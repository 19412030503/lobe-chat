import { ModelParamsSchema, Runtime3DGenParams } from 'model-bank';

import { GenerationBatch, ImageGenerationTopic as GenerationTopic } from '@/types/generation';

export interface ThreeDConfigState {
  activeGenerationTopicId?: string | null;
  activeTopicId?: string | null;
  generationBatchesMap: Record<string, GenerationBatch[]>;
  generationTopics: GenerationTopic[];
  isCreatingWithNewTopic: boolean;
  isInit: boolean;
  loadingGenerationTopicIds: string[];
  model?: string;
  modelCount: number;
  parameters: Runtime3DGenParams;
  parametersSchema?: ModelParamsSchema;
  provider?: string;
}

export interface ThreeDMetaState {
  convertingGenerations: Record<string, boolean>;
  isCreating: boolean;
}

export type ThreeDStoreState = ThreeDConfigState & ThreeDMetaState;

export const initialState: ThreeDStoreState = {
  activeGenerationTopicId: null,
  activeTopicId: null,
  convertingGenerations: {},
  generationBatchesMap: {},
  generationTopics: [],
  isCreating: false,
  isCreatingWithNewTopic: false,
  isInit: false,
  loadingGenerationTopicIds: [],
  modelCount: 1,
  parameters: {
    imageUrl: '',
    prompt: '',
  },
};
