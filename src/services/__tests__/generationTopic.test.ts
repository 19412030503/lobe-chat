import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { UpdateTopicValue } from '@/server/routers/lambda/generationTopic';

import { ServerService } from '../generationTopic';

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    generationTopic: {
      getAllGenerationTopics: { query: vi.fn() },
      createTopic: { mutate: vi.fn() },
      updateTopic: { mutate: vi.fn() },
      updateTopicCover: { mutate: vi.fn() },
      deleteTopic: { mutate: vi.fn() },
    },
  },
}));

describe('GenerationTopic ServerService', () => {
  let service: ServerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServerService();
  });

  it('getAllGenerationTopics should call lambdaClient with default type', async () => {
    await service.getAllGenerationTopics();
    expect(lambdaClient.generationTopic.getAllGenerationTopics.query).toBeCalledWith({
      type: 'image',
    });
  });

  it('getAllGenerationTopics should forward custom type', async () => {
    await service.getAllGenerationTopics({ type: 'threeD' });
    expect(lambdaClient.generationTopic.getAllGenerationTopics.query).toBeCalledWith({
      type: 'threeD',
    });
  });

  it('createTopic should call lambdaClient with default type', async () => {
    await service.createTopic();
    expect(lambdaClient.generationTopic.createTopic.mutate).toBeCalledWith({ type: 'image' });
  });

  it('createTopic should forward custom params', async () => {
    await service.createTopic({ title: 'Custom', type: 'threeD' });
    expect(lambdaClient.generationTopic.createTopic.mutate).toBeCalledWith({
      title: 'Custom',
      type: 'threeD',
    });
  });

  it('updateTopic should call lambdaClient with correct params', async () => {
    const id = 'test-topic-id';
    const data: UpdateTopicValue = {
      title: 'Updated Topic',
      coverUrl: 'https://example.com/cover.jpg',
    };

    await service.updateTopic(id, data);

    expect(lambdaClient.generationTopic.updateTopic.mutate).toBeCalledWith({
      id,
      value: data,
    });
  });

  it('updateTopicCover should call lambdaClient with correct params', async () => {
    const id = 'test-topic-id';
    const coverUrl = 'https://example.com/cover.jpg';

    await service.updateTopicCover(id, coverUrl);

    expect(lambdaClient.generationTopic.updateTopicCover.mutate).toBeCalledWith({
      id,
      coverUrl,
    });
  });

  it('deleteTopic should call lambdaClient with correct params', async () => {
    const id = 'test-topic-id';

    await service.deleteTopic(id);

    expect(lambdaClient.generationTopic.deleteTopic.mutate).toBeCalledWith({ id });
  });
});
