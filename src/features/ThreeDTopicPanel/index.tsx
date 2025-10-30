'use client';

import { DraggablePanel, DraggablePanelContainer, type DraggablePanelProps } from '@lobehub/ui';
import { createStyles, useResponsive } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { PropsWithChildren, memo, useEffect, useState } from 'react';

import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

export const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    height: 100%;
    background: ${token.colorBgContainerSecondary};
  `,
}));

const ThreeDTopicPanel = memo<PropsWithChildren>(({ children }) => {
  const { md = true } = useResponsive();

  const { styles } = useStyles();
  const [threeDTopicPanelWidth, showThreeDTopicPanel, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.threeDTopicPanelWidth(s),
    systemStatusSelectors.showThreeDTopicPanel(s),
    s.updateSystemStatus,
  ]);

  const [tmpWidth, setWidth] = useState(threeDTopicPanelWidth);
  if (tmpWidth !== threeDTopicPanelWidth) setWidth(threeDTopicPanelWidth);
  const [cacheExpand, setCacheExpand] = useState<boolean>(Boolean(showThreeDTopicPanel));

  const handleExpand = (expand: boolean) => {
    if (isEqual(expand, showThreeDTopicPanel)) return;
    updateSystemStatus({ showThreeDTopicPanel: expand });
    setCacheExpand(expand);
  };
  useEffect(() => {
    if (md && cacheExpand) updateSystemStatus({ showThreeDTopicPanel: true });
    if (!md) updateSystemStatus({ showThreeDTopicPanel: false });
  }, [md, cacheExpand]);

  const handleSizeChange: DraggablePanelProps['onSizeChange'] = (_, size) => {
    if (!size) return;
    const nextWidth = typeof size.width === 'string' ? Number.parseInt(size.width) : size.width;
    if (!nextWidth) return;

    if (isEqual(nextWidth, threeDTopicPanelWidth)) return;
    setWidth(nextWidth);
    updateSystemStatus({ threeDTopicPanelWidth: nextWidth });
  };

  return (
    <DraggablePanel
      className={styles.panel}
      defaultSize={{ width: tmpWidth }}
      expand={showThreeDTopicPanel}
      maxWidth={320}
      minWidth={80}
      mode={md ? 'fixed' : 'float'}
      onExpandChange={handleExpand}
      onSizeChange={handleSizeChange}
      placement="right"
      size={{ height: '100%', width: threeDTopicPanelWidth }}
    >
      <DraggablePanelContainer
        style={{
          flex: 'none',
          height: '100%',
          minWidth: 80,
        }}
      >
        {children}
      </DraggablePanelContainer>
    </DraggablePanel>
  );
});

export default ThreeDTopicPanel;
