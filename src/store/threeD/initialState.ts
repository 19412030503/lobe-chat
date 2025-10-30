import { ModelParamsSchema, Runtime3DGenParams } from 'model-bank';

export interface ThreeDConfigState {
  activeTopicId?: string | null;
  isInit: boolean;
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
  activeTopicId: null,
  convertingGenerations: {},
  isCreating: false,
  isInit: false,
  modelCount: 1,
  parameters: {
    imageUrl: '',
    prompt: '',
  },
};
