'use client';

import { Skeleton } from 'antd';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

const SkeletonList = memo(() => {
  return (
    <Flexbox align="center" gap={12} paddingBlock={16} width={'100%'}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton.Avatar active key={index} shape="square" size={48} style={{ flex: 'none' }} />
      ))}
    </Flexbox>
  );
});

SkeletonList.displayName = 'SkeletonList';

export default SkeletonList;
