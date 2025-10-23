'use client';

import { Flexbox } from 'react-layout-kit';

const CoursePlaceholder = () => {
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
      <h2 style={{ margin: 0 }}>课程中心</h2>
      <p style={{ margin: 0 }}>课程中心开发中</p>
    </Flexbox>
  );
};

CoursePlaceholder.displayName = 'CoursePlaceholder';

export default CoursePlaceholder;
