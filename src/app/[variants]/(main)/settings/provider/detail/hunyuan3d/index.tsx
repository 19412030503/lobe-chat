import { useTranslation } from 'react-i18next';

import { FormInput, FormPassword } from '@/components/FormInput';
import { Hunyuan3DProviderCard } from '@/config/modelProviders';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { GlobalLLMProviderKey } from '@/types/user/settings';

import { KeyVaultsConfigKey } from '../../const';
import { SkeletonInput } from '../../features/ProviderConfig';
import { ProviderItem } from '../../type';
import ProviderDetail from '../default';

const providerKey: GlobalLLMProviderKey = 'hunyuan3d';

const useHunyuan3DCard = (): ProviderItem => {
  const { t } = useTranslation('modelProvider');
  const isLoading = useAiInfraStore(aiProviderSelectors.isAiProviderConfigLoading(providerKey));

  return {
    ...Hunyuan3DProviderCard,
    apiKeyItems: [
      {
        children: isLoading ? (
          <SkeletonInput />
        ) : (
          <FormPassword
            autoComplete="new-password"
            placeholder={t('hunyuan3d.secretKey.placeholder')}
          />
        ),
        desc: t('hunyuan3d.secretKey.desc'),
        label: t('hunyuan3d.secretKey.title'),
        name: [KeyVaultsConfigKey, 'apiKey'],
      },
      {
        children: isLoading ? (
          <SkeletonInput />
        ) : (
          <FormInput allowClear placeholder={t('hunyuan3d.secretId.placeholder')} />
        ),
        desc: t('hunyuan3d.secretId.desc'),
        label: t('hunyuan3d.secretId.title'),
        name: [KeyVaultsConfigKey, 'secretId'],
      },
      {
        children: isLoading ? (
          <SkeletonInput />
        ) : (
          <FormInput allowClear placeholder={t('hunyuan3d.version.placeholder')} />
        ),
        desc: t('hunyuan3d.version.desc'),
        label: t('hunyuan3d.version.title'),
        name: [KeyVaultsConfigKey, 'version'],
      },
      {
        children: isLoading ? (
          <SkeletonInput />
        ) : (
          <FormInput allowClear placeholder={t('hunyuan3d.region.placeholder')} />
        ),
        desc: t('hunyuan3d.region.desc'),
        label: t('hunyuan3d.region.title'),
        name: [KeyVaultsConfigKey, 'region'],
      },
    ],
  };
};

const Page = () => {
  const card = useHunyuan3DCard();

  return <ProviderDetail {...card} />;
};

export default Page;
