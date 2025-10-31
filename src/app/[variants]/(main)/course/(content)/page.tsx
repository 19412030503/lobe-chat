'use client';

import { useTranslation } from 'react-i18next';

import CourseManager from '@/features/CourseManager';

const CoursePage = () => {
  const { t } = useTranslation('course');

  return <CourseManager title={t('title')} />;
};

export default CoursePage;
