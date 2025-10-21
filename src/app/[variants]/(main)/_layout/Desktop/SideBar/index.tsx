'use client';

import { SideNav } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { Suspense, memo, useCallback } from 'react';

import { isDesktop } from '@/const/version';
import { useActiveTabKey } from '@/hooks/useActiveTabKey';
import { useIsSingleMode } from '@/hooks/useIsSingleMode';
import { usePinnedAgentState } from '@/hooks/usePinnedAgentState';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { electronStylish } from '@/styles/electron';

import Avatar from './Avatar';
import BottomActions from './BottomActions';
import PinList from './PinList';
import TopActions from './TopActions';

const Top = ({ collapsed }: { collapsed: boolean }) => {
  const [isPinned] = usePinnedAgentState();
  const sidebarKey = useActiveTabKey();

  return <TopActions collapsed={collapsed} isPinned={isPinned} tab={sidebarKey} />;
};

const Nav = memo(() => {
  const theme = useTheme();
  const isSingleMode = useIsSingleMode();
  const inZenMode = useGlobalStore(systemStatusSelectors.inZenMode);
  const [collapsed, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.isSideNavCollapsed(s),
    s.updateSystemStatus,
  ]);
  const { showPinList } = useServerConfigStore(featureFlagsSelectors);

  const handleToggleCollapse = useCallback(() => {
    updateSystemStatus({ sideNavCollapsed: !collapsed });
  }, [collapsed, updateSystemStatus]);

  return (
    !inZenMode &&
    !isSingleMode && (
      <SideNav
        avatar={
          <div className={electronStylish.nodrag}>
            <Avatar />
          </div>
        }
        bottomActions={
          <div className={electronStylish.nodrag}>
            <BottomActions collapsed={collapsed} onToggleCollapse={handleToggleCollapse} />
          </div>
        }
        className={electronStylish.draggable}
        style={{
          height: '100%',
          zIndex: 100,
          ...(isDesktop
            ? {
                background: 'transparent',
                borderInlineEnd: 0,
                paddingBlockStart: 8,
              }
            : { background: theme.colorBgLayout }),
          paddingInline: collapsed ? 4 : 12,
          transition: `width 200ms ${theme.motionEaseInOut}, padding 200ms ${theme.motionEaseInOut}`,
          width: collapsed ? 56 : 176,
        }}
        topActions={
          <Suspense>
            <div
              className={electronStylish.nodrag}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxHeight: isDesktop ? 'calc(100vh - 180px)' : 'calc(100vh - 150px)',
              }}
            >
              <Top collapsed={collapsed} />
              {showPinList && <PinList collapsed={collapsed} />}
            </div>
          </Suspense>
        }
      />
    )
  );
});

Nav.displayName = 'DesktopNav';

export default Nav;
