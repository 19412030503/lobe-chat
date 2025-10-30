import { GenerationBatch } from '@/types/generation';

import { generationTopicSelectors } from '../generationTopic/selectors';

// ====== topic batch selectors ====== //

const getGenerationBatchesByTopicId = (topicId: string) => (s: any) => {
  return s.generationBatchesMap?.[topicId] || [];
};

const currentGenerationBatches = (s: any): GenerationBatch[] => {
  const activeTopicId = generationTopicSelectors.activeGenerationTopicId(s);
  if (!activeTopicId) return [];
  return getGenerationBatchesByTopicId(activeTopicId)(s);
};

const getGenerationBatchByBatchId = (batchId: string) => (s: any) => {
  const batches = currentGenerationBatches(s);
  return batches.find((batch) => batch.id === batchId);
};

const isCurrentGenerationTopicLoaded = (s: any): boolean => {
  const activeTopicId = generationTopicSelectors.activeGenerationTopicId(s);
  if (!activeTopicId) return false;
  return s.generationBatchesMap && Array.isArray(s.generationBatchesMap[activeTopicId]);
};

// ====== aggregate selectors ====== //

export const generationBatchSelectors = {
  currentGenerationBatches,
  getGenerationBatchByBatchId,
  getGenerationBatchesByTopicId,
  isCurrentGenerationTopicLoaded,
};
