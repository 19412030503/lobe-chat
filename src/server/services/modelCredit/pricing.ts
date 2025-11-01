import type { LobeChatDatabase } from '@lobechat/database';
import type { Pricing } from 'model-bank';

import { AiInfraRepos } from '@/database/repositories/aiInfra';
import { getServerGlobalConfig } from '@/server/globalConfig';
import type { ProviderConfig } from '@/types/user/settings';

export const createAiInfraRepos = async (db: LobeChatDatabase, userId: string) => {
  const { aiProvider } = await getServerGlobalConfig();
  const providerConfigs = (aiProvider ?? {}) as Record<string, ProviderConfig>;

  return new AiInfraRepos(db, userId, providerConfigs);
};

export const resolveModelPricing = async (
  repos: AiInfraRepos,
  providerId: string,
  modelId: string,
): Promise<Pricing | undefined> => {
  try {
    const models = await repos.getAiProviderModelList(providerId);
    return models.find((item) => item.id === modelId)?.pricing ?? undefined;
  } catch (error) {
    console.warn('[resolveModelPricing] failed to fetch pricing', error);
    return undefined;
  }
};
