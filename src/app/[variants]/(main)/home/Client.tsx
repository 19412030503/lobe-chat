'use client';

import { useTheme } from 'antd-style';
import { Compass, FolderClosed, type LucideIcon, MessageSquare, Settings } from 'lucide-react';
import Link from 'next/link';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

interface QuickLink {
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
}

interface Announcement {
  cta?: { href: string; label: string };
  description: string;
  title: string;
}

interface BannerItem {
  highlight?: boolean;
  text: string;
}

const ROTATE_INTERVAL = 6000;

const HomeClient = memo(() => {
  const { t: tRaw } = useTranslation('common');
  const t = useCallback((key: string) => tRaw(key as any), [tRaw]);
  const theme = useTheme();

  const announcements: Announcement[] = useMemo(
    () => [
      {
        cta: { href: '/discover', label: t('home.notice.0.cta') },
        description: t('home.notice.0.desc'),
        title: t('home.notice.0.title'),
      },
      {
        cta: { href: '/settings', label: t('home.notice.1.cta') },
        description: t('home.notice.1.desc'),
        title: t('home.notice.1.title'),
      },
      {
        description: t('home.notice.2.desc'),
        title: t('home.notice.2.title'),
      },
    ],
    [t],
  );

  const bannerItems: BannerItem[] = useMemo(
    () => [
      { highlight: true, text: t('home.banner.items.0') },
      { text: t('home.banner.items.1') },
      { text: t('home.banner.items.2') },
    ],
    [t],
  );

  const quickLinks: QuickLink[] = useMemo(
    () => [
      {
        description: t('home.quick.chat'),
        href: '/chat',
        icon: MessageSquare,
        title: t('tab.chat'),
      },
      {
        description: t('home.quick.discover'),
        href: '/discover',
        icon: Compass,
        title: t('tab.discover'),
      },
      {
        description: t('home.quick.files'),
        href: '/files',
        icon: FolderClosed,
        title: t('tab.files'),
      },
      {
        description: t('home.quick.settings'),
        href: '/settings',
        icon: Settings,
        title: t('tab.setting'),
      },
    ],
    [t],
  );

  const [activeAnnouncement, setActiveAnnouncement] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveAnnouncement((prev) => (prev + 1) % announcements.length);
    }, ROTATE_INTERVAL);

    return () => clearInterval(timer);
  }, [announcements.length]);

  return (
    <Flexbox
      gap={32}
      style={{
        boxSizing: 'border-box',
        margin: '0 auto',
        maxWidth: 1040,
        padding: '32px 24px 48px',
        width: '100%',
      }}
    >
      <Flexbox
        gap={12}
        style={{
          background: theme.colorBgElevated,
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: 16,
          padding: '20px 24px',
        }}
      >
        <span
          style={{
            color: theme.colorPrimary,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {t('home.notice.label')}
        </span>
        <Flexbox gap={4} horizontal justify={'space-between'} style={{ alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {announcements[activeAnnouncement].title}
            </div>
            <div style={{ color: theme.colorTextTertiary, marginTop: 4 }}>
              {announcements[activeAnnouncement].description}
            </div>
          </div>
          {announcements[activeAnnouncement].cta && (
            <Link
              href={announcements[activeAnnouncement].cta!.href}
              style={{
                color: theme.colorPrimary,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {announcements[activeAnnouncement].cta!.label}
            </Link>
          )}
        </Flexbox>
      </Flexbox>

      <Flexbox
        gap={16}
        style={{
          background: theme.colorBgElevated,
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: 16,
          padding: '28px 32px',
        }}
      >
        <Flexbox gap={8}>
          <span style={{ color: theme.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>
            {t('home.banner.tag')}
          </span>
          <h2 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{t('home.banner.title')}</h2>
          <p style={{ color: theme.colorTextTertiary, fontSize: 15, margin: 0 }}>
            {t('home.banner.desc')}
          </p>
        </Flexbox>
        <Flexbox gap={10}>
          {bannerItems.map(({ text, highlight }, index) => (
            <Flexbox
              gap={12}
              horizontal
              key={index}
              style={{
                alignItems: 'flex-start',
                background: highlight ? theme.colorPrimaryBg : theme.colorBgLayout,
                border: `1px solid ${
                  highlight ? theme.colorPrimaryHover : theme.colorBorderSecondary
                }`,
                borderRadius: 12,
                padding: '12px 16px',
              }}
            >
              <span
                style={{
                  alignItems: 'center',
                  background: theme.colorPrimary,
                  borderRadius: 999,
                  color: theme.colorTextLightSolid,
                  display: 'inline-flex',
                  fontSize: 12,
                  fontWeight: 600,
                  height: 28,
                  justifyContent: 'center',
                  minWidth: 28,
                }}
              >
                {index + 1}
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.5 }}>{text}</span>
            </Flexbox>
          ))}
        </Flexbox>
      </Flexbox>

      <Flexbox gap={12}>
        <Flexbox horizontal justify={'space-between'} style={{ alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{t('home.hero.title')}</h3>
            <p style={{ color: theme.colorTextTertiary, fontSize: 15, margin: '4px 0 0' }}>
              {t('home.hero.desc')}
            </p>
          </div>
          <span style={{ color: theme.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>
            {t('home.hero.cta')}
          </span>
        </Flexbox>

        <Flexbox gap={16} horizontal style={{ width: '100%' }} wrap="wrap">
          {quickLinks.map(({ description, href, icon: Icon, title }) => (
            <Link
              href={href}
              key={href}
              style={{
                color: 'inherit',
                display: 'block',
                flex: '1 1 220px',
                height: '100%',
                minWidth: 220,
                textDecoration: 'none',
              }}
            >
              <Flexbox
                gap={12}
                style={{
                  alignItems: 'flex-start',
                  background: theme.colorBgElevated,
                  border: `1px solid ${theme.colorBorderSecondary}`,
                  borderRadius: 12,
                  height: '100%',
                  minHeight: 140,
                  padding: 20,
                  transition: `border ${theme.motionEaseInOut} 180ms, box-shadow ${theme.motionEaseInOut} 180ms`,
                }}
              >
                <Icon size={28} />
                <Flexbox gap={6}>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>{title}</span>
                  <span style={{ color: theme.colorTextTertiary, fontSize: 14 }}>
                    {description}
                  </span>
                </Flexbox>
              </Flexbox>
            </Link>
          ))}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

HomeClient.displayName = 'HomeClient';

export default HomeClient;
