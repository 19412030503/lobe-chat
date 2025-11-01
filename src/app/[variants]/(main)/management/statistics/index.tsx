'use client';

import type { inferRouterOutputs } from '@trpc/server';
import { Card, Col, Row, Select, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_ROLE, ROOT_ROLE } from '@/const/rbac';
import { useUserRoles } from '@/hooks/useHasRole';
import { lambdaQuery } from '@/libs/trpc/client';
import type { LambdaRouter } from '@/server/routers/lambda';

type LambdaOutputs = inferRouterOutputs<LambdaRouter>;
type UsageStatisticsData = LambdaOutputs['quota']['getUsageStatistics'];
type UserStats = UsageStatisticsData['allUsers'][number];

const UsageStatistics = () => {
  const { t } = useTranslation(['setting', 'common']);

  const roles = useUserRoles();
  const roleSet = useMemo(() => new Set(roles), [roles]);
  const isRoot = roleSet.has(ROOT_ROLE);
  const isAdmin = roleSet.has(ADMIN_ROLE);
  const canAccess = isRoot || isAdmin;

  // Root: 查询所有组织
  const { data: organizations } = lambdaQuery.organization.list.useQuery(undefined, {
    enabled: canAccess && isRoot,
  });

  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState<string | undefined>(
    undefined,
  );

  // 查询统计数据
  const { data: statistics, isLoading } = lambdaQuery.quota.getUsageStatistics.useQuery(
    selectedOrganizationId ? { organizationId: selectedOrganizationId } : undefined,
    {
      enabled: canAccess,
    },
  );

  const organizationOptions = useMemo(
    () => [
      { label: t('management.statistics.allOrganizations' as any), value: undefined },
      ...(organizations ?? []).map((item) => ({ label: item.name, value: item.id })),
    ],
    [organizations, t],
  );

  const userStatsColumns: ColumnsType<UserStats> = [
    {
      dataIndex: ['user', 'fullName'],
      key: 'fullName',
      render: (name: string | null, record) => name || record.user?.email || 'Unknown',
      title: t('management.columns.name'),
    },
    {
      dataIndex: ['user', 'email'],
      key: 'email',
      title: t('management.columns.email'),
    },
    {
      dataIndex: 'credits',
      key: 'credits',
      render: (credits: number) => (
        <Typography.Text strong>{credits.toLocaleString()}</Typography.Text>
      ),
      title: t('management.statistics.creditsUsed' as any),
    },
    {
      dataIndex: 'textTokens',
      key: 'textTokens',
      render: (tokens: number) => <Typography.Text>{tokens.toLocaleString()}</Typography.Text>,
      title: t('management.statistics.userTextTokens' as any),
    },
    {
      dataIndex: 'imageCount',
      key: 'imageCount',
      render: (count: number) => <Typography.Text>{count.toLocaleString()}</Typography.Text>,
      title: t('management.statistics.userImageCount' as any),
    },
    {
      dataIndex: 'threeDCount',
      key: 'threeDCount',
      render: (count: number) => <Typography.Text>{count.toLocaleString()}</Typography.Text>,
      title: t('management.statistics.userThreeDCount' as any),
    },
  ];

  if (!canAccess) {
    return (
      <Card>
        <Typography.Text type="danger">{t('management.accessDenied')}</Typography.Text>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Root: 组织选择器 */}
      {isRoot && (
        <Card>
          <Space>
            <Typography.Text>
              {t('management.statistics.selectOrganization' as any)}:
            </Typography.Text>
            <Select
              allowClear
              onChange={(value) => setSelectedOrganizationId(value)}
              options={organizationOptions}
              placeholder={t('management.statistics.allOrganizations' as any)}
              style={{ width: 300 }}
              value={selectedOrganizationId}
            />
          </Space>
        </Card>
      )}

      {/* 统计概览 */}
      <Card loading={isLoading} title={t('management.statistics.overview' as any)}>
        {statistics?.organization && (
          <Typography.Paragraph>
            <Typography.Text strong>{t('management.quota.organizationName')}:</Typography.Text>{' '}
            {statistics.organization.name}
          </Typography.Paragraph>
        )}
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title={t('management.statistics.totalCreditsUsed' as any)}
              value={statistics?.totalCreditsUsed || 0}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('management.statistics.textTotalTokens' as any)}
              value={statistics?.text.totalTokens || 0}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('management.statistics.imageCount' as any)}
              value={statistics?.image.totalCount || 0}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('management.statistics.threeDCount' as any)}
              value={statistics?.threeD.totalCount || 0}
            />
          </Col>
        </Row>
      </Card>

      {/* 文字使用详情 */}
      <Card loading={isLoading} title={t('management.statistics.textUsageDetail' as any)}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title={t('management.statistics.inputTokens' as any)}
              value={statistics?.text.totalInputTokens || 0}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={t('management.statistics.outputTokens' as any)}
              value={statistics?.text.totalOutputTokens || 0}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={t('management.statistics.totalTokens' as any)}
              value={statistics?.text.totalTokens || 0}
            />
          </Col>
        </Row>
      </Card>

      {/* 组织用户统计 */}
      <Card loading={isLoading} title={t('management.statistics.allUsers' as any)}>
        <Table
          columns={userStatsColumns}
          dataSource={statistics?.allUsers || []}
          pagination={{
            pageSize: 20,
            showQuickJumper: true,
            showSizeChanger: true,
            showTotal: (total) => t('management.quota.totalItems' as any, { total }),
          }}
          rowKey="userId"
          scroll={{ x: 'max-content', y: 500 }}
        />
      </Card>
    </Space>
  );
};

export default UsageStatistics;
