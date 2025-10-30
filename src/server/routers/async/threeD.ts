import { AgentRuntimeErrorType } from '@lobechat/model-runtime';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@lobechat/types';
import debug from 'debug';
import { Runtime3DGenParams } from 'model-bank';
import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { z } from 'zod';

import { ASYNC_TASK_TIMEOUT, AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { asyncAuthedProcedure, asyncRouter as router } from '@/libs/trpc/async';
import { initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { FileService } from '@/server/services/file';
import { FileSource } from '@/types/files';

const log = debug('lobe-threed:async');

const MODEL_STORAGE_PREFIX = 'generations/threeD';
const MODEL_PREVIEW_STORAGE_PREFIX = 'generations/threeD/previews';

const MODEL_MIME_MAP: Record<string, string> = {
  fbx: 'model/vnd.autodesk.fbx',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  obj: 'model/obj',
  ply: 'application/octet-stream',
  stl: 'model/stl',
  usdz: 'model/vnd.usdz+zip',
  zip: 'application/zip',
};

const resolveExtensionFromUrl = (url: string | undefined, fallback: string) => {
  if (!url) return fallback.toLowerCase();
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || '';
    const ext = extname(pathname).toLowerCase().replace(/^\./, '');
    return ext || fallback.toLowerCase();
  } catch {
    return fallback.toLowerCase();
  }
};

const resolveModelMime = (extension: string) =>
  MODEL_MIME_MAP[extension.toLowerCase()] || 'application/octet-stream';

const sanitizeFilename = (value: string, fallback: string) => {
  const sanitized = value
    .replaceAll(/[^\w.-]+/g, '_')
    .replaceAll(/_{2,}/g, '_')
    .trim();
  return sanitized ? sanitized.slice(0, 64) : fallback;
};

const downloadAsBuffer = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const threeDProcedure = asyncAuthedProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      fileService: new FileService(ctx.serverDB, ctx.userId),
      generationModel: new GenerationModel(ctx.serverDB, ctx.userId),
    },
  });
});

const createThreeDInputSchema = z.object({
  generationId: z.string(),
  model: z.string(),
  params: z
    .object({
      prompt: z.string().optional(),
    })
    .passthrough(),
  provider: z.string(),
  taskId: z.string(),
});

const convertThreeDInputSchema = z.object({
  generationId: z.string(),
  model: z.string(),
  originalTaskId: z.string(),
  params: z
    .object({
      format: z.string(),
    })
    .passthrough(),
  provider: z.string(),
  sourceGenerationId: z.string(),
  taskId: z.string(),
});

const categorizeError = (
  error: any,
  isAborted: boolean,
): { errorMessage: string; errorType: AsyncTaskErrorType } => {
  if (error.errorType === AgentRuntimeErrorType.InvalidProviderAPIKey || error?.status === 401) {
    return {
      errorMessage: 'Invalid provider API key, please check your API key',
      errorType: AsyncTaskErrorType.InvalidProviderAPIKey,
    };
  }

  if (error instanceof AsyncTaskError) {
    return {
      errorMessage: typeof error.body === 'string' ? error.body : error.body.detail,
      errorType: error.name as AsyncTaskErrorType,
    };
  }

  if (isAborted || error.message?.includes('aborted')) {
    return {
      errorMessage: '3D generation task timed out, please try again',
      errorType: AsyncTaskErrorType.Timeout,
    };
  }

  if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
    return {
      errorMessage: '3D generation task timed out, please try again',
      errorType: AsyncTaskErrorType.Timeout,
    };
  }

  if (error.message?.includes('network') || error.name === 'NetworkError') {
    return {
      errorMessage: error.message || 'Network error occurred during 3D generation',
      errorType: AsyncTaskErrorType.ServerError,
    };
  }

  return {
    errorMessage: error.message || 'Unknown error occurred during 3D generation',
    errorType: AsyncTaskErrorType.ServerError,
  };
};

export const threeDRouter = router({
  convertModel: threeDProcedure.input(convertThreeDInputSchema).mutation(async ({ input, ctx }) => {
    const { taskId, generationId, provider, model, params, originalTaskId, sourceGenerationId } =
      input;

    log('Starting async 3D conversion: %O', {
      generationId,
      model,
      originalTaskId,
      provider,
      sourceGenerationId,
      taskId,
    });

    await ctx.asyncTaskModel.update(taskId, { status: AsyncTaskStatus.Processing });

    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const run = async (signal: AbortSignal) => {
        const sourceGeneration = await ctx.generationModel.findById(sourceGenerationId);
        if (!sourceGeneration) {
          throw new Error(`Source generation ${sourceGenerationId} not found for conversion`);
        }

        log('Initializing model runtime for provider=%s', provider);
        const runtime = await initModelRuntimeWithUserPayload(provider, ctx.jwtPayload);

        if (!runtime.convert3DModel) {
          throw new Error('Provider does not support 3D conversion');
        }

        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        log('Invoking runtime.convert3DModel for generation %s', generationId);
        const response = await runtime.convert3DModel({
          model,
          originalTaskId,
          params: {
            ...params,
            originalTaskId,
          },
        });

        if (!response || !response.modelUrl) {
          throw new Error('Convert 3D model response missing modelUrl');
        }

        log('3D conversion response: %O', {
          format: response.format,
          hasModelUrl: Boolean(response.modelUrl),
          hasPreview: Boolean(response.previewUrl),
          jobId: response.jobId,
        });

        const modelExtension = resolveExtensionFromUrl(response.modelUrl, response.format || 'bin');
        log('Resolved conversion model extension %s, downloading asset', modelExtension);
        const modelBuffer = await downloadAsBuffer(response.modelUrl, signal);

        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        log('Uploading converted model buffer (size=%d bytes)', modelBuffer.length);
        const modelContentType = resolveModelMime(modelExtension);
        const modelKey = `${MODEL_STORAGE_PREFIX}/${nanoid()}.${modelExtension}`;
        const uploadedModel = await ctx.fileService.uploadMedia(
          modelKey,
          modelBuffer,
          modelContentType,
        );
        log('Converted model stored at key %s', uploadedModel.key);

        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        let previewKey: string | undefined;
        if (response.previewUrl) {
          try {
            const previewExt = resolveExtensionFromUrl(response.previewUrl, 'png');
            log('Downloading conversion preview asset (ext=%s)', previewExt);
            const previewBuffer = await downloadAsBuffer(response.previewUrl, signal);
            const previewKeyPath = `${MODEL_PREVIEW_STORAGE_PREFIX}/${nanoid()}.${previewExt}`;
            const uploadResult = await ctx.fileService.uploadMedia(
              previewKeyPath,
              previewBuffer,
              'image/png',
            );
            previewKey = uploadResult.key;
            log('Conversion preview stored at key %s', previewKey);
            if (signal.aborted) {
              throw new Error('Operation was aborted');
            }
          } catch (error) {
            log('Failed to process conversion preview resource: %O', error);
          }
        }

        const modelHash = createHash('sha256').update(modelBuffer).digest('hex');
        const conversionParams = structuredClone(params);
        if (conversionParams && typeof conversionParams === 'object') {
          delete conversionParams.originalTaskId;
        }
        const sourceAsset = sourceGeneration.asset as Record<string, any> | null;
        const sourceFormat =
          sourceAsset && typeof sourceAsset.format === 'string'
            ? (sourceAsset.format as string)
            : undefined;
        const promptSnippet = 'threeD-conversion';
        const fileName = `${sanitizeFilename(promptSnippet, 'threeD-conversion')}-${nanoid()}.${modelExtension}`;

        const asset: {
          conversion?: {
            originalTaskId: string;
            params: Record<string, any>;
            sourceFormat?: string;
            sourceGenerationId: string;
          };
          format?: string;
          jobId?: string;
          modelUrl: string;
          previewThumbnailUrl?: string;
          previewUrl?: string;
          type: 'threeD';
        } = {
          conversion: {
            originalTaskId,
            params: conversionParams,
            sourceFormat,
            sourceGenerationId,
          },
          format: response.format ?? modelExtension.toUpperCase(),
          modelUrl: uploadedModel.key,
          type: 'threeD',
        };

        if (previewKey) {
          asset.previewUrl = previewKey;
          asset.previewThumbnailUrl = previewKey;
        }

        if (response.jobId) {
          asset.jobId = response.jobId;
        }

        await ctx.generationModel.createAssetAndFile(
          generationId,
          asset,
          {
            fileHash: modelHash,
            fileType: modelContentType,
            metadata: {
              conversion: asset.conversion,
              format: response.format,
              jobId: response.jobId,
              originalTaskId,
              originalUrl: response.modelUrl,
              previewStoredKey: previewKey,
              provider,
              size: modelBuffer.length,
            },
            name: fileName,
            size: modelBuffer.length,
            url: uploadedModel.key,
          },
          FileSource.ThreeDGeneration,
        );
        log('Persisted conversion asset for %s (taskId=%s)', generationId, taskId);
        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        await ctx.asyncTaskModel.update(taskId, {
          status: AsyncTaskStatus.Success,
        });
        log('Conversion async task %s marked as success', taskId);

        return { success: true };
      };

      timeoutId = setTimeout(() => {
        log('3D conversion task timeout, aborting: %s', taskId);
        abortController.abort();
      }, ASYNC_TASK_TIMEOUT);

      const result = await run(abortController.signal);

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      return result;
    } catch (error: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      log('Async 3D conversion task failed: %O', {
        error: error.message || error,
        generationId,
        sourceGenerationId,
        taskId,
      });

      const { errorType, errorMessage } = categorizeError(error, abortController.signal.aborted);

      await ctx.asyncTaskModel.update(taskId, {
        error: new AsyncTaskError(errorType, errorMessage),
        status: AsyncTaskStatus.Error,
      });

      return {
        message: `3D conversion ${taskId} failed: ${errorMessage}`,
        success: false,
      };
    }
  }),
  createModel: threeDProcedure.input(createThreeDInputSchema).mutation(async ({ input, ctx }) => {
    const { taskId, generationId, provider, model, params } = input;

    log('Starting async 3D generation: %O', {
      generationId,
      model,
      provider,
      taskId,
    });

    await ctx.asyncTaskModel.update(taskId, { status: AsyncTaskStatus.Processing });

    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const run = async (signal: AbortSignal) => {
        log('Initializing model runtime for provider=%s', provider);
        const runtime = await initModelRuntimeWithUserPayload(provider, ctx.jwtPayload);

        if (!runtime.create3DModel) {
          throw new Error('Provider does not support 3D generation');
        }

        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        log('Invoking runtime.create3DModel for generation %s', generationId);
        const response = await runtime.create3DModel({
          model,
          params: params as Runtime3DGenParams,
        });

        if (!response || !response.modelUrl) {
          throw new Error('Create 3D model response missing modelUrl');
        }

        log('3D generation response: %O', {
          format: response.format,
          hasModelUrl: Boolean(response.modelUrl),
          hasPreview: Boolean(response.previewUrl),
          jobId: response.jobId,
        });

        const modelExtension = resolveExtensionFromUrl(response.modelUrl, response.format || 'bin');
        log('Resolved model extension %s, downloading asset', modelExtension);
        const modelBuffer = await downloadAsBuffer(response.modelUrl, signal);

        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        log('Uploading model buffer (size=%d bytes)', modelBuffer.length);
        const modelContentType = resolveModelMime(modelExtension);
        const modelKey = `${MODEL_STORAGE_PREFIX}/${nanoid()}.${modelExtension}`;
        const uploadedModel = await ctx.fileService.uploadMedia(
          modelKey,
          modelBuffer,
          modelContentType,
        );
        log('Model stored at key %s', uploadedModel.key);

        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        let previewKey: string | undefined;
        if (response.previewUrl) {
          try {
            const previewExt = resolveExtensionFromUrl(response.previewUrl, 'png');
            log('Downloading preview asset (ext=%s)', previewExt);
            const previewBuffer = await downloadAsBuffer(response.previewUrl, signal);
            const previewKeyPath = `${MODEL_PREVIEW_STORAGE_PREFIX}/${nanoid()}.${previewExt}`;
            const uploadResult = await ctx.fileService.uploadMedia(
              previewKeyPath,
              previewBuffer,
              'image/png',
            );
            previewKey = uploadResult.key;
            log('Preview stored at key %s', previewKey);
            if (signal.aborted) {
              throw new Error('Operation was aborted');
            }
          } catch (error) {
            log('Failed to process preview resource: %O', error);
          }
        }

        const modelHash = createHash('sha256').update(modelBuffer).digest('hex');
        const promptSnippet = typeof params.prompt === 'string' ? params.prompt : '';
        const fileName = `${sanitizeFilename(promptSnippet, 'threeD-model')}-${nanoid()}.${modelExtension}`;

        const asset: {
          format?: string;
          jobId?: string;
          modelUrl: string;
          modelUsage?: unknown;
          previewThumbnailUrl?: string;
          previewUrl?: string;
          type: 'threeD';
        } = {
          format: response.format ?? modelExtension.toUpperCase(),
          modelUrl: uploadedModel.key,
          type: 'threeD',
        };

        if (previewKey) {
          asset.previewUrl = previewKey;
          asset.previewThumbnailUrl = previewKey;
        }

        if (response.modelUsage) {
          asset.modelUsage = response.modelUsage;
        }

        if (response.jobId) {
          asset.jobId = response.jobId;
        }

        await ctx.generationModel.createAssetAndFile(
          generationId,
          asset,
          {
            fileHash: modelHash,
            fileType: modelContentType,
            metadata: {
              format: response.format,
              jobId: response.jobId,
              originalUrl: response.modelUrl,
              previewStoredKey: previewKey,
              provider,
              size: modelBuffer.length,
            },
            name: fileName,
            size: modelBuffer.length,
            url: uploadedModel.key,
          },
          FileSource.ThreeDGeneration,
        );
        log('Persisted generation asset for %s (taskId=%s)', generationId, taskId);
        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

        await ctx.asyncTaskModel.update(taskId, {
          status: AsyncTaskStatus.Success,
        });
        log('Async task %s marked as success', taskId);

        return { success: true };
      };

      timeoutId = setTimeout(() => {
        log('3D task timeout, aborting: %s', taskId);
        abortController.abort();
      }, ASYNC_TASK_TIMEOUT);

      const result = await run(abortController.signal);

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      return result;
    } catch (error: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      log('Async 3D task failed: %O', {
        error: error.message || error,
        generationId,
        taskId,
      });

      const { errorType, errorMessage } = categorizeError(error, abortController.signal.aborted);

      await ctx.asyncTaskModel.update(taskId, {
        error: new AsyncTaskError(errorType, errorMessage),
        status: AsyncTaskStatus.Error,
      });

      return {
        message: `3D generation ${taskId} failed: ${errorMessage}`,
        success: false,
      };
    }
  }),
});
