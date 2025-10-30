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
import { GenerationBatchAction, createGenerationBatchSlice } from './slices/generationBatch/action';
import { GenerationTopicAction, createGenerationTopicSlice } from './slices/generationTopic/action';

const LEGACY_TRIPO_MODEL_IDS = new Set(['tripo-image-to-model', 'tripo-text-to-model']);

// Actions not from slices
interface CoreThreeDActions {
  convertGeneration: (payload: {
    generationId: string;
    model: string;
    params: Record<string, any>;
    provider: string;
  }) => Promise<Awaited<ReturnType<typeof threeDService.convertModel>>>;
  createTask: (generationTopicId: string) => Promise<void>;
  createThreeD: () => Promise<void>;
  initializeConfig: (isLogin?: boolean | null, lastModel?: string, lastProvider?: string) => void;
  recreateThreeD: (topicId: string, batchId: string) => Promise<void>;
  reuseSettings: (
    model: string,
    provider: string,
    settings: Partial<ThreeDStoreState['parameters']>,
  ) => void;
  setActiveTopicId: (id: string | null) => void;
  setModelAndProvider: (model: string, provider: string) => void;
  setModelAndProviderOnSelect: (model: string, provider: string) => void;
  setModelCount: (count: number) => void;
  setParameter: <K extends keyof ThreeDStoreState['parameters']>(
    key: K,
    value: ThreeDStoreState['parameters'][K],
  ) => void;
  setPrompt: (prompt: string) => void;
  switchTopic: (topicId: string | null) => void;
}

export interface ThreeDStore
  extends ThreeDStoreState,
    CoreThreeDActions,
    GenerationBatchAction,
    GenerationTopicAction {}

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

const createStore: StateCreator<
  ThreeDStore,
  [['zustand/devtools', never]],
  [],
  CoreThreeDActions
> = (set, get) => ({
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

  createThreeD: async () => {
    set({ isCreating: true }, false, 'createThreeD/start');

    const store = get();
    const { parameters, provider, model, modelCount, activeGenerationTopicId } = store;
    const { internal_createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    if (!parameters) {
      throw new TypeError('parameters is not initialized');
    }

    // Validate based on input mode - either prompt or image is required
    const hasTextInput = Boolean(parameters.prompt);
    const hasImageInput = Boolean(parameters.imageUrl || parameters.multiViewImages?.length);

    if (!hasTextInput && !hasImageInput) {
      set({ isCreating: false }, false, 'createThreeD/error');
      throw new TypeError('prompt or image is required');
    }

    // Track the final topic ID to use for 3D creation
    let finalTopicId = activeGenerationTopicId;

    // 1. Create generation topic if not exists
    let isNewTopic = false;

    if (!finalTopicId) {
      isNewTopic = true;
      const newGenerationTopicId = await internal_createGenerationTopic();
      finalTopicId = newGenerationTopicId;

      // 2. Initialize empty batch array to avoid skeleton screen
      setTopicBatchLoaded(newGenerationTopicId);

      // 3. Switch to the new topic (now it has empty data, so no skeleton screen)
      switchGenerationTopic(newGenerationTopicId);
    }

    try {
      // 4. If it's a new topic, set the creating state after topic creation
      if (isNewTopic) {
        set({ isCreatingWithNewTopic: true }, false, 'createThreeD/startWithNewTopic');
      }

      // 5. Create 3D model via service
      await threeDService.createModel({
        generationTopicId: finalTopicId!,
        model: model || '',
        modelNum: modelCount,
        params: parameters as any,
        provider: provider || '',
      });

      // 6. Only refresh generation batches if it's not a new topic
      if (!isNewTopic) {
        await get().refreshGenerationBatches();
      }

      // 7. Clear the prompt/image inputs after successful creation
      set(
        (state) => ({
          parameters: {
            ...state.parameters,
            imageUrl: undefined,
            multiViewImages: undefined,
            prompt: '',
          },
        }),
        false,
        'createThreeD/clearInputs',
      );
    } finally {
      // 8. Reset all creating states
      if (isNewTopic) {
        set(
          { isCreating: false, isCreatingWithNewTopic: false },
          false,
          'createThreeD/endWithNewTopic',
        );
      } else {
        set({ isCreating: false }, false, 'createThreeD/end');
      }
    }
  },

  initializeConfig: (isLogin, lastModel, lastProvider) => {
    console.log('[initializeConfig] Called with:', { isLogin, lastModel, lastProvider });

    const providerList = aiProviderSelectors
      .enabledThreeDModelList(useAiInfraStore.getState())
      .map((item) => ({
        ...item,
        children: item.children.filter((child) => !LEGACY_TRIPO_MODEL_IDS.has(child.id)),
      }));

    console.log(
      '[initializeConfig] Provider list:',
      providerList.map((p) => ({
        childCount: p.children.length,
        id: p.id,
        name: p.name,
      })),
    );

    if (!providerList.length) {
      console.log('[initializeConfig] No providers available');
      set({ isInit: true }, false, 'threeD/init/empty');
      return;
    }

    const provider =
      providerList.find((item) => item.id === lastProvider && item.children.length > 0) ||
      providerList[0];
    const model =
      provider.children.find((item) => item.id === lastModel) || provider.children[0] || null;

    console.log('[initializeConfig] Selected:', {
      modelId: model?.id,
      modelName: model?.displayName || model?.id,
      providerId: provider.id,
      providerName: provider.name,
    });

    const { parameters, schema } = getModelDefaults(provider.id, model?.id || undefined);

    console.log('[initializeConfig] Setting state:', {
      hasSchema: !!schema,
      isInit: true,
      model: model?.id,
      parametersCount: Object.keys(parameters || {}).length,
      provider: provider.id,
    });

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
      console.log('[initializeConfig] Saving to globalStore:', {
        lastSelectedThreeDModel: model.id,
        lastSelectedThreeDProvider: provider.id,
      });
      useGlobalStore.getState().updateSystemStatus(
        {
          lastSelectedThreeDModel: model.id,
          lastSelectedThreeDProvider: provider.id,
        },
        'threeD/initRemember',
      );
    } else {
      console.log('[initializeConfig] Not saving to globalStore:', { hasModel: !!model, isLogin });
    }

    console.log('[initializeConfig] Done. Current store state:', get());
  },

  recreateThreeD: async (topicId: string, batchId: string) => {
    set({ isCreating: true }, false, 'recreateThreeD/start');

    const store = get();
    const { modelCount, removeGenerationBatch } = store;
    const batches = store.generationBatchesMap?.[topicId] || [];
    const batch = batches.find((b) => b.id === batchId);

    if (!batch) {
      set({ isCreating: false }, false, 'recreateThreeD/error');
      throw new Error(`Batch ${batchId} not found in topic ${topicId}`);
    }

    try {
      // 1. Delete generation batch
      await removeGenerationBatch(batchId, topicId);

      // 2. Create 3D model via service with batch config
      await threeDService.createModel({
        generationTopicId: topicId,
        model: batch.model,
        modelNum: modelCount,
        params: batch.config as any,
        provider: batch.provider,
      });

      // 3. Refresh generation batches to show the real data
      await store.refreshGenerationBatches();
    } finally {
      set({ isCreating: false }, false, 'recreateThreeD/end');
    }
  },

  reuseSettings: (model, provider, settings) => {
    const { parameters, schema } = getModelDefaults(provider, model);
    set(
      {
        model,
        parameters: { ...parameters, ...settings },
        parametersSchema: schema,
        provider,
      },
      false,
      `reuseSettings/${model}/${provider}`,
    );
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

  // Alias for ModelSelect component compatibility
  setModelAndProviderOnSelect: (model, provider) => {
    get().setModelAndProvider(model, provider);
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

  switchTopic: (topicId) => {
    set(
      { activeGenerationTopicId: topicId, activeTopicId: topicId },
      false,
      `switchTopic/${topicId}`,
    );
  },
});

//  ===============  implement useStore ============ //

const createCombinedStore: StateCreator<ThreeDStore, [['zustand/devtools', never]]> = (
  ...parameters
) => ({
  ...initialState,
  ...createStore(...parameters),
  ...createGenerationBatchSlice(...parameters),
  ...createGenerationTopicSlice(...parameters),
});

const devtools = createDevtools('threeD');

export const useThreeDStore = createWithEqualityFn<ThreeDStore>()(
  subscribeWithSelector(devtools(createCombinedStore)),
  shallow,
);

export const getThreeDStoreState = () => useThreeDStore.getState();
