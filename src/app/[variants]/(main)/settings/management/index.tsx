'use client';

import type { inferRouterOutputs } from '@trpc/server';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ADMIN_ROLE,
  ORGANIZATION_TYPE_MANAGEMENT,
  ORGANIZATION_TYPE_SCHOOL,
  type OrganizationType,
  ROOT_ROLE,
  type SystemRole,
  USER_ROLE,
} from '@/const/rbac';
import { useUserRoles } from '@/hooks/useHasRole';
import { lambdaQuery } from '@/libs/trpc/client';
import type { LambdaRouter } from '@/server/routers/lambda';

type LambdaOutputs = inferRouterOutputs<LambdaRouter>;
type Organization = LambdaOutputs['organization']['list'][number];
type UserItem = LambdaOutputs['adminUser']['list'][number];

type RoleLabelKey = 'management.roles.root' | 'management.roles.admin' | 'management.roles.user';

const roleLabelMap: Record<SystemRole, RoleLabelKey> = {
  [ADMIN_ROLE]: 'management.roles.admin',
  [ROOT_ROLE]: 'management.roles.root',
  [USER_ROLE]: 'management.roles.user',
};

type OrganizationTypeLabelKey =
  | 'management.organizationTypes.management'
  | 'management.organizationTypes.school';

const organizationTypeLabelMap: Record<OrganizationType, OrganizationTypeLabelKey> = {
  [ORGANIZATION_TYPE_MANAGEMENT]: 'management.organizationTypes.management',
  [ORGANIZATION_TYPE_SCHOOL]: 'management.organizationTypes.school',
};

const { Paragraph, Text } = Typography;

const NONE_ORGANIZATION_VALUE = '__none__';

const ManagementSettings = () => {
  const { t } = useTranslation(['setting', 'common']);
  const [messageApi, contextHolder] = message.useMessage();

  const translateRole = (role: SystemRole) => t(roleLabelMap[role] as any);
  const translateOrganizationType = (type: OrganizationType) =>
    t(organizationTypeLabelMap[type] as any);

  const roles = useUserRoles();
  const roleSet = useMemo(() => new Set(roles), [roles]);
  const isRoot = roleSet.has(ROOT_ROLE);
  const isAdmin = roleSet.has(ADMIN_ROLE);
  const canAccess = isRoot || isAdmin;

  const {
    data: organizations,
    isLoading: organizationLoading,
    refetch: refetchOrganizations,
  } = lambdaQuery.organization.list.useQuery(undefined, {
    enabled: canAccess,
  });

  const {
    data: users,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = lambdaQuery.adminUser.list.useQuery(undefined, {
    enabled: canAccess,
  });

  const createOrganizationMutation = lambdaQuery.organization.create.useMutation();
  const updateOrganizationMutation = lambdaQuery.organization.update.useMutation();
  const deleteOrganizationMutation = lambdaQuery.organization.delete.useMutation();
  const setUserOrganizationMutation = lambdaQuery.adminUser.setOrganization.useMutation();
  const setUserRoleMutation = lambdaQuery.adminUser.setRole.useMutation();

  const [createForm] = Form.useForm<{ name: string; type: OrganizationType }>();
  const [renameForm] = Form.useForm<{ name: string }>();
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);

  const organizationOptions = useMemo(
    () => (organizations ?? []).map((item) => ({ label: item.name, value: item.id })),
    [organizations],
  );

  const handleCreateOrganization = async (values: { name: string; type: OrganizationType }) => {
    try {
      await createOrganizationMutation.mutateAsync({
        name: values.name,
        parentId: null,
        type: values.type,
      });
      messageApi.success(t('management.messages.organizationCreated'));
      createForm.resetFields();
      await refetchOrganizations();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  const handleRenameOrganization = async (values: { name: string }) => {
    if (!editingOrganization) return;
    try {
      await updateOrganizationMutation.mutateAsync({
        id: editingOrganization.id,
        name: values.name,
      });
      messageApi.success(t('management.messages.organizationUpdated'));
      setEditingOrganization(null);
      renameForm.resetFields();
      await refetchOrganizations();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  const confirmDeleteOrganization = (organization: Organization) => {
    Modal.confirm({
      content: t('management.dialogs.deleteOrganization.content', { name: organization.name }),
      okButtonProps: { danger: true },
      okText: t('common:delete'),
      onOk: async () => {
        try {
          await deleteOrganizationMutation.mutateAsync({ id: organization.id });
          messageApi.success(t('management.messages.organizationDeleted'));
          await refetchOrganizations();
          await refetchUsers();
        } catch (error: any) {
          messageApi.error(error?.message ?? t('management.messages.operationFailed'));
        }
      },
      title: t('management.dialogs.deleteOrganization.title'),
    });
  };

  const handleSetUserOrganization = async (userId: string, organizationId: string | null) => {
    try {
      await setUserOrganizationMutation.mutateAsync({
        organizationId,
        userId,
      });
      messageApi.success(t('management.messages.userUpdated'));
      await refetchUsers();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  const handleSetUserRole = async (userId: string, role: SystemRole) => {
    try {
      await setUserRoleMutation.mutateAsync({ role, userId });
      messageApi.success(t('management.messages.roleUpdated'));
      await refetchUsers();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  const userColumns: ColumnsType<UserItem> = useMemo(() => {
    const baseColumns: ColumnsType<UserItem> = [
      {
        dataIndex: 'fullName',
        key: 'fullName',
        render: (_value, record) => record.fullName ?? record.username ?? record.email ?? '-',
        title: t('management.columns.name'),
      },
      {
        dataIndex: 'email',
        key: 'email',
        render: (value) => value ?? '-',
        title: t('management.columns.email'),
      },
      {
        dataIndex: 'roles',
        key: 'roles',
        render: (roles: UserItem['roles']) => (
          <Space size={4} wrap>
            {roles.map((role) => {
              const normalized = ([ROOT_ROLE, ADMIN_ROLE, USER_ROLE] as SystemRole[]).includes(
                role as SystemRole,
              )
                ? (role as SystemRole)
                : USER_ROLE;
              return (
                <Tag
                  color={
                    normalized === ROOT_ROLE
                      ? 'volcano'
                      : normalized === ADMIN_ROLE
                        ? 'geekblue'
                        : 'green'
                  }
                  key={role}
                >
                  {translateRole(normalized)}
                </Tag>
              );
            })}
          </Space>
        ),
        title: t('management.columns.roles'),
      },
    ];

    const organizationColumn: ColumnsType<UserItem>[number] = {
      dataIndex: ['organization', 'id'],
      key: 'organization',
      render: (_value, record) => {
        const currentValue = record.organization?.id ?? NONE_ORGANIZATION_VALUE;
        const baseOptions = organizationOptions;
        const options = isRoot
          ? [
              { label: t('management.fields.organization.none'), value: NONE_ORGANIZATION_VALUE },
              ...baseOptions,
            ]
          : baseOptions;

        const disableSelect = !isRoot && !isAdmin;

        return (
          <Select<string>
            disabled={disableSelect || setUserOrganizationMutation.isPending}
            onChange={(value) =>
              handleSetUserOrganization(
                record.id,
                value === NONE_ORGANIZATION_VALUE ? null : (value as string),
              )
            }
            options={options}
            value={currentValue}
          />
        );
      },
      title: t('management.columns.organization'),
    };

    const roleColumn: ColumnsType<UserItem>[number] | null = isRoot
      ? {
          dataIndex: 'roles',
          key: 'roleSelector',
          render: (roles, record) => {
            const current = roles[0] ?? USER_ROLE;
            return (
              <Select<SystemRole>
                disabled={setUserRoleMutation.isPending}
                onChange={(value) => handleSetUserRole(record.id, value)}
                options={[
                  { label: translateRole(ROOT_ROLE), value: ROOT_ROLE },
                  { label: translateRole(ADMIN_ROLE), value: ADMIN_ROLE },
                  { label: translateRole(USER_ROLE), value: USER_ROLE },
                ]}
                value={current}
              />
            );
          },
          title: t('management.columns.actions'),
        }
      : null;

    return [...baseColumns, organizationColumn, ...(roleColumn ? [roleColumn] : [])];
  }, [
    t,
    isRoot,
    isAdmin,
    organizationOptions,
    handleSetUserOrganization,
    setUserOrganizationMutation.isPending,
    handleSetUserRole,
    setUserRoleMutation.isPending,
  ]);

  if (!canAccess) {
    return (
      <Card>
        {contextHolder}
        <Paragraph>{t('management.accessDenied')}</Paragraph>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {contextHolder}

      {isRoot && (
        <Card title={t('management.sections.organizations')}>
          <Space align="start" direction="vertical" size="large" style={{ width: '100%' }}>
            <Form
              form={createForm}
              initialValues={{ type: ORGANIZATION_TYPE_SCHOOL }}
              layout="inline"
              onFinish={handleCreateOrganization}
            >
              <Form.Item
                label={t('management.fields.organization.name')}
                name="name"
                rules={[{ message: t('management.validation.organizationName'), required: true }]}
              >
                <Input
                  allowClear
                  maxLength={60}
                  placeholder={t('management.placeholders.organizationName')}
                />
              </Form.Item>
              <Form.Item label={t('management.fields.organization.type')} name="type">
                <Select<OrganizationType>
                  options={[
                    {
                      label: translateOrganizationType(ORGANIZATION_TYPE_SCHOOL),
                      value: ORGANIZATION_TYPE_SCHOOL,
                    },
                  ]}
                  style={{ minWidth: 160 }}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  htmlType="submit"
                  loading={createOrganizationMutation.isPending}
                  type="primary"
                >
                  {t('management.actions.createOrganization')}
                </Button>
              </Form.Item>
            </Form>

            <Table<Organization>
              columns={[
                { dataIndex: 'name', key: 'name', title: t('management.columns.organizationName') },
                {
                  dataIndex: 'type',
                  key: 'type',
                  render: (value: string) => {
                    const normalized = (
                      [ORGANIZATION_TYPE_MANAGEMENT, ORGANIZATION_TYPE_SCHOOL] as OrganizationType[]
                    ).includes(value as OrganizationType)
                      ? (value as OrganizationType)
                      : ORGANIZATION_TYPE_SCHOOL;
                    return translateOrganizationType(normalized);
                  },
                  title: t('management.columns.organizationType'),
                },
                {
                  key: 'id',
                  render: (_value, record) => (
                    <Space>
                      <Button
                        onClick={() => {
                          setEditingOrganization(record);
                          renameForm.setFieldsValue({ name: record.name });
                        }}
                      >
                        {t('management.actions.renameOrganization')}
                      </Button>
                      {record.type !== ORGANIZATION_TYPE_SCHOOL ? (
                        <Text type="secondary">{t('management.hints.lockedOrganization')}</Text>
                      ) : (
                        <Button danger onClick={() => confirmDeleteOrganization(record)}>
                          {t('common:delete')}
                        </Button>
                      )}
                    </Space>
                  ),
                  title: t('management.columns.organizationActions'),
                },
              ]}
              dataSource={organizations ?? []}
              loading={organizationLoading}
              pagination={false}
              rowKey={(record) => record.id}
            />
          </Space>
        </Card>
      )}

      <Card title={t('management.sections.users')}>
        <Table<UserItem>
          columns={userColumns}
          dataSource={users ?? []}
          loading={usersLoading}
          pagination={false}
          rowKey={(record) => record.id}
        />
      </Card>

      <Modal
        confirmLoading={updateOrganizationMutation.isPending}
        okText={t('common:save')}
        onCancel={() => {
          setEditingOrganization(null);
          renameForm.resetFields();
        }}
        onOk={() => renameForm.submit()}
        open={!!editingOrganization}
        title={t('management.dialogs.renameOrganization.title')}
      >
        <Form form={renameForm} layout="vertical" onFinish={handleRenameOrganization}>
          <Form.Item
            label={t('management.fields.organization.name')}
            name="name"
            rules={[{ message: t('management.validation.organizationName'), required: true }]}
          >
            <Input maxLength={60} placeholder={t('management.placeholders.organizationName')} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default ManagementSettings;
