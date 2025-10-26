import { AsyncTaskError, AsyncTaskStatus } from '../asyncTask';

export interface ImageGenerationTopic {
  coverUrl?: string | null;
  createdAt: Date;
  id: string;
  title?: string | null;
  updatedAt: Date;
}

export interface BaseGenerationAsset {
  type: string;
}

export interface ImageGenerationAsset extends BaseGenerationAsset {
  /**
   * 图片/视频的高度
   */
  height?: number;
  /**
   * api provider 家的 cdn url，一般很快就会失效
   */
  originalUrl?: string;
  /**
   * 缩略图，图片那就是尺寸裁剪过的，视频那就是封面的缩略图
   */
  thumbnailUrl?: string;
  /**
   * 存到自己 oss 的 url, 只存了 key， 完整的 url 需要使用 FileService.getFullFileUrl 获取
   */
  url?: string;
  /**
   * 图片/视频的宽度
   */
  width?: number;
}

export interface ThreeDGenerationAsset extends BaseGenerationAsset {
  /**
   * 3D 资产格式，如 glb/obj/fbx
   */
  format?: string;
  /**
   * 兼容图片逻辑所需的高度
   */
  height?: number;
  /**
   * 完整的模型文件地址或存储 key
   */
  modelUrl?: string;
  /**
   * 预览缩略图地址，若与 previewUrl 不同可单独存储
   */
  previewThumbnailUrl?: string;
  /**
   * 预览资源地址（可为图片、GIF 或视频）
   */
  previewUrl?: string;
  /**
   * 兼容图片逻辑所需的缩略图 URL
   */
  thumbnailUrl?: string;
  /**
   * 兼容图片逻辑所需的资源 URL
   */
  url?: string;
  /**
   * 兼容图片逻辑所需的宽度
   */
  width?: number;
}

export type GenerationAsset = ImageGenerationAsset | ThreeDGenerationAsset;

export interface GenerationConfig {
  aspectRatio?: string;
  cfg?: number;
  height?: number;
  imageUrl?: string | null;
  imageUrls?: string[];
  prompt: string;
  size?: string;
  steps?: number;
  width?: number;
}

export interface GenerationAsyncTask {
  error?: AsyncTaskError;
  id: string;
  status: AsyncTaskStatus;
}

export interface Generation {
  /**
   * The asset associated with the generation, containing image URLs and dimensions.
   */
  asset?: GenerationAsset | null;
  asyncTaskId: string | null;
  createdAt: Date;
  id: string;
  seed?: number | null;

  task: GenerationAsyncTask;
}

export interface GenerationBatch {
  config?: GenerationConfig;
  createdAt: Date;
  generations: Generation[];
  height?: number | null;
  id: string;
  model: string;
  prompt: string;
  provider: string;
  width?: number | null;
}
