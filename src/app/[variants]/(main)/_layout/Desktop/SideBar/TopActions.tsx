import { Compass, FolderClosed, MessageSquare, Palette } from 'lucide-react';
import { MouseEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useGlobalStore } from '@/store/global';
import { SidebarTabKey } from '@/store/global/initialState';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useSessionStore } from '@/store/session';

import NavItem from './NavItem';

export interface TopActionProps {
  collapsed?: boolean;
  isPinned?: boolean | null;
  tab?: SidebarTabKey;
}

const TopActions = memo<TopActionProps>(({ tab, isPinned, collapsed = false }) => {
  const { t } = useTranslation('common');
  const switchBackToChat = useGlobalStore((s) => s.switchBackToChat);
  const { showMarket, enableKnowledgeBase, showAiImage } =
    useServerConfigStore(featureFlagsSelectors);

  const isChatActive = tab === SidebarTabKey.Chat && !isPinned;
  const isFilesActive = tab === SidebarTabKey.Files;
  const isDiscoverActive = tab === SidebarTabKey.Discover;
  const isImageActive = tab === SidebarTabKey.Image;

  const handleChatClick = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (event.metaKey || event.ctrlKey) return;

    event.preventDefault();
    switchBackToChat(useSessionStore.getState().activeId);
  };

  return (
    <Flexbox gap={8}>
      <NavItem
        active={isChatActive}
        collapsed={collapsed}
        href={'/chat'}
        icon={MessageSquare}
        label={t('tab.chat')}
        onClick={handleChatClick}
      />
      {enableKnowledgeBase && (
        <NavItem
          active={isFilesActive}
          collapsed={collapsed}
          href={'/files'}
          icon={FolderClosed}
          label={t('tab.files')}
        />
      )}
      {showAiImage && (
        <NavItem
          active={isImageActive}
          collapsed={collapsed}
          href={'/image'}
          icon={Palette}
          label={t('tab.aiImage')}
        />
      )}
      {showMarket && (
        <NavItem
          active={isDiscoverActive}
          collapsed={collapsed}
          href={'/discover'}
          icon={Compass}
          label={t('tab.discover')}
        />
      )}
    </Flexbox>
  );
});

export default TopActions;
