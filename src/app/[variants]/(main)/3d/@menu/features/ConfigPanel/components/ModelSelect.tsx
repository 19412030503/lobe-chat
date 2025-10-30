import { ActionIcon, Icon, Select, type SelectProps } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { LucideArrowRight, LucideBolt } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { ModelItemRender, ProviderItemRender } from '@/components/ModelSelect';
import { isDeprecatedEdition } from '@/const/version';
import { useAiInfraStore } from '@/store/aiInfra';
import { aiProviderSelectors } from '@/store/aiInfra/slices/aiProvider/selectors';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useThreeDStore } from '@/store/threeD';
import { threeDGenerationConfigSelectors } from '@/store/threeD/slices/generationConfig/selectors';
import { EnabledProviderWithModels } from '@/types/aiProvider';

const useStyles = createStyles(({ css, prefixCls }) => ({
  popup: css`
    &.${prefixCls}-select-dropdown .${prefixCls}-select-item-option-grouped {
      padding-inline-start: 12px;
    }
  `,
}));

interface ModelOption {
  label: any;
  provider: string;
  value: string;
}

const ModelSelect = memo(() => {
  const { styles } = useStyles();
  const { t } = useTranslation('components');
  const theme = useTheme();
  const { showLLM } = useServerConfigStore(featureFlagsSelectors);
  const router = useRouter();

  const [currentModel, currentProvider] = useThreeDStore((s) => [
    threeDGenerationConfigSelectors.model(s),
    threeDGenerationConfigSelectors.provider(s),
  ]);
  const setModelAndProviderOnSelect = useThreeDStore((s) => s.setModelAndProviderOnSelect);

  const enabledThreeDModelList = useAiInfraStore(aiProviderSelectors.enabledThreeDModelList);

  const options = useMemo<SelectProps['options']>(() => {
    const getThreeDModels = (provider: EnabledProviderWithModels) => {
      const modelOptions = provider.children.map((model) => ({
        label: <ModelItemRender {...model} {...model.abilities} showInfoTag={false} />,
        provider: provider.id,
        value: `${provider.id}/${model.id}`,
      }));

      // if there are no models, add a placeholder guide
      if (modelOptions.length === 0) {
        return [
          {
            disabled: true,
            label: (
              <Flexbox gap={8} horizontal style={{ color: theme.colorTextTertiary }}>
                {t('ModelSwitchPanel.emptyModel')}
                <Icon icon={LucideArrowRight} />
              </Flexbox>
            ),
            onClick: () => {
              router.push(
                isDeprecatedEdition
                  ? '/settings?active=llm'
                  : `/settings?active=provider&provider=${provider.id}`,
              );
            },
            value: `${provider.id}/empty`,
          },
        ];
      }

      return modelOptions;
    };

    // if there are no providers at all
    if (enabledThreeDModelList.length === 0) {
      return [
        {
          disabled: true,
          label: (
            <Flexbox gap={8} horizontal style={{ color: theme.colorTextTertiary }}>
              {t('ModelSwitchPanel.emptyProvider')}
              <Icon icon={LucideArrowRight} />
            </Flexbox>
          ),
          onClick: () => {
            router.push(isDeprecatedEdition ? '/settings?active=llm' : '/settings?active=provider');
          },
          value: 'no-provider',
        },
      ];
    }

    if (enabledThreeDModelList.length === 1) {
      const provider = enabledThreeDModelList[0];
      return getThreeDModels(provider);
    }

    return enabledThreeDModelList.map((provider) => ({
      label: (
        <Flexbox horizontal justify="space-between">
          <ProviderItemRender
            logo={provider.logo}
            name={provider.name}
            provider={provider.id}
            source={provider.source}
          />
          {showLLM && (
            <Link
              href={
                isDeprecatedEdition
                  ? '/settings?active=llm'
                  : `/settings?active=provider&provider=${provider.id}`
              }
            >
              <ActionIcon
                icon={LucideBolt}
                size={'small'}
                title={t('ModelSwitchPanel.goToSettings')}
              />
            </Link>
          )}
        </Flexbox>
      ),
      options: getThreeDModels(provider),
    }));
  }, [enabledThreeDModelList, showLLM, t, theme.colorTextTertiary, router]);

  return (
    <Select
      classNames={{
        root: styles.popup,
      }}
      onChange={(value, option) => {
        // Skip onChange for disabled options (empty states)
        if (value === 'no-provider' || value.includes('/empty')) return;
        const model = value.split('/').slice(1).join('/');
        const provider = (option as unknown as ModelOption).provider;
        if (model !== currentModel || provider !== currentProvider) {
          setModelAndProviderOnSelect(model, provider);
        }
      }}
      options={options}
      shadow
      size={'large'}
      style={{
        width: '100%',
      }}
      value={currentProvider && currentModel ? `${currentProvider}/${currentModel}` : undefined}
    />
  );
});

export default ModelSelect;
