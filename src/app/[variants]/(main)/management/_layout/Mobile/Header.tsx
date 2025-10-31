'use client';

import { ActionIcon } from '@lobehub/ui';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import MobileNavLayout from '@/components/server/MobileNavLayout';

const Header = memo(() => {
  const { t } = useTranslation('setting');
  const router = useRouter();

  return (
    <MobileNavLayout
      header={
        <>
          <ActionIcon
            icon={ArrowLeft}
            onClick={() => router.back()}
            size={{ blockSize: 32, size: 18 }}
          />
          {t('management.header.title')}
        </>
      }
    />
  );
});

export default Header;
