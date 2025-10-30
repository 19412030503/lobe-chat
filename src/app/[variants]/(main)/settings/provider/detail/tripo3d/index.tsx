import { useTranslation } from 'react-i18next';

import { FormPassword } from '@/components/FormInput';
import { Tripo3DProviderCard } from '@/config/modelProviders';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { GlobalLLMProviderKey } from '@/types/user/settings';

import { KeyVaultsConfigKey } from '../../const';
import { SkeletonInput } from '../../features/ProviderConfig';
import { ProviderItem } from '../../type';
import ProviderDetail from '../default';

const providerKey: GlobalLLMProviderKey = 'tripo3d';

const useTripo3DCard = (): ProviderItem => {
  const { t } = useTranslation('modelProvider');
  const isLoading = useAiInfraStore(aiProviderSelectors.isAiProviderConfigLoading(providerKey));

  return {
    ...Tripo3DProviderCard,
    apiKeyItems: [
      {
        children: isLoading ? (
          <SkeletonInput />
        ) : (
          <FormPassword autoComplete="new-password" placeholder={t('tripo3d.apiKey.placeholder')} />
        ),
        desc: t('tripo3d.apiKey.desc'),
        label: t('tripo3d.apiKey.title'),
        name: [KeyVaultsConfigKey, 'apiKey'],
      },
    ],
  };
};

const Tripo3DDetailPage = () => {
  const card = useTripo3DCard();
  return <ProviderDetail {...card} />;
};

export default Tripo3DDetailPage;
