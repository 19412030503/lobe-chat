import debug from 'debug';
import { ModelProvider } from 'model-bank';

import {
  CreateImageOptions,
  OpenAICompatibleFactoryOptions,
  createOpenAICompatibleRuntime,
} from '../../core/openaiCompatibleFactory';
import {
  Convert3DModelPayload,
  Convert3DModelResponse,
  Create3DModelPayload,
  Create3DModelResponse,
} from '../../types';

const runtimeLog = debug('lobe-tripo3d:runtime');
const DEFAULT_BASE_URL = 'https://api.tripo3d.ai/v2/openapi';
const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_POLL_TIMEOUT = 5 * 60 * 1000;
const FINAL_FAILURE_STATUSES = new Set(['failed', 'banned', 'expired', 'cancelled', 'unknown']);

type Tripo3DRuntimeConfig = {
  tripo3dApiKey?: string;
  tripo3dBaseURL?: string;
  tripo3dPollInterval?: number | string;
  tripo3dPollTimeout?: number | string;
};

const MODEL_VERSION_MAP: Record<string, string> = {
  'tripo3d-turbo-v1-20250506': 'Turbo-v1.0-20250506',
  'tripo3d-v1-4-20240625': 'v1.4-20240625',
  'tripo3d-v2-20240919': 'v2.0-20240919',
  'tripo3d-v2-5-20250123': 'v2.5-20250123',
  'tripo3d-v3-20250812': 'v3.0-20250812',
};
const DEFAULT_MODEL_VERSION = 'v2.5-20250123';

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const toNumber = (value: number | string | undefined, fallback: number) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const inferFileType = (explicit?: string, url?: string): string | undefined => {
  if (explicit && explicit.toLowerCase() !== 'auto') return explicit.toLowerCase();
  if (!url) return undefined;
  const match = url.toLowerCase().match(/\.([\da-z]+)(?:\?|#|$)/);
  if (match && ['jpg', 'jpeg', 'png', 'webp'].includes(match[1])) {
    return match[1] === 'jpeg' ? 'jpg' : match[1];
  }
  return undefined;
};

const valueToArray = (entry: any): any[] => {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  return [entry];
};

const resolveUrlFromEntry = (entry: any): string | undefined => {
  if (!entry) return undefined;
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry)) return resolveUrlFromEntry(entry[0]);
  if (typeof entry === 'object') {
    return (
      entry.url || entry.uri || entry.downloadUrl || entry.download_url || entry.href || undefined
    );
  }
  return undefined;
};

const resolveFormatFromEntry = (entry: any, fallbackUrl?: string): string | undefined => {
  if (!entry) {
    if (!fallbackUrl) return undefined;
    const extension = fallbackUrl.split('?')[0].split('#')[0].split('.').pop();
    return extension ? extension.toUpperCase() : undefined;
  }

  if (typeof entry === 'string') {
    const extension = entry.split('?')[0].split('#')[0].split('.').pop();
    return extension ? extension.toUpperCase() : undefined;
  }

  if (Array.isArray(entry)) {
    return resolveFormatFromEntry(entry[0], fallbackUrl);
  }

  const explicit =
    entry.format ||
    entry.ext ||
    entry.extension ||
    entry.type ||
    (typeof entry.mime === 'string' ? entry.mime.split('/').pop() : undefined);
  if (explicit && typeof explicit === 'string') {
    return explicit.toUpperCase();
  }

  return resolveFormatFromEntry(entry.url || entry.uri || entry.downloadUrl, fallbackUrl);
};

const resolvePreviewUrl = (output: any): string | undefined => {
  if (!output) return undefined;
  if (output.previewUrl) return resolveUrlFromEntry(output.previewUrl);
  if (output.preview) return resolveUrlFromEntry(output.preview);
  const renderedImages = valueToArray(output.rendered_image || output.renderedImages);
  return resolveUrlFromEntry(renderedImages[0]);
};

const extractModelUrl = (
  output: any,
  preferredFormat?: string,
): { format?: string; url: string } => {
  if (!output) {
    throw new Error('Tripo 3D returned empty output payload');
  }

  const preferredOrder = ['model', 'pbr_model', 'base_model'];
  const normalizedPreference = preferredFormat?.toUpperCase();
  const evaluatedEntries: Array<{ format?: string; url: string }> = [];

  for (const key of preferredOrder) {
    if (output[key]) {
      const url = resolveUrlFromEntry(output[key]);
      if (url) {
        const format = resolveFormatFromEntry(output[key], url);
        if (normalizedPreference && format === normalizedPreference) {
          return { format, url };
        }
        evaluatedEntries.push({ format, url });
      }
    }
  }

  for (const key of Object.keys(output)) {
    const candidate = resolveUrlFromEntry(output[key]);
    if (candidate) {
      const format = resolveFormatFromEntry(output[key], candidate);
      if (normalizedPreference && format === normalizedPreference) {
        return { format, url: candidate };
      }
      evaluatedEntries.push({ format, url: candidate });
    }
  }

  if (evaluatedEntries.length > 0) {
    return evaluatedEntries[0];
  }

  throw new Error('Tripo 3D task returned success but no downloadable model URL');
};

const buildAuthHeaders = (apiKey: string) => ({
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

const OPTIONAL_PARAM_MAP: Array<[string, string]> = [
  ['modelSeed', 'model_seed'],
  ['faceLimit', 'face_limit'],
  ['texture', 'texture'],
  ['pbr', 'pbr'],
  ['textureSeed', 'texture_seed'],
  ['textureAlignment', 'texture_alignment'],
  ['textureQuality', 'texture_quality'],
  ['autoSize', 'auto_size'],
  ['style', 'style'],
  ['orientation', 'orientation'],
  ['quad', 'quad'],
  ['compress', 'compress'],
  ['smartLowPoly', 'smart_low_poly'],
  ['generateParts', 'generate_parts'],
  ['geometryQuality', 'geometry_quality'],
  ['negativePrompt', 'negative_prompt'],
  ['imageSeed', 'image_seed'],
];

type Tripo3DConvertParams = {
  animateInPlace?: boolean;
  bake?: boolean;
  exportOrientation?: string;
  exportVertexColors?: boolean;
  faceLimit?: number;
  fbxPreset?: string;
  flattenBottom?: boolean;
  flattenBottomThreshold?: number;
  forceSymmetry?: boolean;
  format: string;
  originalTaskId?: string;
  packUv?: boolean;
  partNames?: string[];
  pivotToCenterBottom?: boolean;
  quad?: boolean;
  scaleFactor?: number;
  textureFormat?: string;
  textureSize?: number;
  withAnimation?: boolean;
};

const CONVERT_PARAM_MAP: Array<[keyof Tripo3DConvertParams, string]> = [
  ['quad', 'quad'],
  ['forceSymmetry', 'force_symmetry'],
  ['faceLimit', 'face_limit'],
  ['flattenBottom', 'flatten_bottom'],
  ['flattenBottomThreshold', 'flatten_bottom_threshold'],
  ['textureSize', 'texture_size'],
  ['textureFormat', 'texture_format'],
  ['pivotToCenterBottom', 'pivot_to_center_bottom'],
  ['scaleFactor', 'scale_factor'],
  ['withAnimation', 'with_animation'],
  ['packUv', 'pack_uv'],
  ['bake', 'bake'],
  ['animateInPlace', 'animate_in_place'],
  ['exportVertexColors', 'export_vertex_colors'],
  ['exportOrientation', 'export_orientation'],
  ['fbxPreset', 'fbx_preset'],
];

type SubmitTaskOptions = {
  apiKey: string;
  baseURL: string;
  body: Record<string, any>;
};

type PollTaskOptions = {
  apiKey: string;
  baseURL: string;
  pollInterval: number;
  pollTimeout: number;
  preferredFormat?: string;
  taskId: string;
};

type PollTaskResult = {
  format?: string;
  modelUrl: string;
  modelUsage?: Create3DModelResponse['modelUsage'];
  output?: any;
  previewUrl?: string;
};

const submitTask = async ({ apiKey, baseURL, body }: SubmitTaskOptions): Promise<string> => {
  const response = await fetch(`${baseURL}/task`, {
    body: JSON.stringify(body),
    headers: buildAuthHeaders(apiKey),
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Tripo 3D task submission failed: ${message || response.statusText}`);
  }

  const json: any = await response.json();
  if (json?.code !== 0) {
    throw new Error(`Tripo 3D task submission failed: ${json?.message || 'Unknown error'}`);
  }

  const taskId: string | undefined = json?.data?.task_id;
  if (!taskId) {
    throw new Error('Tripo 3D submission succeeded but no task_id was returned');
  }

  return taskId;
};

const pollTask = async ({
  apiKey,
  baseURL,
  pollInterval,
  pollTimeout,
  preferredFormat,
  taskId,
}: PollTaskOptions): Promise<PollTaskResult> => {
  const pollEndpoint = `${baseURL}/task/${taskId}`;
  const startTime = Date.now();

  runtimeLog(
    'Polling Tripo 3D task %s (interval=%d timeout=%d)',
    taskId,
    pollInterval,
    pollTimeout,
  );

  while (Date.now() - startTime <= pollTimeout) {
    const pollResponse = await fetch(pollEndpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: 'GET',
    });

    if (!pollResponse.ok) {
      const message = await pollResponse.text();
      throw new Error(
        `Tripo 3D task ${taskId} query failed: ${message || pollResponse.statusText}`,
      );
    }

    const pollJson: any = await pollResponse.json();
    if (pollJson?.code !== 0) {
      throw new Error(
        `Tripo 3D task ${taskId} query failed: ${pollJson?.message || 'Unknown error'}`,
      );
    }

    const data = pollJson?.data;
    const status: string = (data?.status || '').toLowerCase();

    runtimeLog('Tripo 3D task %s status=%s progress=%s', taskId, status, data?.progress ?? 0);

    if (status === 'success') {
      const { url: modelUrl, format } = extractModelUrl(data?.output, preferredFormat);
      const previewUrl = resolvePreviewUrl(data?.output);
      const modelUsage = data?.output?.model_usage;

      return {
        format: format ?? preferredFormat,
        modelUrl,
        modelUsage,
        output: data?.output,
        previewUrl,
      };
    }

    if (FINAL_FAILURE_STATUSES.has(status)) {
      const message =
        data?.output?.message ||
        data?.message ||
        `Tripo 3D task ${taskId} failed with status ${status}`;
      throw new Error(message);
    }

    await wait(pollInterval);
  }

  throw new Error(`Tripo 3D task ${taskId} polling timed out after ${pollTimeout}ms`);
};

const create3DModel = async (
  payload: Create3DModelPayload,
  options: CreateImageOptions & Tripo3DRuntimeConfig,
): Promise<Create3DModelResponse> => {
  const apiKey = options.tripo3dApiKey ?? options.apiKey;
  if (!apiKey) {
    throw new Error('Missing Tripo 3D API key');
  }

  const baseURL = trimTrailingSlash(options.tripo3dBaseURL ?? options.baseURL ?? DEFAULT_BASE_URL);
  const { params } = payload;
  const modelVersion = MODEL_VERSION_MAP[payload.model] ?? DEFAULT_MODEL_VERSION;

  const prompt = typeof params?.prompt === 'string' ? params.prompt.trim() : '';
  const negativePrompt =
    typeof params?.negativePrompt === 'string' ? params.negativePrompt.trim() : '';
  const imageToken =
    typeof (params as any)?.imageToken === 'string' ? (params as any).imageToken.trim() : '';
  const imageUrl =
    typeof (params as any)?.imageUrl === 'string' ? (params as any).imageUrl.trim() : '';
  const explicitFileType =
    typeof (params as any)?.imageFileType === 'string'
      ? (params as any).imageFileType.trim().toLowerCase()
      : undefined;
  const preferredFormat =
    typeof (params as any)?.resultFormat === 'string'
      ? (params as any).resultFormat.trim().toUpperCase()
      : undefined;

  const isImageTask = Boolean(imageToken) || Boolean(imageUrl);
  const taskType = isImageTask ? 'image_to_model' : 'text_to_model';

  if (taskType === 'text_to_model' && !prompt) {
    throw new Error('Tripo 3D text_to_model requires a prompt');
  }

  if (taskType === 'image_to_model' && !imageToken && !imageUrl) {
    throw new Error('Tripo 3D image_to_model requires imageUrl or imageToken');
  }

  const requestBody: Record<string, any> = {
    model_version: modelVersion,
    type: taskType,
  };

  if (prompt) {
    requestBody.prompt = prompt;
  }
  if (negativePrompt) {
    requestBody.negative_prompt = negativePrompt;
  }

  for (const [camelKey, apiKeyName] of OPTIONAL_PARAM_MAP) {
    const value = (params as any)?.[camelKey];
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed.length) continue;
      requestBody[apiKeyName] = trimmed;
      continue;
    }

    requestBody[apiKeyName] = value;
  }

  if (requestBody.generate_parts) {
    requestBody.texture = false;
    requestBody.pbr = false;
    requestBody.quad = false;
  }

  if (taskType === 'image_to_model') {
    const fileType = inferFileType(explicitFileType, imageUrl);
    if (!fileType && !imageToken) {
      throw new Error('Tripo 3D image_to_model requires a valid image type or uploaded token');
    }
    const filePayload: Record<string, any> = {};
    if (fileType) filePayload.type = fileType;
    if (imageToken) filePayload.file_token = imageToken;
    if (imageUrl) filePayload.url = imageUrl;

    requestBody.file = filePayload;
  }

  runtimeLog(
    'Submitting Tripo 3D job version=%s type=%s payload=%O',
    modelVersion,
    taskType,
    requestBody,
  );

  const taskId = await submitTask({
    apiKey,
    baseURL,
    body: requestBody,
  });

  const pollInterval = toNumber(options.tripo3dPollInterval, DEFAULT_POLL_INTERVAL);
  const pollTimeout = toNumber(options.tripo3dPollTimeout, DEFAULT_POLL_TIMEOUT);

  const result = await pollTask({
    apiKey,
    baseURL,
    pollInterval,
    pollTimeout,
    preferredFormat,
    taskId,
  });

  runtimeLog(
    'Tripo 3D generation %s completed (format=%s hasPreview=%s)',
    taskId,
    result.format ?? preferredFormat ?? 'GLB',
    Boolean(result.previewUrl),
  );

  return {
    format: result.format ?? 'GLB',
    jobId: taskId,
    modelUrl: result.modelUrl,
    modelUsage: result.modelUsage,
    previewUrl: result.previewUrl,
  };
};

const convert3DModel = async (
  payload: Convert3DModelPayload,
  options: CreateImageOptions & Tripo3DRuntimeConfig,
): Promise<Convert3DModelResponse> => {
  const apiKey = options.tripo3dApiKey ?? options.apiKey;
  if (!apiKey) {
    throw new Error('Missing Tripo 3D API key');
  }

  const baseURL = trimTrailingSlash(options.tripo3dBaseURL ?? options.baseURL ?? DEFAULT_BASE_URL);
  const params = (payload.params ?? {}) as Tripo3DConvertParams;

  const rawFormat = typeof params.format === 'string' ? params.format.trim() : '';
  if (!rawFormat) {
    throw new Error('Tripo 3D convert_model requires a target format');
  }
  const targetFormat = rawFormat.toUpperCase();

  const originalTaskId = (payload.originalTaskId || params.originalTaskId || '').trim();
  if (!originalTaskId) {
    throw new Error('Tripo 3D convert_model requires the original task id');
  }

  const requestBody: Record<string, any> = {
    format: targetFormat,
    original_model_task_id: originalTaskId,
    type: 'convert_model',
  };

  for (const [camelKey, apiKeyName] of CONVERT_PARAM_MAP) {
    const value = params[camelKey];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      requestBody[apiKeyName] = value;
      continue;
    }

    requestBody[apiKeyName] = value;
  }

  if (Array.isArray(params.partNames) && params.partNames.length > 0) {
    requestBody.part_names = params.partNames;
  }

  runtimeLog(
    'Submitting Tripo 3D conversion originalTask=%s format=%s payload=%O',
    originalTaskId,
    targetFormat,
    requestBody,
  );

  const taskId = await submitTask({
    apiKey,
    baseURL,
    body: requestBody,
  });

  const pollInterval = toNumber(options.tripo3dPollInterval, DEFAULT_POLL_INTERVAL);
  const pollTimeout = toNumber(options.tripo3dPollTimeout, DEFAULT_POLL_TIMEOUT);

  const result = await pollTask({
    apiKey,
    baseURL,
    pollInterval,
    pollTimeout,
    preferredFormat: targetFormat,
    taskId,
  });

  runtimeLog(
    'Tripo 3D conversion %s completed (format=%s hasPreview=%s)',
    taskId,
    result.format ?? targetFormat,
    Boolean(result.previewUrl),
  );

  return {
    format: result.format ?? targetFormat,
    jobId: taskId,
    modelUrl: result.modelUrl,
    modelUsage: result.modelUsage,
    previewUrl: result.previewUrl,
  };
};

export const params = {
  baseURL: DEFAULT_BASE_URL,
  convert3DModel,
  create3DModel,
  provider: ModelProvider.Tripo3D,
} satisfies OpenAICompatibleFactoryOptions<Tripo3DRuntimeConfig>;

export const LobeTripo3DAI = createOpenAICompatibleRuntime(params);
