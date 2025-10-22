import { DatabaseLoadingState } from '@/types/clientDB';

export enum AppLoadingStage {
  GoToHome = 'goToHome',
  Idle = 'appIdle',
  InitAuth = 'initAuth',
  InitUser = 'initUser',
  Initializing = 'appInitializing',
}

export const SERVER_LOADING_STAGES = [
  AppLoadingStage.Idle,
  AppLoadingStage.Initializing,
  AppLoadingStage.InitAuth,
  AppLoadingStage.InitUser,
  AppLoadingStage.GoToHome,
];

export const CLIENT_LOADING_STAGES = [
  AppLoadingStage.Idle,
  AppLoadingStage.Initializing,
  DatabaseLoadingState.Initializing,
  DatabaseLoadingState.LoadingDependencies,
  DatabaseLoadingState.LoadingWasm,
  DatabaseLoadingState.Migrating,
  DatabaseLoadingState.Finished,
  DatabaseLoadingState.Ready,
  AppLoadingStage.InitUser,
  AppLoadingStage.GoToHome,
] as string[];
