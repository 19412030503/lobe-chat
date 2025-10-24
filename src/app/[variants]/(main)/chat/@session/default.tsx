import { Suspense } from 'react';

import CircleLoading from '@/components/Loading/CircleLoading';
import ServerLayout from '@/components/server/ServerLayout';
import { DynamicLayoutProps } from '@/types/next';

import Desktop from './_layout/Desktop';
import Mobile from './_layout/Mobile';
import SessionHydration from './features/SessionHydration';
import SkeletonList from './features/SkeletonList';
import TopicSidebarContent from './features/TopicSidebarContent';

const Layout = ServerLayout({ Desktop, Mobile });

const Session = (props: DynamicLayoutProps) => {
  return (
    <Suspense fallback={<CircleLoading />}>
      <Layout {...props}>
        <Suspense fallback={<SkeletonList />}>
          <TopicSidebarContent />
        </Suspense>
      </Layout>
      <SessionHydration />
    </Suspense>
  );
};

Session.displayName = 'Session';

export default Session;
