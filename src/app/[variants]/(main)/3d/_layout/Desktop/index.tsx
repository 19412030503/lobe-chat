import { Flexbox } from 'react-layout-kit';

import ThreeDPanel from '@/features/ThreeDSidePanel';
import ThreeDTopicPanel from '@/features/ThreeDTopicPanel';

import InitializeThreeD from '../../features/InitializeThreeD';
import { LayoutProps } from '../type';
import Container from './Container';
import RegisterHotkeys from './RegisterHotkeys';

const Layout = ({ children, menu, topic }: LayoutProps) => {
  return (
    <>
      <InitializeThreeD />
      <Flexbox
        height={'100%'}
        horizontal
        style={{ maxWidth: '100%', overflow: 'hidden', position: 'relative' }}
        width={'100%'}
      >
        <ThreeDPanel>{menu}</ThreeDPanel>
        <Container>{children}</Container>
        <ThreeDTopicPanel>{topic}</ThreeDTopicPanel>
      </Flexbox>
      <RegisterHotkeys />
    </>
  );
};

Layout.displayName = 'DesktopAi3DLayout';

export default Layout;
