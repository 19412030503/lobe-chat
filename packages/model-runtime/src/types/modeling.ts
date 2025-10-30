import { Runtime3DGenParams } from 'model-bank';

import { ModelUsage } from '@/types/message';

export type Create3DModelPayload = {
  model: string;
  params: Runtime3DGenParams;
};

export type Create3DModelResponse = {
  /**
   * 3D 资产格式，如 GLB/OBJ/FBX
   */
  format?: string;
  /**
   * 服务商返回的任务 ID
   */
  jobId?: string;
  /**
   * 存储生成模型的 URL 或 key
   */
  modelUrl: string;
  /**
   * 服务商返回的用量信息
   */
  modelUsage?: ModelUsage;
  /**
   * 预览资源地址（图片 / GIF / 视频）
   */
  previewUrl?: string;
};

export type Convert3DModelPayload<P extends Record<string, any> = Record<string, any>> = {
  /**
   * 发起转换时使用的模型 ID（用于路由对应的运行时实例）
   */
  model: string;
  /**
   * 原始建模任务 ID，用于部分供应商的转换接口
   */
  originalTaskId?: string;
  /**
   * 供应商特定的转换参数
   */
  params: P;
};

export type Convert3DModelResponse = Create3DModelResponse;
