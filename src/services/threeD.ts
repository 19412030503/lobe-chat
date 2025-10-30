import debug from 'debug';

import { lambdaClient } from '@/libs/trpc/client';
import {
  ConvertThreeDServicePayload,
  CreateThreeDServicePayload,
} from '@/server/routers/lambda/threeD';

const log = debug('lobe-threed:service');

class ThreeDService {
  async createModel(payload: CreateThreeDServicePayload) {
    log('Creating 3D model with payload: %O', payload);

    try {
      const result = await lambdaClient.threeD.createModel.mutate(payload);
      log('3D service call completed successfully: %O', {
        batchId: result.data?.batch?.id,
        generationCount: result.data?.generations?.length,
        success: result.success,
      });

      return result;
    } catch (error) {
      log('3D service call failed: %O', {
        error: (error as Error).message,
        payload,
      });
      throw error;
    }
  }

  async convertModel(payload: ConvertThreeDServicePayload) {
    log('Converting 3D model with payload: %O', payload);

    try {
      const result = await lambdaClient.threeD.convertModel.mutate(payload);
      log('3D conversion call completed successfully: %O', {
        generationId: result.data?.generation?.id,
        success: result.success,
      });

      return result;
    } catch (error) {
      log('3D conversion call failed: %O', {
        error: (error as Error).message,
        payload,
      });
      throw error;
    }
  }
}

export const threeDService = new ThreeDService();
