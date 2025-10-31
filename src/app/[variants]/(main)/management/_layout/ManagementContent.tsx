'use client';

import dynamic from 'next/dynamic';
import React, { CSSProperties } from 'react';
import { Flexbox } from 'react-layout-kit';

import Loading from '@/components/Loading/BrandTextLoading';

import { ManagementTabs } from './type';

const componentMap = {
  [ManagementTabs.Users]: dynamic(() => import('../users/index'), {
    loading: () => <Loading />,
  }),
  [ManagementTabs.Organizations]: dynamic(() => import('../organizations/index'), {
    loading: () => <Loading />,
  }),
};

interface ManagementContentProps {
  activeTab?: string;
  mobile?: boolean;
}

const ManagementContent = ({ mobile, activeTab }: ManagementContentProps) => {
  const renderComponent = (tab: string) => {
    const Component = componentMap[tab as keyof typeof componentMap] || componentMap.users;
    if (!Component) return null;

    return <Component />;
  };

  if (mobile) {
    return activeTab ? renderComponent(activeTab) : renderComponent(ManagementTabs.Users);
  }

  const getDisplayStyle = (tabName: string): CSSProperties => ({
    display: activeTab === tabName ? 'flex' : 'none',
    flexDirection: 'column',
    gap: 24,
    height: '100%',
    maxWidth: '100%',
    overflow: 'auto',
    paddingBlock: mobile ? 0 : 24,
    paddingInline: mobile ? 0 : 32,
    width: '100%',
  });

  return (
    <Flexbox height={'100%'} width={'100%'}>
      {Object.keys(componentMap).map((tabKey) => {
        return (
          <div key={tabKey} style={getDisplayStyle(tabKey)}>
            {activeTab === tabKey && renderComponent(tabKey)}
          </div>
        );
      })}
    </Flexbox>
  );
};

export default ManagementContent;
