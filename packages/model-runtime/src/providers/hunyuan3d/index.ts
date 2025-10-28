import debug from 'debug';
import { ModelProvider } from 'model-bank';

import {
  CreateImageOptions,
  OpenAICompatibleFactoryOptions,
  createOpenAICompatibleRuntime,
} from '../../core/openaiCompatibleFactory';
import { Create3DModelPayload, Create3DModelResponse } from '../../types';
import { createTencentCloudCaller } from './tencentCloud';

const runtimeLog = debug('lobe-hunyuan3d:runtime');

const MODEL_ACTION_MAP: Record<string, { query: string; submit: string }> = {
  'hunyuan-3d-pro': {
    query: 'QueryHunyuanTo3DProJob',
    submit: 'SubmitHunyuanTo3DProJob',
  },
  'hunyuan-3d-rapid': {
    query: 'QueryHunyuanTo3DRapidJob',
    submit: 'SubmitHunyuanTo3DRapidJob',
  },
  'hunyuan-3d-standard': {
    query: 'QueryHunyuanTo3DJob',
    submit: 'SubmitHunyuanTo3DJob',
  },
};

const DEFAULT_MODEL_ACTIONS = MODEL_ACTION_MAP['hunyuan-3d-standard'];

type Hunyuan3DRuntimeConfig = {
  hunyuan3dEndpoint?: string;
  hunyuan3dPollInterval?: number | string;
  hunyuan3dPollTimeout?: number | string;
  hunyuan3dRegion?: string;
  hunyuan3dSecretId?: string;
  hunyuan3dSecretKey?: string;
  hunyuan3dVersion?: string;
};

const create3DModel = async (
  payload: Create3DModelPayload,
  options: CreateImageOptions & Hunyuan3DRuntimeConfig,
): Promise<Create3DModelResponse> => {
  const caller = createTencentCloudCaller({
    apiKey: options.hunyuan3dSecretKey ?? options.apiKey,
    baseURL: options.hunyuan3dEndpoint ?? options.baseURL ?? undefined,
    pollInterval: options.hunyuan3dPollInterval,
    pollTimeout: options.hunyuan3dPollTimeout,
    region: options.hunyuan3dRegion,
    secretId: options.hunyuan3dSecretId,
    secretKey: options.hunyuan3dSecretKey ?? options.apiKey,
    version: options.hunyuan3dVersion,
  });
  const { model, params } = payload;
  const modelActions = MODEL_ACTION_MAP[model] ?? DEFAULT_MODEL_ACTIONS;
  const submitAction = modelActions.submit;
  const queryAction = modelActions.query;

  const requestBody: Record<string, any> = {};
  const prompt = typeof params?.prompt === 'string' ? params.prompt.trim() : undefined;
  const imageUrl = typeof params?.imageUrl === 'string' ? params.imageUrl.trim() : undefined;
  const imageBase64 =
    typeof (params as any)?.imageBase64 === 'string'
      ? (params as any).imageBase64.trim()
      : undefined;
  const multiViewImages = Array.isArray((params as any)?.multiViewImages)
    ? (params as any).multiViewImages
    : undefined;
  const generateType =
    typeof (params as any)?.generateType === 'string' ? (params as any).generateType : undefined;
  const allowPromptWithImages = generateType?.toLowerCase() === 'sketch';

  if (prompt) {
    requestBody.Prompt = prompt;
  }

  const allowImageFields = !prompt || allowPromptWithImages;

  if (allowImageFields && imageBase64) {
    requestBody.ImageBase64 = imageBase64;
  }

  if (allowImageFields && imageUrl) {
    requestBody.ImageUrl = imageUrl;
  }

  if (allowImageFields && multiViewImages?.length) {
    requestBody.MultiViewImages = multiViewImages;
  }

  if (submitAction === 'SubmitHunyuanTo3DRapidJob' && requestBody.MultiViewImages) {
    const multiViewCount = Array.isArray(requestBody.MultiViewImages)
      ? requestBody.MultiViewImages.length
      : 0;
    runtimeLog(
      'Rapid edition does not support multi view images, dropping %d references',
      multiViewCount,
    );
    delete requestBody.MultiViewImages;
  }

  const enablePBR = (params as any)?.enablePBR;
  if (typeof enablePBR === 'boolean') {
    requestBody.EnablePBR = enablePBR;
  }

  const faceCount = (params as any)?.faceCount;
  if (typeof faceCount === 'number') {
    requestBody.FaceCount = faceCount;
  }

  if (generateType) {
    requestBody.GenerateType = generateType;
  }

  const polygonType = (params as any)?.polygonType;
  if (polygonType) {
    requestBody.PolygonType = polygonType;
  }

  const resultFormat = (params as any)?.resultFormat;
  if (typeof resultFormat === 'string' && resultFormat.trim()) {
    requestBody.ResultFormat = resultFormat.trim().toUpperCase();
  }

  if (
    !requestBody.Prompt &&
    !requestBody.ImageUrl &&
    !requestBody.ImageBase64 &&
    !requestBody.MultiViewImages
  ) {
    throw new Error('Hunyuan 3D requires a prompt or reference image');
  }

  runtimeLog(
    'Submitting 3D job via %s (prompt=%s, imageUrl=%s, imageBase64=%s, multiView=%d, generateType=%s)',
    submitAction,
    Boolean(requestBody.Prompt),
    Boolean(requestBody.ImageUrl),
    Boolean(requestBody.ImageBase64),
    Array.isArray(requestBody.MultiViewImages) ? requestBody.MultiViewImages.length : 0,
    requestBody.GenerateType ?? 'Normal',
  );

  const submitResponse = await caller.call(submitAction, requestBody);
  const jobId = submitResponse?.Response?.JobId;

  if (!jobId) {
    throw new Error(`Tencent Cloud ${submitAction} did not return a JobId`);
  }

  runtimeLog('Tencent Cloud accepted job %s via %s', jobId, submitAction);

  const result = await caller.waitForJob(jobId, queryAction);
  if (!result.modelUrl || typeof result.modelUrl !== 'string') {
    throw new Error(`Tencent Cloud job ${jobId} returned DONE status but no model file`);
  }
  runtimeLog(
    'Job %s completed (format=%s, hasPreview=%s, modelUsage=%s)',
    jobId,
    result.format ?? 'unknown',
    Boolean(result.previewUrl),
    result.modelUsage ? 'yes' : 'no',
  );
  return result;
};

export const params = {
  baseURL: 'https://ai3d.tencentcloudapi.com',
  create3DModel,
  provider: ModelProvider.Hunyuan3D,
} satisfies OpenAICompatibleFactoryOptions<Hunyuan3DRuntimeConfig>;

export const LobeHunyuan3DAI = createOpenAICompatibleRuntime(params);
