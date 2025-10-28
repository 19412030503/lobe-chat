import { ModelParamsSchema } from '../standard-parameters';
import { AI3DModelCard } from '../types/aiModel';

const baseParams: ModelParamsSchema = {
  imageUrl: {
    default: '',
    description: '可选：参考图像的公开 URL，用于三维建模',
    type: ['string', 'null'] as const,
  },
  prompt: { default: '' },
};

const proParams: ModelParamsSchema = {
  ...baseParams,
  enablePBR: {
    default: false,
    description: '开启基于物理渲染（PBR）的材质输出，质量更高但处理耗时更长。',
    type: 'boolean',
  },
  faceCount: {
    default: 200_000,
    description: '控制生成模型的最大三角面数量，范围 40,000 - 1,500,000。',
    max: 1_500_000,
    min: 40_000,
    step: 10_000,
    type: 'number',
  },
  generateType: {
    default: 'Normal',
    description: 'Normal：默认带纹理；LowPoly：智能减面；Geometry：白模；Sketch：草图生成。',
    enum: ['Normal', 'LowPoly', 'Geometry', 'Sketch'],
    type: 'string',
  },
  multiViewImages: {
    default: [],
    description: '可选：按行输入左、右、后视角图片 URL，最多 3 张。',
    maxCount: 3,
    type: 'array',
  },
  polygonType: {
    default: 'triangle',
    description: 'LowPoly 模式下可自定义生成三角网格或四边形混合网格。',
    enum: ['triangle', 'quadrilateral'],
    type: 'string',
  },
};

const standardParams: ModelParamsSchema = {
  ...baseParams,
  enablePBR: {
    default: false,
    description: '开启 PBR 材质输出，适合需要高品质贴图的场景。',
    type: 'boolean',
  },
  multiViewImages: {
    default: [],
    description: '可选：按行输入多视角参考图 URL（建议左/右/后视图），最多 3 张。',
    maxCount: 3,
    type: 'array',
  },
  resultFormat: {
    default: 'OBJ',
    description: '选择导出的模型文件格式，默认提供 OBJ。',
    enum: ['OBJ', 'GLB', 'STL', 'USDZ', 'FBX', 'MP4'],
    type: 'string',
  },
};

const rapidParams: ModelParamsSchema = {
  ...baseParams,
  enablePBR: {
    default: false,
    description: '开启 PBR 材质输出，可能增加生成耗时。',
    type: 'boolean',
  },
  resultFormat: {
    default: 'OBJ',
    description: '选择导出的模型文件格式，默认提供 OBJ。',
    enum: ['OBJ', 'GLB', 'STL', 'USDZ', 'FBX', 'MP4'],
    type: 'string',
  },
};

const hunyuanThreeDModels: AI3DModelCard[] = [
  {
    description: '专业版：支持多视角、PBR 材质与面数控制，适合对质量有苛刻要求的建模场景。',
    displayName: 'Hunyuan 3D Pro',
    enabled: true,
    id: 'hunyuan-3d-pro',
    parameters: proParams,
    type: '3d',
  },
  {
    description: '标准版：平衡画质与耗时，支持提示词或单/多视角图片生成通用 3D 模型。',
    displayName: 'Hunyuan 3D Standard',
    enabled: true,
    id: 'hunyuan-3d-standard',
    parameters: standardParams,
    type: '3d',
  },
  {
    description: '快速版：追求最低延迟，支持提示词或单图输入（建议 200 字以内），不支持多视角。',
    displayName: 'Hunyuan 3D Rapid',
    enabled: true,
    id: 'hunyuan-3d-rapid',
    parameters: rapidParams,
    type: '3d',
  },
];

export const allModels = [...hunyuanThreeDModels];

export default allModels;
