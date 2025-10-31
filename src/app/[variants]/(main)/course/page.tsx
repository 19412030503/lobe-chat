'use client';

import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import CourseManager from '@/features/CourseManager';

import CourseMenu from './features/CourseMenu';

const CoursePage = () => {
  const { t } = useTranslation('course');

  return (
    <Flexbox horizontal style={{ height: '100%', width: '100%' }}>
      <CourseMenu />
      <Flexbox flex={1} style={{ overflow: 'hidden' }}>
        <CourseManager title={t('title')} />
      </Flexbox>
    </Flexbox>
  );
};

export default CoursePage;
