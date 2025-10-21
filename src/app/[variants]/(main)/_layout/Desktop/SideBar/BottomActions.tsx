import { ChevronsLeft, ChevronsRight, FlaskConical, Github } from 'lucide-react';
import { MouseEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { GITHUB } from '@/const/url';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import NavItem from './NavItem';

export interface BottomActionsProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const BottomActions = memo<BottomActionsProps>(({ collapsed, onToggleCollapse }) => {
  const { t } = useTranslation('common');

  const { hideGitHub } = useServerConfigStore(featureFlagsSelectors);

  const toggleLabel = collapsed ? t('nav.expand') : t('nav.collapse');
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;

  const handleToggle = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    event.preventDefault();
    onToggleCollapse();
  };

  return (
    <Flexbox gap={8}>
      {!hideGitHub && (
        <NavItem
          collapsed={collapsed}
          href={GITHUB}
          icon={Github}
          label={'GitHub'}
          rel="noreferrer"
          target="_blank"
        />
      )}
      <NavItem collapsed={collapsed} href={'/labs'} icon={FlaskConical} label={t('labs')} />
      <NavItem collapsed={collapsed} icon={ToggleIcon} label={toggleLabel} onClick={handleToggle} />
    </Flexbox>
  );
});

export default BottomActions;
