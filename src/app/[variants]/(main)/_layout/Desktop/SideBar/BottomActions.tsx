import { ChevronsLeft, ChevronsRight, FolderClosed } from 'lucide-react';
import { MouseEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import NavItem from './NavItem';

export interface BottomActionsProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const BottomActions = memo<BottomActionsProps>(({ collapsed, onToggleCollapse }) => {
  const { t } = useTranslation('common');
  const { enableKnowledgeBase } = useServerConfigStore(featureFlagsSelectors);

  const toggleLabel = collapsed ? t('nav.expand') : t('nav.collapse');
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;

  const handleToggle = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    event.preventDefault();
    onToggleCollapse();
  };

  return (
    <Flexbox gap={8}>
      {enableKnowledgeBase && (
        <NavItem collapsed={collapsed} href={'/files'} icon={FolderClosed} label={t('tab.files')} />
      )}
      <NavItem collapsed={collapsed} icon={ToggleIcon} label={toggleLabel} onClick={handleToggle} />
    </Flexbox>
  );
});

export default BottomActions;
