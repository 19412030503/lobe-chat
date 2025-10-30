'use client';

import { Select as AntSelect, InputNumber, Switch, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { type ReactNode, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useThreeDStore } from '@/store/threeD';

import ModelSelect from './components/ModelSelect';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  configItem: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-block-end: 20px;
  `,
  description: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  label: css`
    font-weight: 600;
    color: ${token.colorText};
  `,
  scroll: css`
    overflow-y: auto;
    flex: 1;
    padding-inline-end: 6px;
  `,
}));

const ConfigPanel = memo(() => {
  const { styles } = useStyles();
  const { t } = useTranslation('threeD', { keyPrefix: 'workspace' });

  const parameters = useThreeDStore((state) => state.parameters);
  const parametersSchema = useThreeDStore((state) => state.parametersSchema);
  const modelCount = useThreeDStore((state) => state.modelCount);
  const setModelCount = useThreeDStore((state) => state.setModelCount);
  const setParameter = useThreeDStore((state) => state.setParameter);

  const enablePBRSchema = parametersSchema?.enablePBR;
  const faceCountSchema = parametersSchema?.faceCount;
  const faceLimitSchema = parametersSchema?.faceLimit;
  const generateTypeSchema = parametersSchema?.generateType;
  const polygonTypeSchema = parametersSchema?.polygonType;
  const resultFormatSchema = parametersSchema?.resultFormat;
  const modelSeedSchema = parametersSchema?.modelSeed;
  const textureSchema = parametersSchema?.texture;
  const pbrSchema = parametersSchema?.pbr;
  const textureQualitySchema = parametersSchema?.textureQuality;
  const textureAlignmentSchema = parametersSchema?.textureAlignment;
  const geometryQualitySchema = parametersSchema?.geometryQuality;
  const textureSeedSchema = parametersSchema?.textureSeed;
  const autoSizeSchema = parametersSchema?.autoSize;
  const smartLowPolySchema = parametersSchema?.smartLowPoly;
  const generatePartsSchema = parametersSchema?.generateParts;
  const quadSchema = parametersSchema?.quad;

  const faceCountFallback = faceCountSchema?.default ?? faceCountSchema?.min ?? 40_000;

  const generateTypeOptions = useMemo(() => {
    if (!generateTypeSchema?.enum) return undefined;
    return generateTypeSchema.enum.map((value: string) => ({
      label: t(`config.generateTypeOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [generateTypeSchema, t]);

  const polygonTypeOptions = useMemo(() => {
    if (!polygonTypeSchema?.enum) return undefined;
    return polygonTypeSchema.enum.map((value: string) => ({
      label: t(`config.polygonTypeOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [polygonTypeSchema, t]);

  const resultFormatOptions = useMemo(() => {
    if (!resultFormatSchema?.enum) return undefined;
    return resultFormatSchema.enum.map((value: string) => ({
      label: value.toUpperCase(),
      value: value.toUpperCase(),
    }));
  }, [resultFormatSchema]);

  const geometryQualityOptions = useMemo(() => {
    if (!geometryQualitySchema?.enum) return undefined;
    return geometryQualitySchema.enum.map((value: string) => ({
      label: t(`config.geometryQualityOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [geometryQualitySchema, t]);

  const textureQualityOptions = useMemo(() => {
    if (!textureQualitySchema?.enum) return undefined;
    return textureQualitySchema.enum.map((value: string) => ({
      label: t(`config.textureQualityOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [textureQualitySchema, t]);

  const textureAlignmentOptions = useMemo(() => {
    if (!textureAlignmentSchema?.enum) return undefined;
    return textureAlignmentSchema.enum.map((value: string) => ({
      label: t(`config.textureAlignmentOptions.${value.toLowerCase()}`, value),
      value,
    }));
  }, [textureAlignmentSchema, t]);

  const renderSection = useCallback(
    (label: string | undefined, description: string | undefined, children: ReactNode) => (
      <Flexbox className={styles.configItem}>
        {label && <Text className={styles.label}>{label}</Text>}
        {children}
        {description && <Text className={styles.description}>{description}</Text>}
      </Flexbox>
    ),
    [styles.configItem, styles.description, styles.label],
  );

  // 开关类型的配置项：标签和开关在同一行
  const renderSwitchSection = useCallback(
    (label: string, description: string | undefined, children: ReactNode) => (
      <Flexbox className={styles.configItem}>
        <Flexbox align="center" gap={12} horizontal justify="space-between">
          <Text className={styles.label}>{label}</Text>
          {children}
        </Flexbox>
        {description && <Text className={styles.description}>{description}</Text>}
      </Flexbox>
    ),
    [styles.configItem, styles.description, styles.label],
  );

  return (
    <Flexbox gap={24} padding="12px 12px 0 12px" style={{ height: '100%' }}>
      <Flexbox gap={8}>
        <ModelSelect />
      </Flexbox>

      <div className={styles.scroll}>
        {renderSection(
          t('config.count', '生成数量'),
          undefined,
          <InputNumber
            max={4}
            min={1}
            onChange={(value) => setModelCount(value ? Number(value) : 1)}
            style={{ width: '100%' }}
            value={modelCount}
          />,
        )}

        {modelSeedSchema &&
          renderSection(
            t('config.modelSeed', '几何随机种子'),
            t('config.modelSeedDescription', '留空使用随机值，指定后可复现实验中的网格结果。'),
            <InputNumber
              max={modelSeedSchema.max}
              min={modelSeedSchema.min}
              onChange={(value) =>
                setParameter(
                  'modelSeed',
                  typeof value === 'number' && Number.isFinite(value) ? value : null,
                )
              }
              style={{ width: '100%' }}
              value={typeof parameters.modelSeed === 'number' ? parameters.modelSeed : undefined}
            />,
          )}

        {faceLimitSchema &&
          renderSection(
            t('config.faceLimit', '面数上限'),
            t('config.faceLimitDescription'),
            <InputNumber
              max={faceLimitSchema.max}
              min={faceLimitSchema.min}
              onChange={(value) =>
                setParameter(
                  'faceLimit',
                  typeof value === 'number' && Number.isFinite(value) ? value : null,
                )
              }
              step={faceLimitSchema.step ?? 500}
              style={{ width: '100%' }}
              value={typeof parameters.faceLimit === 'number' ? parameters.faceLimit : undefined}
            />,
          )}

        {faceCountSchema &&
          renderSection(
            t('config.faceCount', '最大面数'),
            t('config.faceCountDescription', {
              defaultValue: '范围 {{min}} - {{max}}，数值越高细节越好',
              max: faceCountSchema.max ?? 1_500_000,
              min: faceCountSchema.min ?? 40_000,
            }),
            <InputNumber
              max={faceCountSchema.max}
              min={faceCountSchema.min}
              onChange={(value) =>
                setParameter('faceCount', typeof value === 'number' ? value : faceCountFallback)
              }
              step={faceCountSchema.step ?? 10_000}
              style={{ width: '100%' }}
              value={
                typeof parameters.faceCount === 'number' ? parameters.faceCount : faceCountFallback
              }
            />,
          )}

        {enablePBRSchema &&
          renderSwitchSection(
            t('config.enablePBR', '启用 PBR 材质'),
            t('config.enablePBRDescription'),
            <Switch
              checked={parameters.enablePBR !== false}
              onChange={(checked) => {
                setParameter('enablePBR', checked);
                if (pbrSchema) {
                  setParameter('pbr', checked);
                }
              }}
            />,
          )}

        {textureSchema &&
          renderSwitchSection(
            t('config.texture', '生成贴图'),
            t('config.textureDescription'),
            <Switch
              checked={parameters.texture !== false}
              onChange={(checked) => setParameter('texture', checked)}
            />,
          )}

        {textureQualityOptions &&
          renderSection(
            t('config.textureQuality', '贴图质量'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('textureQuality', value)}
              options={textureQualityOptions}
              style={{ width: '100%' }}
              value={parameters.textureQuality ?? textureQualitySchema?.default}
            />,
          )}

        {textureAlignmentOptions &&
          renderSection(
            t('config.textureAlignment', '贴图对齐方式'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('textureAlignment', value)}
              options={textureAlignmentOptions}
              style={{ width: '100%' }}
              value={parameters.textureAlignment ?? textureAlignmentSchema?.default}
            />,
          )}

        {generateTypeOptions &&
          renderSection(
            t('config.generateType', '生成模式'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('generateType', value)}
              options={generateTypeOptions}
              style={{ width: '100%' }}
              value={parameters.generateType ?? generateTypeSchema?.default}
            />,
          )}

        {polygonTypeOptions &&
          renderSection(
            t('config.polygonType', '多边形类型'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('polygonType', value)}
              options={polygonTypeOptions}
              style={{ width: '100%' }}
              value={parameters.polygonType ?? polygonTypeSchema?.default}
            />,
          )}

        {resultFormatOptions &&
          renderSection(
            t('config.resultFormat', '输出格式'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('resultFormat', value)}
              options={resultFormatOptions}
              placeholder={t('config.resultFormatPlaceholder', '选择导出的模型格式')}
              style={{ width: '100%' }}
              value={parameters.resultFormat ?? resultFormatSchema?.default}
            />,
          )}

        {geometryQualityOptions &&
          renderSection(
            t('config.geometryQuality', '几何质量'),
            undefined,
            <AntSelect
              onChange={(value) => setParameter('geometryQuality', value)}
              options={geometryQualityOptions}
              style={{ width: '100%' }}
              value={parameters.geometryQuality ?? geometryQualitySchema?.default}
            />,
          )}

        {textureSeedSchema &&
          renderSection(
            t('config.textureSeed', '贴图随机种子'),
            undefined,
            <InputNumber
              max={textureSeedSchema.max}
              min={textureSeedSchema.min}
              onChange={(value) =>
                setParameter(
                  'textureSeed',
                  typeof value === 'number' && Number.isFinite(value) ? value : null,
                )
              }
              style={{ width: '100%' }}
              value={
                typeof parameters.textureSeed === 'number' ? parameters.textureSeed : undefined
              }
            />,
          )}

        {autoSizeSchema &&
          renderSwitchSection(
            t('config.autoSize', '自动缩放至真实尺寸'),
            undefined,
            <Switch
              checked={parameters.autoSize !== false}
              onChange={(checked) => setParameter('autoSize', checked)}
            />,
          )}

        {smartLowPolySchema &&
          renderSwitchSection(
            t('config.smartLowPoly', '智能低多边形'),
            t('config.smartLowPolyDescription'),
            <Switch
              checked={parameters.smartLowPoly === true}
              onChange={(checked) => setParameter('smartLowPoly', checked)}
            />,
          )}

        {generatePartsSchema &&
          renderSwitchSection(
            t('config.generateParts', '生成可分段模型'),
            t('config.generatePartsDescription'),
            <Switch
              checked={parameters.generateParts === true}
              onChange={(checked) => setParameter('generateParts', checked)}
            />,
          )}

        {quadSchema &&
          renderSwitchSection(
            t('config.quad', '输出四边形网格'),
            t('config.quadDescription'),
            <Switch
              checked={parameters.quad === true}
              onChange={(checked) => setParameter('quad', checked)}
            />,
          )}
      </div>
    </Flexbox>
  );
});

ConfigPanel.displayName = 'ConfigPanel';

export default ConfigPanel;
