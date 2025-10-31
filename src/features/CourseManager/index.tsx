'use client';

import { Text } from '@lobehub/ui';
import { Empty, List, Spin } from 'antd';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useCourseStore } from '@/store/course/store';

import CourseHeader from './CourseHeader';

interface CourseManagerProps {
  title: string;
}

const CourseManager = memo<CourseManagerProps>(({ title }) => {
  const { t } = useTranslation('course');

  const { currentCategoryId, files, isLoadingFiles, loadFiles } = useCourseStore((s) => ({
    currentCategoryId: s.currentCategoryId,
    files: s.files,
    isLoadingFiles: s.isLoadingFiles,
    loadFiles: s.loadFiles,
  }));

  // 加载文件列表
  useEffect(() => {
    loadFiles(currentCategoryId || undefined);
  }, [currentCategoryId, loadFiles]);

  return (
    <>
      <CourseHeader />
      <Flexbox gap={12} height={'100%'} style={{ overflow: 'auto' }}>
        <Text strong style={{ fontSize: 16, marginBlock: 16, marginInline: 24 }}>
          {title}
        </Text>
        <Flexbox padding={24} style={{ flex: 1 }}>
          {isLoadingFiles ? (
            <Flexbox align={'center'} justify={'center'} style={{ minHeight: 400 }}>
              <Spin size="large" />
            </Flexbox>
          ) : files.length === 0 ? (
            <Flexbox align={'center'} justify={'center'} style={{ minHeight: 400 }}>
              <Empty description={t('file.empty')} />
            </Flexbox>
          ) : (
            <List
              dataSource={files}
              renderItem={(file) => (
                <List.Item key={file.id}>
                  <List.Item.Meta description={file.description} title={file.name} />
                  <div>{(file.size / 1024).toFixed(2)} KB</div>
                </List.Item>
              )}
            />
          )}
        </Flexbox>
      </Flexbox>
    </>
  );
});

export default CourseManager;
