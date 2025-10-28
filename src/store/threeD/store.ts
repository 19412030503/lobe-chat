import { AI3DModelCard, ModelParamsSchema, extractDefaultValues } from 'model-bank';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { StateCreator } from 'zustand/vanilla';

import { threeDService } from '@/services/threeD';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useGlobalStore } from '@/store/global';
import { authSelectors } from '@/store/user/selectors';
import { useUserStore } from '@/store/user/store';

import { createDevtools } from '../middleware/createDevtools';
import type { ThreeDStoreState } from './initialState';
import { initialState } from './initialState';

export interface ThreeDStore extends ThreeDStoreState {
  createTask: (generationTopicId: string) => Promise<void>;
  initializeConfig: (isLogin?: boolean | null, lastModel?: string, lastProvider?: string) => void;
  setActiveTopicId: (id: string | null) => void;
  setModelAndProvider: (model: string, provider: string) => void;
  setModelCount: (count: number) => void;
  setParameter: <K extends keyof ThreeDStoreState['parameters']>(
    key: K,
    value: ThreeDStoreState['parameters'][K],
  ) => void;
  setPrompt: (prompt: string) => void;
}

function getModelDefaults(providerId?: string, modelId?: string) {
  if (!providerId || !modelId) {
    return { parameters: initialState.parameters, schema: undefined };
  }

  const providerList = aiProviderSelectors.enabledThreeDModelList(useAiInfraStore.getState());
  const provider = providerList.find((item) => item.id === providerId);
  if (!provider) {
    throw new Error(`Provider "${providerId}" not found in enabled 3D provider list.`);
  }

  const activeModel = provider.children.find((item) => item.id === modelId) as unknown as
    | (AI3DModelCard & { parameters?: ModelParamsSchema })
    | undefined;

  if (!activeModel) {
    throw new Error(
      `Model "${modelId}" not found in provider "${providerId}". Available models: ${provider.children
        .map((m) => m.id)
        .join(', ')}`,
    );
  }

  const parametersSchema = activeModel.parameters as ModelParamsSchema | undefined;
  if (!parametersSchema) {
    return { parameters: { prompt: '' }, schema: undefined };
  }

  let parameters: ThreeDStoreState['parameters'] = { prompt: '' };
  try {
    parameters = extractDefaultValues(parametersSchema) as ThreeDStoreState['parameters'];
  } catch (error) {
    console.warn('[ThreeDStore] Failed to extract default values for model', modelId, error);
  }

  if (!parameters.prompt) parameters.prompt = '';

  return { parameters, schema: parametersSchema };
}

const createStore: StateCreator<ThreeDStore, [['zustand/devtools', never]]> = (set, get) => ({
  ...initialState,

  createTask: async (generationTopicId: string) => {
    const state = get();
    if (!state.provider || !state.model) {
      throw new Error('3D provider or model is not ready');
    }

    const hasPrompt = Boolean(state.parameters.prompt?.trim());
    const hasImageUrl = Boolean(state.parameters.imageUrl);
    const multiViewImages = state.parameters.multiViewImages;
    const hasMultiView = Array.isArray(multiViewImages) && multiViewImages.some(Boolean);

    if (!hasPrompt && !hasImageUrl && !hasMultiView) {
      throw new Error('请至少提供提示词、参考图片或多视角图片 URL');
    }

    if (
      state.model === 'hunyuan-3d-rapid' &&
      typeof state.parameters.prompt === 'string' &&
      state.parameters.prompt.length > 200
    ) {
      throw new Error('快速版提示词需控制在 200 字符以内');
    }

    set({ isCreating: true }, false, 'threeD/create/start');
    try {
      await threeDService.createModel({
        generationTopicId,
        model: state.model,
        modelNum: state.modelCount,
        params: state.parameters,
        provider: state.provider,
      });

      set(
        (prev) => ({
          parameters: { ...prev.parameters, prompt: '' },
        }),
        false,
        'threeD/create/resetPrompt',
      );
    } finally {
      set({ isCreating: false }, false, 'threeD/create/end');
    }
  },

  initializeConfig: (isLogin, lastModel, lastProvider) => {
    const providerList = aiProviderSelectors.enabledThreeDModelList(useAiInfraStore.getState());
    if (!providerList.length) {
      set({ isInit: true }, false, 'threeD/init/empty');
      return;
    }

    const provider =
      providerList.find((item) => item.id === lastProvider && item.children.length > 0) ||
      providerList[0];
    const model =
      provider.children.find((item) => item.id === lastModel) || provider.children[0] || null;

    const { parameters, schema } = getModelDefaults(provider.id, model?.id || undefined);

    set(
      {
        isInit: true,
        model: model?.id,
        parameters,
        parametersSchema: schema,
        provider: provider.id,
      },
      false,
      `threeD/init/${provider.id}/${model?.id || 'none'}`,
    );

    if (isLogin && model) {
      useGlobalStore.getState().updateSystemStatus(
        {
          lastSelectedThreeDModel: model.id,
          lastSelectedThreeDProvider: provider.id,
        },
        'threeD/initRemember',
      );
    }
  },

  setActiveTopicId: (id) => {
    set({ activeTopicId: id }, false, `threeD/setActiveTopic/${id || 'none'}`);
  },

  setModelAndProvider: (model, provider) => {
    const { parameters, schema } = getModelDefaults(provider, model);

    set(
      {
        model,
        parameters,
        parametersSchema: schema,
        provider,
      },
      false,
      `threeD/setModelProvider/${provider}/${model}`,
    );

    const isLogin = authSelectors.isLogin(useUserStore.getState());
    if (isLogin) {
      useGlobalStore.getState().updateSystemStatus(
        {
          lastSelectedThreeDModel: model,
          lastSelectedThreeDProvider: provider,
        },
        'threeD/updateLastSelection',
      );
    }
  },

  setModelCount: (count) => {
    const safeCount = Math.min(Math.max(count, 1), 4);
    set({ modelCount: safeCount }, false, `threeD/setModelCount/${safeCount}`);
  },

  setParameter: (key, value) => {
    set(
      (state) => ({
        parameters: {
          ...state.parameters,
          [key]: value,
        },
      }),
      false,
      `threeD/setParameter/${String(key)}`,
    );
  },

  setPrompt: (prompt) => {
    set(
      (state) => ({
        parameters: {
          ...state.parameters,
          prompt,
        },
      }),
      false,
      'threeD/setPrompt',
    );
  },
});

const devtools = createDevtools('threeD');

export const useThreeDStore = createWithEqualityFn<ThreeDStore>()(
  subscribeWithSelector(devtools(createStore)),
  shallow,
);

export const getThreeDStoreState = () => useThreeDStore.getState();
