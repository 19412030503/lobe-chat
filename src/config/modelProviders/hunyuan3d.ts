import { ModelProviderCard } from '@/types/llm';

const Hunyuan3D: ModelProviderCard = {
  chatModels: [],
  description: '腾讯云混元 3D 建模接口，支持根据提示或参考图像生成可下载的三维模型资产。',
  enabled: true,
  id: 'hunyuan3d',
  name: 'Hunyuan 3D',
  settings: {
    disableBrowserRequest: true,
    modelEditable: false,
    proxyUrl: {
      desc: 'Use the default Tencent Cloud endpoint or provide a custom HTTPS endpoint if required',
      placeholder: 'https://ai3d.tencentcloudapi.com',
      // title: 'API Endpoint',
    },
    sdkType: 'openai',
    showApiKey: true,
    showChecker: true,
  },
  showConfig: true,
  url: 'https://cloud.tencent.com/document/product/1804/123447',
};

export default Hunyuan3D;
