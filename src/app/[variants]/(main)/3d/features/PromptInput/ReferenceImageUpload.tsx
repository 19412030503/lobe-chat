'use client';

import { createStyles } from 'antd-style';
import type { MessageInstance } from 'antd/es/message/interface';
import { ImageIcon, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import type { ChangeEvent, DragEvent, FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useFileStore } from '@/store/file';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    width: 100%;
    min-height: 200px;
    border: 2px dashed ${token.colorBorder};
    border-radius: ${token.borderRadiusLG}px;

    background: ${token.colorFillQuaternary};

    transition: all 0.2s ease;

    &:hover {
      border-color: ${token.colorPrimary};
      background: ${token.colorFillTertiary};
    }

    &.disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &.dragOver {
      border-color: ${token.colorPrimary};
      background: ${token.colorPrimaryBg};
    }
  `,
  content: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;

    padding: 16px;

    text-align: center;
  `,
  icon: css`
    color: ${token.colorTextSecondary};
  `,
  input: css`
    display: none;
  `,
  placeholder: css`
    font-size: ${token.fontSize}px;
    color: ${token.colorTextSecondary};
  `,
  preview: css`
    position: absolute;
    inset: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  progressBar: css`
    overflow: hidden;

    width: 90px;
    height: 4px;
    border-radius: 2px;

    background: ${token.colorBgContainerDisabled};
  `,
  progressFill: css`
    height: 100%;
    background: ${token.colorPrimary};
    transition: width 0.2s ease;
  `,
  removeButton: css`
    cursor: pointer;

    position: absolute;
    z-index: 1;
    inset-block-start: 8px;
    inset-inline-end: 8px;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 28px;
    height: 28px;
    border-radius: ${token.borderRadiusSM}px;

    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowSecondary};

    transition: all 0.2s ease;

    &:hover {
      background: ${token.colorBgTextHover};
    }
  `,
}));

type SingleUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface SingleUploadState {
  previewUrl?: string;
  progress: number;
  status: SingleUploadStatus;
}

interface ReferenceImageUploadProps {
  className?: string;
  disabled?: boolean;
  messageApi: MessageInstance;
  onChange: (url?: string) => void;
  placeholder: string;
  value?: string;
}

export const ReferenceImageUpload: FC<ReferenceImageUploadProps> = ({
  className,
  disabled,
  messageApi,
  onChange,
  placeholder,
  value,
}) => {
  const { styles, cx } = useStyles();
  const uploadWithProgress = useFileStore((s) => s.uploadWithProgress);
  const inputRef = useRef<HTMLInputElement>(null);
  const tempPreviewRef = useRef<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [state, setState] = useState<SingleUploadState>({
    previewUrl: value,
    progress: value ? 100 : 0,
    status: value ? 'success' : 'idle',
  });

  useEffect(() => {
    setState({
      previewUrl: value,
      progress: value ? 100 : 0,
      status: value ? 'success' : 'idle',
    });
  }, [value]);

  useEffect(
    () => () => {
      if (tempPreviewRef.current) {
        URL.revokeObjectURL(tempPreviewRef.current);
        tempPreviewRef.current = null;
      }
    },
    [],
  );

  const cleanupTempPreview = useCallback(() => {
    if (tempPreviewRef.current) {
      URL.revokeObjectURL(tempPreviewRef.current);
      tempPreviewRef.current = null;
    }
  }, []);

  const handleRemove = useCallback(() => {
    cleanupTempPreview();
    onChange(undefined);
    setState({ previewUrl: undefined, progress: 0, status: 'idle' });
  }, [cleanupTempPreview, onChange]);

  const updateProgress = useCallback((progress: number, status: SingleUploadStatus) => {
    setState((prev) => ({
      ...prev,
      progress,
      status,
    }));
  }, []);

  const beginUpload = useCallback(
    async (file: File) => {
      if (disabled) return;

      const blobUrl = URL.createObjectURL(file);
      cleanupTempPreview();
      tempPreviewRef.current = blobUrl;

      setState({
        previewUrl: blobUrl,
        progress: 0,
        status: 'uploading',
      });

      try {
        const result = await uploadWithProgress({
          file,
          onStatusUpdate: (updateData) => {
            if (updateData.type !== 'updateFile') return;
            const progress = updateData.value.uploadState?.progress ?? 0;
            updateProgress(progress, 'uploading');
          },
          skipCheckFileType: true,
        });

        if (result?.url) {
          updateProgress(100, 'success');
          onChange(result.url);
        } else {
          throw new Error('Upload failed: no URL returned');
        }
      } catch (error) {
        updateProgress(0, 'error');
        messageApi.error(error instanceof Error ? error.message : 'Upload failed');
        handleRemove();
      } finally {
        cleanupTempPreview();
      }
    },
    [
      disabled,
      cleanupTempPreview,
      uploadWithProgress,
      updateProgress,
      onChange,
      messageApi,
      handleRemove,
    ],
  );

  const handleClick = useCallback(() => {
    if (disabled || state.status === 'uploading') return;
    inputRef.current?.click();
  }, [disabled, state.status]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        beginUpload(file);
      }
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [beginUpload],
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      if (disabled || state.status === 'uploading') return;

      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        beginUpload(file);
      } else {
        messageApi.warning('Please drop an image file');
      }
    },
    [disabled, state.status, beginUpload, messageApi],
  );

  const { status, previewUrl, progress } = state;

  return (
    <div
      className={cx(styles.container, className, disabled && 'disabled', isDragOver && 'dragOver')}
      onClick={handleClick}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        accept="image/*"
        className={styles.input}
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />

      {status === 'success' && previewUrl ? (
        <>
          <div className={styles.preview}>
            <Image alt="Preview" fill src={previewUrl} style={{ objectFit: 'cover' }} unoptimized />
          </div>
          {!disabled && (
            <button
              className={styles.removeButton}
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              type="button"
            >
              <X size={16} />
            </button>
          )}
        </>
      ) : (
        <div className={styles.content}>
          {status === 'uploading' ? (
            <>
              <Loader2 className={cx(styles.icon, 'animate-spin')} size={32} />
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.placeholder}>{Math.round(progress)}%</span>
            </>
          ) : (
            <>
              <ImageIcon className={styles.icon} size={32} />
              <span className={styles.placeholder}>{placeholder}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
