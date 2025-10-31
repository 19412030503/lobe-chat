'use client';

import { ActionIcon } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/chat';
import { Drawer, type DrawerProps } from 'antd';
import { createStyles } from 'antd-style';
import { Menu } from 'lucide-react';
import { ReactNode, memo, useState } from 'react';

import BrandWatermark from '@/components/BrandWatermark';

const useStyles = createStyles(({ token, css }) => ({
  container: css`
    position: relative;
    flex: none;
    height: 54px;
    background: ${token.colorBgLayout};
  `,
  title: css`
    font-size: 18px;
    font-weight: 700;
  `,
}));

export interface HeaderProps {
  children?: ReactNode;
  getContainer?: DrawerProps['getContainer'];
}

const Header = memo<HeaderProps>(({ children, getContainer }) => {
  const { styles, theme } = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ChatHeader
        className={styles.container}
        left={
          <ActionIcon
            icon={Menu}
            onClick={() => setOpen(true)}
            size={{ blockSize: 32, size: 18 }}
            style={{ border: 'none' }}
          />
        }
        style={{ borderBottom: `1px solid ${theme.colorSplit}` }}
        styles={{
          left: {
            padding: 0,
          },
        }}
      />
      <Drawer
        getContainer={getContainer}
        onClick={() => setOpen(false)}
        onClose={() => setOpen(false)}
        open={open}
        placement={'left'}
        rootStyle={{ position: 'absolute' }}
        style={{
          background: theme.colorBgLayout,
          borderRight: `1px solid ${theme.colorSplit}`,
        }}
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            justifyContent: 'space-between',
            padding: 16,
          },
          header: { display: 'none' },
          mask: { background: 'transparent' },
        }}
        width={260}
        zIndex={10}
      >
        {children}
        <BrandWatermark paddingInline={12} />
      </Drawer>
    </>
  );
});

export default Header;
