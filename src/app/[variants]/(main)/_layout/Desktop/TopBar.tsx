'use client';

import { useTheme } from 'antd-style';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { ProductLogo } from '@/components/Branding';
import { electronStylish } from '@/styles/electron';

import Avatar from './SideBar/Avatar';

const DesktopTopBar = memo(() => {
  const theme = useTheme();

  return (
    <div
      className={electronStylish.nodrag}
      data-testid={'desktop-topbar'}
      style={{
        alignItems: 'center',
        background: theme.colorBgLayout,
        borderBottom: `1px solid ${theme.colorBorderSecondary}`,
        display: 'flex',
        gap: 12,
        justifyContent: 'space-between',
        minHeight: 52,
        paddingBlock: 8,
        paddingInline: 24,
        position: 'sticky',
        top: 0,
        width: '100%',
        zIndex: 2,
      }}
    >
      <Flexbox align={'center'} gap={8} horizontal>
        <ProductLogo size={28} type={'text'} />
      </Flexbox>
      <Avatar />
    </div>
  );
});

DesktopTopBar.displayName = 'DesktopTopBar';

export default DesktopTopBar;
