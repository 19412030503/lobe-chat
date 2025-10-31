'use client';

import { ActionIcon, Icon } from '@lobehub/ui';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import Menu from '@/components/Menu';
import type { MenuProps } from '@/components/Menu';
import { useCourseStore } from '@/store/course/store';

import CreateCategoryModal from './CreateCategoryModal';

const CourseMenu = memo(() => {
  const { t } = useTranslation('course');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { categories, currentCategoryId, loadCategories, setCurrentCategory } = useCourseStore(
    (s) => ({
      categories: s.categories,
      currentCategoryId: s.currentCategoryId,
      loadCategories: s.loadCategories,
      setCurrentCategory: s.setCurrentCategory,
    }),
  );

  // 加载分类列表
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleAddCategory = () => {
    setShowCreateModal(true);
  };

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

  return (
    <Flexbox style={{ borderRight: '1px solid var(--lobe-chat-border-color)', width: 240 }}>
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
          setCurrentCategory(key === 'all' ? null : key);
        }}
        selectable
        selectedKeys={[currentCategoryId || 'all']}
      />
      <CreateCategoryModal onClose={() => setShowCreateModal(false)} open={showCreateModal} />
    </Flexbox>
  );
});

export default CourseMenu;
