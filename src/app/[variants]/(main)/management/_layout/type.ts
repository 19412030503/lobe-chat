import { ReactNode } from 'react';

export interface LayoutProps {
  children?: ReactNode;
}

export enum ManagementTabs {
  Organizations = 'organizations',
  Users = 'users',
}
