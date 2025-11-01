'use client';

import type { inferRouterOutputs } from '@trpc/server';
import { Card, DatePicker, Progress, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { lambdaQuery } from '@/libs/trpc/client';
import type { LambdaRouter } from '@/server/routers/lambda';

const { RangePicker } = DatePicker;

type LambdaOutputs = inferRouterOutputs<LambdaRouter>;
type MyUsage = LambdaOutputs['quota']['listMyUsages'][number];

const MyUsageRecords = () => {
  const { t } = useTranslation(['setting', 'common']);

  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 查询个人额度信息
  const { data: myQuota } = lambdaQuery.quota.getMyQuota.useQuery();

  // 查询组织额度信息
  const { data: orgCredit } = lambdaQuery.quota.getMyOrganizationCredit.useQuery();

  // 构建查询参数
  const queryParams = useMemo(() => {
    const params: any = {
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    };

    if (dateRange) {
      params.startDate = dateRange[0].toISOString();
      params.endDate = dateRange[1].toISOString();
    }

    return params;
  }, [dateRange, currentPage, pageSize]);

  // 查询个人使用记录
  const { data: myUsages, isLoading } = lambdaQuery.quota.listMyUsages.useQuery(queryParams);

  const columns: ColumnsType<MyUsage> = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
      title: t('management.usage.timestamp'),
      width: 180,
    },
    {
      dataIndex: 'usageType',
      key: 'usageType',
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          '3d': 'purple',
          'chat': 'blue',
          'image': 'green',
        };
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
      },
      title: t('management.usage.type'),
      width: 100,
    },
    {
      dataIndex: 'provider',
      key: 'provider',
      title: t('management.usage.provider'),
      width: 120,
    },
    {
      dataIndex: 'model',
      key: 'model',
      title: t('management.usage.model'),
      width: 180,
    },
    {
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      render: (tokens: number | null) => tokens?.toLocaleString() || '-',
      title: t('management.usage.tokens'),
      width: 100,
    },
    {
      dataIndex: 'creditCost',
      key: 'creditCost',
      render: (cost: number) => (
        <Typography.Text strong style={{ color: cost > 100 ? 'red' : 'inherit' }}>
          {cost.toLocaleString()}
        </Typography.Text>
      ),
      title: t('management.usage.creditCost'),
      width: 100,
    },
  ];

  const quotaPercentage =
    myQuota && myQuota.limit !== null && myQuota.limit > 0
      ? (myQuota.used / myQuota.limit) * 100
      : 0;

  const quotaStatus =
    quotaPercentage >= 90 ? 'exception' : quotaPercentage >= 70 ? 'active' : 'normal';

  return (
    <Flexbox gap={24} width={'100%'}>
      {/* 组织额度和个人额度并排显示 */}
      <Flexbox gap={16} horizontal style={{ width: '100%' }}>
        {/* 组织额度卡片 */}
        {orgCredit && (
          <Card style={{ flex: 1 }} title={t('account.usage.organizationCredit')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Flexbox gap={8}>
                <Typography.Text type="secondary">
                  {t('management.quota.organizationName')}:
                </Typography.Text>
                <Typography.Text strong>
                  {(() => {
                    const org = orgCredit.organization as any;
                    return org && !Array.isArray(org) ? org.name : '-';
                  })()}
                </Typography.Text>
              </Flexbox>
              <Flexbox gap={8}>
                <Typography.Text type="secondary">{t('management.quota.balance')}:</Typography.Text>
                <Typography.Text
                  strong
                  style={{ color: orgCredit.balance < 1000 ? 'red' : 'inherit' }}
                >
                  {orgCredit.balance.toLocaleString()}
                </Typography.Text>
              </Flexbox>
            </Space>
          </Card>
        )}

        {/* 个人额度卡片 */}
        {myQuota && (
          <Card style={{ flex: 1 }} title={t('account.usage.quotaInfo')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Flexbox gap={8}>
                <Typography.Text type="secondary">{t('management.quota.limit')}:</Typography.Text>
                <Typography.Text strong>
                  {myQuota.limit === null
                    ? t('management.quota.unlimited')
                    : myQuota.limit.toLocaleString()}
                </Typography.Text>
              </Flexbox>
              <Flexbox gap={8}>
                <Typography.Text type="secondary">{t('management.quota.used')}:</Typography.Text>
                <Typography.Text strong>{myQuota.used.toLocaleString()}</Typography.Text>
              </Flexbox>
              {myQuota.limit !== null && myQuota.limit > 0 && (
                <Flexbox gap={8}>
                  <Typography.Text type="secondary">
                    {t('account.usage.remaining')}:
                  </Typography.Text>
                  <Typography.Text strong>
                    {(myQuota.limit - myQuota.used).toLocaleString()}
                  </Typography.Text>
                  <Progress
                    percent={quotaPercentage}
                    status={quotaStatus}
                    style={{ width: '100%' }}
                  />
                </Flexbox>
              )}
            </Space>
          </Card>
        )}
      </Flexbox>

      {/* 使用记录表格 */}
      <Card
        extra={
          <RangePicker
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              } else {
                setDateRange(null);
              }
              setCurrentPage(1);
            }}
            placeholder={[t('common:startDate'), t('common:endDate')]}
            value={dateRange}
          />
        }
        style={{ width: '100%' }}
        title={t('account.usage.records')}
      >
        <Table
          columns={columns}
          dataSource={myUsages ?? []}
          loading={isLoading}
          onChange={(pagination) => {
            setCurrentPage(pagination.current || 1);
            setPageSize(pagination.pageSize || 20);
          }}
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            showTotal: (total) => t('common:totalItems', { count: total }),
          }}
          rowKey="id"
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </Flexbox>
  );
};

export default MyUsageRecords;
