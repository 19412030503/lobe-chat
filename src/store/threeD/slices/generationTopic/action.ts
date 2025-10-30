import isEqual from 'fast-deep-equal';
import type { SWRResponse } from 'swr';
import { mutate } from 'swr';
import type { StateCreator } from 'zustand/vanilla';

import { useClientDataSWR } from '@/libs/swr';
import { generationTopicService } from '@/services/generationTopic';
import type { ImageGenerationTopic as GenerationTopic } from '@/types/generation';
import { setNamespace } from '@/utils/storeDebug';

import type { ThreeDStore } from '../../store';
import { generationTopicReducer } from './reducer';
import type { GenerationTopicDispatch } from './reducer';

const FETCH_GENERATION_TOPICS_KEY = 'fetchGenerationTopics_threeD';

const n = setNamespace('threeD/generationTopic');

export interface GenerationTopicAction {
  internal_createGenerationTopic: () => Promise<string>;
  internal_dispatchGenerationTopic: (payload: GenerationTopicDispatch, action?: any) => void;
  internal_removeGenerationTopic: (id: string) => Promise<void>;
  internal_updateGenerationTopicLoading: (id: string, loading: boolean) => void;
  openNewGenerationTopic: () => void;

  refreshGenerationTopics: () => Promise<void>;
  removeGenerationTopic: (id: string) => Promise<void>;
  switchGenerationTopic: (topicId: string) => void;
  useFetchGenerationTopics: (enabled: boolean) => SWRResponse<GenerationTopic[]>;
}

export const createGenerationTopicSlice: StateCreator<
  ThreeDStore,
  [['zustand/devtools', never]],
  [],
  GenerationTopicAction
> = (set, get) => ({
  // ===== Internal Methods ===== //
  internal_createGenerationTopic: async () => {
    const id = await generationTopicService.createTopic({ type: 'threeD' });
    await get().refreshGenerationTopics();
    return id;
  },

  internal_dispatchGenerationTopic: (payload, action) => {
    const nextTopics = generationTopicReducer(get().generationTopics, payload);

    // No need to update if the topics are the same
    if (isEqual(nextTopics, get().generationTopics)) return;

    set(
      { generationTopics: nextTopics },
      false,
      action ?? n(`dispatchGenerationTopic/${payload.type}`),
    );
  },

  internal_removeGenerationTopic: async (id: string) => {
    await generationTopicService.deleteTopic(id);
    await get().refreshGenerationTopics();
  },

  internal_updateGenerationTopicLoading: (id: string, loading: boolean) => {
    set(
      (state) => {
        const loadingIds = state.loadingGenerationTopicIds || [];
        if (loading) {
          return { loadingGenerationTopicIds: [...loadingIds, id] };
        }
        return { loadingGenerationTopicIds: loadingIds.filter((i) => i !== id) };
      },
      false,
      n('internal_updateGenerationTopicLoading'),
    );
  },

  // ===== Topic Management ===== //
  openNewGenerationTopic: () => {
    set({ activeGenerationTopicId: null }, false, n('openNewGenerationTopic'));
  },

  refreshGenerationTopics: async () => {
    await mutate([FETCH_GENERATION_TOPICS_KEY]);
  },

  removeGenerationTopic: async (id: string) => {
    const { internal_removeGenerationTopic, activeGenerationTopicId, openNewGenerationTopic } =
      get();

    const isRemovingActiveTopic = activeGenerationTopicId === id;

    await internal_removeGenerationTopic(id);

    // If we removed the active topic, always go back to the default page
    if (isRemovingActiveTopic) {
      openNewGenerationTopic();
    }
  },

  switchGenerationTopic: (topicId: string) => {
    set({ activeGenerationTopicId: topicId }, false, n('switchGenerationTopic'));
  },

  // ===== SWR Hooks ===== //
  useFetchGenerationTopics: (enabled) =>
    useClientDataSWR<GenerationTopic[]>(
      enabled ? [FETCH_GENERATION_TOPICS_KEY] : null,
      () => generationTopicService.getAllGenerationTopics({ type: 'threeD' }),
      {
        onSuccess: (data) => {
          // No need to update if data is the same
          if (isEqual(data, get().generationTopics)) return;
          set({ generationTopics: data }, false, n('useFetchGenerationTopics'));
        },
        suspense: true,
      },
    ),
});
