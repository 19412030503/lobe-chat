import { Runtime3DGenParams } from 'model-bank';

import { ModelUsage } from '@/types/message';

export type Create3DModelPayload = {
  model: string;
  params: Runtime3DGenParams;
};

export type Create3DModelResponse = {
  /**
   * Reported asset format, e.g. glb/obj
   */
  format?: string;
  /**
   * Key or URL referencing the generated 3D asset
   */
  modelUrl: string;
  /**
   * Provider usage metadata if available
   */
  modelUsage?: ModelUsage;
  /**
   * Optional preview URL (image / gif / video)
   */
  previewUrl?: string;
};
