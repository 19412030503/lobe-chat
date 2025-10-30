'use client';

import { Icon, Text } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import { Box } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Center } from 'react-layout-kit';

const PromptTitle = () => {
  const { t } = useTranslation('threeD');
  const theme = useTheme();

  return (
    <Center gap={16} horizontal style={{ width: '100%' }}>
      <Center
        flex={'none'}
        height={54}
        style={{
          backgroundColor: theme.colorText,
          borderRadius: 16,
        }}
        width={54}
      >
        <Icon color={theme.colorBgLayout} icon={Box} size={32} />
      </Center>
      <Text
        as={'h1'}
        style={{
          margin: 0,
        }}
      >
        {t('workspace.config.header.title')}
      </Text>
    </Center>
  );
};

export default PromptTitle;
