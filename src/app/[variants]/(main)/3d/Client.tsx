'use client';

import { InboxOutlined } from '@ant-design/icons';
import { ActionIcon, Icon, TextArea, Button as UiButton, Select as UiSelect } from '@lobehub/ui';
import {
  Alert,
  Select as AntSelect,
  Button,
  Empty,
  Form,
  InputNumber,
  List,
  Modal,
  Progress,
  Segmented,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { createStyles, useTheme } from 'antd-style';
import type { TFunction } from 'i18next';
import { LucideArrowRight, LucideBolt, LucidePlus, LucideX, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type ChangeEvent,
  type DragEvent,
  type FC,
  type KeyboardEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';
import { shallow } from 'zustand/shallow';

import { ModelItemRender, ProviderItemRender } from '@/components/ModelSelect';
import { useThreeDConfig } from '@/hooks/useThreeDConfig';
import { useClientDataSWR } from '@/libs/swr';
import { generationBatchService } from '@/services/generationBatch';
import { generationTopicService } from '@/services/generationTopic';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useFileStore } from '@/store/file';
import { useThreeDStore } from '@/store/threeD';
import type { EnabledProviderWithModels } from '@/types/aiProvider';
import { GenerationBatch } from '@/types/generation';

const { Title, Text } = Typography;

const statusColorMap: Record<string, 'error' | 'processing' | 'success' | 'warning'> = {
  error: 'error',
  pending: 'warning',
  processing: 'processing',
  success: 'success',
};

const pendingStatuses = new Set(['pending', 'processing']);

const TRIPO_CONVERSION_FORMATS = ['GLTF', 'USDZ', 'FBX', 'OBJ', 'STL', '3MF'];
const TRIPO_TEXTURE_FORMATS = [
  'BMP',
  'DPX',
  'HDR',
  'JPEG',
  'OPEN_EXR',
  'PNG',
  'TARGA',
  'TIFF',
  'WEBP',
];
const TRIPO_EXPORT_ORIENTATIONS = ['+x', '-x', '+y', '-y'];
const TRIPO_FBX_PRESETS = ['blender', '3dsmax', 'mixamo'];
const LEGACY_TRIPO_MODEL_IDS = new Set(['tripo-image-to-model', 'tripo-text-to-model']);

const useWorkspaceStyles = createStyles(({ css, token }) => ({
  configItem: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-block-end: 20px;
  `,
  content: css`
    overflow: hidden;
    display: flex;
    flex: 1 1 0;
    flex-direction: column;

    min-width: 0;
    padding: 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;

    background: ${token.colorBgContainer};
  `,
  contentHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block-end: 16px;
  `,
  contentTitle: css`
    display: flex;
    gap: 12px;
    align-items: center;
  `,
  description: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  feed: css`
    overflow-y: auto;
    flex: 1;
    padding-block-end: 120px;
    padding-inline-end: 6px;
  `,
  label: css`
    font-weight: 600;
    color: ${token.colorText};
  `,
  page: css`
    overflow: hidden;
    display: flex;
    flex: 1;
    gap: 24px;

    width: 100%;
    max-width: 100%;
    height: 100%;
    padding: 24px;

    background: ${token.colorBgContainerSecondary};
  `,
  promptSection: css`
    margin-block-start: 24px;
    padding-block-start: 24px;
    border-block-start: 1px solid ${token.colorBorderSecondary};
  `,
  sidebar: css`
    overflow: hidden;
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;

    width: 320px;
    min-width: 300px;
    max-width: 360px;
    padding-block: 24px 32px;
    padding-inline: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;

    background: ${token.colorBgContainer};
  `,
  sidebarHeader: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-block-end: 16px;
  `,
  sidebarScroll: css`
    overflow-y: auto;
    flex: 1;
    padding-inline-end: 6px;
  `,
  topicHeader: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
  topicList: css`
    overflow-y: auto;
    flex: 1;
    margin-block-start: 16px;
    padding-inline-end: 6px;
  `,
  topicPanel: css`
    overflow: hidden;
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;

    width: 280px;
    min-width: 260px;
    padding-block: 24px;
    padding-inline: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;

    background: ${token.colorBgContainer};
  `,
  uploader: css`
    border: 1px dashed ${token.colorBorderSecondary} !important;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillSecondary};
  `,
}));
const usePromptStyles = createStyles(({ css, token, isDarkMode }) => ({
  container: css`
    display: flex;
    gap: 12px;
    align-items: stretch;

    padding-block: 12px;
    padding-inline: 16px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;

    background-color: ${token.colorBgContainer};
    box-shadow:
      ${token.boxShadowTertiary},
      ${isDarkMode
        ? `0 0 48px 32px ${token.colorBgContainerSecondary}`
        : `0 0 0 ${token.colorBgContainerSecondary}`};
  `,
  imageModeSwitch: css`
    flex: 0 0 auto;
  `,
  imageUploadWrapper: css`
    display: flex;
    flex: 1 1 0;
    align-items: stretch;
    min-height: 164px;

    > * {
      flex: 1 1 0;
    }
  `,
  inputColumn: css`
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 12px;
  `,
  note: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  textArea: css`
    resize: none;
    flex: 1;
    height: 100%;
    min-height: 0;
  `,
  toggleNote: css`
    margin-inline-start: auto;
    font-size: 12px;
    color: ${token.colorTextTertiary};
    white-space: nowrap;
  `,
  toggleRow: css`
    display: flex;
    gap: 12px;
    align-items: center;
  `,
  wrapper: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  `,
}));

interface GenerationFeedListProps {
  convertingGenerations: Record<string, boolean>;
  generationBatches?: GenerationBatch[];
  onOpenConversion: (payload: {
    assetFormat?: string;
    generationId: string;
    model: string;
    prompt?: string;
    provider: string;
  }) => void;
  t: TFunction<'threeD', 'workspace'>;
}

const GenerationFeedList: FC<GenerationFeedListProps> = memo(
  ({ convertingGenerations, generationBatches, onOpenConversion, t }) => {
    if (!generationBatches || generationBatches.length === 0) {
      return (
        <Empty
          description={t('result.empty', '暂无生成记录')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <List
        dataSource={generationBatches}
        renderItem={(batch) => {
          const generations = batch.generations || [];
          const batchStatus = generations.some((generation) => generation.task.status === 'error')
            ? 'error'
            : generations.some((generation) => pendingStatuses.has(generation.task.status))
              ? 'processing'
              : 'success';
          return (
            <List.Item key={batch.id}>
              <Flexbox gap={12}>
                <Flexbox align="center" gap={8} horizontal>
                  <Text strong>{batch.prompt}</Text>
                  <Tag color={statusColorMap[batchStatus] ?? 'processing'}>
                    {t(`status.${batchStatus}`, batchStatus)}
                  </Tag>
                </Flexbox>
                <Text type="secondary">
                  {t('result.assetInfo', {
                    model: batch.model,
                    provider: batch.provider,
                  })}
                </Text>
                <Flexbox gap={12}>
                  {generations.length === 0 ? (
                    <Text type="secondary">{t('result.noGeneration', '该批次暂无生成结果')}</Text>
                  ) : (
                    generations.map((generation) => {
                      const asset = generation.asset as any;
                      const status = generation.task.status;
                      const tagColor = statusColorMap[status] ?? 'warning';
                      const taskErrorBody = generation.task.error?.body;
                      const taskErrorMessage =
                        typeof taskErrorBody === 'string' ? taskErrorBody : taskErrorBody?.detail;
                      const seedLabel =
                        generation.seed !== null && generation.seed !== undefined
                          ? t('result.seed', { value: generation.seed })
                          : t('result.seedUnknown', '未提供种子');
                      const previewUrl = asset?.previewUrl || asset?.url;
                      const hasAsset = Boolean(asset?.modelUrl || previewUrl);
                      return (
                        <Flexbox
                          gap={6}
                          key={generation.id}
                          style={{
                            border: '1px solid var(--ant-color-border)',
                            borderRadius: 8,
                            padding: 12,
                          }}
                        >
                          <Flexbox align="center" gap={8} horizontal>
                            <Tag color={tagColor}>{t(`status.${status}`, status)}</Tag>
                            <Text type="secondary">{seedLabel}</Text>
                            {asset?.format && (
                              <Text type="secondary">
                                {t('result.assetFormat', { value: asset.format })}
                              </Text>
                            )}
                            {asset?.conversion && (
                              <Tag color="purple">{t('result.conversionTag', '转换')}</Tag>
                            )}
                          </Flexbox>
                          {taskErrorMessage && (
                            <Text type="danger">
                              {t('result.errorMessage', {
                                message: taskErrorMessage,
                              })}
                            </Text>
                          )}
                          {hasAsset ? (
                            <Space size={12}>
                              {asset?.modelUrl && (
                                <a href={asset.modelUrl} rel="noreferrer" target="_blank">
                                  {t('result.viewModel', '查看模型文件')}
                                </a>
                              )}
                              {previewUrl && (
                                <a href={previewUrl} rel="noreferrer" target="_blank">
                                  {t('result.viewPreview', '查看预览')}
                                </a>
                              )}
                              {batch.provider?.toLowerCase() === 'tripo3d' && asset?.jobId && (
                                <Button
                                  loading={Boolean(convertingGenerations[generation.id])}
                                  onClick={() =>
                                    onOpenConversion({
                                      assetFormat: asset?.format,
                                      generationId: generation.id,
                                      model: batch.model,
                                      prompt: batch.prompt,
                                      provider: batch.provider,
                                    })
                                  }
                                  size="small"
                                  type="link"
                                >
                                  {asset?.conversion
                                    ? t('result.reconvert', '再次转换')
                                    : t('result.convert', '转换格式')}
                                </Button>
                              )}
                            </Space>
                          ) : (
                            <Text type="secondary">
                              {t('result.noAsset', '生成结果暂未提供可预览文件')}
                            </Text>
                          )}
                          {asset?.conversion && (
                            <Text type="secondary">
                              {t('result.conversionInfo', {
                                defaultValue: '来源任务：{{id}}，原格式：{{format}}',
                                format: asset.conversion.sourceFormat || '--',
                                id: asset.conversion.sourceGenerationId,
                              })}
                            </Text>
                          )}
                        </Flexbox>
                      );
                    })
                  )}
                </Flexbox>
              </Flexbox>
            </List.Item>
          );
        }}
        split={false}
      />
    );
  },
);

const useSingleUploadStyles = createStyles(({ css, token }) => ({
  actions: css`
    position: absolute;
    inset-block-start: 12px;
    inset-inline-end: 12px;

    display: flex;
    gap: 8px;
  `,
  card: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    width: 100%;
    height: 100%;
    min-height: 164px;
    padding: 12px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;

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
  placeholderHint: css`
    font-size: 12px;
  `,
  preview: css`
    position: absolute;
    inset: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  progress: css`
    width: 96px;
  `,
  uploadContent: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;

    color: ${token.colorTextTertiary};
    text-align: center;
  `,
}));

const useMultiUploadStyles = createStyles(({ css, token }) => ({
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

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  progress: css`
    width: 90px;
  `,
}));

type SingleUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface SingleUploadState {
  previewUrl?: string;
  progress: number;
  status: SingleUploadStatus;
}

interface ReferenceImageUploadProps {
  className?: string;
  disabled?: boolean;
  messageApi: ReturnType<typeof message.useMessage>[0];
  onChange: (url?: string) => void;
  placeholder: string;
  value?: string;
}

const ReferenceImageUpload: FC<ReferenceImageUploadProps> = ({
  className,
  disabled,
  messageApi,
  onChange,
  placeholder,
  value,
}) => {
  const { styles, cx } = useSingleUploadStyles();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });
  const uploadWithProgress = useFileStore((s) => s.uploadWithProgress);
  const inputRef = useRef<HTMLInputElement>(null);
  const tempPreviewRef = useRef<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [state, setState] = useState<SingleUploadState>({
    previewUrl: value,
    progress: value ? 100 : 0,
    status: value ? 'success' : 'idle',
  });

  useEffect(() => {
    setState({
      previewUrl: value,
      progress: value ? 100 : 0,
      status: value ? 'success' : 'idle',
    });
  }, [value]);

  useEffect(
    () => () => {
      if (tempPreviewRef.current) {
        URL.revokeObjectURL(tempPreviewRef.current);
        tempPreviewRef.current = null;
      }
    },
    [],
  );

  const cleanupTempPreview = useCallback(() => {
    if (tempPreviewRef.current) {
      URL.revokeObjectURL(tempPreviewRef.current);
      tempPreviewRef.current = null;
    }
  }, []);

  const handleRemove = useCallback(() => {
    cleanupTempPreview();
    onChange(undefined);
    setState({ previewUrl: undefined, progress: 0, status: 'idle' });
  }, [cleanupTempPreview, onChange]);

  const updateProgress = useCallback((progress: number, status: SingleUploadStatus) => {
    setState((prev) => ({
      ...prev,
      progress,
      status,
    }));
  }, []);

  const beginUpload = useCallback(
    async (file: File) => {
      if (disabled) return;

      const blobUrl = URL.createObjectURL(file);
      cleanupTempPreview();
      tempPreviewRef.current = blobUrl;

      setState({
        previewUrl: blobUrl,
        progress: 0,
        status: 'uploading',
      });

      try {
        const result = await uploadWithProgress({
          file,
          onStatusUpdate: (updateData) => {
            if (updateData.type !== 'updateFile') return;
            const status =
              updateData.value.status === 'processing'
                ? 'uploading'
                : ((updateData.value.status as SingleUploadStatus) ?? 'uploading');
            const progress = updateData.value.uploadState?.progress ?? 0;
            updateProgress(progress, status);
          },
          skipCheckFileType: true,
        });

        if (!result?.url) {
          throw new Error('Upload failed');
        }

        cleanupTempPreview();
        setState({
          previewUrl: result.url,
          progress: 100,
          status: 'success',
        });
        onChange(result.url);
      } catch {
        messageApi.error(t('config.uploadError', '上传失败，请重试'));
        setState((prev) => ({
          ...prev,
          status: 'error',
        }));
      }
    },
    [cleanupTempPreview, disabled, messageApi, onChange, t, updateProgress, uploadWithProgress],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await beginUpload(file);
      event.target.value = '';
    },
    [beginUpload],
  );

  const handleSelect = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      await beginUpload(file);
    },
    [beginUpload, disabled],
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
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <div
        className={cx(styles.card, className, isDragOver && styles.dragOver)}
        onClick={handleSelect}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {state.previewUrl && (
          <div className={styles.preview}>
            <img alt="reference" src={state.previewUrl} />
          </div>
        )}

        {state.status === 'uploading' && (
          <div className={styles.overlay}>
            <Progress
              className={styles.progress}
              percent={Math.round(state.progress)}
              showInfo={false}
              status="active"
            />
            <span>{t('config.uploading', '上传中...')}</span>
          </div>
        )}

        {!state.previewUrl && state.status !== 'uploading' && (
          <div className={styles.uploadContent}>
            <InboxOutlined style={{ fontSize: 28 }} />
            <Text type="secondary">{placeholder}</Text>
            <Text className={styles.placeholderHint} type="secondary">
              {t('config.imageUploadHint', '点击或拖拽上传图片')}
            </Text>
          </div>
        )}

        {state.status === 'error' && (
          <div className={styles.overlay}>
            <Text type="danger">{t('config.uploadError', '上传失败，请重试')}</Text>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                handleSelect();
              }}
              size="small"
            >
              {t('config.retryUpload', '重新上传')}
            </Button>
          </div>
        )}

        {state.previewUrl && state.status === 'success' && (
          <div className={styles.actions}>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                handleSelect();
              }}
              size="small"
            >
              {t('config.replaceImage', '更换')}
            </Button>
            <Button
              danger
              onClick={(event) => {
                event.stopPropagation();
                handleRemove();
              }}
              size="small"
            >
              {t('config.deleteImage', '删除')}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

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
  messageApi: ReturnType<typeof message.useMessage>[0];
  onChange: (urls: string[]) => void;
  placeholder: string;
  value?: string[];
}

const MultiViewUpload: FC<MultiViewUploadProps> = ({
  className,
  disabled,
  maxCount = 3,
  messageApi,
  onChange,
  placeholder,
  value,
}) => {
  const { styles, cx } = useMultiUploadStyles();
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
                  <img alt="multi-view" src={item.previewUrl || item.url} />
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
                <Tooltip title={t('config.deleteImage', '删除')}>
                  <Button
                    danger
                    icon={<LucideX size={14} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemove(item);
                    }}
                    size="small"
                  />
                </Tooltip>
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
              <LucidePlus size={20} />
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
const useModelSelectStyles = createStyles(({ css, prefixCls }) => ({
  popup: css`
    &.${prefixCls}-select-dropdown .${prefixCls}-select-item-option-grouped {
      padding-inline-start: 12px;
    }
  `,
}));

interface ModelOption {
  label: ReactNode;
  provider: string;
  value: string;
}

const ThreeDModelSelect: FC = memo(() => {
  const { styles } = useModelSelectStyles();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation('threeD');

  const [currentModel, currentProvider] = useThreeDStore(
    (state) => [state.model, state.provider],
    shallow,
  );
  const setModelAndProvider = useThreeDStore((state) => state.setModelAndProvider);

  const enabledThreeDModelList = useAiInfraStore(aiProviderSelectors.enabledThreeDModelList);

  const providerOptions = useMemo(() => {
    const sanitizedProviders: EnabledProviderWithModels[] = enabledThreeDModelList.map(
      (provider) => ({
        ...provider,
        children: provider.children.filter((model) => !LEGACY_TRIPO_MODEL_IDS.has(model.id)),
      }),
    );

    const buildModelOptions = (provider: EnabledProviderWithModels) => {
      const options = provider.children.map((model) => ({
        label: <ModelItemRender {...model} showInfoTag={false} />,
        provider: provider.id,
        value: `${provider.id}/${model.id}`,
      }));

      if (options.length === 0) {
        return [
          {
            disabled: true,
            label: (
              <Flexbox gap={8} horizontal style={{ color: theme.colorTextTertiary }}>
                {t('config.modelEmpty', '该提供商暂无可用模型')}
                <Icon icon={LucideArrowRight} />
              </Flexbox>
            ),
            onClick: () =>
              router.push(`/settings?active=provider&provider=${encodeURIComponent(provider.id)}`),
            value: `${provider.id}/empty`,
          },
        ];
      }

      return options;
    };

    if (sanitizedProviders.length === 0) {
      return [
        {
          disabled: true,
          label: (
            <Flexbox gap={8} horizontal style={{ color: theme.colorTextTertiary }}>
              {t('config.providerEmpty', '尚未配置 3D 模型供应商')}
              <Icon icon={LucideArrowRight} />
            </Flexbox>
          ),
          onClick: () => router.push('/settings?active=provider'),
          value: 'no-provider',
        },
      ];
    }

    if (sanitizedProviders.length === 1) {
      return buildModelOptions(sanitizedProviders[0]);
    }

    return sanitizedProviders.map((provider) => ({
      label: (
        <Flexbox horizontal justify="space-between">
          <ProviderItemRender
            logo={provider.logo}
            name={provider.name}
            provider={provider.id}
            source={provider.source}
          />
          <Link href={`/settings?active=provider&provider=${encodeURIComponent(provider.id)}`}>
            <ActionIcon
              icon={LucideBolt}
              size="small"
              title={t('config.goToProvider', '供应商设置')}
            />
          </Link>
        </Flexbox>
      ),
      options: buildModelOptions(provider),
    }));
  }, [enabledThreeDModelList, router, t, theme.colorTextTertiary]);

  return (
    <UiSelect
      classNames={{ root: styles.popup }}
      onChange={(value, option) => {
        if (!value || value === 'no-provider' || value.includes('/empty')) return;
        const model = value.split('/').slice(1).join('/');
        const provider = (option as unknown as ModelOption).provider;
        if (model && provider && (model !== currentModel || provider !== currentProvider)) {
          setModelAndProvider(model, provider);
        }
      }}
      options={providerOptions}
      placeholder={t('config.modelPlaceholder', '选择模型')}
      shadow
      size="large"
      style={{ width: '100%' }}
      value={currentProvider && currentModel ? `${currentProvider}/${currentModel}` : undefined}
    />
  );
});

interface PromptComposerProps {
  imageInputMode: 'single' | 'multi';
  inputMode: 'text' | 'image';
  isSubmitting: boolean;
  messageApi: ReturnType<typeof message.useMessage>[0];
  multiViewDescription?: string;
  multiViewMaxCount: number;
  onImageInputModeChange: (mode: 'single' | 'multi') => void;
  onModeChange: (mode: 'text' | 'image') => void;
  onSubmit: () => void;
  showRapidHint: boolean;
  singleImageDescription?: string;
  supportsImage: boolean;
  supportsMultiImage: boolean;
  supportsSingleImage: boolean;
}

const PromptComposer: FC<PromptComposerProps> = ({
  imageInputMode,
  inputMode,
  isSubmitting,
  messageApi,
  multiViewDescription,
  multiViewMaxCount,
  onImageInputModeChange,
  onModeChange,
  onSubmit,
  showRapidHint,
  singleImageDescription,
  supportsImage,
  supportsMultiImage,
  supportsSingleImage,
}) => {
  const { styles } = usePromptStyles();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });

  const prompt = useThreeDStore((state) => state.parameters.prompt);
  const imageUrl = useThreeDStore((state) => state.parameters.imageUrl as string | undefined);
  const multiViewImages = useThreeDStore(
    (state) => state.parameters.multiViewImages as string[] | undefined,
  );
  const setPrompt = useThreeDStore((state) => state.setPrompt);
  const setParameter = useThreeDStore((state) => state.setParameter);

  const promptValue = typeof prompt === 'string' ? prompt : '';
  const isTextMode = inputMode === 'text';
  const isImageMode = inputMode === 'image';

  useEffect(() => {
    if (!isTextMode && promptValue) {
      setPrompt('');
    }
  }, [isTextMode, promptValue, setPrompt]);

  const canSubmit = useMemo(() => {
    if (isTextMode) {
      return Boolean(promptValue.trim());
    }

    if (supportsImage) {
      if (imageInputMode === 'single') {
        return Boolean(imageUrl);
      }
      return Boolean(multiViewImages && multiViewImages.length > 0);
    }

    return false;
  }, [imageInputMode, imageUrl, isTextMode, multiViewImages, promptValue, supportsImage]);

  const modeOptions = useMemo(
    () => [
      { label: t('config.promptMode.text', '文本模式'), value: 'text' },
      {
        disabled: !supportsImage,
        label: t('config.promptMode.image', '图片模式'),
        value: 'image',
      },
    ],
    [supportsImage, t],
  );

  const imageModeOptions = useMemo(() => {
    const options: Array<{ label: string; value: 'single' | 'multi' }> = [];
    if (supportsSingleImage) {
      options.push({ label: t('config.imageMode.single', '单图'), value: 'single' });
    }
    if (supportsMultiImage) {
      options.push({ label: t('config.imageMode.multi', '多图'), value: 'multi' });
    }
    return options;
  }, [supportsMultiImage, supportsSingleImage, t]);

  const handlePromptChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (!isTextMode) return;
      setPrompt(event.target.value);
    },
    [isTextMode, setPrompt],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey && isTextMode) {
        event.preventDefault();
        if (!isSubmitting && canSubmit) {
          onSubmit();
        }
      }
    },
    [canSubmit, isSubmitting, isTextMode, onSubmit],
  );

  let noteText: string | undefined;
  let inputContent: ReactNode;

  if (isTextMode) {
    noteText = undefined;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <TextArea
          className={styles.textArea}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          placeholder={t('config.promptPlaceholder', '描述你想要的 3D 资产')}
          rows={6}
          value={promptValue}
          variant="borderless"
        />
      </div>
    );
  } else if (imageInputMode === 'multi' && supportsMultiImage) {
    noteText = multiViewDescription;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <MultiViewUpload
          disabled={isSubmitting}
          maxCount={multiViewMaxCount}
          messageApi={messageApi}
          onChange={(urls) => setParameter('multiViewImages', urls)}
          placeholder={t('config.multiViewPlaceholder', {
            defaultValue: '上传多张视角图像（最多 {{max}} 张）',
            max: multiViewMaxCount,
          })}
          value={multiViewImages || []}
        />
      </div>
    );
  } else if (supportsSingleImage) {
    noteText = singleImageDescription;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <ReferenceImageUpload
          disabled={isSubmitting}
          messageApi={messageApi}
          onChange={(url) => setParameter('imageUrl', url || '')}
          placeholder={singleImageDescription || t('config.imagePlaceholder', '上传参考图像')}
          value={imageUrl || undefined}
        />
      </div>
    );
  } else {
    noteText = undefined;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <ReferenceImageUpload
          disabled
          messageApi={messageApi}
          onChange={() => {}}
          placeholder={t('config.imagePlaceholder', '上传参考图像')}
        />
      </div>
    );
  }

  return (
    <Flexbox className={styles.wrapper} gap={12}>
      <Flexbox align="center" className={styles.container} gap={12} horizontal width="100%">
        <div className={styles.inputColumn}>
          <div className={styles.toggleRow}>
            <Segmented
              onChange={(value) => onModeChange(value as 'text' | 'image')}
              options={modeOptions}
              size="large"
              value={inputMode}
            />
            {isImageMode && imageModeOptions.length > 1 && (
              <Segmented
                className={styles.imageModeSwitch}
                onChange={(value) => onImageInputModeChange(value as 'single' | 'multi')}
                options={imageModeOptions}
                size="middle"
                value={imageInputMode}
              />
            )}
            {isImageMode && noteText && <Text className={styles.toggleNote}>{noteText}</Text>}
          </div>
          {inputContent}
        </div>
        <UiButton
          disabled={!canSubmit}
          icon={Sparkles}
          loading={isSubmitting}
          onClick={onSubmit}
          size="large"
          style={{
            alignSelf: 'center',
            fontWeight: 500,
            height: 64,
            minWidth: 64,
            width: 64,
          }}
          type="primary"
        />
      </Flexbox>

      {isTextMode && showRapidHint && (
        <Text className={styles.note}>
          {t('config.rapidPromptHint', '快速版提示词建议控制在 200 字符以内')}
        </Text>
      )}
    </Flexbox>
  );
};
interface ConversionModalProps {
  confirmLoading: boolean;
  dialog: {
    assetFormat?: string;
    generationId: string;
    model: string;
    prompt?: string;
    provider: string;
  } | null;
  initialValues: Record<string, any>;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  t: TFunction<'threeD', 'workspace'>;
}

const ConversionModal: FC<ConversionModalProps> = ({
  confirmLoading,
  dialog,
  initialValues,
  loading,
  onCancel,
  onSubmit,
  t,
}) => {
  const [form] = Form.useForm();
  const [quadEnabled, setQuadEnabled] = useState(false);
  const [flattenBottomEnabled, setFlattenBottomEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!dialog) {
      form.resetFields();
      setQuadEnabled(false);
      setFlattenBottomEnabled(false);
      return;
    }

    form.setFieldsValue(initialValues);
    const currentValues = form.getFieldsValue();
    setQuadEnabled(Boolean(currentValues.quad));
    setFlattenBottomEnabled(Boolean(currentValues.flattenBottom));
  }, [dialog, form, initialValues]);

  const handleValuesChange = useCallback((_: any, allValues: Record<string, any>) => {
    setQuadEnabled(Boolean(allValues.quad));
    setFlattenBottomEnabled(Boolean(allValues.flattenBottom));
  }, []);

  const handleCancel = useCallback(() => {
    form.resetFields();
    setQuadEnabled(false);
    setFlattenBottomEnabled(false);
    onCancel();
  }, [form, onCancel]);

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
    } catch (error: any) {
      if (error?.errorFields) return;
      throw error;
    }
  }, [form, onSubmit]);

  if (!mounted) return null;

  return (
    <Modal
      cancelText={t('common.cancel', '取消')}
      confirmLoading={loading || confirmLoading}
      forceRender
      okText={t('result.convertSubmit', '提交转换')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={Boolean(dialog)}
      title={t('result.convertModalTitle', '转换模型格式')}
    >
      {dialog && (
        <Alert
          message={t('result.convertSourceInfo', {
            defaultValue: '源模型格式：{{format}}',
            format: dialog.assetFormat || '未知',
          })}
          showIcon
          type="info"
        />
      )}
      <Form
        form={form}
        initialValues={initialValues}
        key={dialog?.generationId || 'conversion-form'}
        layout="vertical"
        onValuesChange={handleValuesChange}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label={t('convert.format', '目标格式')}
          name="format"
          rules={[{ message: t('convert.formatRequired', '请选择目标格式'), required: true }]}
        >
          <AntSelect
            options={TRIPO_CONVERSION_FORMATS.map((value) => ({ label: value, value }))}
            placeholder={t('convert.formatPlaceholder', '选择输出格式')}
          />
        </Form.Item>

        <Form.Item label={t('convert.faceLimit', '面数上限')} name="faceLimit">
          <InputNumber
            max={1_500_000}
            min={1000}
            placeholder={t('convert.faceLimitPlaceholder', '默认保留原始面数')}
            step={1000}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label={t('convert.textureSize', '贴图分辨率')} name="textureSize">
          <InputNumber
            max={4096}
            min={512}
            placeholder={t('convert.textureSizePlaceholder', '默认 2048')}
            step={512}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label={t('convert.textureFormat', '贴图格式')} name="textureFormat">
          <AntSelect
            allowClear
            options={TRIPO_TEXTURE_FORMATS.map((value) => ({ label: value, value }))}
            placeholder={t('convert.textureFormatPlaceholder', '默认保留原格式')}
          />
        </Form.Item>

        <Form.Item
          label={t('convert.scaleFactor', '缩放系数')}
          name="scaleFactor"
          tooltip={t('convert.scaleFactorTip', '用于整体缩放模型尺寸，默认 1')}
        >
          <InputNumber max={10} min={0.1} step={0.1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label={t('convert.quad', '启用四边形重建')} name="quad" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          label={t('convert.forceSymmetry', '强制对称拓扑')}
          name="forceSymmetry"
          valuePropName="checked"
        >
          <Switch disabled={!quadEnabled} />
        </Form.Item>

        <Form.Item
          label={t('convert.withAnimation', '保留骨骼与动画')}
          name="withAnimation"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item label={t('convert.packUv', '合并 UV 岛')} name="packUv" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label={t('convert.bake', '烘焙材质')} name="bake" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          label={t('convert.pivotToCenter', '枢轴移至底部中心')}
          name="pivotToCenterBottom"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label={t('convert.flattenBottom', '启用底部平整化')}
          name="flattenBottom"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label={t('convert.flattenBottomThreshold', '平整深度')}
          name="flattenBottomThreshold"
        >
          <InputNumber
            disabled={!flattenBottomEnabled}
            max={0.5}
            min={0.001}
            step={0.001}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label={t('convert.animateInPlace', '原地播放动画')}
          name="animateInPlace"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label={t('convert.exportVertexColors', '导出顶点色（OBJ）')}
          name="exportVertexColors"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item label={t('convert.exportOrientation', '模型朝向')} name="exportOrientation">
          <AntSelect
            allowClear
            options={TRIPO_EXPORT_ORIENTATIONS.map((value) => ({ label: value, value }))}
            placeholder={t('convert.exportOrientationPlaceholder', '保持默认 +x')}
          />
        </Form.Item>

        <Form.Item label={t('convert.fbxPreset', 'FBX 预设')} name="fbxPreset">
          <AntSelect
            allowClear
            options={TRIPO_FBX_PRESETS.map((value) => ({ label: value, value }))}
            placeholder={t('convert.fbxPresetPlaceholder', '默认 Blender')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const ConfigSidebar: FC = memo(() => {
  const { styles } = useWorkspaceStyles();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });

  const parameters = useThreeDStore((state) => state.parameters);
  const parametersSchema = useThreeDStore((state) => state.parametersSchema);
  const modelCount = useThreeDStore((state) => state.modelCount);
  const setModelCount = useThreeDStore((state) => state.setModelCount);
  const setParameter = useThreeDStore((state) => state.setParameter);
  const provider = useThreeDStore((state) => state.provider);
  const model = useThreeDStore((state) => state.model);

  const providerList = useAiInfraStore(aiProviderSelectors.enabledThreeDModelList);

  const { providerName, modelName } = useMemo(() => {
    const currentProvider = providerList.find((item) => item.id === provider);
    const sanitizedModels =
      currentProvider?.children.filter((child) => !LEGACY_TRIPO_MODEL_IDS.has(child.id)) || [];
    const currentModel = sanitizedModels.find((item) => item.id === model);

    return {
      modelName: currentModel?.displayName || currentModel?.id,
      providerName: currentProvider?.name,
    };
  }, [model, provider, providerList]);

  const enablePBRS = parametersSchema?.enablePBR;
  const faceCountSchema = parametersSchema?.faceCount;
  const faceLimitSchema = parametersSchema?.faceLimit;
  const generateTypeSchema = parametersSchema?.generateType;
  const polygonTypeSchema = parametersSchema?.polygonType;
  const resultFormatSchema = parametersSchema?.resultFormat;
  const modelSeedSchema = parametersSchema?.modelSeed;
  const textureSchema = parametersSchema?.texture;
  const pbrSchema = parametersSchema?.pbr;
  const textureQualitySchema = parametersSchema?.textureQuality;
  const textureAlignmentSchema = parametersSchema?.textureAlignment;
  const geometryQualitySchema = parametersSchema?.geometryQuality;
  const textureSeedSchema = parametersSchema?.textureSeed;
  const autoSizeSchema = parametersSchema?.autoSize;
  const smartLowPolySchema = parametersSchema?.smartLowPoly;
  const generatePartsSchema = parametersSchema?.generateParts;
  const styleSchema = parametersSchema?.style;
  const quadSchema = parametersSchema?.quad;

  const faceCountFallback = faceCountSchema?.default ?? faceCountSchema?.min ?? 40_000;

  const generateTypeOptions = useMemo(() => {
    if (!generateTypeSchema?.enum) return undefined;
    return generateTypeSchema.enum.map((value: string) => ({
      label: t(`config.generateTypeOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [generateTypeSchema, t]);

  const polygonTypeOptions = useMemo(() => {
    if (!polygonTypeSchema?.enum) return undefined;
    return polygonTypeSchema.enum.map((value: string) => ({
      label: t(`config.polygonTypeOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [polygonTypeSchema, t]);

  const resultFormatOptions = useMemo(() => {
    if (!resultFormatSchema?.enum) return undefined;
    return resultFormatSchema.enum.map((value: string) => ({
      label: value.toUpperCase(),
      value: value.toUpperCase(),
    }));
  }, [resultFormatSchema]);

  const geometryQualityOptions = useMemo(() => {
    if (!geometryQualitySchema?.enum) return undefined;
    return geometryQualitySchema.enum.map((value: string) => ({
      label: t(`config.geometryQualityOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [geometryQualitySchema, t]);

  const textureQualityOptions = useMemo(() => {
    if (!textureQualitySchema?.enum) return undefined;
    return textureQualitySchema.enum.map((value: string) => ({
      label: t(`config.textureQualityOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [textureQualitySchema, t]);

  const textureAlignmentOptions = useMemo(() => {
    if (!textureAlignmentSchema?.enum) return undefined;
    return textureAlignmentSchema.enum.map((value: string) => ({
      label: t(`config.textureAlignmentOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [textureAlignmentSchema, t]);

  const renderSection = useCallback(
    (label: string | undefined, description: string | undefined, children: ReactNode) => (
      <Flexbox className={styles.configItem}>
        {label && <Text className={styles.label}>{label}</Text>}
        {children}
        {description && <Text className={styles.description}>{description}</Text>}
      </Flexbox>
    ),
    [styles.configItem, styles.description, styles.label],
  );

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <Title level={5} style={{ margin: 0 }}>
          {t('config.title', '建模参数')}
        </Title>
        <Text type="secondary">
          {providerName && modelName
            ? t('config.selectedModel', {
                defaultValue: '当前：{{provider}} · {{model}}',
                model: modelName,
                provider: providerName,
              })
            : t('config.modelPlaceholder', '选择模型')}
        </Text>
      </div>
      <div style={{ marginBottom: 20 }}>
        <ThreeDModelSelect />
      </div>

      <div className={styles.sidebarScroll}>
        {renderSection(
          t('config.count', '生成数量'),
          undefined,
          <InputNumber
            max={4}
            min={1}
            onChange={(value) => setModelCount(value ? Number(value) : 1)}
            style={{ width: '100%' }}
            value={modelCount}
          />,
        )}

        {modelSeedSchema &&
          renderSection(
            t('config.modelSeed', '几何随机种子'),
            t('config.modelSeedDescription', '留空使用随机值，指定后可复现实验中的网格结果。'),
            <InputNumber
              max={modelSeedSchema.max}
              min={modelSeedSchema.min}
              onChange={(value) =>
                setParameter(
                  'modelSeed',
                  typeof value === 'number' && Number.isFinite(value) ? value : null,
                )
              }
              style={{ width: '100%' }}
              value={typeof parameters.modelSeed === 'number' ? parameters.modelSeed : undefined}
            />,
          )}

        {faceLimitSchema &&
          renderSection(
            t('config.faceLimit', '面数上限'),
            t('config.faceLimitDescription'),
            <InputNumber
              max={faceLimitSchema.max}
              min={faceLimitSchema.min}
              onChange={(value) =>
                setParameter(
                  'faceLimit',
                  typeof value === 'number' && Number.isFinite(value) ? value : null,
                )
              }
              step={faceLimitSchema.step ?? 500}
              style={{ width: '100%' }}
              value={typeof parameters.faceLimit === 'number' ? parameters.faceLimit : undefined}
            />,
          )}

        {faceCountSchema &&
          renderSection(
            t('config.faceCount', '最大面数'),
            t('config.faceCountDescription', {
              defaultValue: '范围 {{min}} - {{max}}，数值越高细节越好',
              max: faceCountSchema.max ?? 1_500_000,
              min: faceCountSchema.min ?? 40_000,
            }),
            <InputNumber
              max={faceCountSchema.max}
              min={faceCountSchema.min}
              onChange={(value) =>
                setParameter('faceCount', typeof value === 'number' ? value : faceCountFallback)
              }
              step={faceCountSchema.step ?? 10_000}
              style={{ width: '100%' }}
              value={
                typeof parameters.faceCount === 'number' ? parameters.faceCount : faceCountFallback
              }
            />,
          )}

        {enablePBRS &&
          renderSection(
            t('config.enablePBR', '启用 PBR 材质'),
            t('config.enablePBRDescription'),
            <Switch
              checked={parameters.enablePBR !== false}
              onChange={(checked) => {
                setParameter('enablePBR', checked);
                if (pbrSchema) {
                  setParameter('pbr', checked);
                }
              }}
            />,
          )}

        {textureSchema &&
          renderSection(
            t('config.texture', '生成贴图'),
            t('config.textureDescription'),
            <Switch
              checked={parameters.texture !== false}
              onChange={(checked) => setParameter('texture', checked)}
            />,
          )}

        {textureQualityOptions &&
          renderSection(
            t('config.textureQuality', '贴图质量'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('textureQuality', value)}
              options={textureQualityOptions}
              style={{ width: '100%' }}
              value={parameters.textureQuality ?? textureQualitySchema?.default}
            />,
          )}

        {textureAlignmentOptions &&
          renderSection(
            t('config.textureAlignment', '贴图对齐方式'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('textureAlignment', value)}
              options={textureAlignmentOptions}
              style={{ width: '100%' }}
              value={parameters.textureAlignment ?? textureAlignmentSchema?.default}
            />,
          )}

        {generateTypeOptions &&
          renderSection(
            t('config.generateType', '生成模式'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('generateType', value)}
              options={generateTypeOptions}
              style={{ width: '100%' }}
              value={parameters.generateType ?? generateTypeSchema?.default}
            />,
          )}

        {polygonTypeOptions &&
          renderSection(
            t('config.polygonType', '多边形类型'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('polygonType', value)}
              options={polygonTypeOptions}
              style={{ width: '100%' }}
              value={parameters.polygonType ?? polygonTypeSchema?.default}
            />,
          )}

        {resultFormatOptions &&
          renderSection(
            t('config.resultFormat', '输出格式'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('resultFormat', value)}
              options={resultFormatOptions}
              placeholder={t('config.resultFormatPlaceholder', '选择导出的模型格式')}
              style={{ width: '100%' }}
              value={parameters.resultFormat ?? resultFormatSchema?.default}
            />,
          )}

        {geometryQualityOptions &&
          renderSection(
            t('config.geometryQuality', '几何质量'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('geometryQuality', value)}
              options={geometryQualityOptions}
              style={{ width: '100%' }}
              value={parameters.geometryQuality ?? geometryQualitySchema?.default}
            />,
          )}

        {textureSeedSchema &&
          renderSection(
            t('config.textureSeed', '贴图随机种子'),
            undefined,
            <InputNumber
              max={textureSeedSchema.max}
              min={textureSeedSchema.min}
              onChange={(value) =>
                setParameter(
                  'textureSeed',
                  typeof value === 'number' && Number.isFinite(value) ? value : null,
                )
              }
              style={{ width: '100%' }}
              value={
                typeof parameters.textureSeed === 'number' ? parameters.textureSeed : undefined
              }
            />,
          )}

        {autoSizeSchema &&
          renderSection(
            t('config.autoSize', '自动缩放至真实尺寸'),
            undefined,
            <Switch
              checked={Boolean(parameters.autoSize)}
              onChange={(checked) => setParameter('autoSize', checked)}
            />,
          )}

        {smartLowPolySchema &&
          renderSection(
            t('config.smartLowPoly', '智能低多边形'),
            t('config.smartLowPolyDescription', '适用于需要低面数模型的场景，复杂模型可能失败。'),
            <Switch
              checked={Boolean(parameters.smartLowPoly)}
              onChange={(checked) => setParameter('smartLowPoly', checked)}
            />,
          )}

        {generatePartsSchema &&
          renderSection(
            t('config.generateParts', '生成可分段模型'),
            t(
              'config.generatePartsDescription',
              '启用后将自动关闭贴图/PBR/四边形输出，适合后续编辑分件。',
            ),
            <Switch
              checked={Boolean(parameters.generateParts)}
              onChange={(checked) => setParameter('generateParts', checked)}
            />,
          )}

        {quadSchema &&
          renderSection(
            t('config.quad', '输出四边形网格'),
            t('config.quadDescription', '开启后将以 FBX 形式输出四边形网格模型。'),
            <Switch
              checked={Boolean(parameters.quad)}
              onChange={(checked) => setParameter('quad', checked)}
            />,
          )}

        {styleSchema?.enum &&
          renderSection(
            t('config.style', '艺术风格'),
            t('config.stylePlaceholder', '可选：选择一种艺术风格'),
            <AntSelect
              allowClear
              onChange={(value) => setParameter('style', value || '')}
              options={styleSchema.enum.map((value: string) => ({
                label: value,
                value,
              }))}
              placeholder={t('config.stylePlaceholder', '可选：选择一种艺术风格')}
              style={{ width: '100%' }}
              value={parameters.style || undefined}
            />,
          )}
      </div>
    </div>
  );
});

const ThreeDWorkspace = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });
  const { styles } = useWorkspaceStyles();

  useThreeDConfig();

  const activeTopicId = useThreeDStore((s) => s.activeTopicId);
  const isCreating = useThreeDStore((s) => s.isCreating);
  const parametersSchema = useThreeDStore((s) => s.parametersSchema);
  const model = useThreeDStore((s) => s.model);

  const setActiveTopicId = useThreeDStore((s) => s.setActiveTopicId);
  const createThreeDTask = useThreeDStore((s) => s.createTask);
  const convertGeneration = useThreeDStore((s) => s.convertGeneration);
  const convertingGenerations = useThreeDStore((s) => s.convertingGenerations);

  const imageSchema = parametersSchema?.imageUrl;
  const multiViewSchema = parametersSchema?.multiViewImages;
  const supportsSingleImage = Boolean(imageSchema);
  const supportsMultiImage = Boolean(multiViewSchema);
  const supportsImageInput = supportsSingleImage || supportsMultiImage;
  const multiViewMaxCount = multiViewSchema?.maxCount ?? 3;

  const [inputMode, setInputMode] = useState<'text' | 'image'>(() =>
    supportsImageInput ? 'text' : 'text',
  );
  const [imageInputMode, setImageInputMode] = useState<'single' | 'multi'>(() =>
    supportsMultiImage && !supportsSingleImage ? 'multi' : 'single',
  );

  useEffect(() => {
    if (!supportsImageInput && inputMode === 'image') {
      setInputMode('text');
    }
  }, [inputMode, supportsImageInput]);

  useEffect(() => {
    if (!supportsSingleImage && supportsMultiImage) {
      setImageInputMode('multi');
    } else if (supportsSingleImage && !supportsMultiImage) {
      setImageInputMode('single');
    } else if (!supportsSingleImage && !supportsMultiImage) {
      setImageInputMode('single');
    } else if (!supportsMultiImage && imageInputMode === 'multi') {
      setImageInputMode('single');
    } else if (!supportsSingleImage && imageInputMode === 'single') {
      setImageInputMode('multi');
    }
  }, [imageInputMode, supportsMultiImage, supportsSingleImage]);

  const [conversionDialog, setConversionDialog] = useState<{
    assetFormat?: string;
    generationId: string;
    model: string;
    prompt?: string;
    provider: string;
  } | null>(null);
  const [conversionSubmitting, setConversionSubmitting] = useState(false);

  const {
    data: topics = [],
    mutate: refreshTopics,
    isLoading: isTopicsLoading,
  } = useClientDataSWR(
    'threeD-topics',
    () =>
      generationTopicService.getAllGenerationTopics({
        type: 'threeD',
      }),
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (!topics.length) return;
    if (!activeTopicId) {
      setActiveTopicId(topics[0].id);
    } else if (!topics.some((topic) => topic.id === activeTopicId)) {
      setActiveTopicId(topics[0].id);
    }
  }, [activeTopicId, setActiveTopicId, topics]);

  const {
    data: generationBatches,
    isLoading: isBatchLoading,
    mutate: refreshBatches,
  } = useClientDataSWR<GenerationBatch[] | undefined>(
    activeTopicId ? ['threeD-batches', activeTopicId] : null,
    async ([, topicId]) => generationBatchService.getGenerationBatches(topicId as string, 'threeD'),
    {
      revalidateOnFocus: false,
    },
  );

  const hasPendingGenerations = useMemo(() => {
    if (!generationBatches?.length) return false;
    return generationBatches.some((batch) =>
      batch.generations?.some((generation) => pendingStatuses.has(generation.task.status)),
    );
  }, [generationBatches]);

  useEffect(() => {
    if (!hasPendingGenerations) return;

    const timer = setInterval(() => {
      if (!isBatchLoading) {
        refreshBatches();
      }
    }, 5000);

    // 立即触发一次刷新，避免等待首个轮询周期
    if (!isBatchLoading) {
      refreshBatches();
    }

    return () => clearInterval(timer);
  }, [hasPendingGenerations, isBatchLoading, refreshBatches]);

  const handleRefreshBatches = useCallback(() => {
    refreshBatches();
  }, [refreshBatches]);

  const handleOpenConversion = useCallback(
    (payload: {
      assetFormat?: string;
      generationId: string;
      model: string;
      prompt?: string;
      provider: string;
    }) => {
      setConversionSubmitting(false);
      setConversionDialog(payload);
    },
    [],
  );

  const handleCloseConversion = useCallback(() => {
    setConversionDialog(null);
    setConversionSubmitting(false);
  }, []);

  const handleSubmitConversion = useCallback(
    async (values: Record<string, any>) => {
      if (!conversionDialog) return;

      setConversionSubmitting(true);

      try {
        const params: Record<string, any> = {
          format: values.format,
        };

        const booleanFields: Array<keyof typeof values> = [
          'quad',
          'forceSymmetry',
          'withAnimation',
          'packUv',
          'bake',
          'pivotToCenterBottom',
          'flattenBottom',
          'animateInPlace',
          'exportVertexColors',
        ];

        booleanFields.forEach((field) => {
          if (typeof values[field] === 'boolean') {
            if (field === 'forceSymmetry' && !values.quad) return;
            params[field] = values[field];
          }
        });

        if (typeof values.faceLimit === 'number') params.faceLimit = values.faceLimit;
        if (typeof values.textureSize === 'number') params.textureSize = values.textureSize;
        if (typeof values.scaleFactor === 'number') params.scaleFactor = values.scaleFactor;
        if (values.textureFormat) params.textureFormat = values.textureFormat;
        if (values.exportOrientation) params.exportOrientation = values.exportOrientation;
        if (values.fbxPreset) params.fbxPreset = values.fbxPreset;
        if (values.flattenBottom && typeof values.flattenBottomThreshold === 'number') {
          params.flattenBottomThreshold = values.flattenBottomThreshold;
        }

        await convertGeneration({
          generationId: conversionDialog.generationId,
          model: conversionDialog.model,
          params,
          provider: conversionDialog.provider,
        });

        messageApi.success(t('result.convertSubmitSuccess', '转换任务已提交'));
        handleCloseConversion();
        refreshBatches();
      } catch (error: any) {
        const errorMessage =
          error?.message || t('result.convertSubmitFail', '转换任务提交失败，请稍后重试');
        messageApi.error(errorMessage);
      } finally {
        setConversionSubmitting(false);
      }
    },
    [conversionDialog, convertGeneration, handleCloseConversion, messageApi, refreshBatches, t],
  );
  const conversionInitialValues = useMemo(() => {
    const defaultFormat =
      TRIPO_CONVERSION_FORMATS.find((item) => item !== conversionDialog?.assetFormat) ??
      TRIPO_CONVERSION_FORMATS[0];

    return {
      animateInPlace: false,
      bake: true,
      exportOrientation: undefined,
      exportVertexColors: false,
      faceLimit: undefined,
      fbxPreset: undefined,
      flattenBottom: false,
      flattenBottomThreshold: 0.01,
      forceSymmetry: false,
      format: defaultFormat,
      packUv: false,
      pivotToCenterBottom: false,
      quad: false,
      scaleFactor: 1,
      textureFormat: undefined,
      textureSize: 2048,
      withAnimation: true,
    };
  }, [conversionDialog]);

  const handleCreateTopic = useCallback(async () => {
    try {
      const id = await generationTopicService.createTopic({ type: 'threeD' });
      await refreshTopics();
      setActiveTopicId(id);
      messageApi.success(t('topic.createdSuccess', '已创建新的建模主题'));
    } catch (error: any) {
      console.error(error);
      messageApi.error(error?.message || t('topic.createFail', '创建主题失败，请稍后重试'));
    }
  }, [messageApi, refreshTopics, setActiveTopicId, t]);

  const handlePromptSubmit = useCallback(async () => {
    const state = useThreeDStore.getState();
    const promptRaw = typeof state.parameters.prompt === 'string' ? state.parameters.prompt : '';
    const trimmedPrompt = promptRaw.trim();
    const imageUrl = state.parameters.imageUrl as string | undefined;
    const multiViewImages = state.parameters.multiViewImages as string[] | undefined;

    if (inputMode === 'text') {
      if (!trimmedPrompt) {
        messageApi.error(t('config.promptRequired', '请先输入提示词'));
        return;
      }
      if (model === 'hunyuan-3d-rapid' && trimmedPrompt.length > 200) {
        messageApi.error(t('config.rapidPromptLimit', '快速版提示词需控制在 200 字符以内'));
        return;
      }
    } else if (inputMode === 'image') {
      if (!supportsImageInput) {
        messageApi.error(t('config.imageModeNotSupported', '当前模型不支持图片输入'));
        return;
      }

      if (imageInputMode === 'single' && supportsSingleImage && !imageUrl) {
        messageApi.error(t('config.imageRequired', '请先上传参考图片'));
        return;
      }

      if (
        imageInputMode === 'multi' &&
        supportsMultiImage &&
        (!multiViewImages || multiViewImages.length === 0)
      ) {
        messageApi.error(t('config.multiViewRequired', '请上传至少一张视角图像'));
        return;
      }

      if (model === 'hunyuan-3d-rapid' && trimmedPrompt.length > 200) {
        messageApi.error(t('config.rapidPromptLimit', '快速版提示词需控制在 200 字符以内'));
        return;
      }
    }

    let topicId = activeTopicId;

    try {
      if (!topicId) {
        topicId = await generationTopicService.createTopic({ type: 'threeD' });
        await refreshTopics();
        setActiveTopicId(topicId);
      }

      if (!topicId) return;

      await createThreeDTask(topicId);
      await refreshBatches();
      messageApi.success(t('result.submitSuccess', '建模任务已提交'));
    } catch (error: any) {
      console.error(error);
      messageApi.error(error?.message || t('result.submitFail', '建模任务提交失败'));
    }
  }, [
    activeTopicId,
    createThreeDTask,
    imageInputMode,
    inputMode,
    messageApi,
    model,
    refreshBatches,
    refreshTopics,
    setActiveTopicId,
    supportsImageInput,
    supportsMultiImage,
    supportsSingleImage,
    t,
  ]);

  const singleImageDescription =
    typeof imageSchema?.description === 'string' ? imageSchema.description : undefined;
  const multiViewDescription =
    typeof multiViewSchema?.description === 'string' ? multiViewSchema.description : undefined;
  const isRapidModel = model === 'hunyuan-3d-rapid';

  const isConversionProcessing = conversionDialog
    ? Boolean(convertingGenerations[conversionDialog.generationId])
    : false;

  return (
    <>
      {contextHolder}
      <ConversionModal
        confirmLoading={isConversionProcessing}
        dialog={conversionDialog}
        initialValues={conversionInitialValues}
        loading={conversionSubmitting}
        onCancel={handleCloseConversion}
        onSubmit={handleSubmitConversion}
        t={t}
      />
      <div className={styles.page}>
        <ConfigSidebar />
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <Flexbox align="center" horizontal justify="space-between" style={{ width: '100%' }}>
              <Flexbox align="center" gap={8} horizontal>
                <Sparkles size={18} />
                <Title level={4} style={{ margin: 0 }}>
                  {t('result.title', '生成记录')}
                </Title>
                {hasPendingGenerations && (
                  <Tag color="processing">{t('result.pendingTag', '有任务正在处理中')}</Tag>
                )}
              </Flexbox>
              <Button loading={isBatchLoading} onClick={handleRefreshBatches} size="small">
                {t('result.refresh', '刷新')}
              </Button>
            </Flexbox>
          </div>

          <div className={styles.feed}>
            <GenerationFeedList
              convertingGenerations={convertingGenerations}
              generationBatches={generationBatches}
              onOpenConversion={handleOpenConversion}
              t={t}
            />
          </div>

          <div className={styles.promptSection}>
            <PromptComposer
              imageInputMode={imageInputMode}
              inputMode={inputMode}
              isSubmitting={isCreating}
              messageApi={messageApi}
              multiViewDescription={multiViewDescription}
              multiViewMaxCount={multiViewMaxCount}
              onImageInputModeChange={setImageInputMode}
              onModeChange={setInputMode}
              onSubmit={handlePromptSubmit}
              showRapidHint={isRapidModel}
              singleImageDescription={singleImageDescription}
              supportsImage={supportsImageInput}
              supportsMultiImage={supportsMultiImage}
              supportsSingleImage={supportsSingleImage}
            />
          </div>
        </div>
        <div className={styles.topicPanel}>
          <div className={styles.topicHeader}>
            <Text className={styles.label}>{t('topic.title', '建模主题')}</Text>
            <Button loading={isTopicsLoading} onClick={handleCreateTopic} size="small" type="link">
              {t('topic.create', '新建')}
            </Button>
          </div>
          <div className={styles.topicList}>
            {topics.length === 0 && !isTopicsLoading ? (
              <Empty
                description={t('topic.empty', '暂无建模主题')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={topics}
                loading={isTopicsLoading}
                renderItem={(topic) => (
                  <List.Item
                    onClick={() => setActiveTopicId(topic.id)}
                    style={{
                      background:
                        topic.id === activeTopicId
                          ? 'var(--ant-color-fill-secondary)'
                          : 'transparent',
                      borderRadius: 8,
                      cursor: 'pointer',
                      padding: '8px 12px',
                    }}
                  >
                    <Flexbox gap={4}>
                      <Text strong>{topic.title || t('topic.untitled', '未命名主题')}</Text>
                      <Text style={{ fontSize: 12 }} type="secondary">
                        {t('topic.updatedAt', {
                          value: new Date(topic.updatedAt || topic.createdAt).toLocaleString(),
                        })}
                      </Text>
                    </Flexbox>
                  </List.Item>
                )}
                split={false}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

ThreeDWorkspace.displayName = 'ThreeDWorkspace';

export default ThreeDWorkspace;
