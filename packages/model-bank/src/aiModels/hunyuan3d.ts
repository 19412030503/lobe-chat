import { ModelParamsSchema } from '../standard-parameters';
import { AI3DModelCard } from '../types/aiModel';

const hunyuanThreeDParams: ModelParamsSchema = {
  imageUrl: {
    default: '',
    description: '可选：参考图像的公开 URL，用于三维建模',
    type: ['string', 'null'] as const,
  },
  prompt: { default: '' },
};

const hunyuanThreeDModels: AI3DModelCard[] = [
  {
    description: '腾讯混元提供的高保真 3D 建模能力，支持将参考图像快速生成可下载的 3D 资产。',
    displayName: 'Hunyuan 3D Pro',
    enabled: true,
    id: 'hunyuan-3d-pro',
    parameters: hunyuanThreeDParams,
    type: '3d',
  },
];

export const allModels = [...hunyuanThreeDModels];

export default allModels;
