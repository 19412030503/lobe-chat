import { useEffect } from 'react';
import { useHotkeysContext } from 'react-hotkeys-hook';

import { FOLDER_WIDTH } from '@/const/layoutTokens';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { HotkeyEnum, HotkeyScopeEnum } from '@/types/hotkey';

import { useHotkeyById } from './useHotkeyById';

export const useToggleThreeDLeftPanelHotkey = () => {
  const showThreeDPanel = useGlobalStore(systemStatusSelectors.showThreeDPanel);
  const updateSystemStatus = useGlobalStore((s) => s.updateSystemStatus);

  return useHotkeyById(HotkeyEnum.ToggleLeftPanel, () =>
    updateSystemStatus({
      showThreeDPanel: !showThreeDPanel,
      threeDPanelWidth: showThreeDPanel ? 0 : FOLDER_WIDTH,
    }),
  );
};

export const useToggleThreeDRightPanelHotkey = () => {
  const showThreeDTopicPanel = useGlobalStore(systemStatusSelectors.showThreeDTopicPanel);
  const updateSystemStatus = useGlobalStore((s) => s.updateSystemStatus);

  return useHotkeyById(HotkeyEnum.ToggleRightPanel, () =>
    updateSystemStatus({
      showThreeDTopicPanel: !showThreeDTopicPanel,
      threeDTopicPanelWidth: showThreeDTopicPanel ? 0 : 80,
    }),
  );
};

// 注册聚合

export const useRegisterThreeDHotkeys = () => {
  const { enableScope, disableScope } = useHotkeysContext();

  // Layout
  useToggleThreeDLeftPanelHotkey();
  useToggleThreeDRightPanelHotkey();

  useEffect(() => {
    enableScope(HotkeyScopeEnum.ThreeD);
    return () => disableScope(HotkeyScopeEnum.ThreeD);
  }, []);
};
