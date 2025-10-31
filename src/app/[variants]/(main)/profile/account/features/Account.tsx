'use client';

import { Button, Card, Form, Input, Modal, Space, Typography, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { lambdaQuery } from '@/libs/trpc/client';

const { Paragraph } = Typography;

const Account = () => {
  const { t } = useTranslation(['setting', 'common']);
  const [messageApi, contextHolder] = message.useMessage();
  const [passwordForm] = Form.useForm();
  const [inviteCodeForm] = Form.useForm();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isInviteCodeModalOpen, setIsInviteCodeModalOpen] = useState(false);

  // 修改密码
  const changePasswordMutation = lambdaQuery.user.changePassword.useMutation();

  // 加入组织
  const joinOrganizationMutation = lambdaQuery.invite.joinOrganization.useMutation();

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

  const handleJoinOrganization = async (values: { inviteCode: string }) => {
    try {
      await joinOrganizationMutation.mutateAsync({ code: values.inviteCode });
      messageApi.success(t('account.inviteCode.joinSuccess'));
      setIsInviteCodeModalOpen(false);
      inviteCodeForm.resetFields();
    } catch (error: any) {
      messageApi.error(error?.message ?? t('account.inviteCode.joinFailed'));
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

      {/* 加入组织 */}
      <Card style={{ width: '100%' }} title={t('account.sections.organization')}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Paragraph>{t('account.organization.desc')}</Paragraph>
          <Button onClick={() => setIsInviteCodeModalOpen(true)} type="primary">
            {t('account.actions.joinOrganization')}
          </Button>
        </Space>
      </Card>

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

      {/* 加入组织弹窗 */}
      <Modal
        onCancel={() => {
          setIsInviteCodeModalOpen(false);
          inviteCodeForm.resetFields();
        }}
        onOk={() => inviteCodeForm.submit()}
        open={isInviteCodeModalOpen}
        title={t('account.actions.joinOrganization')}
      >
        <Form form={inviteCodeForm} layout="vertical" onFinish={handleJoinOrganization}>
          <Form.Item
            label={t('account.organization.inviteCodeLabel')}
            name="inviteCode"
            rules={[
              {
                message: t('account.organization.inviteCodeRequired'),
                required: true,
              },
            ]}
          >
            <Input placeholder={t('account.organization.inviteCodePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </Flexbox>
  );
};

export default Account;
