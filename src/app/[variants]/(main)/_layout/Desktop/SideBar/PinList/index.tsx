import { Avatar, ScrollShadow, Tooltip } from '@lobehub/ui';
import { Divider } from 'antd';
import { createStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { Flexbox } from 'react-layout-kit';

import { usePinnedAgentState } from '@/hooks/usePinnedAgentState';
import { useSwitchSession } from '@/hooks/useSwitchSession';
import { useSessionStore } from '@/store/session';
import { sessionHelpers } from '@/store/session/helpers';
import { sessionSelectors } from '@/store/session/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';
import { HotkeyEnum, KeyEnum } from '@/types/hotkey';

const HANDLER_WIDTH = 4;

const useStyles = createStyles(({ css, token }) => ({
  button: css`
    width: 100%;
    padding: 0;
    border: none;

    text-align: start;

    background: none;

    &:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: 2px;
    }
  `,
  ink: css`
    &::before {
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline: -9px;
      transform: translateY(-50%);

      width: 0;
      height: 8px;
      border-start-end-radius: ${HANDLER_WIDTH}px;
      border-end-end-radius: ${HANDLER_WIDTH}px;

      opacity: 0;
      background: ${token.colorPrimary};

      transition:
        height 150ms ${token.motionEaseInOut},
        width 150ms ${token.motionEaseInOut},
        opacity 200ms ${token.motionEaseInOut};
    }

    &:hover {
      &::before {
        width: ${HANDLER_WIDTH}px;
        height: 24px;
        opacity: 1;
      }
    }
  `,
  inkActive: css`
    &::before {
      width: ${HANDLER_WIDTH}px;
      height: 40px;
      opacity: 1;
    }

    &:hover {
      &::before {
        width: ${HANDLER_WIDTH}px;
        height: 40px;
        opacity: 1;
      }
    }
  `,
  item: css`
    cursor: pointer;

    display: flex;
    gap: 10px;
    align-items: center;

    padding-block: 4px;
    padding-inline: 8px;
    border-radius: ${token.borderRadiusLG}px;

    color: ${token.colorTextSecondary};

    transition: all 0.2s ${token.motionEaseInOut};

    &:hover {
      color: ${token.colorText};
      background: ${token.colorFillSecondary};
    }
  `,
  itemActive: css`
    font-weight: 500;
    color: ${token.colorText};
    background: ${token.colorFillTertiary};
  `,
  title: css`
    overflow: hidden;
    flex: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

export interface PinListProps {
  collapsed: boolean;
}

const PinList = ({ collapsed }: PinListProps) => {
  const { styles, cx } = useStyles();
  const list = useSessionStore(sessionSelectors.pinnedSessions, isEqual);
  const [activeId] = useSessionStore((s) => [s.activeId]);
  const switchSession = useSwitchSession();
  const hotkey = useUserStore(settingsSelectors.getHotkeyById(HotkeyEnum.SwitchAgent));
  const hasList = list.length > 0;
  const [isPinned, { pinAgent }] = usePinnedAgentState();

  const switchAgent = (id: string) => {
    switchSession(id);
    pinAgent();
  };

  return (
    hasList && (
      <>
        <Divider style={{ marginBottom: 8, marginTop: 4 }} />
        <ScrollShadow height={'100%'} hideScrollBar={true} size={collapsed ? 36 : 44}>
          <Flexbox gap={collapsed ? 12 : 4} style={{ padding: '0' }}>
            {list.map((item, index) => {
              const title = sessionHelpers.getTitle(item.meta);
              const hotkeyLabel =
                index < 9 ? hotkey.replaceAll(KeyEnum.Number, String(index + 1)) : undefined;

              if (collapsed) {
                return (
                  <Flexbox key={item.id} style={{ position: 'relative' }}>
                    <Tooltip hotkey={hotkeyLabel} placement={'right'} title={title}>
                      <Flexbox
                        className={cx(
                          styles.ink,
                          isPinned && activeId === item.id ? styles.inkActive : undefined,
                        )}
                      >
                        <Avatar
                          avatar={sessionHelpers.getAvatar(item.meta)}
                          background={item.meta.backgroundColor}
                          onClick={() => {
                            switchAgent(item.id);
                          }}
                          size={36}
                        />
                      </Flexbox>
                    </Tooltip>
                  </Flexbox>
                );
              }

              return (
                <button
                  className={styles.button}
                  key={item.id}
                  onClick={() => switchAgent(item.id)}
                  type={'button'}
                >
                  <Tooltip hotkey={hotkeyLabel} placement={'right'} title={title}>
                    <Flexbox
                      align={'center'}
                      className={cx(
                        styles.item,
                        isPinned && activeId === item.id ? styles.itemActive : undefined,
                      )}
                      gap={10}
                      horizontal
                    >
                      <Avatar
                        avatar={sessionHelpers.getAvatar(item.meta)}
                        background={item.meta.backgroundColor}
                        size={32}
                      />
                      <span className={styles.title}>{title}</span>
                    </Flexbox>
                  </Tooltip>
                </button>
              );
            })}
          </Flexbox>
        </ScrollShadow>
      </>
    )
  );
};

export default PinList;
