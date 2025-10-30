'use client';

import { useQueryState } from 'nuqs';
import { useLayoutEffect } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useThreeDStore } from '@/store/threeD';

/**
 * 双向绑定 url 的 topic 参数到 threeD store 的 activeGenerationTopicId
 */
const TopicUrlSync = () => {
  const useStoreUpdater = createStoreUpdater(useThreeDStore);

  const [topic, setTopic] = useQueryState('topic', { history: 'replace', throttleMs: 500 });
  useStoreUpdater('activeGenerationTopicId', topic);

  useLayoutEffect(() => {
    const unsubscribeTopic = useThreeDStore.subscribe(
      (s) => s.activeGenerationTopicId,
      (state) => {
        setTopic(state || null);
      },
    );

    return () => {
      unsubscribeTopic();
    };
  }, [setTopic]);

  // 这个组件不渲染任何UI，仅用于同步状态
  return null;
};

TopicUrlSync.displayName = 'ThreeDTopicUrlSync';

export default TopicUrlSync;
