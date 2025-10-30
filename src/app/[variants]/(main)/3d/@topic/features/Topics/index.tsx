'use client';

import dynamic from 'next/dynamic';

import SkeletonList from './SkeletonList';

const TopicsList = dynamic(() => import('./TopicList'), {
  loading: () => <SkeletonList />,
  ssr: false,
});

const Topics = () => {
  return <TopicsList />;
};

Topics.displayName = 'ThreeDTopics';

export default Topics;
