'use client';

import { ActionIcon, Icon } from '@lobehub/ui';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import Menu from '@/components/Menu';
import type { MenuProps } from '@/components/Menu';

const CourseMenu = memo(() => {
  const { t } = useTranslation('course');
  const [activeKey, setActiveKey] = useState('all');

  // TODO: 从 store 获取分类列表
  const categories: any[] = [];

  const items: MenuProps['items'] = [
    {
      icon: <Icon icon={FolderOpen} />,
      key: 'all',
      label: t('category.all'),
    },
    ...categories.map((cat) => ({
      icon: <Icon icon={FolderOpen} />,
      key: cat.id,
      label: cat.name,
    })),
  ];

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const handleAddCategory = () => {
    // TODO: 打开创建分类对话框
    console.log('Add category');
  };

  return (
    <Flexbox>
      <Flexbox
        align={'center'}
        horizontal
        justify={'space-between'}
        padding={12}
        style={{ borderBottom: '1px solid var(--lobe-chat-border-color)' }}
      >
        <span>{t('category.name')}</span>
        <ActionIcon icon={FolderPlus} onClick={handleAddCategory} title={t('category.add')} />
      </Flexbox>
      <Menu
        compact
        items={items}
        onClick={({ key }) => {
          setActiveKey(key);
        }}
        selectable
        selectedKeys={[activeKey]}
      />
    </Flexbox>
  );
});

export default CourseMenu;
