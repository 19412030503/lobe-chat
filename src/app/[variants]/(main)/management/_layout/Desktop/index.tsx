'use client';

import { useResponsive, useTheme } from 'antd-style';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { memo, useRef } from 'react';
import { Flexbox } from 'react-layout-kit';

import CategoryContent from '@/app/[variants]/(main)/management/_layout/CategoryContent';
import ManagementContent from '@/app/[variants]/(main)/management/_layout/ManagementContent';
import { LayoutProps, ManagementTabs } from '@/app/[variants]/(main)/management/_layout/type';
import InitClientDB from '@/features/InitClientDB';
import SettingContainer from '@/features/Setting/SettingContainer';

import Header from './Header';
import SideBar from './SideBar';

const Layout = memo<LayoutProps>(() => {
  const ref = useRef<HTMLDivElement | null>(null);
  const { md = true } = useResponsive();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useQueryState(
    'tab',
    parseAsStringEnum(Object.values(ManagementTabs)).withDefault(ManagementTabs.Users),
  );

  const category = <CategoryContent activeTab={activeTab} onMenuSelect={setActiveTab} />;

  return (
    <Flexbox
      height={'100%'}
      horizontal={md}
      ref={ref}
      style={{ background: theme.colorBgContainer, flex: '1', position: 'relative' }}
    >
      {md ? (
        <SideBar>{category}</SideBar>
      ) : (
        <Header getContainer={() => ref.current!}>{category}</Header>
      )}
      <SettingContainer maxWidth={'none'}>
        <ManagementContent activeTab={activeTab} mobile={!md} />
      </SettingContainer>
      <InitClientDB />
    </Flexbox>
  );
});

Layout.displayName = 'DesktopManagementLayout';

export default Layout;
