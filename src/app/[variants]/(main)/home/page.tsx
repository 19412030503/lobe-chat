import type { Metadata } from 'next';

import HomeClient from './Client';

export const metadata: Metadata = {
  title: '首页 | LobeChat',
};

const Page = () => {
  return <HomeClient />;
};

Page.displayName = 'Home';

export default Page;
