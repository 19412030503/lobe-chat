import { Runtime3DGenParams } from 'model-bank';

export interface ThreeDConfigState {
  activeTopicId?: string | null;
  isInit: boolean;
  model?: string;
  modelCount: number;
  parameters: Runtime3DGenParams;
  parametersSchema?: Record<string, any>;
  provider?: string;
}

export interface ThreeDMetaState {
  isCreating: boolean;
}

export type ThreeDStoreState = ThreeDConfigState & ThreeDMetaState;

export const initialState: ThreeDStoreState = {
  activeTopicId: null,
  isCreating: false,
  isInit: false,
  modelCount: 1,
  parameters: {
    prompt: '',
  },
};
