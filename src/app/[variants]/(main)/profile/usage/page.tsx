import { notFound } from 'next/navigation';

import { isMobileDevice } from '@/utils/server/responsive';

import Desktop from './_layout/Desktop';
import Mobile from './_layout/Mobile';

const Page = async () => {
  const mobile = await isMobileDevice();
  const Layout = mobile ? Mobile : Desktop;

  if (!Layout) return notFound();

  return <Layout />;
};

Page.displayName = 'ProfileUsagePage';

export default Page;
