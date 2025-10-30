'use client';

import { Block } from '@lobehub/ui';
import { Skeleton } from 'antd';
import { memo } from 'react';
import { Center, Flexbox } from 'react-layout-kit';

import PromptInput from '@/app/[variants]/(main)/3d/features/PromptInput';

const SkeletonList = memo(() => {
  return (
    <>
      <Block variant={'borderless'}>
        <Flexbox gap={12}>
          {/* Prompt text skeleton */}
          <Skeleton.Button active style={{ height: 20, width: '95%' }} />

          {/* Metadata skeleton */}
          <Flexbox gap={12} horizontal style={{ width: '100%' }}>
            <Skeleton.Button active style={{ height: 16, width: 120 }} />
            <Skeleton.Button active style={{ height: 16, width: 80 }} />
            <Skeleton.Button active style={{ height: 16, width: 60 }} />
            <Skeleton.Button active style={{ height: 16, width: 70 }} />
          </Flexbox>

          {/* 3D Model preview skeleton - single large box */}
          <Skeleton.Button active style={{ height: 300, width: '100%' }} />
        </Flexbox>
      </Block>
      <div style={{ flex: 1 }} />
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
});

SkeletonList.displayName = 'SkeletonList';

export default SkeletonList;
