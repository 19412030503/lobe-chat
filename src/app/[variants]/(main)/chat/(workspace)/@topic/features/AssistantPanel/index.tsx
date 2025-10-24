'use client';

import { Suspense, lazy } from 'react';
import { Flexbox } from 'react-layout-kit';

import PanelBody from '@/app/[variants]/(main)/chat/@session/_layout/Desktop/PanelBody';
import SessionSkeleton from '@/app/[variants]/(main)/chat/@session/features/SkeletonList';

import AssistantPanelHeader from '../AssistantPanelHeader';

const SessionListContent = lazy(
  () => import('@/app/[variants]/(main)/chat/@session/features/SessionListContent'),
);

const AssistantPanel = () => {
  return (
    <>
      <AssistantPanelHeader />
      <PanelBody>
        <Flexbox gap={12}>
          <Suspense fallback={<SessionSkeleton />}>
            <SessionListContent />
          </Suspense>
        </Flexbox>
      </PanelBody>
    </>
  );
};

export default AssistantPanel;
