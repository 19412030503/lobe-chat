'use client';

import { ActionIcon } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { LucideX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CSSProperties, memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { ProductLogo } from '@/components/Branding';
import { electronStylish } from '@/styles/electron';

import Avatar from './SideBar/Avatar';

interface DesktopTopBarProps {
  hideSideBar?: boolean;
}

const DesktopTopBar = memo<DesktopTopBarProps>(({ hideSideBar }) => {
  const theme = useTheme();
  const hasSideBar = !hideSideBar;
  const router = useRouter();

  const baseStyle: CSSProperties = {
    alignItems: 'center',
    borderBottom: `1px solid ${theme.colorBorderSecondary}`,
    display: 'flex',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingBlock: 8,
    paddingInline: hideSideBar ? 20 : 24,
    position: 'sticky',
    top: 0,
    width: '100%',
    zIndex: 2,
  };

  const visualStyle: CSSProperties = hasSideBar
    ? {
        backdropFilter: 'none',
        background: theme.colorBgLayout,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 12,
        boxShadow: 'none',
      }
    : {
        backdropFilter: 'blur(10px)',
        background: theme.colorBgElevated,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        boxShadow: `0 8px 18px ${theme.colorFillSecondary}`,
        position: 'relative',
        top: 'auto',
        zIndex: 0,
      };

  return (
    <div
      className={electronStylish.nodrag}
      data-testid={'desktop-topbar'}
      style={{ ...baseStyle, ...visualStyle }}
    >
      <Flexbox align={'center'} gap={8} horizontal>
        <ProductLogo size={28} type={'text'} />
      </Flexbox>
      {hasSideBar ? (
        <Avatar />
      ) : (
        <ActionIcon
          icon={LucideX}
          onClick={() => router.push('/chat')}
          size={{ blockSize: 32, size: 18 }}
          style={{ color: theme.colorText }}
          title={'关闭设置'}
        />
      )}
    </div>
  );
});

DesktopTopBar.displayName = 'DesktopTopBar';

export default DesktopTopBar;
