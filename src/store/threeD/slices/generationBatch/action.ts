import { isEqual } from 'lodash-es';
import { SWRResponse, mutate } from 'swr';
import { StateCreator } from 'zustand';

import { useClientDataSWR } from '@/libs/swr';
import { generationService } from '@/services/generation';
import { generationBatchService } from '@/services/generationBatch';
import { GenerationBatch } from '@/types/generation';
import { setNamespace } from '@/utils/storeDebug';

import type { ThreeDStoreState } from '../../initialState';
import { GenerationBatchDispatch, generationBatchReducer } from './reducer';

const n = setNamespace('generationBatch');

// ====== SWR key ====== //
const SWR_USE_FETCH_GENERATION_BATCHES = 'SWR_USE_FETCH_GENERATION_BATCHES_3D';

// ====== action interface ====== //

export interface GenerationBatchAction {
  internal_deleteGeneration: (generationId: string) => Promise<void>;
  internal_deleteGenerationBatch: (batchId: string, topicId: string) => Promise<void>;
  internal_dispatchGenerationBatch: (
    topicId: string,
    payload: GenerationBatchDispatch,
    action?: string,
  ) => void;
  refreshGenerationBatches: () => Promise<void>;
  removeGeneration: (generationId: string) => Promise<void>;
  removeGenerationBatch: (batchId: string, topicId: string) => Promise<void>;
  setTopicBatchLoaded: (topicId: string) => void;
  useFetchGenerationBatches: (topicId?: string | null) => SWRResponse<GenerationBatch[]>;
}

// ====== action implementation ====== //

export const createGenerationBatchSlice: StateCreator<
  ThreeDStoreState & GenerationBatchAction,
  [['zustand/devtools', never]],
  [],
  GenerationBatchAction
> = (set, get) => ({
  internal_deleteGeneration: async (generationId: string) => {
    const { activeGenerationTopicId, refreshGenerationBatches, internal_dispatchGenerationBatch } =
      get();

    if (!activeGenerationTopicId) return;

    // 找到包含该 generation 的 batch
    const currentBatches = get().generationBatchesMap[activeGenerationTopicId] || [];
    const targetBatch = currentBatches.find((batch) =>
      batch.generations.some((gen) => gen.id === generationId),
    );

    if (!targetBatch) return;

    // 1. 立即更新前端状态（乐观更新）
    internal_dispatchGenerationBatch(
      activeGenerationTopicId,
      { batchId: targetBatch.id, generationId, type: 'deleteGenerationInBatch' },
      'internal_deleteGeneration',
    );

    // 2. 调用后端服务删除generation
    await generationService.deleteGeneration(generationId);

    // 3. 刷新数据确保一致性
    await refreshGenerationBatches();
  },

  internal_deleteGenerationBatch: async (batchId: string, topicId: string) => {
    const { internal_dispatchGenerationBatch, refreshGenerationBatches } = get();

    // 1. 立即更新前端状态（乐观更新）
    internal_dispatchGenerationBatch(
      topicId,
      { id: batchId, type: 'deleteBatch' },
      'internal_deleteGenerationBatch',
    );

    // 2. 调用后端服务
    await generationBatchService.deleteGenerationBatch(batchId);

    // 3. 刷新数据确保一致性
    await refreshGenerationBatches();
  },

  internal_dispatchGenerationBatch: (topicId, payload, action) => {
    const currentBatches = get().generationBatchesMap[topicId] || [];
    const nextBatches = generationBatchReducer(currentBatches, payload);

    const nextMap = {
      ...get().generationBatchesMap,
      [topicId]: nextBatches,
    };

    // no need to update map if the map is the same
    if (isEqual(nextMap, get().generationBatchesMap)) return;

    set(
      {
        generationBatchesMap: nextMap,
      },
      false,
      action ?? n(`dispatchGenerationBatch/${payload.type}`),
    );
  },

  refreshGenerationBatches: async () => {
    const { activeGenerationTopicId } = get();
    if (activeGenerationTopicId) {
      await mutate([SWR_USE_FETCH_GENERATION_BATCHES, activeGenerationTopicId]);
    }
  },

  removeGeneration: async (generationId: string) => {
    const { internal_deleteGeneration, activeGenerationTopicId, refreshGenerationBatches } = get();

    await internal_deleteGeneration(generationId);

    // 检查删除后是否有batch变成空的，如果有则删除空batch
    if (activeGenerationTopicId) {
      const updatedBatches = get().generationBatchesMap[activeGenerationTopicId] || [];
      const emptyBatches = updatedBatches.filter((batch) => batch.generations.length === 0);

      // 删除所有空的batch
      for (const emptyBatch of emptyBatches) {
        await get().internal_deleteGenerationBatch(emptyBatch.id, activeGenerationTopicId);
      }

      // 如果删除了空batch，再次刷新数据确保一致性
      if (emptyBatches.length > 0) {
        await refreshGenerationBatches();
      }
    }
  },

  removeGenerationBatch: async (batchId: string, topicId: string) => {
    const { internal_deleteGenerationBatch } = get();
    await internal_deleteGenerationBatch(batchId, topicId);
  },

  setTopicBatchLoaded: (topicId: string) => {
    const nextMap = {
      ...get().generationBatchesMap,
      [topicId]: [],
    };

    // no need to update map if the map is the same
    if (isEqual(nextMap, get().generationBatchesMap)) return;

    set(
      {
        generationBatchesMap: nextMap,
      },
      false,
      n('setTopicBatchLoaded'),
    );
  },

  useFetchGenerationBatches: (topicId) => {
    // 检查是否有进行中的任务来决定轮询间隔
    const batches = get().generationBatchesMap?.[topicId!] || [];
    const hasPendingTasks = batches.some((batch) =>
      batch.generations?.some(
        (gen) => gen.task?.status === 'processing' || gen.task?.status === 'pending',
      ),
    );

    return useClientDataSWR<GenerationBatch[]>(
      topicId ? [SWR_USE_FETCH_GENERATION_BATCHES, topicId] : null,
      async ([, topicId]: [string, string]) => {
        return generationBatchService.getGenerationBatches(topicId, 'threeD');
      },
      {
        onSuccess: (data) => {
          const nextMap = {
            ...get().generationBatchesMap,
            [topicId!]: data,
          };

          // no need to update map if the map is the same
          if (isEqual(nextMap, get().generationBatchesMap)) return;

          set(
            {
              generationBatchesMap: nextMap,
            },
            false,
            n('useFetchGenerationBatches(success)', { topicId }),
          );
        },

        // 有进行中的任务时每 3 秒轮询一次
        refreshInterval: hasPendingTasks ? 3000 : 0,
        // 窗口重新获得焦点时刷新
        revalidateOnFocus: true,
      },
    );
  },
});
