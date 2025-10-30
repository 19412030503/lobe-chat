'use client';

import { Button, Progress, Typography } from 'antd';
import { createStyles } from 'antd-style';
import type { MessageInstance } from 'antd/es/message/interface';
import { Plus, X } from 'lucide-react';
import Image from 'next/image';
import type { ChangeEvent, DragEvent, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useFileStore } from '@/store/file';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  actions: css`
    position: absolute;
    inset-block-start: 10px;
    inset-inline-end: 10px;

    display: flex;
    gap: 6px;
  `,
  card: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    height: 100%;
    min-height: 164px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    background: ${token.colorFillSecondary};

    transition:
      border-color 0.2s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      border-color: ${token.colorPrimary};
      background: ${token.colorFill};
      box-shadow: ${token.boxShadowSecondary};
    }
  `,
  container: css`
    display: grid;
    grid-auto-rows: minmax(164px, 1fr);
    grid-template-columns: repeat(auto-fill, minmax(164px, 1fr));
    gap: 12px;

    width: 100%;
    min-height: 164px;
  `,
  dragOver: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorFill};
    box-shadow: ${token.boxShadowSecondary};
  `,
  hiddenInput: css`
    display: none;
  `,
  overlay: css`
    position: absolute;
    inset: 0;

    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;

    padding: 16px;

    color: ${token.colorWhite};
    text-align: center;

    background: rgba(0, 0, 0, 45%);
  `,
  placeholder: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;

    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  preview: css`
    position: absolute;
    inset: 0;
  `,
  progress: css`
    width: 90px;
  `,
}));

type MultiUploadStatus = 'uploading' | 'success' | 'error';

interface MultiUploadItem {
  id: string;
  previewUrl?: string;
  progress: number;
  status: MultiUploadStatus;
  url?: string;
}

interface MultiViewUploadProps {
  className?: string;
  disabled?: boolean;
  maxCount?: number;
  messageApi: MessageInstance;
  onChange: (urls: string[]) => void;
  placeholder: string;
  value?: string[];
}

export const MultiViewUpload: FC<MultiViewUploadProps> = ({
  className,
  disabled,
  maxCount = 3,
  messageApi,
  onChange,
  placeholder,
  value,
}) => {
  const { styles, cx } = useStyles();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });
  const uploadWithProgress = useFileStore((s) => s.uploadWithProgress);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewMap = useRef<Map<string, string>>(new Map());
  const [items, setItems] = useState<MultiUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const occupiedCount = useMemo(
    () => items.filter((item) => item.status !== 'error').length,
    [items],
  );

  const availableSlots = maxCount ? Math.max(maxCount - occupiedCount, 0) : Infinity;
  const slotLimit = useMemo(
    () => (maxCount ? maxCount : Math.max(items.length + 1, 3)),
    [items.length, maxCount],
  );

  const displaySlots = useMemo(
    () => Array.from({ length: slotLimit }, (_, index) => items[index] ?? null),
    [items, slotLimit],
  );

  const cleanupPreview = useCallback((id: string) => {
    const url = previewMap.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewMap.current.delete(id);
    }
  }, []);

  const syncWithValue = useCallback((prevItems: MultiUploadItem[], nextValue?: string[]) => {
    const successMap = new Map((nextValue ?? []).map((url) => [url, url]));
    const successItems: MultiUploadItem[] = (nextValue ?? []).map((url) => {
      const existing = prevItems.find((item) => item.url === url || item.id === url);
      if (existing) {
        return {
          ...existing,
          id: url,
          previewUrl: existing.previewUrl ?? existing.url ?? url,
          progress: 100,
          status: 'success',
          url,
        };
      }
      return {
        id: url,
        previewUrl: url,
        progress: 100,
        status: 'success',
        url,
      };
    });

    const uploadingItems = prevItems.filter(
      (item) => item.status === 'uploading' && !successMap.has(item.url ?? item.id),
    );

    return [...successItems, ...uploadingItems];
  }, []);

  useEffect(() => {
    setItems((prev) => syncWithValue(prev, value));
  }, [syncWithValue, value]);

  useEffect(
    () => () => {
      previewMap.current.forEach((url) => URL.revokeObjectURL(url));
      previewMap.current.clear();
    },
    [],
  );

  const handleRemove = useCallback(
    (item: MultiUploadItem) => {
      cleanupPreview(item.id);
      setItems((prev) => prev.filter((current) => current.id !== item.id));
      if (item.url) {
        const next = (value ?? []).filter((url) => url !== item.url);
        onChange(next);
      }
    },
    [cleanupPreview, onChange, value],
  );

  const processFile = useCallback(
    async (file: File) => {
      if (availableSlots <= 0) {
        messageApi.warning(t('config.uploadLimitReached', '已达到上传上限'));
        return;
      }

      const tempId = `${file.name}-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);
      previewMap.current.set(tempId, previewUrl);

      setItems((prev) => [...prev, { id: tempId, previewUrl, progress: 0, status: 'uploading' }]);

      try {
        const result = await uploadWithProgress({
          file,
          onStatusUpdate: (updateData) => {
            if (updateData.type !== 'updateFile') return;

            const status =
              updateData.value.status === 'processing'
                ? 'uploading'
                : ((updateData.value.status as MultiUploadStatus) ?? 'uploading');

            const progress = updateData.value.uploadState?.progress ?? 0;

            setItems((prev) =>
              prev.map((item) =>
                item.id === tempId
                  ? {
                      ...item,
                      progress,
                      status,
                    }
                  : item,
              ),
            );
          },
          skipCheckFileType: true,
        });

        if (!result?.url) {
          throw new Error('Upload failed');
        }

        cleanupPreview(tempId);

        setItems((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  id: result.url,
                  previewUrl: result.url,
                  progress: 100,
                  status: 'success',
                  url: result.url,
                }
              : item,
          ),
        );

        const next = [...(value ?? []), result.url];
        onChange(Array.from(new Set(next)));
      } catch {
        messageApi.error(t('config.uploadError', '上传失败，请重试'));
        setItems((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  status: 'error',
                }
              : item,
          ),
        );
      }
    },
    [availableSlots, cleanupPreview, messageApi, onChange, t, uploadWithProgress, value],
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      const entries = Array.from(files);
      for (const file of entries) {
        if (availableSlots <= 0) {
          messageApi.warning(t('config.uploadLimitReached', '已达到上传上限'));
          break;
        }
        await processFile(file);
      }
    },
    [availableSlots, messageApi, processFile, t],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || !files.length) return;
      await handleFiles(files);
      event.target.value = '';
    },
    [handleFiles],
  );

  const handleAddClick = useCallback(() => {
    if (disabled) return;
    if (availableSlots <= 0) {
      messageApi.warning(t('config.uploadLimitReached', '已达到上传上限'));
      return;
    }
    inputRef.current?.click();
  }, [availableSlots, disabled, messageApi, t]);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const files = event.dataTransfer.files;
      if (!files?.length) return;
      await handleFiles(files);
    },
    [disabled, handleFiles],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (disabled) return;
      setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <>
      <input
        accept="image/*"
        className={styles.hiddenInput}
        multiple
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <Flexbox className={cx(styles.container, className)} gap={12}>
        {displaySlots.map((item, index) =>
          item ? (
            <div className={styles.card} key={item.id}>
              {(item.previewUrl || item.url) && (
                <div className={styles.preview}>
                  <Image
                    alt="multi-view"
                    fill
                    src={item.previewUrl || item.url || ''}
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                </div>
              )}

              {item.status === 'uploading' && (
                <div className={styles.overlay}>
                  <Progress
                    className={styles.progress}
                    percent={Math.round(item.progress)}
                    showInfo={false}
                    status="active"
                  />
                  <span>{t('config.uploading', '上传中...')}</span>
                </div>
              )}

              {item.status === 'error' && (
                <div className={styles.overlay}>
                  <Text type="danger">{t('config.uploadError', '上传失败，请重试')}</Text>
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemove(item);
                      handleAddClick();
                    }}
                    size="small"
                    type="primary"
                  >
                    {t('config.retryUpload', '重新上传')}
                  </Button>
                </div>
              )}

              <div className={styles.actions}>
                <Button
                  danger
                  icon={<X size={14} />}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove(item);
                  }}
                  size="small"
                  title={t('config.deleteImage', '删除')}
                />
              </div>
            </div>
          ) : (
            <div
              className={cx(styles.card, styles.placeholder, isDragOver && styles.dragOver)}
              key={`placeholder-${index}`}
              onClick={handleAddClick}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Plus size={20} />
              <Text type="secondary">
                {placeholder}
                {typeof maxCount === 'number' ? ` (${index + 1}/${maxCount})` : ''}
              </Text>
            </div>
          ),
        )}
      </Flexbox>
    </>
  );
};
