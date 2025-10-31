import { LobeChatDatabase } from '@lobechat/database';

import { CourseModel } from '@/database/models/course';
import {
  CourseCategoryItem,
  CourseFileItem,
  NewCourseCategory,
  NewCourseFile,
} from '@/database/schemas';

/**
 * 课程服务类
 * 提供课程分类和课程文件的业务逻辑
 *
 * 权限规则：
 * - 超管（无 organizationId）创建的内容所有人可见
 * - 组织管理员创建的内容仅本组织成员可见
 */
export class CourseService {
  private courseModel: CourseModel;

  constructor(db: LobeChatDatabase, userId: string, organizationId?: string) {
    this.courseModel = new CourseModel(db, userId, organizationId);
  }

  // ==================== 分类管理 ====================

  /**
   * 创建课程分类
   */
  async createCategory(
    params: Omit<NewCourseCategory, 'id' | 'userId' | 'organizationId'>,
  ): Promise<CourseCategoryItem> {
    return this.courseModel.createCategory(params);
  }

  /**
   * 获取分类列表
   */
  async getCategories(): Promise<CourseCategoryItem[]> {
    return this.courseModel.findCategories();
  }

  /**
   * 根据 ID 获取分类
   */
  async getCategoryById(id: string): Promise<CourseCategoryItem | undefined> {
    return this.courseModel.findCategoryById(id);
  }

  /**
   * 更新分类
   */
  async updateCategory(
    id: string,
    value: Partial<CourseCategoryItem>,
  ): Promise<CourseCategoryItem[]> {
    return this.courseModel.updateCategory(id, value);
  }

  /**
   * 删除分类
   */
  async deleteCategory(id: string): Promise<void> {
    return this.courseModel.deleteCategory(id);
  }

  // ==================== 文件管理 ====================

  /**
   * 创建课程文件
   */
  async createFile(
    params: Omit<NewCourseFile, 'id' | 'userId' | 'organizationId'>,
  ): Promise<CourseFileItem> {
    return this.courseModel.createFile(params);
  }

  /**
   * 获取文件列表
   */
  async getFiles(categoryId?: string): Promise<CourseFileItem[]> {
    return this.courseModel.findFiles(categoryId);
  }

  /**
   * 根据 ID 获取文件
   */
  async getFileById(id: string): Promise<CourseFileItem | undefined> {
    return this.courseModel.findFileById(id);
  }

  /**
   * 搜索文件
   */
  async searchFiles(keyword: string, categoryId?: string): Promise<CourseFileItem[]> {
    return this.courseModel.searchFiles(keyword, categoryId);
  }

  /**
   * 更新文件
   */
  async updateFile(id: string, value: Partial<CourseFileItem>): Promise<CourseFileItem[]> {
    return this.courseModel.updateFile(id, value);
  }

  /**
   * 删除文件
   */
  async deleteFile(id: string): Promise<void> {
    await this.courseModel.deleteFile(id);
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(ids: string[]): Promise<void> {
    await this.courseModel.deleteFiles(ids);
  }

  /**
   * 增加下载计数
   */
  async incrementDownloadCount(id: string): Promise<void> {
    await this.courseModel.incrementDownloadCount(id);
  }
}
