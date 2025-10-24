'use client';

import { Suspense, lazy, memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import ConfigSwitcher from '@/app/[variants]/(main)/chat/(workspace)/@topic/features/ConfigSwitcher';
import TopicSearchBar from '@/app/[variants]/(main)/chat/(workspace)/@topic/features/Topic/TopicSearchBar';
import CircleLoading from '@/components/Loading/CircleLoading';

import NewConversationButton from './NewConversationButton';

const TopicListContent = lazy(
  () => import('@/app/[variants]/(main)/chat/(workspace)/@topic/features/Topic/TopicListContent'),
);

const TopicSidebarContent = memo(() => {
  return (
    <Flexbox gap={16}>
      <Flexbox gap={12}>
        <NewConversationButton />
        <TopicSearchBar autoFocus={false} />
      </Flexbox>
      <ConfigSwitcher />
      <Suspense fallback={<CircleLoading />}>
        <TopicListContent />
      </Suspense>
    </Flexbox>
  );
});

TopicSidebarContent.displayName = 'TopicSidebarContent';

export default TopicSidebarContent;
