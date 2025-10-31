import ServerLayout from '@/components/server/ServerLayout';
import { metadataModule } from '@/server/metadata';
import { translation } from '@/server/translation';
import { DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

import Desktop from './_layout/Desktop';
import Mobile from './_layout/Mobile';
import { LayoutProps } from './_layout/type';

export const generateMetadata = async (props: DynamicLayoutProps) => {
  const locale = await RouteVariants.getLocale(props);
  const { t } = await translation('setting', locale);
  return metadataModule.generate({
    description: t('management.header.desc'),
    title: t('management.header.title'),
    url: '/management',
  });
};

const ManagementLayout = ServerLayout<LayoutProps>({ Desktop, Mobile });

const ManagementPage = async (props: DynamicLayoutProps) => {
  // @ts-expect-error - ServerLayout type compatibility issue
  return <ManagementLayout {...props} />;
};

export default ManagementPage;
