import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCanonicalUrl } from '@/server/utils/url';

export const metadata: Metadata = {
  alternates: { canonical: getCanonicalUrl('/') },
};

const RootPage = () => {
  redirect('/home');
};

export default RootPage;
