'use client';

import type { inferRouterOutputs } from '@trpc/server';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ORGANIZATION_TYPE_MANAGEMENT,
  ORGANIZATION_TYPE_SCHOOL,
  type OrganizationType,
} from '@/const/rbac';
import { lambdaQuery } from '@/libs/trpc/client';
import type { LambdaRouter } from '@/server/routers/lambda';

type LambdaOutputs = inferRouterOutputs<LambdaRouter>;
type Organization = LambdaOutputs['organization']['list'][number];

type OrganizationTypeLabelKey =
  | 'management.organizationTypes.management'
  | 'management.organizationTypes.school';

const organizationTypeLabelMap: Record<OrganizationType, OrganizationTypeLabelKey> = {
  [ORGANIZATION_TYPE_MANAGEMENT]: 'management.organizationTypes.management',
  [ORGANIZATION_TYPE_SCHOOL]: 'management.organizationTypes.school',
};

const { Text } = Typography;

const OrganizationsManagement = () => {
  const { t } = useTranslation(['setting', 'common']);
  const [messageApi, contextHolder] = message.useMessage();

  const translateOrganizationType = (type: OrganizationType) =>
    t(organizationTypeLabelMap[type] as any);

  const {
    data: organizations,
    isLoading: organizationLoading,
    refetch: refetchOrganizations,
  } = lambdaQuery.organization.list.useQuery(undefined);

  const createOrganizationMutation = lambdaQuery.organization.create.useMutation();
  const updateOrganizationMutation = lambdaQuery.organization.update.useMutation();
  const deleteOrganizationMutation = lambdaQuery.organization.delete.useMutation();

  const [createForm] = Form.useForm<{ maxUsers?: number; name: string; type: OrganizationType }>();
  const [editForm] = Form.useForm<{ maxUsers?: number; name: string }>();
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const handleCreateOrganization = async (values: {
    maxUsers?: number;
    name: string;
    type: OrganizationType;
  }) => {
    try {
      await createOrganizationMutation.mutateAsync({
        maxUsers: values.maxUsers,
        name: values.name,
        parentId: null,
        type: values.type,
      });
      messageApi.success(t('management.messages.organizationCreated'));
      setIsCreateModalOpen(false);
      createForm.resetFields();
      await refetchOrganizations();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  const handleUpdateOrganization = async (values: { maxUsers?: number; name: string }) => {
    if (!editingOrganization) return;
    try {
      await updateOrganizationMutation.mutateAsync({
        id: editingOrganization.id,
        maxUsers: values.maxUsers,
        name: values.name,
      });
      messageApi.success(t('management.messages.organizationUpdated'));
      setEditingOrganization(null);
      editForm.resetFields();
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
        } catch (error: any) {
          messageApi.error(error?.message ?? t('management.messages.operationFailed'));
        }
      },
      title: t('management.dialogs.deleteOrganization.title'),
    });
  };

  // 筛选后的组织列表
  const filteredOrganizations = useMemo(() => {
    if (!organizations) return [];

    if (!searchText) return organizations;

    const lowerSearch = searchText.toLowerCase();
    return organizations.filter((org) => {
      const name = org.name?.toLowerCase() || '';
      return name.includes(lowerSearch);
    });
  }, [organizations, searchText]);

  return (
    <>
      {contextHolder}

      <Card
        extra={
          <Space>
            <Input.Search
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t('management.search.organizationPlaceholder')}
              style={{ width: 240 }}
              value={searchText}
            />
            <Button onClick={() => setIsCreateModalOpen(true)} type="primary">
              {t('management.actions.createOrganization')}
            </Button>
          </Space>
        }
        style={{ margin: 24 }}
        title={t('management.sections.organizations')}
      >
        <Table<Organization>
          columns={[
            {
              dataIndex: 'name',
              ellipsis: true,
              key: 'name',
              title: t('management.columns.organizationName'),
              width: 200,
            },
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
              width: 150,
            },
            {
              dataIndex: 'maxUsers',
              key: 'maxUsers',
              render: (value: number | null) => value ?? t('management.labels.unlimited'),
              title: t('management.columns.maxUsers'),
              width: 120,
            },
            {
              key: 'id',
              render: (_value, record) => (
                <Space>
                  <Button
                    onClick={() => {
                      setEditingOrganization(record);
                      editForm.setFieldsValue({ maxUsers: record.maxUsers, name: record.name });
                    }}
                    size="small"
                  >
                    {t('management.actions.updateOrganization')}
                  </Button>
                  {record.type !== ORGANIZATION_TYPE_SCHOOL ? (
                    <Text type="secondary">{t('management.hints.lockedOrganization')}</Text>
                  ) : (
                    <Button danger onClick={() => confirmDeleteOrganization(record)} size="small">
                      {t('common:delete')}
                    </Button>
                  )}
                </Space>
              ),
              title: t('management.columns.organizationActions'),
              width: 250,
            },
          ]}
          dataSource={filteredOrganizations ?? []}
          loading={organizationLoading}
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
          scroll={{ y: 450 }}
          size="small"
        />
      </Card>

      {/* 新增组织弹窗 */}
      <Modal
        confirmLoading={createOrganizationMutation.isPending}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        open={isCreateModalOpen}
        title={t('management.dialogs.createOrganization.title')}
      >
        <Form
          form={createForm}
          initialValues={{ type: ORGANIZATION_TYPE_SCHOOL }}
          layout="vertical"
          onFinish={handleCreateOrganization}
        >
          <Form.Item
            label={t('management.fields.organization.name')}
            name="name"
            rules={[{ message: t('management.validation.organizationName'), required: true }]}
          >
            <Input maxLength={60} placeholder={t('management.placeholders.organizationName')} />
          </Form.Item>

          <Form.Item
            label={t('management.fields.organization.type')}
            name="type"
            rules={[{ message: t('management.validation.organizationType'), required: true }]}
          >
            <Select<OrganizationType>
              options={[
                {
                  label: translateOrganizationType(ORGANIZATION_TYPE_SCHOOL),
                  value: ORGANIZATION_TYPE_SCHOOL,
                },
              ]}
            />
          </Form.Item>

          <Form.Item
            label={t('management.fields.organization.maxUsers')}
            name="maxUsers"
            rules={[{ message: t('management.validation.maxUsers'), min: 1, type: 'number' }]}
          >
            <Input min={1} placeholder={t('management.placeholders.maxUsers')} type="number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改组织弹窗 */}
      <Modal
        confirmLoading={updateOrganizationMutation.isPending}
        okText={t('common:save')}
        onCancel={() => {
          setEditingOrganization(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        open={!!editingOrganization}
        title={t('management.dialogs.updateOrganization.title')}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateOrganization}>
          <Form.Item
            label={t('management.fields.organization.name')}
            name="name"
            rules={[{ message: t('management.validation.organizationName'), required: true }]}
          >
            <Input maxLength={60} placeholder={t('management.placeholders.organizationName')} />
          </Form.Item>
          <Form.Item
            label={t('management.fields.organization.maxUsers')}
            name="maxUsers"
            rules={[{ message: t('management.validation.maxUsers'), min: 1, type: 'number' }]}
          >
            <Input min={1} placeholder={t('management.placeholders.maxUsers')} type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default OrganizationsManagement;
