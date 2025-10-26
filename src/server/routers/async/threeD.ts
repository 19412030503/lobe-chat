import { AgentRuntimeErrorType } from '@lobechat/model-runtime';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@lobechat/types';
import debug from 'debug';
import { Runtime3DGenParams } from 'model-bank';
import { z } from 'zod';

import { ASYNC_TASK_TIMEOUT, AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { asyncAuthedProcedure, asyncRouter as router } from '@/libs/trpc/async';
import { initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';

const log = debug('lobe-threed:async');

const threeDProcedure = asyncAuthedProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      generationModel: new GenerationModel(ctx.serverDB, ctx.userId),
    },
  });
});

const createThreeDInputSchema = z.object({
  generationId: z.string(),
  model: z.string(),
  params: z
    .object({
      prompt: z.string(),
    })
    .passthrough(),
  provider: z.string(),
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
        const runtime = await initModelRuntimeWithUserPayload(provider, ctx.jwtPayload);

        if (!runtime.create3DModel) {
          throw new Error('Provider does not support 3D generation');
        }

        if (signal.aborted) {
          throw new Error('Operation was aborted');
        }

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
        });

        await ctx.generationModel.update(generationId, {
          asset: {
            format: response.format,
            modelUrl: response.modelUrl,
            previewUrl: response.previewUrl,
            type: 'threeD',
          },
        });

        await ctx.asyncTaskModel.update(taskId, {
          status: AsyncTaskStatus.Success,
        });

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
