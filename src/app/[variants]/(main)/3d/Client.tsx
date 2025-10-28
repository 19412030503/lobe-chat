'use client';

import {
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  List,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useThreeDConfig } from '@/hooks/useThreeDConfig';
import { useClientDataSWR } from '@/libs/swr';
import { generationBatchService } from '@/services/generationBatch';
import { generationTopicService } from '@/services/generationTopic';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useThreeDStore } from '@/store/threeD';
import { GenerationBatch } from '@/types/generation';

const { Title, Text } = Typography;

const statusColorMap: Record<string, 'error' | 'processing' | 'success' | 'warning'> = {
  error: 'error',
  pending: 'warning',
  processing: 'processing',
  success: 'success',
};

const pendingStatuses = new Set(['pending', 'processing']);

const ThreeDWorkspace = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });

  useThreeDConfig();

  const providerList = useAiInfraStore(aiProviderSelectors.enabledThreeDModelList);
  const activeTopicId = useThreeDStore((s) => s.activeTopicId);
  const isCreating = useThreeDStore((s) => s.isCreating);
  const modelCount = useThreeDStore((s) => s.modelCount);
  const parameters = useThreeDStore((s) => s.parameters);
  const parametersSchema = useThreeDStore((s) => s.parametersSchema);
  const provider = useThreeDStore((s) => s.provider);
  const model = useThreeDStore((s) => s.model);

  const setActiveTopicId = useThreeDStore((s) => s.setActiveTopicId);
  const setModelAndProvider = useThreeDStore((s) => s.setModelAndProvider);
  const setModelCount = useThreeDStore((s) => s.setModelCount);
  const setPrompt = useThreeDStore((s) => s.setPrompt);
  const setParameter = useThreeDStore((s) => s.setParameter);
  const createThreeDTask = useThreeDStore((s) => s.createTask);

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

  const modelOptions = useMemo(() => {
    const currentProvider = providerList.find((item) => item.id === provider);
    return currentProvider?.children?.map((item) => ({
      label: item.displayName || item.id,
      value: item.id,
    }));
  }, [provider, providerList]);

  const providerOptions = useMemo(
    () =>
      providerList.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [providerList],
  );

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

  const handleGenerate = useCallback(async () => {
    let topicId = activeTopicId;

    if (!topicId) {
      topicId = await generationTopicService.createTopic({ type: 'threeD' });
      await refreshTopics();
      setActiveTopicId(topicId);
    }

    if (!topicId) return;

    if (
      model === 'hunyuan-3d-rapid' &&
      typeof parameters.prompt === 'string' &&
      parameters.prompt.length > 200
    ) {
      messageApi.error(t('config.rapidPromptLimit', '快速版提示词需控制在 200 字符以内'));
      return;
    }

    try {
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
    messageApi,
    refreshBatches,
    refreshTopics,
    setActiveTopicId,
    t,
  ]);

  const handleProviderChange = (nextProvider: string) => {
    const targetProvider =
      providerList.find((item) => item.id === nextProvider) || providerList[0] || undefined;
    const nextModel = targetProvider?.children?.[0]?.id;
    setModelAndProvider(nextModel || '', nextProvider);
  };

  const handleModelChange = (nextModel: string) => {
    if (!provider) return;
    setModelAndProvider(nextModel, provider);
  };

  const multiViewSchema = parametersSchema?.multiViewImages;
  const enablePBRS = parametersSchema?.enablePBR;
  const faceCountSchema = parametersSchema?.faceCount;
  const generateTypeSchema = parametersSchema?.generateType;
  const polygonTypeSchema = parametersSchema?.polygonType;
  const resultFormatSchema = parametersSchema?.resultFormat;

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

  const hasPrompt = Boolean(parameters.prompt?.trim());
  const hasImageUrl = Boolean(parameters.imageUrl);
  const hasMultiView =
    Array.isArray(parameters.multiViewImages) && parameters.multiViewImages.length > 0;
  const disableGenerate = !hasPrompt && !hasImageUrl && !hasMultiView;
  const isRapidModel = model === 'hunyuan-3d-rapid';
  const multiViewMaxCount = multiViewSchema?.maxCount ?? 3;
  const faceCountFallback = faceCountSchema?.default ?? faceCountSchema?.min ?? 40_000;

  return (
    <>
      {contextHolder}
      <Flexbox gap={16} horizontal padding={16} style={{ height: '100%', overflow: 'hidden' }}>
        <Card style={{ width: 320 }} title={t('config.title', '建模参数')}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong>{t('config.provider', '模型提供商')}</Text>
              <Select
                onChange={handleProviderChange}
                options={providerOptions}
                placeholder={t('config.providerPlaceholder', '选择提供商')}
                style={{ marginTop: 8, width: '100%' }}
                value={provider}
              />
            </div>

            <div>
              <Text strong>{t('config.model', '模型')}</Text>
              <Select
                disabled={!provider}
                onChange={handleModelChange}
                options={modelOptions}
                placeholder={t('config.modelPlaceholder', '选择模型')}
                style={{ marginTop: 8, width: '100%' }}
                value={model}
              />
            </div>

            <div>
              <Text strong>{t('config.count', '生成数量')}</Text>
              <InputNumber
                max={4}
                min={1}
                onChange={(value) => setModelCount(Number(value))}
                style={{ marginTop: 8, width: '100%' }}
                value={modelCount}
              />
            </div>

            <div>
              <Text strong>{t('config.prompt', '提示词')}</Text>
              <Input.TextArea
                autoSize={{ maxRows: 8, minRows: 4 }}
                maxLength={isRapidModel ? 200 : undefined}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t('config.promptPlaceholder', '描述你想要的 3D 资产')}
                showCount={isRapidModel}
                style={{ marginTop: 8 }}
                value={parameters.prompt}
              />
              {isRapidModel && (
                <Text style={{ display: 'block', marginTop: 4 }} type="secondary">
                  {t('config.rapidPromptHint', '快速版提示词建议控制在 200 字符以内')}
                </Text>
              )}
            </div>

            <div>
              <Text strong>{t('config.reference', '参考图像 URL')}</Text>
              <Input
                onChange={(event) => setParameter('imageUrl', event.target.value)}
                placeholder={t('config.referencePlaceholder', '可选：引用现有图片作为建模参考')}
                style={{ marginTop: 8 }}
                value={parameters.imageUrl || ''}
              />
            </div>

            {multiViewSchema && (
              <div>
                <Text strong>{t('config.multiView', '多视角图片 URL')}</Text>
                <Input.TextArea
                  autoSize={{ maxRows: 6, minRows: 3 }}
                  onChange={(event) => {
                    const urls = event.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, multiViewMaxCount);
                    setParameter('multiViewImages', urls);
                  }}
                  placeholder={t('config.multiViewPlaceholder', {
                    defaultValue: '每行输入一个图片 URL（最多 {{max}} 张）',
                    max: multiViewMaxCount,
                  })}
                  style={{ marginTop: 8 }}
                  value={(parameters.multiViewImages || []).join('\n')}
                />
                <Text style={{ display: 'block', marginTop: 4 }} type="secondary">
                  {t('config.multiViewDescription', {
                    defaultValue: '可选：每行一个 URL，最多 {{max}} 张（左/右/后视图）',
                    max: multiViewMaxCount,
                  })}
                </Text>
              </div>
            )}

            {enablePBRS && (
              <div>
                <Flexbox align="center" horizontal justify="space-between">
                  <Text strong>{t('config.enablePBR', '启用 PBR 材质')}</Text>
                  <Switch
                    checked={Boolean(parameters.enablePBR)}
                    onChange={(checked) => setParameter('enablePBR', checked)}
                  />
                </Flexbox>
                <Text style={{ display: 'block', marginTop: 4 }} type="secondary">
                  {t('config.enablePBRDescription', '开启后输出带物理材质的模型，处理耗时会增加。')}
                </Text>
              </div>
            )}

            {faceCountSchema && (
              <div>
                <Text strong>{t('config.faceCount', '最大面数')}</Text>
                <InputNumber
                  max={faceCountSchema.max}
                  min={faceCountSchema.min}
                  onChange={(value) =>
                    setParameter('faceCount', typeof value === 'number' ? value : faceCountFallback)
                  }
                  step={faceCountSchema.step ?? 10_000}
                  style={{ marginTop: 8, width: '100%' }}
                  value={
                    typeof parameters.faceCount === 'number'
                      ? parameters.faceCount
                      : faceCountFallback
                  }
                />
                <Text style={{ display: 'block', marginTop: 4 }} type="secondary">
                  {t('config.faceCountDescription', {
                    defaultValue: '范围 {{min}} - {{max}}，数值越高细节越好',
                    max: faceCountSchema.max ?? 1_500_000,
                    min: faceCountSchema.min ?? 40_000,
                  })}
                </Text>
              </div>
            )}

            {generateTypeOptions && generateTypeOptions.length > 0 && (
              <div>
                <Text strong>{t('config.generateType', '生成模式')}</Text>
                <Select
                  onChange={(value) => setParameter('generateType', value)}
                  options={generateTypeOptions}
                  style={{ marginTop: 8, width: '100%' }}
                  value={parameters.generateType ?? generateTypeSchema?.default}
                />
              </div>
            )}

            {polygonTypeOptions && polygonTypeOptions.length > 0 && (
              <div>
                <Text strong>{t('config.polygonType', '多边形类型')}</Text>
                <Select
                  onChange={(value) => setParameter('polygonType', value)}
                  options={polygonTypeOptions}
                  style={{ marginTop: 8, width: '100%' }}
                  value={parameters.polygonType ?? polygonTypeSchema?.default}
                />
              </div>
            )}

            {resultFormatOptions && resultFormatOptions.length > 0 && (
              <div>
                <Text strong>{t('config.resultFormat', '输出格式')}</Text>
                <Select
                  onChange={(value) => setParameter('resultFormat', value)}
                  options={resultFormatOptions}
                  placeholder={t('config.resultFormatPlaceholder', '选择导出的模型格式')}
                  style={{ marginTop: 8, width: '100%' }}
                  value={parameters.resultFormat ?? resultFormatSchema?.default}
                />
              </div>
            )}

            <Button
              block
              disabled={disableGenerate}
              loading={isCreating}
              onClick={handleGenerate}
              size="large"
              type="primary"
            >
              {t('config.generate', '开始生成')}
            </Button>
          </Space>
        </Card>

        <Flexbox flex={1} gap={16} style={{ minWidth: 0 }}>
          <Card
            style={{ flex: 1, minHeight: 360 }}
            title={
              <Flexbox align="center" horizontal justify="space-between">
                <Flexbox align="center" gap={8} horizontal>
                  <Title level={5} style={{ margin: 0 }}>
                    {t('result.title', '生成记录')}
                  </Title>
                  {isBatchLoading && (
                    <Text type="secondary">{t('result.loading', '加载中...')}</Text>
                  )}
                  {hasPendingGenerations && (
                    <Tag color="processing">{t('result.pendingTag', '有任务正在处理中')}</Tag>
                  )}
                </Flexbox>
                <Button loading={isBatchLoading} onClick={handleRefreshBatches} size="small">
                  {t('result.refresh', '刷新')}
                </Button>
              </Flexbox>
            }
          >
            {!generationBatches || generationBatches.length === 0 ? (
              <Empty
                description={t('result.empty', '暂无生成记录')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={generationBatches}
                renderItem={(batch) => {
                  const generations = batch.generations || [];
                  const batchStatus = generations.some(
                    (generation) => generation.task.status === 'error',
                  )
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
                            <Text type="secondary">
                              {t('result.noGeneration', '该批次暂无生成结果')}
                            </Text>
                          ) : (
                            generations.map((generation) => {
                              const asset = generation.asset as any;
                              const status = generation.task.status;
                              const tagColor = statusColorMap[status] ?? 'warning';
                              const taskErrorBody = generation.task.error?.body;
                              const taskErrorMessage =
                                typeof taskErrorBody === 'string'
                                  ? taskErrorBody
                                  : taskErrorBody?.detail;
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
                                    </Space>
                                  ) : (
                                    <Text type="secondary">
                                      {t('result.noAsset', '生成结果暂未提供可预览文件')}
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
              />
            )}
          </Card>
        </Flexbox>

        <Card
          extra={
            <Button loading={isTopicsLoading} onClick={handleCreateTopic} size="small" type="link">
              {t('topic.create', '新建')}
            </Button>
          }
          style={{ display: 'flex', flexDirection: 'column', width: 280 }}
          title={t('topic.title', '建模主题')}
        >
          <List
            dataSource={topics}
            loading={isTopicsLoading}
            renderItem={(topic) => (
              <List.Item
                onClick={() => setActiveTopicId(topic.id)}
                style={{
                  background:
                    topic.id === activeTopicId ? 'var(--ant-color-fill-secondary)' : 'transparent',
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
          />
          {!topics.length && !isTopicsLoading && (
            <Empty
              description={t('topic.empty', '暂无建模主题')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: 24 }}
            />
          )}
        </Card>
      </Flexbox>
    </>
  );
};

ThreeDWorkspace.displayName = 'ThreeDWorkspace';

export default ThreeDWorkspace;
