export default {
  // 操作提示
  action: {
    createSuccess: '创建成功',
    deleteSuccess: '删除成功',
    operationFailed: '操作失败',
    updateSuccess: '更新成功',
  },

  // 分类相关
  category: {
    add: '添加分类',
    all: '全部分类',
    create: '创建分类',
    delete: '删除分类',
    deleteConfirm: '确定要删除此分类吗？分类下的所有文件也将被删除。',
    description: '分类描述',
    descriptionPlaceholder: '请输入分类描述（可选）',
    edit: '编辑分类',
    empty: '暂无分类',
    name: '分类名称',
    namePlaceholder: '请输入分类名称',
  },

  // 文件相关
  file: {
    add: '添加文件',
    delete: '删除文件',
    deleteConfirm: '确定要删除此文件吗？',
    deleteMultipleConfirm: '确定要删除选中的 {{count}} 个文件吗？',
    download: '下载',
    downloadCount: '下载次数',
    empty: '暂无文件',
    name: '文件名称',
    search: '搜索文件',
    searchPlaceholder: '请输入文件名或描述',
    selectCategoryFirst: '请先选择分类',
    size: '文件大小',
    type: '文件类型',
    upload: '上传文件',
    uploadFailed: '文件上传失败',
    uploadSuccess: '文件上传成功',
    uploadTime: '上传时间',
    uploader: '上传者',
  },

  // 权限提示
  permission: {
    orgAdmin: '您是组织管理员，上传的内容仅本组织成员可见',
    superAdmin: '您是超级管理员，上传的内容所有人可见',
    user: '您只能查看公开内容和本组织内容',
  },

  // 页面标题
  title: '课程中心',
} as const;
