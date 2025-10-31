import { ReactNode } from 'react';

export interface LayoutProps {
  children: ReactNode;
  menu: ReactNode;
}

const Layout = ({ children, menu }: LayoutProps) => {
  return (
    <>
      {menu}
      {children}
    </>
  );
};

Layout.displayName = 'CourseLayout';

export default Layout;
