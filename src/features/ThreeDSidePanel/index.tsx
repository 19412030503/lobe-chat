'use client';

import { DraggablePanel, DraggablePanelContainer, type DraggablePanelProps } from '@lobehub/ui';
import { createStyles, useResponsive } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { PropsWithChildren, memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import PanelTitle from '@/components/PanelTitle';
import { FOLDER_WIDTH } from '@/const/layoutTokens';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

export const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    height: 100%;
    background: ${token.colorBgLayout};
  `,
}));

const ThreeDSidePanel = memo<PropsWithChildren>(({ children }) => {
  const { md = true } = useResponsive();
  const { t } = useTranslation('threeD');
  const { styles } = useStyles();
  const [threeDPanelWidth, showThreeDPanel, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.threeDPanelWidth(s),
    systemStatusSelectors.showThreeDPanel(s),
    s.updateSystemStatus,
  ]);

  const [tmpWidth, setWidth] = useState(threeDPanelWidth);
  if (tmpWidth !== threeDPanelWidth) setWidth(threeDPanelWidth);
  const [cacheExpand, setCacheExpand] = useState<boolean>(Boolean(showThreeDPanel));

  const handleExpand = (expand: boolean) => {
    if (isEqual(expand, showThreeDPanel)) return;
    updateSystemStatus({ showThreeDPanel: expand });
    setCacheExpand(expand);
  };
  useEffect(() => {
    if (md && cacheExpand) updateSystemStatus({ showThreeDPanel: true });
    if (!md) updateSystemStatus({ showThreeDPanel: false });
  }, [md, cacheExpand]);

  const handleSizeChange: DraggablePanelProps['onSizeChange'] = (_, size) => {
    if (!size) return;
    const nextWidth = typeof size.width === 'string' ? Number.parseInt(size.width) : size.width;
    if (!nextWidth) return;

    if (isEqual(nextWidth, threeDPanelWidth)) return;
    setWidth(nextWidth);
    updateSystemStatus({ threeDPanelWidth: nextWidth });
  };

  return (
    <DraggablePanel
      className={styles.panel}
      defaultSize={{ width: tmpWidth }}
      expand={showThreeDPanel}
      maxWidth={320}
      minWidth={FOLDER_WIDTH}
      mode={md ? 'fixed' : 'float'}
      onExpandChange={handleExpand}
      onSizeChange={handleSizeChange}
      placement="left"
      size={{ height: '100%', width: threeDPanelWidth }}
    >
      <DraggablePanelContainer
        style={{
          flex: 'none',
          height: '100%',
          minWidth: FOLDER_WIDTH,
          zIndex: 10,
        }}
      >
        <PanelTitle title={t('workspace.config.header.simpleTitle', '建模')} />
        {children}
      </DraggablePanelContainer>
    </DraggablePanel>
  );
});

export default ThreeDSidePanel;
