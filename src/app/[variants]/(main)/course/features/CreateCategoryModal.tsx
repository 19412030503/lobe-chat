'use client';

import { Form, Input, Modal } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCourseStore } from '@/store/course/store';

interface CreateCategoryModalProps {
  onClose: () => void;
  open: boolean;
}

const CreateCategoryModal = memo<CreateCategoryModalProps>(({ open, onClose }) => {
  const { t } = useTranslation('course');
  const [form] = Form.useForm();
  const createCategory = useCourseStore((s) => s.createCategory);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await createCategory(values.name, values.description);
      form.resetFields();
      onClose();
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      okText={t('category.create')}
      onCancel={handleCancel}
      onOk={handleOk}
      open={open}
      title={t('category.create')}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('category.name')}
          name="name"
          rules={[{ message: t('category.namePlaceholder'), required: true }]}
        >
          <Input placeholder={t('category.namePlaceholder')} />
        </Form.Item>
        <Form.Item label={t('category.description')} name="description">
          <Input.TextArea placeholder={t('category.descriptionPlaceholder')} rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
});

CreateCategoryModal.displayName = 'CreateCategoryModal';

export default CreateCategoryModal;
