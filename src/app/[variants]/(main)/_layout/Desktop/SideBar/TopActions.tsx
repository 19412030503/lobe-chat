import { BookOpen, Brain, Home, MessageSquare, Palette } from 'lucide-react';
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
  const { showAiImage } = useServerConfigStore(featureFlagsSelectors);

  const isHomeActive = tab === SidebarTabKey.Home;
  const isChatActive = tab === SidebarTabKey.Chat && !isPinned;
  const isModelActive = tab === SidebarTabKey.Modeling;
  const isCourseActive = tab === SidebarTabKey.Course;
  const isImageActive = tab === SidebarTabKey.Image;

  const handleChatClick = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (event.metaKey || event.ctrlKey) return;

    event.preventDefault();
    switchBackToChat(useSessionStore.getState().activeId);
  };

  return (
    <Flexbox gap={8}>
      <NavItem
        active={isHomeActive}
        collapsed={collapsed}
        href={'/home'}
        icon={Home}
        label={t('tab.home')}
      />
      <NavItem
        active={isChatActive}
        collapsed={collapsed}
        href={'/chat'}
        icon={MessageSquare}
        label={t('tab.chat')}
        onClick={handleChatClick}
      />
      {showAiImage && (
        <NavItem
          active={isImageActive}
          collapsed={collapsed}
          href={'/image'}
          icon={Palette}
          label={t('tab.aiImage')}
        />
      )}
      <NavItem
        active={isModelActive}
        collapsed={collapsed}
        href={'/3d'}
        icon={Brain}
        label={t('tab.aiModel')}
      />
      <NavItem
        active={isCourseActive}
        collapsed={collapsed}
        href={'/course'}
        icon={BookOpen}
        label={t('tab.courseCenter')}
      />
    </Flexbox>
  );
});

export default TopActions;
