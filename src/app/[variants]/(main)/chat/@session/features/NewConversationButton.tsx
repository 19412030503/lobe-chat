'use client';

import { Button } from 'antd';
import { MessageSquarePlus } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { INBOX_SESSION_ID } from '@/const/session';
import { useSwitchSession } from '@/hooks/useSwitchSession';
import { getChatStoreState, useChatStore } from '@/store/chat';
import { chatSelectors } from '@/store/chat/selectors';
import { useServerConfigStore } from '@/store/serverConfig';
import { useSessionStore } from '@/store/session';

const NewConversationButton = memo(() => {
  const { t } = useTranslation('chat');
  const switchSession = useSwitchSession();
  const mobile = useServerConfigStore((s) => s.isMobile);
  const activeId = useSessionStore((s) => s.activeId);
  const openNewTopicOrSaveTopic = useChatStore((s) => s.openNewTopicOrSaveTopic);

  const handleClick = useCallback(async () => {
    if (activeId === INBOX_SESSION_ID && !mobile) {
      const inboxMessages = chatSelectors.inboxActiveTopicMessages(getChatStoreState());

      if (inboxMessages.length > 0) {
        await openNewTopicOrSaveTopic();
        return;
      }
    }

    switchSession(INBOX_SESSION_ID);
  }, [activeId, mobile, openNewTopicOrSaveTopic, switchSession]);

  return (
    <Button
      block
      icon={<MessageSquarePlus size={16} />}
      onClick={handleClick}
      size="large"
      type="primary"
    >
      {t('inbox.title')}
    </Button>
  );
});

NewConversationButton.displayName = 'NewConversationButton';

export default NewConversationButton;
