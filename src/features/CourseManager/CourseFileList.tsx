'use client';

import { Empty } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

interface CourseFileListProps {
  categoryId?: string;
}

const CourseFileList = memo<CourseFileListProps>(() => {
  const { t } = useTranslation('course');

  // TODO: 从 store 获取文件列表

  return (
    <Flexbox align={'center'} justify={'center'} style={{ minHeight: 400 }}>
      <Empty description={t('file.empty')} />
    </Flexbox>
  );
});

CourseFileList.displayName = 'CourseFileList';

export default CourseFileList;
