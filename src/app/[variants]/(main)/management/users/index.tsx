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

import { ADMIN_ROLE, ROOT_ROLE, type SystemRole, USER_ROLE } from '@/const/rbac';
import { useUserRoles } from '@/hooks/useHasRole';
import { lambdaQuery } from '@/libs/trpc/client';
import type { LambdaRouter } from '@/server/routers/lambda';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

type LambdaOutputs = inferRouterOutputs<LambdaRouter>;
type UserItem = LambdaOutputs['adminUser']['list'][number];

type RoleLabelKey = 'management.roles.root' | 'management.roles.admin' | 'management.roles.user';

const roleLabelMap: Record<SystemRole, RoleLabelKey> = {
  [ADMIN_ROLE]: 'management.roles.admin',
  [ROOT_ROLE]: 'management.roles.root',
  [USER_ROLE]: 'management.roles.user',
};

const NONE_ORGANIZATION_VALUE = '__none__';

const UsersManagement = () => {
  const { t } = useTranslation(['setting', 'common']);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const [inviteForm] = Form.useForm();

  // 状态管理
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [filterOrganizationId, setFilterOrganizationId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const translateRole = (role: SystemRole) => t(roleLabelMap[role] as any);

  const roles = useUserRoles();
  const roleSet = useMemo(() => new Set(roles), [roles]);
  const isRoot = roleSet.has(ROOT_ROLE);
  const isAdmin = roleSet.has(ADMIN_ROLE);
  const canAccess = isRoot || isAdmin;

  const { data: organizations } = lambdaQuery.organization.list.useQuery(undefined, {
    enabled: canAccess,
  });

  const {
    data: users,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = lambdaQuery.adminUser.list.useQuery(undefined, {
    enabled: canAccess,
  });

  const setUserOrganizationMutation = lambdaQuery.adminUser.setOrganization.useMutation();
  const setUserRoleMutation = lambdaQuery.adminUser.setRole.useMutation();
  const createUserMutation = lambdaQuery.adminUser.createUser.useMutation();
  const toggleUserStatusMutation = lambdaQuery.adminUser.toggleUserStatus.useMutation();
  const generateInviteCodeMutation = lambdaQuery.invite.generateInviteCode.useMutation();

  const organizationOptions = useMemo(
    () => (organizations ?? []).map((item) => ({ label: item.name, value: item.id })),
    [organizations],
  );

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

  const handleCreateUser = async (values: {
    displayName?: string;
    email: string;
    name: string;
    organizationId?: string;
    password: string;
  }) => {
    try {
      await createUserMutation.mutateAsync({
        displayName: values.displayName,
        email: values.email,
        name: values.name,
        organizationId: values.organizationId || null,
        password: values.password,
      });
      messageApi.success(t('management.messages.userCreated'));
      setIsCreateModalOpen(false);
      form.resetFields();
      await refetchUsers();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  const handleToggleUserStatus = async (userId: string, userName: string, isForbidden: boolean) => {
    const action = isForbidden ? 'disableUser' : 'enableUser';
    Modal.confirm({
      content: t(`management.dialogs.${action}.content`, { name: userName }),
      onOk: async () => {
        try {
          await toggleUserStatusMutation.mutateAsync({ isForbidden, userId });
          messageApi.success(
            t(isForbidden ? 'management.messages.userDisabled' : 'management.messages.userEnabled'),
          );
          await refetchUsers();
        } catch (error: any) {
          messageApi.error(error?.message ?? t('management.messages.operationFailed'));
        }
      },
      title: t(`management.dialogs.${action}.title`),
    });
  };

  const handleGenerateInvite = async () => {
    try {
      const result = await generateInviteCodeMutation.mutateAsync();
      // 自动复制到剪贴板
      await navigator.clipboard.writeText(result.code);
      messageApi.success('邀请码已生成并复制到剪贴板');
      setIsInviteModalOpen(false);
      inviteForm.resetFields();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  // 获取当前登录用户ID
  const currentUserId = useUserStore(userProfileSelectors.userId);

  // 筛选后的用户列表
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    let result = users;

    // 按组织筛选
    if (isRoot && filterOrganizationId) {
      result = result.filter((user) => user.organization?.id === filterOrganizationId);
    }

    // 按搜索文本筛选（账号、用户名、邮箱）
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter((user) => {
        const username = user.username?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const fullName = user.fullName?.toLowerCase() || '';
        return (
          username.includes(lowerSearch) ||
          email.includes(lowerSearch) ||
          fullName.includes(lowerSearch)
        );
      });
    }

    return result;
  }, [users, filterOrganizationId, searchText, isRoot]);

  const userColumns: ColumnsType<UserItem> = useMemo(() => {
    const baseColumns: ColumnsType<UserItem> = [
      {
        dataIndex: 'fullName',
        ellipsis: true,
        key: 'fullName',
        render: (_value, record) => record.fullName ?? record.username ?? record.email ?? '-',
        title: t('management.columns.name'),
        width: 150,
      },
      {
        dataIndex: 'email',
        ellipsis: true,
        key: 'email',
        render: (value) => value ?? '-',
        title: t('management.columns.email'),
        width: 200,
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
        width: 120,
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
            style={{ width: '100%' }}
            value={currentValue}
          />
        );
      },
      title: t('management.columns.organization'),
      width: 180,
    };

    const actionsColumn: ColumnsType<UserItem>[number] = {
      key: 'userActions',
      render: (_value, record) => {
        const userName = record.fullName ?? record.username ?? record.email ?? '';
        const isForbidden = false; // TODO: 从 Casdoor 获取实际状态
        return (
          <Space size="small">
            <Button
              danger={!isForbidden}
              onClick={() => handleToggleUserStatus(record.id, userName, !isForbidden)}
              size="small"
              type="link"
            >
              {isForbidden
                ? t('management.actions.enableUser')
                : t('management.actions.disableUser')}
            </Button>
          </Space>
        );
      },
      title: t('management.columns.actions'),
      width: 180,
    };

    const roleColumn: ColumnsType<UserItem>[number] | null = isRoot
      ? {
          dataIndex: 'roles',
          key: 'roleSelector',
          render: (roles, record) => {
            const current = roles[0] ?? USER_ROLE;
            // Root users cannot change their own role
            const canEditRole = record.id !== currentUserId;
            return (
              <Select<SystemRole>
                disabled={!canEditRole || setUserRoleMutation.isPending}
                onChange={(value) => handleSetUserRole(record.id, value)}
                options={[
                  { label: translateRole(ROOT_ROLE), value: ROOT_ROLE },
                  { label: translateRole(ADMIN_ROLE), value: ADMIN_ROLE },
                  { label: translateRole(USER_ROLE), value: USER_ROLE },
                ]}
                style={{ width: '100%' }}
                value={current}
              />
            );
          },
          title: t('management.columns.roles'),
          width: 130,
        }
      : null;

    return [...baseColumns, organizationColumn, ...(roleColumn ? [roleColumn] : []), actionsColumn];
  }, [
    t,
    isRoot,
    isAdmin,
    organizationOptions,
    handleSetUserOrganization,
    setUserOrganizationMutation.isPending,
    handleSetUserRole,
    setUserRoleMutation.isPending,
    handleToggleUserStatus,
  ]);

  if (!canAccess) {
    return (
      <Card style={{ width: '100%' }}>
        {contextHolder}
        {t('management.accessDenied')}
      </Card>
    );
  }

  return (
    <>
      {contextHolder}
      <Card
        extra={
          <Space>
            <Input.Search
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t('management.search.userPlaceholder')}
              style={{ width: 240 }}
              value={searchText}
            />
            {isRoot && (
              <Select
                allowClear
                onChange={(value) => setFilterOrganizationId(value || null)}
                options={[...(organizationOptions ?? [])]}
                placeholder={t('management.filters.organizationLabel')}
                style={{ width: 200 }}
                value={filterOrganizationId}
              />
            )}
            <Button onClick={() => setIsInviteModalOpen(true)}>
              {t('management.actions.inviteUser')}
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)} type="primary">
              {t('management.actions.createUser')}
            </Button>
          </Space>
        }
        style={{ margin: 24 }}
        title={t('management.sections.users')}
      >
        <Table<UserItem>
          columns={userColumns}
          dataSource={filteredUsers ?? []}
          loading={usersLoading}
          pagination={{
            current: currentPage,
            onChange: (page, size) => {
              setCurrentPage(page);
              if (size !== pageSize) {
                setPageSize(size);
                setCurrentPage(1);
              }
            },
            onShowSizeChange: (_, size) => {
              setPageSize(size);
              setCurrentPage(1);
            },
            pageSize: pageSize,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          rowKey={(record) => record.id}
          scroll={{ y: 550 }}
          size="small"
        />
      </Card>

      {/* 生成邀请码弹窗 */}
      <Modal
        onCancel={() => {
          setIsInviteModalOpen(false);
        }}
        onOk={handleGenerateInvite}
        open={isInviteModalOpen}
        title={t('management.actions.inviteUser')}
      >
        <Typography.Paragraph>
          生成邀请码后,将邀请码发送给用户,用户可在 &ldquo;个人资料 → 账户管理&rdquo;
          页面输入邀请码加入组织
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          点击 &ldquo;确定&rdquo; 将生成新的邀请码并自动复制到剪贴板
        </Typography.Text>
      </Modal>

      {/* 新增用户弹窗 */}
      <Modal
        confirmLoading={createUserMutation.isPending}
        onCancel={() => {
          setIsCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        open={isCreateModalOpen}
        title={t('management.dialogs.createUser.title')}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateUser}>
          <Form.Item
            label={t('management.fields.user.name')}
            name="name"
            rules={[{ message: t('management.validation.userName'), required: true }]}
          >
            <Input placeholder={t('management.placeholders.userName')} />
          </Form.Item>

          <Form.Item
            label={t('management.fields.user.email')}
            name="email"
            rules={[
              { message: t('management.validation.userName'), required: true },
              { message: t('management.validation.userEmail'), type: 'email' },
            ]}
          >
            <Input placeholder={t('management.placeholders.userEmail')} type="email" />
          </Form.Item>

          <Form.Item
            label={t('management.fields.user.password')}
            name="password"
            rules={[
              { message: t('management.validation.userName'), required: true },
              { message: t('management.validation.userPassword'), min: 6 },
            ]}
          >
            <Input.Password placeholder={t('management.placeholders.userPassword')} />
          </Form.Item>

          <Form.Item label={t('management.fields.user.displayName')} name="displayName">
            <Input placeholder={t('management.placeholders.userDisplayName')} />
          </Form.Item>

          {isRoot && (
            <Form.Item label={t('management.columns.organization')} name="organizationId">
              <Select
                allowClear
                options={organizationOptions}
                placeholder={t('management.fields.organization.none')}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
};

export default UsersManagement;
