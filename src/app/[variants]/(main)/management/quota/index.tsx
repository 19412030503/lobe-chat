'use client';

import type { inferRouterOutputs } from '@trpc/server';
import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ADMIN_ROLE, ROOT_ROLE } from '@/const/rbac';
import { useUserRoles } from '@/hooks/useHasRole';
import { lambdaQuery } from '@/libs/trpc/client';
import type { LambdaRouter } from '@/server/routers/lambda';

type LambdaOutputs = inferRouterOutputs<LambdaRouter>;
type OrganizationCredit = LambdaOutputs['quota']['listAllOrganizationCredits'][number];
type MemberQuota = LambdaOutputs['quota']['listMemberQuotas'][number];

const QuotaManagement = () => {
  const { t } = useTranslation(['setting', 'common']);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  const [isSetCreditModalOpen, setIsSetCreditModalOpen] = useState(false);
  const [isSetQuotaModalOpen, setIsSetQuotaModalOpen] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [currentCredit, setCurrentCredit] = useState<OrganizationCredit | null>(null);

  const roles = useUserRoles();
  const roleSet = useMemo(() => new Set(roles), [roles]);
  const isRoot = roleSet.has(ROOT_ROLE);
  const isAdmin = roleSet.has(ADMIN_ROLE);
  const canAccess = isRoot || isAdmin;

  // Root: 查询所有组织额度
  const { data: organizationCredits, refetch: refetchCredits } =
    lambdaQuery.quota.listAllOrganizationCredits.useQuery(undefined, {
      enabled: canAccess && isRoot,
    });

  // Admin: 查询成员额度（只能查自己组织）
  const { data: memberQuotas, refetch: refetchMemberQuotas } =
    lambdaQuery.quota.listMemberQuotas.useQuery(
      { organizationId: selectedOrganizationId || '' },
      {
        enabled: canAccess && !!selectedOrganizationId,
      },
    );

  const setOrganizationCreditMutation = lambdaQuery.organization.setCredit.useMutation();
  const setMemberQuotaMutation = lambdaQuery.quota.setMemberQuota.useMutation();
  const resetMemberUsageMutation = lambdaQuery.quota.resetMemberUsage.useMutation();

  const { data: organizations } = lambdaQuery.organization.list.useQuery(undefined, {
    enabled: canAccess,
  });

  const organizationOptions = useMemo(
    () => (organizations ?? []).map((item) => ({ label: item.name, value: item.id })),
    [organizations],
  );

  // Admin 用户自动选择自己的组织（通过组织列表推断）
  useEffect(() => {
    if (
      isAdmin &&
      !isRoot &&
      organizations &&
      organizations.length > 0 &&
      !selectedOrganizationId
    ) {
      // Admin 用户通常只能看到自己的组织
      setSelectedOrganizationId(organizations[0].id);
    }
  }, [isAdmin, isRoot, organizations, selectedOrganizationId]);

  // Root: 设置组织额度
  const handleSetOrganizationCredit = async (values: { balance: number }) => {
    if (!currentCredit) return;

    try {
      await setOrganizationCreditMutation.mutateAsync({
        balance: values.balance,
        id: currentCredit.organizationId,
      });
      messageApi.success(t('management.quota.messages.creditUpdated'));
      setIsSetCreditModalOpen(false);
      form.resetFields();
      await refetchCredits();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  // Admin/Root: 设置成员额度
  const handleSetMemberQuota = async (values: { limit: number | null }) => {
    if (!selectedUserId || !selectedOrganizationId) return;

    try {
      await setMemberQuotaMutation.mutateAsync({
        limit: values.limit,
        organizationId: selectedOrganizationId,
        userId: selectedUserId,
      });
      messageApi.success(t('management.quota.messages.quotaUpdated'));
      setIsSetQuotaModalOpen(false);
      form.resetFields();
      await refetchMemberQuotas();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  // Admin/Root: 重置成员已使用额度
  const handleResetMemberUsage = (userId: string, userName: string) => {
    if (!selectedOrganizationId) return;

    Modal.confirm({
      cancelText: t('common:cancel'),
      content: t('management.quota.confirmResetUsage', { name: userName } as any),
      okText: t('common:ok'),
      okType: 'danger',
      onOk: async () => {
        try {
          await resetMemberUsageMutation.mutateAsync({
            organizationId: selectedOrganizationId,
            userId,
          });
          messageApi.success(t('management.quota.messages.usageReset' as any));
          await refetchMemberQuotas();
        } catch (error: any) {
          messageApi.error(error?.message ?? t('management.messages.operationFailed'));
        }
      },
      title: t('management.quota.resetUsage' as any),
    });
  };

  const organizationColumns: ColumnsType<OrganizationCredit> = [
    {
      dataIndex: ['organization', 'name'],
      key: 'organizationName',
      title: t('management.quota.organizationName'),
    },
    {
      dataIndex: ['organization', 'type'],
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'management' ? 'blue' : 'green'}>
          {t(`management.organizationTypes.${type}` as any)}
        </Tag>
      ),
      title: t('management.columns.organizationType'),
    },
    {
      dataIndex: 'totalUsed',
      key: 'totalUsed',
      render: (used: number) => <Typography.Text>{used.toLocaleString()}</Typography.Text>,
      title: t('management.quota.used'),
    },
    {
      dataIndex: 'totalBalance',
      key: 'totalBalance',
      render: (total: number) => <Typography.Text strong>{total.toLocaleString()}</Typography.Text>,
      title: t('management.quota.total' as any),
    },
    {
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number) => (
        <Typography.Text strong style={{ color: balance < 1000 ? 'red' : 'inherit' }}>
          {balance.toLocaleString()}
        </Typography.Text>
      ),
      title: t('management.quota.balance'),
    },
    {
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: Date) => new Date(date).toLocaleString(),
      title: t('common:updatedAt'),
    },
    {
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            onClick={() => {
              setCurrentCredit(record);
              form.setFieldsValue({ balance: record.balance });
              setIsSetCreditModalOpen(true);
            }}
            size="small"
            type="link"
          >
            {t('management.quota.setCredit')}
          </Button>
          <Button
            onClick={() => {
              setSelectedOrganizationId(record.organizationId);
            }}
            size="small"
            type="link"
          >
            {t('management.quota.viewMembers')}
          </Button>
        </Space>
      ),
      title: t('common:actions'),
    },
  ];

  const memberColumns: ColumnsType<MemberQuota> = [
    {
      dataIndex: ['user', 'fullName'],
      key: 'fullName',
      title: t('management.columns.name'),
    },
    {
      dataIndex: ['user', 'email'],
      key: 'email',
      title: t('management.columns.email'),
    },
    {
      dataIndex: 'limit',
      key: 'limit',
      render: (limit: number | null) =>
        limit === null ? (
          <Tag color="blue">{t('management.quota.unlimited')}</Tag>
        ) : (
          limit.toLocaleString()
        ),
      title: t('management.quota.limit'),
    },
    {
      dataIndex: 'used',
      key: 'used',
      render: (used: number, record: MemberQuota) => {
        const percentage =
          record.limit !== null && record.limit > 0 ? (used / record.limit) * 100 : 0;
        const color = percentage >= 90 ? 'red' : percentage >= 70 ? 'orange' : 'green';
        return (
          <Space>
            <Typography.Text style={{ color }}>{used.toLocaleString()}</Typography.Text>
            {record.limit !== null && (
              <Typography.Text type="secondary">({percentage.toFixed(1)}%)</Typography.Text>
            )}
          </Space>
        );
      },
      title: t('management.quota.used'),
    },
    {
      key: 'remaining',
      render: (_, record: MemberQuota) => {
        if (record.limit === null) {
          return <Tag color="blue">{t('management.quota.unlimited')}</Tag>;
        }
        const remaining = record.limit - record.used;
        const color = remaining < 1000 ? 'red' : remaining < 5000 ? 'orange' : 'green';
        return <Typography.Text style={{ color }}>{remaining.toLocaleString()}</Typography.Text>;
      },
      title: t('management.quota.remaining' as any),
    },
    {
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            onClick={() => {
              setSelectedUserId(record.userId);
              form.setFieldsValue({ limit: record.limit });
              setIsSetQuotaModalOpen(true);
            }}
            size="small"
            type="link"
          >
            {t('management.quota.setQuota')}
          </Button>
          <Button
            danger
            onClick={() =>
              handleResetMemberUsage(
                record.userId,
                record.user.fullName ?? record.user.email ?? 'Unknown',
              )
            }
            size="small"
            type="link"
          >
            {t('management.quota.resetUsage' as any)}
          </Button>
        </Space>
      ),
      title: t('common:actions'),
    },
  ];

  // 获取当前选中组织的额度信息（用于 Admin 显示）
  const currentOrganizationCredit = useMemo(() => {
    if (!isAdmin || isRoot || !selectedOrganizationId) return null;

    // Admin 用户通过成员列表反推组织额度
    if (!memberQuotas || memberQuotas.length === 0) return null;

    const totalUsed = memberQuotas.reduce((sum, quota) => sum + (quota.used || 0), 0);
    const totalLimit = memberQuotas.reduce((sum, quota) => {
      if (quota.limit === null) return sum;
      return sum + quota.limit;
    }, 0);

    return {
      organizationName: organizations?.find((org) => org.id === selectedOrganizationId)?.name ?? '',
      remaining: totalLimit - totalUsed,
      totalLimit,
      totalUsed,
    };
  }, [isAdmin, isRoot, selectedOrganizationId, memberQuotas, organizations]);

  if (!canAccess) {
    return (
      <Card>
        <Typography.Text type="danger">{t('management.accessDenied')}</Typography.Text>
      </Card>
    );
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Root: 组织额度管理 */}
        {isRoot && (
          <Card title={t('management.quota.organizationCredits')}>
            {organizationCredits && organizationCredits.length === 0 ? (
              <Typography.Text type="secondary">
                {t('management.quota.noOrganizations')}
              </Typography.Text>
            ) : (
              <Table
                columns={organizationColumns}
                dataSource={organizationCredits ?? []}
                loading={!organizationCredits}
                pagination={{
                  pageSize: 10,
                  showQuickJumper: true,
                  showSizeChanger: true,
                  showTotal: (total) => t('management.quota.totalItems' as any, { total }),
                }}
                rowKey="organizationId"
                scroll={{ x: 'max-content', y: 400 }}
              />
            )}
          </Card>
        )}
        {/* Admin: 组织额度信息卡片 */}
        {/* Admin: 组织额度信息卡片 */}
        {isAdmin && !isRoot && currentOrganizationCredit && (
          <Card title={t('management.quota.organizationCreditInfo' as any)}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title={t('management.quota.organizationName')}
                  value={currentOrganizationCredit.organizationName}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('management.quota.total' as any)}
                  value={currentOrganizationCredit.totalLimit}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('management.quota.used')}
                  value={currentOrganizationCredit.totalUsed}
                  valueStyle={{
                    color:
                      currentOrganizationCredit.totalUsed / currentOrganizationCredit.totalLimit >=
                      0.9
                        ? '#cf1322'
                        : currentOrganizationCredit.totalUsed /
                              currentOrganizationCredit.totalLimit >=
                            0.7
                          ? '#faad14'
                          : '#3f8600',
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('management.quota.remaining' as any)}
                  value={currentOrganizationCredit.remaining}
                  valueStyle={{
                    color:
                      currentOrganizationCredit.remaining < 1000
                        ? '#cf1322'
                        : currentOrganizationCredit.remaining < 5000
                          ? '#faad14'
                          : '#3f8600',
                  }}
                />
              </Col>
            </Row>
          </Card>
        )}{' '}
        {/* Root/Admin: 成员额度管理 */}
        <Card
          extra={
            isRoot ? (
              <Select
                allowClear
                onChange={(value) => setSelectedOrganizationId(value ?? null)}
                options={organizationOptions}
                placeholder={t('management.quota.selectOrganization')}
                style={{ width: 200 }}
                value={selectedOrganizationId}
              />
            ) : undefined
          }
          title={t('management.quota.memberQuotas')}
        >
          {!selectedOrganizationId ? (
            <Typography.Text type="secondary">
              {t('management.quota.pleaseSelectOrganization')}
            </Typography.Text>
          ) : memberQuotas && memberQuotas.length === 0 ? (
            <Typography.Text type="secondary">{t('management.quota.noMembers')}</Typography.Text>
          ) : (
            <Table
              columns={memberColumns}
              dataSource={memberQuotas ?? []}
              loading={!memberQuotas}
              pagination={{
                pageSize: 10,
                showQuickJumper: true,
                showSizeChanger: true,
                showTotal: (total) => t('management.quota.totalItems' as any, { total }),
              }}
              rowKey="userId"
              scroll={{ x: 'max-content', y: 400 }}
            />
          )}
        </Card>
      </Space>

      {/* 设置组织额度 Modal */}
      <Modal
        onCancel={() => {
          setIsSetCreditModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        open={isSetCreditModalOpen}
        title={t('management.quota.setOrganizationCredit')}
      >
        <Form form={form} layout="vertical" onFinish={handleSetOrganizationCredit}>
          <Form.Item
            label={t('management.quota.balance')}
            name="balance"
            rules={[
              {
                message: t('management.quota.validation.balanceRequired'),
                required: true,
              },
            ]}
          >
            <InputNumber
              min={0}
              placeholder={t('management.quota.balancePlaceholder')}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 设置成员额度 Modal */}
      <Modal
        onCancel={() => {
          setIsSetQuotaModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        open={isSetQuotaModalOpen}
        title={t('management.quota.setMemberQuota')}
      >
        <Form form={form} layout="vertical" onFinish={handleSetMemberQuota}>
          <Form.Item
            extra={t('management.quota.limitHint')}
            label={t('management.quota.limit')}
            name="limit"
          >
            <InputNumber
              min={0}
              placeholder={t('management.quota.limitPlaceholder')}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default QuotaManagement;
