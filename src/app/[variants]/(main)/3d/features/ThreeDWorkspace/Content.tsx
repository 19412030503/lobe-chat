'use client';

import { Center } from 'react-layout-kit';

import { useThreeDStore } from '@/store/threeD';
import { generationBatchSelectors, generationTopicSelectors } from '@/store/threeD/selectors';

import GenerationFeed from '../GenerationFeed';
import PromptInput from '../PromptInput';
import EmptyState from './EmptyState';
import SkeletonList from './SkeletonList';

const ThreeDWorkspaceContent = () => {
  const activeTopicId = useThreeDStore(generationTopicSelectors.activeGenerationTopicId);
  const useFetchGenerationBatches = useThreeDStore((s) => s.useFetchGenerationBatches);
  const isCurrentGenerationTopicLoaded = useThreeDStore(
    generationBatchSelectors.isCurrentGenerationTopicLoaded,
  );
  useFetchGenerationBatches(activeTopicId);
  const currentBatches = useThreeDStore(generationBatchSelectors.currentGenerationBatches);
  const hasGenerations = currentBatches && currentBatches.length > 0;

  if (!isCurrentGenerationTopicLoaded) {
    return <SkeletonList />;
  }

  if (!hasGenerations) return <EmptyState />;

  return (
    <>
      {/* 生成结果展示区 */}
      <GenerationFeed key={activeTopicId} />

      {/* 底部输入框 */}
      <Center
        style={{
          bottom: 24,
          position: 'sticky',
          width: '100%',
        }}
      >
        <PromptInput disableAnimation={true} showTitle={false} />
      </Center>
    </>
  );
};

export default ThreeDWorkspaceContent;
