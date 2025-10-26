'use client';

import { useEffect } from 'react';

import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useThreeDStore } from '@/store/threeD';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

export const useThreeDConfig = () => {
  const isStatusInit = useGlobalStore(systemStatusSelectors.isStatusInit);
  const isProviderStateReady = useAiInfraStore(aiProviderSelectors.isInitAiProviderRuntimeState);

  const isAuthLoaded = useUserStore(authSelectors.isLoaded);
  const isLogin = useUserStore(authSelectors.isLogin);
  const isActualLogout = isAuthLoaded && isLogin === false;
  const isUserStateInit = useUserStore((s) => s.isUserStateInit);
  const isUserStateReady = isUserStateInit || isActualLogout;

  const isReady = isStatusInit && isProviderStateReady && isUserStateReady;

  const { lastSelectedThreeDModel, lastSelectedThreeDProvider } = useGlobalStore((s) => ({
    lastSelectedThreeDModel: s.status.lastSelectedThreeDModel,
    lastSelectedThreeDProvider: s.status.lastSelectedThreeDProvider,
  }));

  const isInitialized = useThreeDStore((s) => s.isInit);
  const initializeConfig = useThreeDStore((s) => s.initializeConfig);

  useEffect(() => {
    if (!isInitialized && isReady) {
      initializeConfig(isLogin, lastSelectedThreeDModel, lastSelectedThreeDProvider);
    }
  }, [
    initializeConfig,
    isInitialized,
    isReady,
    isLogin,
    lastSelectedThreeDModel,
    lastSelectedThreeDProvider,
  ]);
};
