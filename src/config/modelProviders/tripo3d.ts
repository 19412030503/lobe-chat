import { ModelProviderCard } from '@/types/llm';

const Tripo3D: ModelProviderCard = {
  chatModels: [],
  description: 'Tripo3D 官方三维生成接口，支持文本或图像生成模型，并提供贴图与多边形控制能力。',
  enabled: true,
  id: 'tripo3d',
  name: 'Tripo 3D',
  settings: {
    disableBrowserRequest: true,
    modelEditable: false,
    proxyUrl: {
      desc: '可选：覆盖默认 API Endpoint，需使用 https 协议',
      placeholder: 'https://api.tripo3d.ai/v2/openapi',
    },
    sdkType: 'openai',
    showApiKey: true,
    showChecker: true,
  },
  showConfig: true,
  url: 'https://api.tripo3d.ai',
};

export default Tripo3D;
