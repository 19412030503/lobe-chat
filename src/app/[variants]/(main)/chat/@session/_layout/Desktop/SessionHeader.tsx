'use client';

import { createStyles } from 'antd-style';
import Image from 'next/image';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    padding: 16px;
  `,
  logoText: css`
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    color: ${token.colorText};
  `,
  logoWrapper: css`
    overflow: hidden;
    flex: none;
    border-radius: 12px;
  `,
}));

const SessionHeader = memo(() => {
  const { styles } = useStyles();

  return (
    <Flexbox align={'center'} className={styles.container} gap={12} horizontal>
      <div className={styles.logoWrapper}>
        <Image alt="对话" height={28} src="/icons/icon-192x192.png" width={28} />
      </div>
      <span className={styles.logoText}>对话</span>
    </Flexbox>
  );
});

SessionHeader.displayName = 'TopicSidebarHeader';

export default SessionHeader;
