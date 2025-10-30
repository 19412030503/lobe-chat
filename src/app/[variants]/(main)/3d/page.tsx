import { Suspense } from 'react';

import StructuredData from '@/components/StructuredData';
import { BRANDING_NAME } from '@/const/branding';
import InitClientDB from '@/features/InitClientDB';
import { ldModule } from '@/server/ld';
import { metadataModule } from '@/server/metadata';
import { translation } from '@/server/translation';
import { DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

import ThreeDWorkspace from './features/ThreeDWorkspace';
import SkeletonList from './features/ThreeDWorkspace/SkeletonList';

export const generateMetadata = async (props: DynamicLayoutProps) => {
  const locale = await RouteVariants.getLocale(props);
  const { t } = await translation('metadata', locale);
  return metadataModule.generate({
    description: t('threeD.description', { appName: BRANDING_NAME }),
    title: t('threeD.title'),
    url: '/3d',
  });
};

const Ai3D = async (props: DynamicLayoutProps) => {
  const { locale } = await RouteVariants.getVariantsFromProps(props);
  const { t } = await translation('metadata', locale);
  const ld = ldModule.generate({
    description: t('threeD.description', { appName: BRANDING_NAME }),
    title: t('threeD.title'),
    url: '/3d',
  });

  return (
    <>
      <StructuredData ld={ld} />
      <InitClientDB bottom={100} />
      <Suspense fallback={<SkeletonList />}>
        <ThreeDWorkspace />
      </Suspense>
    </>
  );
};

Ai3D.displayName = 'Ai3D';

export default Ai3D;
