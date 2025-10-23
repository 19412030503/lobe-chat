'use client';

import { Flexbox } from 'react-layout-kit';

const ModelPlaceholder = () => {
  return (
    <Flexbox
      align={'center'}
      gap={12}
      justify={'center'}
      style={{
        color: 'var(--ant-color-text-secondary)',
        minHeight: '100%',
        padding: 32,
        textAlign: 'center',
        width: '100%',
      }}
    >
      <h2 style={{ margin: 0 }}>AI 建模</h2>
      <p style={{ margin: 0 }}>AI 建模开发中</p>
    </Flexbox>
  );
};

ModelPlaceholder.displayName = 'ModelPlaceholder';

export default ModelPlaceholder;
