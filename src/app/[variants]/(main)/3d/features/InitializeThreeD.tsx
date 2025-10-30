'use client';

import { memo, useEffect } from 'react';

import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useThreeDStore } from '@/store/threeD';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

/**
 * 初始化 3D 工作台配置
 * - 等待所有依赖状态就绪（全局状态、AI提供商、用户状态）
 * - 选择上次使用的模型
 * - 如果没有则选择列表第一个模型
 */
const InitializeThreeD = memo(() => {
  // 检查所有前置条件
  const isStatusInit = useGlobalStore(systemStatusSelectors.isStatusInit);
  const isProviderStateReady = useAiInfraStore(aiProviderSelectors.isInitAiProviderRuntimeState);

  const isAuthLoaded = useUserStore(authSelectors.isLoaded);
  const isLogin = useUserStore(authSelectors.isLogin);
  const isActualLogout = isAuthLoaded && isLogin === false;
  const isUserStateInit = useUserStore((s) => s.isUserStateInit);
  const isUserStateReady = isUserStateInit || isActualLogout;

  const isReady = isStatusInit && isProviderStateReady && isUserStateReady;

  const lastModel = useGlobalStore(systemStatusSelectors.lastSelectedThreeDModel);
  const lastProvider = useGlobalStore(systemStatusSelectors.lastSelectedThreeDProvider);
  const isInit = useThreeDStore((s) => s.isInit);
  const initializeConfig = useThreeDStore((s) => s.initializeConfig);

  useEffect(() => {
    console.log('[InitializeThreeD] Effect triggered:', {
      isInit,
      isLogin,
      isProviderStateReady,
      isReady,
      isStatusInit,
      isUserStateReady,
      lastModel,
      lastProvider,
    });

    // 必须等待所有依赖就绪后才能初始化
    if (!isInit && isReady) {
      console.log('[InitializeThreeD] All conditions met, calling initializeConfig...');
      initializeConfig(isLogin, lastModel, lastProvider);
    } else if (!isInit && !isReady) {
      console.log('[InitializeThreeD] Not ready yet, waiting...');
    } else {
      console.log('[InitializeThreeD] Already initialized, skipping');
    }
  }, [
    isInit,
    isReady,
    isLogin,
    lastModel,
    lastProvider,
    initializeConfig,
    // Debug only
    isStatusInit,
    isProviderStateReady,
    isUserStateReady,
  ]);

  return null;
});

InitializeThreeD.displayName = 'InitializeThreeD';

export default InitializeThreeD;
