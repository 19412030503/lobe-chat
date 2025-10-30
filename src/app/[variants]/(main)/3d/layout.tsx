import ServerLayout from '@/components/server/ServerLayout';
import { isServerMode } from '@/const/version';

import NotSupportClient from './NotSupportClient';
import Desktop from './_layout/Desktop';
import Mobile from './_layout/Mobile';
import { LayoutProps } from './_layout/type';

const Ai3DLayout = ServerLayout({ Desktop, Mobile });

Ai3DLayout.displayName = 'Ai3DLayout';

const Layout = (props: LayoutProps) => {
  if (!isServerMode) return <NotSupportClient />;

  return <Ai3DLayout {...props} />;
};

export default Layout;
