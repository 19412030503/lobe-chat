import { GenerationTopicItem } from '@/database/schemas';
import { lambdaClient } from '@/libs/trpc/client';
import { UpdateTopicValue } from '@/server/routers/lambda/generationTopic';
import { GenerationContentType, ImageGenerationTopic } from '@/types/generation';

export class ServerService {
  async getAllGenerationTopics(params?: {
    type?: GenerationContentType;
  }): Promise<ImageGenerationTopic[]> {
    const type = params?.type ?? 'image';
    return lambdaClient.generationTopic.getAllGenerationTopics.query({ type });
  }

  async createTopic(params?: { title?: string; type?: GenerationContentType }): Promise<string> {
    const type = params?.type ?? 'image';
    const payload: { title?: string; type: GenerationContentType } = { type };
    if (params?.title !== undefined) {
      payload.title = params.title;
    }
    return lambdaClient.generationTopic.createTopic.mutate(payload);
  }

  async updateTopic(id: string, data: UpdateTopicValue): Promise<GenerationTopicItem | undefined> {
    return lambdaClient.generationTopic.updateTopic.mutate({ id, value: data });
  }

  async updateTopicCover(id: string, coverUrl: string): Promise<GenerationTopicItem | undefined> {
    return lambdaClient.generationTopic.updateTopicCover.mutate({ coverUrl, id });
  }

  async deleteTopic(id: string): Promise<GenerationTopicItem | undefined> {
    return lambdaClient.generationTopic.deleteTopic.mutate({ id });
  }
}

export const generationTopicService = new ServerService();
