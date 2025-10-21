import { ActionIcon, ActionIconProps } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ComponentPropsWithoutRef, MouseEvent, ReactNode, memo, useMemo } from 'react';
import { Flexbox } from 'react-layout-kit';

const ICON_SIZE: ActionIconProps['size'] = {
  blockSize: 36,
  size: 22,
  strokeWidth: 2,
};

const useStyles = createStyles(({ css, token }) => ({
  button: css`
    cursor: pointer;

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
  collapsedWrapper: css`
    display: inline-flex;
  `,
  content: css`
    cursor: pointer;

    display: flex;
    gap: 12px;
    align-items: center;

    padding-block: 6px;
    padding-inline: 10px;
    border-radius: ${token.borderRadiusLG}px;

    color: ${token.colorTextSecondary};

    transition: all 0.2s ${token.motionEaseInOut};

    &:hover {
      color: ${token.colorText};
      background: ${token.colorFillSecondary};
    }
  `,
  contentActive: css`
    font-weight: 500;
    color: ${token.colorText};
    background: ${token.colorFillTertiary};
  `,
  label: css`
    overflow: hidden;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  labelWrapper: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;

    min-width: 0;
  `,
  link: css`
    color: inherit;
    text-decoration: none;
  `,
  secondary: css`
    font-size: ${token.fontSizeSM}px;
    color: ${token.colorTextQuaternary};
  `,
}));

export interface NavItemProps {
  active?: boolean;
  collapsed: boolean;
  hotkey?: ReactNode;
  href?: string;
  icon: LucideIcon;
  label: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  rel?: string;
  target?: ComponentPropsWithoutRef<typeof Link>['target'];
  tooltip?: string;
}

const NavItem = memo<NavItemProps>(
  ({ active, collapsed, href, hotkey, icon, label, onClick, rel, target, tooltip }) => {
    const { styles, cx } = useStyles();

    const actionIcon = useMemo(
      () => (
        <ActionIcon
          active={active}
          icon={icon}
          size={ICON_SIZE}
          title={tooltip || label}
          tooltipProps={collapsed ? { placement: 'right' } : undefined}
        />
      ),
      [active, collapsed, icon, label, tooltip],
    );

    if (collapsed) {
      if (href) {
        return (
          <Link
            className={styles.collapsedWrapper}
            href={href}
            onClick={onClick}
            rel={rel}
            target={target}
          >
            {actionIcon}
          </Link>
        );
      }

      return (
        <button className={styles.button} onClick={onClick} type="button">
          {actionIcon}
        </button>
      );
    }

    const content = (
      <Flexbox
        align="center"
        className={cx(styles.content, active ? styles.contentActive : undefined)}
        horizontal
      >
        {actionIcon}
        <Flexbox className={styles.labelWrapper} gap={4} justify="center">
          <span className={styles.label}>{label}</span>
          {hotkey && <span className={styles.secondary}>{hotkey}</span>}
        </Flexbox>
      </Flexbox>
    );

    if (href) {
      return (
        <Link className={styles.link} href={href} onClick={onClick} rel={rel} target={target}>
          {content}
        </Link>
      );
    }

    return (
      <button className={styles.button} onClick={onClick} type="button">
        {content}
      </button>
    );
  },
);

NavItem.displayName = 'NavItem';

export default NavItem;
