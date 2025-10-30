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

const LEGACY_TRIPO_MODEL_IDS = new Set(['tripo-image-to-model', 'tripo-text-to-model']);

export interface ThreeDStore extends ThreeDStoreState {
  convertGeneration: (payload: {
    generationId: string;
    model: string;
    params: Record<string, any>;
    provider: string;
  }) => Promise<Awaited<ReturnType<typeof threeDService.convertModel>>>;
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

  const providerList = aiProviderSelectors
    .enabledThreeDModelList(useAiInfraStore.getState())
    .map((item) => ({
      ...item,
      children: item.children.filter((child) => !LEGACY_TRIPO_MODEL_IDS.has(child.id)),
    }));
  const provider = providerList.find((item) => item.id === providerId);
  if (!provider) {
    throw new Error(`Provider "${providerId}" not found in enabled 3D provider list.`);
  }

  const activeModel = provider.children.find((item) => item.id === modelId) as unknown as
    | (AI3DModelCard & { parameters?: ModelParamsSchema })
    | undefined;

  const resolvedModel =
    activeModel ??
    (provider.children.length > 0
      ? (provider.children[0] as unknown as AI3DModelCard & {
          parameters?: ModelParamsSchema;
        })
      : undefined);

  if (!resolvedModel) {
    throw new Error(`Provider "${providerId}" does not have any 3D models.`);
  }

  const parametersSchema = resolvedModel.parameters as ModelParamsSchema | undefined;
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

  convertGeneration: async ({ generationId, provider, model, params }) => {
    set(
      (state) => ({
        convertingGenerations: {
          ...state.convertingGenerations,
          [generationId]: true,
        },
      }),
      false,
      `threeD/convert/start/${generationId}`,
    );

    try {
      return await threeDService.convertModel({
        model,
        params: params as { format: string } & Record<string, unknown>,
        provider,
        sourceGenerationId: generationId,
      });
    } finally {
      set(
        (state) => {
          const next = { ...state.convertingGenerations };
          delete next[generationId];
          return { convertingGenerations: next };
        },
        false,
        `threeD/convert/end/${generationId}`,
      );
    }
  },

  createTask: async (generationTopicId: string) => {
    const state = get();
    if (!state.provider || !state.model) {
      throw new Error('3D provider or model is not ready');
    }

    const promptRaw = typeof state.parameters.prompt === 'string' ? state.parameters.prompt : '';
    const trimmedPrompt = promptRaw.trim();
    const imageUrlValue = state.parameters.imageUrl;
    const multiViewImagesValue = state.parameters.multiViewImages;
    const hasSingleImage = typeof imageUrlValue === 'string' && imageUrlValue.trim().length > 0;
    const hasMultiImage = Array.isArray(multiViewImagesValue) && multiViewImagesValue.length > 0;
    const hasImageReference = hasSingleImage || hasMultiImage;

    if (!trimmedPrompt && !hasImageReference) {
      throw new Error('请先输入提示词');
    }

    if (state.model === 'hunyuan-3d-rapid' && trimmedPrompt && trimmedPrompt.length > 200) {
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
    const providerList = aiProviderSelectors
      .enabledThreeDModelList(useAiInfraStore.getState())
      .map((item) => ({
        ...item,
        children: item.children.filter((child) => !LEGACY_TRIPO_MODEL_IDS.has(child.id)),
      }));
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
