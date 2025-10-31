'use client';

import { ActionIcon } from '@lobehub/ui';
import { Upload, type UploadFile } from 'antd';
import { RcFile } from 'antd/es/upload';
import { UploadIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { message } from '@/components/AntdStaticMethods';
import { useCourseStore } from '@/store/course/store';
import { useFileStore } from '@/store/file';

const CourseHeader = memo(() => {
  const { t } = useTranslation('course');
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const { currentCategoryId, createFile } = useCourseStore((s) => ({
    createFile: s.createFile,
    currentCategoryId: s.currentCategoryId,
  }));

  const uploadWithProgress = useFileStore((s) => s.uploadWithProgress);

  const handleUpload = async (file: RcFile) => {
    if (!currentCategoryId) {
      message.warning(t('file.selectCategoryFirst', '请先选择分类'));
      return false;
    }

    setUploading(true);

    try {
      // 使用 FileStore 的 uploadWithProgress 上传文件
      const result = await uploadWithProgress({
        file,
        onStatusUpdate: (data) => {
          if (data.type === 'updateFile') {
            const progress = data.value.uploadState?.progress ?? 0;
            setFileList([
              {
                name: file.name,
                percent: progress,
                status: data.value.status === 'error' ? 'error' : 'uploading',
                uid: file.uid,
              },
            ]);
          }
        },
      });

      if (result?.url) {
        // 创建课程文件记录
        await createFile({
          categoryId: currentCategoryId,
          fileType: file.type,
          name: file.name,
          size: file.size,
          url: result.url,
        });

        setFileList([]);
        message.success(t('file.uploadSuccess', '上传成功'));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      message.error(t('file.uploadFailed', '上传失败'));
    } finally {
      setUploading(false);
    }

    return false; // 阻止默认上传行为
  };

  return (
    <Flexbox
      align={'center'}
      horizontal
      justify={'space-between'}
      padding={16}
      style={{ borderBottom: '1px solid var(--lobe-chat-border-color)' }}
    >
      <div />
      <Upload
        beforeUpload={handleUpload}
        disabled={!currentCategoryId || uploading}
        fileList={fileList}
        showUploadList={false}
      >
        <ActionIcon
          disabled={!currentCategoryId}
          icon={UploadIcon}
          loading={uploading}
          title={t('file.upload')}
        />
      </Upload>
    </Flexbox>
  );
});

export default CourseHeader;
