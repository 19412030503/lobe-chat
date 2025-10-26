const model = {
  workspace: {
    config: {
      count: '生成数量',
      generate: '开始生成',
      model: '模型',
      modelPlaceholder: '选择模型',
      prompt: '提示词',
      promptPlaceholder: '描述你想要的 3D 资产',
      provider: '模型提供商',
      providerPlaceholder: '选择提供商',
      title: '建模参数',
    },
    result: {
      assetInfo: '模型：{{model}} · 服务商：{{provider}}',
      empty: '暂无生成记录',
      loading: '加载中...',
      submitFail: '建模任务提交失败',
      submitSuccess: '建模任务已提交',
      title: '生成记录',
      viewModel: '查看模型文件',
      viewPreview: '预览',
    },
    topic: {
      create: '新建',
      createFail: '创建主题失败，请稍后重试',
      createdSuccess: '已创建新的建模主题',
      empty: '暂无建模主题',
      title: '建模主题',
      untitled: '未命名主题',
      updatedAt: '更新于 {{value}}',
    },
  },
} as const;

export default model;
