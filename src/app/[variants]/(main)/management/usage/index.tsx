'use client';

import type { inferRouterOutputs } from '@trpc/server';
import { Card, DatePicker, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_ROLE, ROOT_ROLE } from '@/const/rbac';
import { useUserRoles } from '@/hooks/useHasRole';
import { lambdaQuery } from '@/libs/trpc/client';
import type { LambdaRouter } from '@/server/routers/lambda';

const { RangePicker } = DatePicker;

type LambdaOutputs = inferRouterOutputs<LambdaRouter>;
type AllUsage = LambdaOutputs['quota']['listAllUsages'][number];
type OrgUsage = LambdaOutputs['quota']['listOrganizationUsages'][number];

type Usage = AllUsage | OrgUsage;

const UsageRecords = () => {
  const { t } = useTranslation(['setting', 'common']);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const roles = useUserRoles();
  const roleSet = useMemo(() => new Set(roles), [roles]);
  const isRoot = roleSet.has(ROOT_ROLE);
  const isAdmin = roleSet.has(ADMIN_ROLE);
  const canAccess = isRoot || isAdmin;

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

  // Root: 查询所有使用记录
  const { data: allUsages, isLoading: allUsagesLoading } = lambdaQuery.quota.listAllUsages.useQuery(
    queryParams,
    {
      enabled: canAccess && isRoot,
    },
  );

  // Admin: 查询本组织使用记录 (后端自动从JWT获取organizationId)
  const { data: orgUsages, isLoading: orgUsagesLoading } =
    lambdaQuery.quota.listOrganizationUsages.useQuery(queryParams, {
      enabled: canAccess && !isRoot,
    });

  const { data: organizations } = lambdaQuery.organization.list.useQuery(undefined, {
    enabled: canAccess,
  });

  const organizationOptions = useMemo(
    () => (organizations ?? []).map((item) => ({ label: item.name, value: item.id })),
    [organizations],
  );

  const usages = isRoot ? allUsages : orgUsages;
  const loading = isRoot ? allUsagesLoading : orgUsagesLoading;

  const columns: ColumnsType<Usage> = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
      title: t('management.usage.timestamp'),
      width: 180,
    },
    ...(isRoot
      ? [
          {
            dataIndex: ['organization', 'name'],
            key: 'organizationName',
            title: t('management.quota.organizationName'),
            width: 150,
          },
        ]
      : []),
    {
      dataIndex: ['user', 'fullName'],
      key: 'userName',
      render: (name: string, record: Usage) => {
        const user = record.user as any;
        if (!user || Array.isArray(user)) return '-';
        return name || user.email || user.username || '-';
      },
      title: t('management.usage.user'),
      width: 120,
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
      width: 150,
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

  if (!canAccess) {
    return (
      <Card>
        <Typography.Text type="danger">{t('management.accessDenied')}</Typography.Text>
      </Card>
    );
  }

  return (
    <Card
      extra={
        <Space>
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
          {isRoot && (
            <Select
              allowClear
              onChange={(value) => {
                setSelectedOrganizationId(value ?? null);
                setCurrentPage(1);
              }}
              options={organizationOptions}
              placeholder={t('management.quota.selectOrganization')}
              style={{ width: 200 }}
              value={selectedOrganizationId}
            />
          )}
        </Space>
      }
      title={t('management.usage.title')}
    >
      {!isRoot && !orgUsages ? (
        <Typography.Text type="secondary">{t('management.quota.noOrganization')}</Typography.Text>
      ) : (
        <Table
          columns={columns}
          dataSource={usages ?? []}
          loading={loading}
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
      )}
    </Card>
  );
};

export default UsageRecords;
