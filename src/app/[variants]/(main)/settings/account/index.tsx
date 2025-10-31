'use client';

import { Button, Card, Form, Input, Modal, Space, Typography, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { ADMIN_ROLE, ROOT_ROLE } from '@/const/rbac';
import { useUserRoles } from '@/hooks/useHasRole';
import { lambdaQuery } from '@/libs/trpc/client';

const { Text, Paragraph } = Typography;

const AccountSettings = () => {
  const { t } = useTranslation(['setting', 'common']);
  const [messageApi, contextHolder] = message.useMessage();
  const [passwordForm] = Form.useForm();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const roles = useUserRoles();
  const roleSet = new Set(roles);
  const isAdmin = roleSet.has(ADMIN_ROLE) || roleSet.has(ROOT_ROLE);

  // 查询邀请码
  const { data: inviteCode, refetch: refetchInviteCode } =
    lambdaQuery.invite.getMyInviteCode.useQuery(undefined, {
      enabled: isAdmin,
    });

  // 生成邀请码
  const generateInviteCodeMutation = lambdaQuery.invite.generateInviteCode.useMutation();

  // 修改密码
  const changePasswordMutation = lambdaQuery.user.changePassword.useMutation();

  const handleChangePassword = async (values: {
    confirmPassword: string;
    currentPassword: string;
    newPassword: string;
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      messageApi.error(t('account.messages.passwordMismatch'));
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      messageApi.success(t('account.messages.changePasswordSuccess'));
      setIsPasswordModalOpen(false);
      passwordForm.resetFields();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('account.messages.changePasswordFailed'));
    }
  };

  const handleGenerateInviteCode = async () => {
    try {
      await generateInviteCodeMutation.mutateAsync();
      messageApi.success(t('account.inviteCode.generateSuccess'));
      await refetchInviteCode();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('management.messages.operationFailed'));
    }
  };

  const handleCopyInviteCode = () => {
    if (inviteCode?.code) {
      navigator.clipboard.writeText(inviteCode.code);
      messageApi.success(t('account.inviteCode.copySuccess'));
    }
  };

  return (
    <Flexbox gap={24} width={'100%'}>
      {contextHolder}

      {/* 密码管理 */}
      <Card style={{ width: '100%' }} title={t('account.sections.password')}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Paragraph>{t('account.dialogs.changePassword.title')}</Paragraph>
          <Button onClick={() => setIsPasswordModalOpen(true)} type="primary">
            {t('account.actions.changePassword')}
          </Button>
        </Space>
      </Card>

      {/* 邀请码管理 - 仅管理员可见 */}
      {isAdmin && (
        <Card style={{ width: '100%' }} title={t('account.sections.inviteCode')}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Paragraph>{t('account.inviteCode.desc')}</Paragraph>

            {inviteCode ? (
              <Flexbox gap={12}>
                <Space>
                  <Text strong>{t('account.inviteCode.label')}:</Text>
                  <Text code copyable>
                    {inviteCode.code}
                  </Text>
                </Space>
                {inviteCode.expiresAt && (
                  <Text type="secondary">
                    {t('account.inviteCode.validUntil', {
                      date: new Date(inviteCode.expiresAt).toLocaleString('zh-CN'),
                    })}
                  </Text>
                )}
                <Space>
                  <Button onClick={handleCopyInviteCode} type="default">
                    {t('account.inviteCode.copy')}
                  </Button>
                  <Button
                    loading={generateInviteCodeMutation.isPending}
                    onClick={handleGenerateInviteCode}
                    type="primary"
                  >
                    {t('account.inviteCode.generate')}
                  </Button>
                </Space>
              </Flexbox>
            ) : (
              <Button
                loading={generateInviteCodeMutation.isPending}
                onClick={handleGenerateInviteCode}
                type="primary"
              >
                {t('account.inviteCode.generate')}
              </Button>
            )}
          </Space>
        </Card>
      )}

      {/* 修改密码弹窗 */}
      <Modal
        onCancel={() => {
          setIsPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        onOk={() => passwordForm.submit()}
        open={isPasswordModalOpen}
        title={t('account.dialogs.changePassword.title')}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item
            label={t('account.dialogs.changePassword.currentLabel')}
            name="currentPassword"
            rules={[
              {
                message: t('account.validation.currentPassword'),
                required: true,
              },
            ]}
          >
            <Input.Password placeholder={t('account.dialogs.changePassword.currentPlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('account.dialogs.changePassword.newLabel')}
            name="newPassword"
            rules={[
              { message: t('account.validation.newPassword'), required: true },
              { message: t('account.validation.passwordLength'), min: 6 },
            ]}
          >
            <Input.Password placeholder={t('account.dialogs.changePassword.newPlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('account.dialogs.changePassword.confirmLabel')}
            name="confirmPassword"
            rules={[{ message: t('account.validation.confirmPassword'), required: true }]}
          >
            <Input.Password placeholder={t('account.dialogs.changePassword.confirmPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </Flexbox>
  );
};

export default AccountSettings;
