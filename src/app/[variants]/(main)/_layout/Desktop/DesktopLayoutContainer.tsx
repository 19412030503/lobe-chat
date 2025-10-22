'use client';

import { PropsWithChildren, memo } from 'react';
import { Flexbox } from 'react-layout-kit';

const DesktopLayoutContainer = memo<PropsWithChildren>(({ children }) => {
  return (
    <Flexbox flex={1} style={{ height: '100%', overflow: 'hidden' }} width={'100%'}>
      {children}
    </Flexbox>
  );
});

DesktopLayoutContainer.displayName = 'DesktopLayoutContainer';

export default DesktopLayoutContainer;
