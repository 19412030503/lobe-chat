import { ModelProvider } from 'model-bank';

import {
  CreateImageOptions,
  OpenAICompatibleFactoryOptions,
  createOpenAICompatibleRuntime,
} from '../../core/openaiCompatibleFactory';
import { Create3DModelPayload, Create3DModelResponse } from '../../types';
import { createTencentCloudCaller } from './tencentCloud';

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
  const { params, model } = payload;

  const requestBody: Record<string, any> = {};
  const imageUrl = params?.imageUrl || (params as any)?.ImageUrl || params?.imageUrls?.[0];
  const prompt = params?.prompt;

  if (imageUrl) requestBody.ImageUrl = imageUrl;
  if (Array.isArray(params?.imageUrls) && params.imageUrls.length > 0) {
    requestBody.ImageUrls = params.imageUrls;
  }
  if (prompt) requestBody.Prompt = prompt;
  if (model) requestBody.ModelId = model;

  if (!requestBody.ImageUrl && !requestBody.Prompt) {
    throw new Error('Hunyuan 3D requires a prompt or reference image');
  }

  const submitResponse = await caller.call('SubmitHunyuanTo3DProJob', requestBody);
  const jobId = submitResponse?.Response?.JobId;

  if (!jobId) {
    throw new Error('Tencent Cloud SubmitHunyuanTo3DProJob did not return a JobId');
  }

  return caller.waitForJob(jobId);
};

export const params = {
  baseURL: 'https://ai3d.tencentcloudapi.com',
  create3DModel,
  provider: ModelProvider.Hunyuan3D,
} satisfies OpenAICompatibleFactoryOptions<Hunyuan3DRuntimeConfig>;

export const LobeHunyuan3DAI = createOpenAICompatibleRuntime(params);
