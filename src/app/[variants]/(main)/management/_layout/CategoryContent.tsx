'use client';

import { Icon } from '@lobehub/ui';
import { Building2, Users } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Menu from '@/components/Menu';
import type { MenuProps } from '@/components/Menu';
import { withSuspense } from '@/components/withSuspense';
import { ROOT_ROLE } from '@/const/rbac';
import { useUserRoles } from '@/hooks/useHasRole';

import { ManagementTabs } from './type';

type CategoryContentProps = {
  activeTab: string | undefined;
  onMenuSelect: (key: ManagementTabs) => void;
};

const CategoryContent = memo((props: CategoryContentProps) => {
  const { t } = useTranslation('setting');
  const { onMenuSelect, activeTab } = props;
  const roles = useUserRoles();
  const isRoot = useMemo(() => new Set(roles).has(ROOT_ROLE), [roles]);

  const cateItems: MenuProps['items'] = useMemo(
    () =>
      [
        {
          icon: <Icon icon={Users} />,
          key: ManagementTabs.Users,
          label: t('management.tabs.users'),
        },
        isRoot && {
          icon: <Icon icon={Building2} />,
          key: ManagementTabs.Organizations,
          label: t('management.tabs.organizations'),
        },
      ].filter(Boolean) as MenuProps['items'],
    [t, isRoot],
  );

  return (
    <Menu
      compact
      defaultSelectedKeys={[activeTab || ManagementTabs.Users]}
      items={cateItems}
      onClick={({ key }) => {
        onMenuSelect(key as ManagementTabs);
      }}
      selectable
    />
  );
});

export default withSuspense(CategoryContent);
