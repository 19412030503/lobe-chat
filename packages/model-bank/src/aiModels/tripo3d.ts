import { ModelParamsSchema } from '../standard-parameters';
import { AI3DModelCard } from '../types/aiModel';

const STYLE_OPTIONS = [
  'person:person2cartoon',
  'object:clay',
  'object:steampunk',
  'animal:venom',
  'object:barbie',
  'object:christmas',
  'gold',
  'ancient_bronze',
];

const ORIENTATION_OPTIONS = ['default', 'align_image'] as const;
const TEXTURE_ALIGNMENT_OPTIONS = ['original_image', 'geometry'] as const;
const TEXTURE_QUALITY_OPTIONS = ['standard', 'detailed'] as const;
const GEOMETRY_QUALITY_OPTIONS = ['standard', 'detailed'] as const;
const IMAGE_FILE_TYPE_OPTIONS = ['auto', 'jpg', 'jpeg', 'png', 'webp'] as const;

const geometryQualityParam = {
  default: 'standard',
  description: '几何质量等级，仅适用于模型版本 ≥ v3.0。',
  enum: Array.from(GEOMETRY_QUALITY_OPTIONS),
  type: 'string' as const,
};

const tripo3DBaseParams: ModelParamsSchema = {
  autoSize: {
    default: false,
    description: '是否自动缩放至真实世界尺寸（单位：米）。',
    type: 'boolean',
  },
  compress: {
    default: '',
    description: '可选的几何压缩方式（例如 geometry）。',
    type: 'string',
  },
  enablePBR: {
    default: true,
    description: '兼容 UI 切换 PBR 设置，与 pbr 参数保持一致。',
    type: 'boolean',
  },
  faceLimit: {
    default: null,
    description: '限制输出模型的最大面数，smart_low_poly 建议 1000~16000，quad 模式建议 500~8000。',
    max: 16_000,
    min: 500,
    step: 500,
    type: ['number', 'null'],
  },
  generateParts: {
    default: false,
    description: '生成可拆分零件的模型（必须与 texture/pbr/quad 同时关闭）。',
    type: 'boolean',
  },
  imageFileType: {
    default: 'auto',
    description: '上传图片的文件类型，auto 将根据 URL 自动识别。',
    enum: Array.from(IMAGE_FILE_TYPE_OPTIONS),
    type: 'string',
  },
  imageToken: {
    default: '',
    description: '可选：调用上传接口返回的 image_token，用于私有图片建模。',
    type: 'string',
  },
  imageUrl: {
    default: '',
    description: '可选：待转换的图片 URL（JPEG/PNG/WebP）。',
    type: ['string', 'null'],
  },
  modelSeed: {
    default: null,
    description: '控制几何随机性的种子值。',
    max: 2_147_483_647,
    min: 0,
    type: ['number', 'null'],
  },
  negativePrompt: {
    default: '',
    description: '反向提示词，可用于排除不希望出现的内容。',
    type: 'string',
  },
  orientation: {
    default: 'default',
    description: '生成时的方向对齐方式。',
    enum: Array.from(ORIENTATION_OPTIONS),
    type: 'string',
  },
  pbr: {
    default: true,
    description: '是否生成 PBR 材质（启用后将忽略 texture 设置）。',
    type: 'boolean',
  },
  prompt: { default: '' },
  quad: {
    default: false,
    description: '是否输出四边形网格（启用后将输出 FBX 模型）。',
    type: 'boolean',
  },
  smartLowPoly: {
    default: false,
    description: '启用智能低面数重建，适合轻量化需求。',
    type: 'boolean',
  },
  style: {
    default: '',
    description: '可选的艺术风格关键字。',
    enum: Array.from(STYLE_OPTIONS),
    type: 'string',
  },
  texture: {
    default: true,
    description: '是否生成贴图。',
    type: 'boolean',
  },
  textureAlignment: {
    default: 'original_image',
    description: '贴图对齐方式。',
    enum: Array.from(TEXTURE_ALIGNMENT_OPTIONS),
    type: 'string',
  },
  textureQuality: {
    default: 'standard',
    description: '贴图质量等级。',
    enum: Array.from(TEXTURE_QUALITY_OPTIONS),
    type: 'string',
  },
  textureSeed: {
    default: null,
    description: '贴图生成的随机种子。',
    max: 2_147_483_647,
    min: 0,
    type: ['number', 'null'],
  },
};

type Tripo3DModelDefinition = {
  description: string;
  displayName: string;
  id: string;
  includeGeometryQuality?: boolean;
};

const TRIPO3D_MODEL_DEFINITIONS: Tripo3DModelDefinition[] = [
  {
    description: 'Turbo 版本：追求生成速度，适合迭代验证场景。',
    displayName: 'Tripo 3D Turbo (2025-05-06)',
    id: 'tripo3d-turbo-v1-20250506',
    includeGeometryQuality: true,
  },
  {
    description: 'v3.0 高细节模型，适合对几何与贴图质量要求较高的场景。',
    displayName: 'Tripo 3D v3.0',
    id: 'tripo3d-v3-20250812',
    includeGeometryQuality: true,
  },
  {
    description: 'v2.5 平衡质量与时长，官方推荐默认版本。',
    displayName: 'Tripo 3D v2.5',
    id: 'tripo3d-v2-5-20250123',
  },
  {
    description: 'v2.0 稳定产线版本，兼容性良好。',
    displayName: 'Tripo 3D v2.0',
    id: 'tripo3d-v2-20240919',
  },
];

export const allModels: AI3DModelCard[] = TRIPO3D_MODEL_DEFINITIONS.map((item) => ({
  description: item.description,
  displayName: item.displayName,
  enabled: true,
  id: item.id,
  parameters: {
    ...tripo3DBaseParams,
    ...(item.includeGeometryQuality ? { geometryQuality: geometryQualityParam } : {}),
  },
  type: '3d',
}));

export default allModels;
