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

const ThreeDWorkspace = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });

  useThreeDConfig();

  const providerList = useAiInfraStore(aiProviderSelectors.enabledThreeDModelList);
  const activeTopicId = useThreeDStore((s) => s.activeTopicId);
  const isCreating = useThreeDStore((s) => s.isCreating);
  const modelCount = useThreeDStore((s) => s.modelCount);
  const parameters = useThreeDStore((s) => s.parameters);
  const provider = useThreeDStore((s) => s.provider);
  const model = useThreeDStore((s) => s.model);

  const setActiveTopicId = useThreeDStore((s) => s.setActiveTopicId);
  const setModelAndProvider = useThreeDStore((s) => s.setModelAndProvider);
  const setModelCount = useThreeDStore((s) => s.setModelCount);
  const setPrompt = useThreeDStore((s) => s.setPrompt);
  const createThreeDTask = useThreeDStore((s) => s.createTask);

  const {
    data: topics = [],
    mutate: refreshTopics,
    isLoading: isTopicsLoading,
  } = useClientDataSWR('threeD-topics', () => generationTopicService.getAllGenerationTopics(), {
    revalidateOnFocus: false,
  });

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
    async ([, topicId]) => generationBatchService.getGenerationBatches(topicId as string),
    {
      revalidateOnFocus: false,
    },
  );

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
      const id = await generationTopicService.createTopic();
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
      topicId = await generationTopicService.createTopic();
      await refreshTopics();
      setActiveTopicId(topicId);
    }

    if (!topicId) return;

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
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t('config.promptPlaceholder', '描述你想要的 3D 资产')}
                style={{ marginTop: 8 }}
                value={parameters.prompt}
              />
            </div>

            <Button
              block
              disabled={!parameters.prompt}
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
              <Flexbox align="center" gap={8} horizontal>
                <Title level={5} style={{ margin: 0 }}>
                  {t('result.title', '生成记录')}
                </Title>
                {isBatchLoading && <Text type="secondary">{t('result.loading', '加载中...')}</Text>}
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
                  const asset = batch.generations?.[0]?.asset as any;
                  return (
                    <List.Item key={batch.id}>
                      <Flexbox gap={8}>
                        <Text strong>{batch.prompt}</Text>
                        <Text type="secondary">
                          {t('result.assetInfo', {
                            model: batch.model,
                            provider: batch.provider,
                          })}
                        </Text>
                        {asset?.modelUrl && (
                          <a href={asset.modelUrl} rel="noreferrer" target="_blank">
                            {t('result.viewModel', '查看模型文件')}
                          </a>
                        )}
                        {asset?.previewUrl && (
                          <a href={asset.previewUrl} rel="noreferrer" target="_blank">
                            {t('result.viewPreview', '查看预览')}
                          </a>
                        )}
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
