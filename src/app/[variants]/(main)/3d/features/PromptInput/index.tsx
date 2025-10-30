'use client';

import { Button, TextArea } from '@lobehub/ui';
import { Segmented, Typography, message } from 'antd';
import { createStyles } from 'antd-style';
import { Sparkles } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { loginRequired } from '@/components/Error/loginRequiredNotification';
import { useGeminiChineseWarning } from '@/hooks/useGeminiChineseWarning';
import { useThreeDStore } from '@/store/threeD';
import { createThreeDSelectors } from '@/store/threeD/slices/createThreeD/selectors';
import { threeDGenerationConfigSelectors } from '@/store/threeD/slices/generationConfig/selectors';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import { MultiViewUpload } from './MultiViewUpload';
import { ReferenceImageUpload } from './ReferenceImageUpload';
import PromptTitle from './Title';

const { Text } = Typography;

interface PromptInputProps {
  disableAnimation?: boolean;
  showTitle?: boolean;
}

const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  container: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG * 1.5}px;
    background-color: ${token.colorBgContainer};
    box-shadow:
      ${token.boxShadowTertiary},
      ${isDarkMode
        ? `0 0 48px 32px ${token.colorBgContainerSecondary}`
        : `0 0 0  ${token.colorBgContainerSecondary}`},
      0 32px 0 ${token.colorBgContainerSecondary};
  `,
  imageModeSwitch: css`
    margin-inline-start: 12px;
  `,
  imageUploadWrapper: css`
    width: 100%;
  `,
  inputColumn: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;

    width: 100%;
  `,
  textArea: css`
    padding: 0;
    border-radius: 0;
  `,
  toggleNote: css`
    margin-inline-start: 12px;
    font-size: ${token.fontSizeSM}px;
    color: ${token.colorTextSecondary};
  `,
  toggleRow: css`
    display: flex;
    align-items: center;
  `,
  wrapper: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;

    width: 100%;
  `,
}));

const PromptInput = ({ showTitle = false }: PromptInputProps) => {
  const { styles } = useStyles();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });
  const [messageApi, contextHolder] = message.useMessage();

  // State
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  const [imageInputMode, setImageInputMode] = useState<'single' | 'multi'>('single');

  // Store
  const prompt = useThreeDStore((state) => state.parameters.prompt);
  const imageUrl = useThreeDStore((state) => state.parameters.imageUrl as string | undefined);
  const multiViewImages = useThreeDStore(
    (state) => state.parameters.multiViewImages as string[] | undefined,
  );
  const setPrompt = useThreeDStore((state) => state.setPrompt);
  const setParameter = useThreeDStore((state) => state.setParameter);
  const isCreating = useThreeDStore(createThreeDSelectors.isCreating);
  const createThreeD = useThreeDStore((s) => s.createThreeD);
  const currentModel = useThreeDStore(threeDGenerationConfigSelectors.model) as string;
  const isLogin = useUserStore(authSelectors.isLogin);
  const checkGeminiChineseWarning = useGeminiChineseWarning();

  // Get model capabilities from parametersSchema
  const parametersSchema = useThreeDStore((state) => state.parametersSchema);

  const supportsImage = Boolean(parametersSchema?.imageUrl || parametersSchema?.multiViewImages);
  const supportsSingleImage = Boolean(parametersSchema?.imageUrl);
  const supportsMultiImage = Boolean(parametersSchema?.multiViewImages);
  const multiViewMaxCount = (parametersSchema?.multiViewImages as any)?.maxItems ?? 3;
  const singleImageDescription = parametersSchema?.imageUrl?.description;
  const multiViewDescription = parametersSchema?.multiViewImages?.description;

  const promptValue = typeof prompt === 'string' ? prompt : '';
  const isTextMode = inputMode === 'text';

  // Clear prompt when switching to image mode
  useEffect(() => {
    if (!isTextMode && promptValue) {
      setPrompt('');
    }
  }, [isTextMode, promptValue, setPrompt]);

  // Validation
  const canSubmit = useMemo(() => {
    if (isTextMode) {
      return Boolean(promptValue.trim());
    }

    if (supportsImage) {
      if (imageInputMode === 'single') {
        return Boolean(imageUrl);
      }
      return Boolean(multiViewImages && multiViewImages.length > 0);
    }

    return false;
  }, [imageInputMode, imageUrl, isTextMode, multiViewImages, promptValue, supportsImage]);

  // Mode options
  const modeOptions = useMemo(
    () => [
      { label: t('config.promptMode.text', '文本模式'), value: 'text' },
      {
        disabled: !supportsImage,
        label: t('config.promptMode.image', '图片模式'),
        value: 'image',
      },
    ],
    [supportsImage, t],
  );

  const imageModeOptions = useMemo(() => {
    const options: Array<{ label: string; value: 'single' | 'multi' }> = [];
    if (supportsSingleImage) {
      options.push({ label: t('config.imageMode.single', '单图'), value: 'single' });
    }
    if (supportsMultiImage) {
      options.push({ label: t('config.imageMode.multi', '多图'), value: 'multi' });
    }
    return options;
  }, [supportsMultiImage, supportsSingleImage, t]);

  // Handlers
  const handlePromptChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (!isTextMode) return;
      setPrompt(event.target.value);
    },
    [isTextMode, setPrompt],
  );

  const handleSubmit = useCallback(async () => {
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }

    // Check for Chinese text warning with Gemini model (only for text mode)
    if (isTextMode) {
      const shouldContinue = await checkGeminiChineseWarning({
        model: currentModel,
        prompt: promptValue,
        scenario: 'image' as any, // Use 'image' as scenario type
      });
      if (!shouldContinue) return;
    }

    await createThreeD();
  }, [checkGeminiChineseWarning, createThreeD, currentModel, isLogin, isTextMode, promptValue]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey && isTextMode) {
        event.preventDefault();
        if (!isCreating && canSubmit) {
          handleSubmit();
        }
      }
    },
    [canSubmit, handleSubmit, isCreating, isTextMode],
  );

  // Render input content
  let noteText: string | undefined;
  let inputContent: ReactNode;

  if (isTextMode) {
    noteText = undefined;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <TextArea
          className={styles.textArea}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          placeholder={t('config.prompt.placeholder', '描述你想要的 3D 资产')}
          rows={6}
          value={promptValue}
          variant="borderless"
        />
      </div>
    );
  } else if (imageInputMode === 'multi' && supportsMultiImage) {
    noteText = multiViewDescription;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <MultiViewUpload
          disabled={isCreating as boolean}
          maxCount={multiViewMaxCount}
          messageApi={messageApi}
          onChange={(urls) => setParameter('multiViewImages', urls)}
          placeholder={t('config.multiViewPlaceholder', {
            defaultValue: '上传多张视角图像（最多 {{max}} 张）',
            max: multiViewMaxCount,
          })}
          value={multiViewImages || []}
        />
      </div>
    );
  } else if (supportsSingleImage) {
    noteText = singleImageDescription;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <ReferenceImageUpload
          disabled={isCreating as boolean}
          messageApi={messageApi}
          onChange={(url) => setParameter('imageUrl', url || '')}
          placeholder={singleImageDescription || t('config.imagePlaceholder', '上传参考图像')}
          value={imageUrl || undefined}
        />
      </div>
    );
  } else {
    noteText = undefined;
    inputContent = (
      <div className={styles.imageUploadWrapper}>
        <ReferenceImageUpload
          disabled
          messageApi={messageApi}
          onChange={() => {}}
          placeholder={t('config.imagePlaceholder', '上传参考图像')}
        />
      </div>
    );
  }

  return (
    <>
      {contextHolder}
      <Flexbox
        gap={32}
        style={{
          marginTop: 48,
        }}
        width={'100%'}
      >
        {showTitle && <PromptTitle />}

        <Flexbox className={styles.wrapper} gap={12}>
          <Flexbox
            align="center"
            className={styles.container}
            gap={12}
            horizontal
            padding={'12px'}
            width="100%"
          >
            <div className={styles.inputColumn}>
              <div className={styles.toggleRow}>
                <Segmented
                  onChange={(value) => setInputMode(value as 'text' | 'image')}
                  options={modeOptions}
                  size="large"
                  value={inputMode}
                />
                {inputMode === 'image' && imageModeOptions.length > 1 && (
                  <Segmented
                    className={styles.imageModeSwitch}
                    onChange={(value) => setImageInputMode(value as 'single' | 'multi')}
                    options={imageModeOptions}
                    size="middle"
                    value={imageInputMode}
                  />
                )}
                {inputMode === 'image' && noteText && (
                  <Text className={styles.toggleNote}>{noteText}</Text>
                )}
              </div>
              {inputContent}
            </div>
            <Button
              disabled={!canSubmit}
              icon={Sparkles}
              loading={isCreating as boolean}
              onClick={handleSubmit}
              size="large"
              style={{
                alignSelf: 'center',
                fontWeight: 500,
                height: 64,
                minWidth: 64,
                width: 64,
              }}
              type="primary"
            />
          </Flexbox>
        </Flexbox>
      </Flexbox>
    </>
  );
};

export default PromptInput;
