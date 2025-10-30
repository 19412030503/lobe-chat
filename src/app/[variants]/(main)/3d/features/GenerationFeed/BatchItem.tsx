'use client';

import { ModelTag } from '@lobehub/icons';
import { ActionIconGroup, Block, Markdown, Tag, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { omit } from 'lodash-es';
import { CopyIcon, RotateCcwSquareIcon, Trash2 } from 'lucide-react';
import { Runtime3DGenParams } from 'model-bank';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import ImageItem from '@/components/ImageItem';
import InvalidAPIKey from '@/components/InvalidAPIKey';
import { useThreeDStore } from '@/store/threeD';
import { AsyncTaskErrorType } from '@/types/asyncTask';
import { GenerationBatch } from '@/types/generation';

const useStyles = createStyles(({ cx, css, token }) => ({
  batchActions: cx(
    'batch-actions',
    css`
      opacity: 0;
      transition: opacity 0.1s ${token.motionEaseInOut};
    `,
  ),
  batchDeleteButton: css`
    &:hover {
      border-color: ${token.colorError} !important;
      color: ${token.colorError} !important;
      background: ${token.colorErrorBg} !important;
    }
  `,
  container: css`
    &:hover {
      .batch-actions {
        opacity: 1;
      }
    }
  `,

  prompt: css`
    pre {
      overflow: hidden !important;
      padding-block: 4px;
      font-size: 13px;
    }
  `,
}));

// 扩展 dayjs 插件
dayjs.extend(relativeTime);

interface GenerationBatchItemProps {
  batch: GenerationBatch;
}

export const GenerationBatchItem = memo<GenerationBatchItemProps>(({ batch }) => {
  const { styles } = useStyles();
  const { t } = useTranslation(['threeD', 'modelProvider', 'error']);
  const { message } = App.useApp();

  const activeTopicId = useThreeDStore((s) => s.activeGenerationTopicId);
  const removeGenerationBatch = useThreeDStore((s) => s.removeGenerationBatch);
  const recreateThreeD = useThreeDStore((s) => s.recreateThreeD);
  const reuseSettings = useThreeDStore((s) => s.reuseSettings);

  const time = useMemo(() => {
    return dayjs(batch.createdAt).format('YYYY-MM-DD HH:mm:ss');
  }, [batch.createdAt]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(batch.prompt);
      message.success(t('workspace.generation.actions.promptCopied'));
    } catch (error) {
      console.error('Failed to copy prompt:', error);
      message.error(t('workspace.generation.actions.promptCopyFailed'));
    }
  };

  const handleReuseSettings = () => {
    reuseSettings(batch.model, batch.provider, omit(batch.config as Runtime3DGenParams, ['seed']));
  };

  const handleDeleteBatch = async () => {
    if (!activeTopicId) return;

    try {
      await removeGenerationBatch(batch.id, activeTopicId);
      message.success(t('workspace.generation.actions.batchDeleted'));
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  };

  // Check if there are no generations at all
  if (batch.generations.length === 0) {
    return null;
  }

  // Check for invalid API key error in any generation
  const isInvalidApiKey = batch.generations.some(
    (generation) => generation.task.error?.name === AsyncTaskErrorType.InvalidProviderAPIKey,
  );

  if (isInvalidApiKey) {
    return (
      <InvalidAPIKey
        bedrockDescription={t('bedrock.unlock.imageGenerationDescription', { ns: 'modelProvider' })}
        description={t('unlock.apiKey.imageGenerationDescription', {
          name: batch.provider,
          ns: 'error',
        })}
        id={batch.id}
        onClose={() => {
          removeGenerationBatch(batch.id, activeTopicId!);
        }}
        onRecreate={() => {
          const topicId = activeTopicId!;
          recreateThreeD(topicId, batch.id);
        }}
        provider={batch.provider}
      />
    );
  }

  return (
    <Block className={styles.container} gap={8} variant="borderless">
      {/* Prompt */}
      <Markdown className={styles.prompt} variant={'chat'}>
        {batch.prompt}
      </Markdown>

      {/* Metadata */}
      <Flexbox gap={4} horizontal justify="space-between" style={{ marginBottom: 10 }}>
        <Flexbox gap={4} horizontal>
          <ModelTag model={batch.model} />
          <Tag>{t(`workspace.generation.metadata.count`, { count: batch.generations.length })}</Tag>
        </Flexbox>
      </Flexbox>

      {/* 3D Model Previews with Status - Grid Layout */}
      <div
        style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          width: '100%',
        }}
      >
        {batch.generations.map((generation) => {
          const asset = generation.asset as any;
          const previewImageUrl = asset?.previewUrl || asset?.url;
          const modelDownloadUrl = asset?.modelUrl;
          const taskStatus = generation.task.status;
          const taskError = generation.task.error;
          const isTripo3D = batch.provider?.toLowerCase() === 'tripo3d';
          const canConvert = isTripo3D && asset?.jobId;

          return (
            <Flexbox
              key={generation.id}
              style={{
                borderRadius: 8,
                maxWidth: 200,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Loading/Pending State */}
              {(taskStatus === 'pending' || taskStatus === 'processing') && (
                <Flexbox
                  align="center"
                  justify="center"
                  style={{
                    aspectRatio: '1',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: 8,
                    width: '100%',
                  }}
                >
                  <Text type="secondary">
                    {taskStatus === 'pending'
                      ? t('workspace.generation.status.pending')
                      : t('workspace.generation.status.generating')}
                  </Text>
                </Flexbox>
              )}

              {/* Error State */}
              {taskStatus === 'error' && taskError && (
                <Flexbox
                  align="center"
                  justify="center"
                  style={{
                    aspectRatio: '1',
                    background: 'rgba(255,0,0,0.05)',
                    borderRadius: 8,
                    padding: 16,
                    width: '100%',
                  }}
                >
                  <Text style={{ color: 'red', textAlign: 'center' }}>
                    {(typeof taskError.body === 'string'
                      ? taskError.body
                      : taskError.body?.detail) || t('workspace.generation.error.failed')}
                  </Text>
                </Flexbox>
              )}

              {/* Success State - Show Preview */}
              {taskStatus === 'success' && previewImageUrl && (
                <Flexbox gap={8} style={{ width: '100%' }}>
                  <ImageItem
                    alt={batch.prompt}
                    preview={{
                      src: previewImageUrl,
                    }}
                    style={{
                      borderRadius: 8,
                      height: 'auto',
                      width: '100%',
                    }}
                    url={previewImageUrl}
                  />
                  {/* Action Links - 操作按钮 */}
                  <Flexbox gap={12} horizontal style={{ marginTop: 8 }} wrap="wrap">
                    {modelDownloadUrl && (
                      <a
                        download
                        href={modelDownloadUrl}
                        rel="noreferrer"
                        style={{
                          color: 'var(--lobe-text-primary)',
                          fontSize: 14,
                          fontWeight: 500,
                          textDecoration: 'none',
                          transition: 'color 0.2s',
                        }}
                        target="_blank"
                      >
                        📦 {t('workspace.result.downloadModel')}
                      </a>
                    )}
                    {canConvert && (
                      <span
                        onClick={() => {
                          message.info('转换功能即将推出！请参考原 Client.tsx 实现');
                        }}
                        style={{
                          color: 'var(--lobe-text-secondary)',
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 500,
                          transition: 'color 0.2s',
                        }}
                      >
                        🔄{' '}
                        {asset?.conversion
                          ? t('workspace.result.reconvert')
                          : t('workspace.result.convert')}
                      </span>
                    )}
                  </Flexbox>
                </Flexbox>
              )}

              {/* Success but no preview */}
              {taskStatus === 'success' && !previewImageUrl && (
                <Flexbox
                  align="center"
                  justify="center"
                  style={{
                    aspectRatio: '1',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: 8,
                    width: '100%',
                  }}
                >
                  <Text type="secondary">{t('workspace.result.noAsset')}</Text>
                </Flexbox>
              )}
            </Flexbox>
          );
        })}
      </div>

      {/* Actions Bar */}
      <Flexbox
        align={'center'}
        className={styles.batchActions}
        horizontal
        justify={'space-between'}
      >
        <Text as={'time'} fontSize={12} type={'secondary'}>
          {time}
        </Text>
        <ActionIconGroup
          items={[
            {
              icon: RotateCcwSquareIcon,
              key: 'reuseSettings',
              label: t('workspace.generation.actions.reuseSettings'),
              onClick: handleReuseSettings,
            },
            {
              icon: CopyIcon,
              key: 'copyPrompt',
              label: t('workspace.generation.actions.copyPrompt'),
              onClick: handleCopyPrompt,
            },
            {
              danger: true,
              icon: Trash2,
              key: 'deleteBatch',
              label: t('workspace.generation.actions.deleteBatch'),
              onClick: handleDeleteBatch,
            },
          ]}
        />
      </Flexbox>
    </Block>
  );
});

GenerationBatchItem.displayName = 'GenerationBatchItem';
