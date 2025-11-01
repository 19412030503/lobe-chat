import { ReactNode } from 'react';

export interface LayoutProps {
  children?: ReactNode;
}

export enum ManagementTabs {
  Organizations = 'organizations',
  Quota = 'quota',
  Statistics = 'statistics',
  Usage = 'usage',
  Users = 'users',
}
