'use client';

import { ActionIcon, Avatar, Text } from '@lobehub/ui';
import { App, Popover } from 'antd';
import { useTheme } from 'antd-style';
import { Trash } from 'lucide-react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { useThreeDStore } from '@/store/threeD';
import { generationBatchSelectors } from '@/store/threeD/slices/generationBatch/selectors';
import { generationTopicSelectors } from '@/store/threeD/slices/generationTopic/selectors';
import type { ImageGenerationTopic as GenerationTopic } from '@/types/generation';

const formatTime = (date: Date, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
  }).format(new Date(date));
};

interface TopicItemProps {
  showMoreInfo?: boolean;
  style?: React.CSSProperties;
  topic: GenerationTopic;
}

const TopicItem = memo<TopicItemProps>(({ topic, showMoreInfo, style }) => {
  const theme = useTheme();
  const { t } = useTranslation('threeD');
  const { modal } = App.useApp();
  const locale = useGlobalStore(globalGeneralSelectors.currentLanguage);

  // Check if current topic is loading
  const isLoading = useThreeDStore(generationTopicSelectors.isLoadingGenerationTopic(topic.id));
  const removeGenerationTopic = useThreeDStore((s) => s.removeGenerationTopic);
  const switchGenerationTopic = useThreeDStore((s) => s.switchGenerationTopic);
  const activeTopicId = useThreeDStore(generationTopicSelectors.activeGenerationTopicId);
  const useFetchGenerationBatches = useThreeDStore((s) => s.useFetchGenerationBatches);

  const isActive = activeTopicId === topic.id;

  // 为每个 topic 加载批次数据以获取缩略图
  // 注意：SWR 会自动缓存和去重请求
  useFetchGenerationBatches(topic.id);

  // 获取该主题的第一个 batch 的第一个 generation 的预览图
  const batches = useThreeDStore(generationBatchSelectors.getGenerationBatchesByTopicId(topic.id));
  const firstGeneration = batches?.[0]?.generations?.[0];
  const thumbnailUrl =
    (firstGeneration?.asset as any)?.previewUrl ||
    (firstGeneration?.asset as any)?.url ||
    topic.coverUrl ||
    '';

  const handleClick = () => {
    switchGenerationTopic(topic.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();

    modal.confirm({
      cancelText: t('cancel', { ns: 'common' }),
      content: t('workspace.topic.deleteConfirmDesc'),
      okButtonProps: { danger: true },
      okText: t('delete', { ns: 'common' }),
      onOk: async () => {
        try {
          await removeGenerationTopic(topic.id);
        } catch (error) {
          console.error('Delete topic failed:', error);
        }
      },
      title: t('workspace.topic.deleteConfirm'),
    });
  };

  const tooltipContent = (
    <Flexbox
      align={'center'}
      flex={1}
      gap={16}
      horizontal
      justify={'space-between'}
      style={{
        overflow: 'hidden',
      }}
    >
      <Flexbox
        flex={1}
        style={{
          overflow: 'hidden',
        }}
      >
        <Text ellipsis fontSize={14} weight={500}>
          {topic.title || t('workspace.topic.untitled')}
        </Text>
        <Text ellipsis fontSize={12} type={'secondary'}>
          {formatTime(topic.updatedAt || topic.createdAt, locale)}
        </Text>
      </Flexbox>
      <ActionIcon danger icon={Trash} onClick={handleDelete} size="small" />
    </Flexbox>
  );

  return (
    <Popover
      arrow={false}
      content={tooltipContent}
      placement={'left'}
      styles={{
        body: {
          width: 200,
        },
      }}
      trigger={showMoreInfo ? [] : ['hover']}
    >
      <Flexbox
        align={'center'}
        gap={12}
        horizontal
        justify={'center'}
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          ...style,
        }}
        width={'100%'}
      >
        <Avatar
          avatar={thumbnailUrl}
          background={theme.colorFillSecondary}
          bordered={isActive}
          loading={isLoading}
          shape="square"
          size={48}
          style={{
            flex: 'none',
          }}
        />
        {showMoreInfo && tooltipContent}
      </Flexbox>
    </Popover>
  );
});

TopicItem.displayName = 'ThreeDTopicItem';

export default TopicItem;
