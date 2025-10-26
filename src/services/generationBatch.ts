import { GenerationBatchItem } from '@/database/schemas';
import { lambdaClient } from '@/libs/trpc/client';
import { Generation, GenerationBatch, GenerationContentType } from '@/types/generation';

type GenerationBatchWithAsyncTaskId = GenerationBatch & {
  generations: (Generation & { asyncTaskId?: string | null })[];
};

class GenerationBatchService {
  /**
   * Get generation batches for a specific topic
   */
  async getGenerationBatches(
    topicId: string,
    type: GenerationContentType = 'image',
  ): Promise<GenerationBatchWithAsyncTaskId[]> {
    return lambdaClient.generationBatch.getGenerationBatches.query({ topicId, type });
  }

  /**
   * Delete a generation batch
   */
  async deleteGenerationBatch(batchId: string): Promise<GenerationBatchItem | undefined> {
    return lambdaClient.generationBatch.deleteGenerationBatch.mutate({ batchId });
  }
}

export const generationBatchService = new GenerationBatchService();
