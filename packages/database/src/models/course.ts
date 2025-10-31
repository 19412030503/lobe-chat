import { and, asc, desc, eq, ilike, inArray, or } from 'drizzle-orm';

import {
  CourseCategoryItem,
  CourseFileItem,
  NewCourseCategory,
  NewCourseFile,
  courseCategories,
  courseFiles,
} from '../schemas';
import { LobeChatDatabase, Transaction } from '../type';

/**
 * 课程模型类
 * 提供课程分类和课程文件的 CRUD 操作
 *
 * 权限规则：
 * - 超管（无 organizationId）创建的内容所有人可见
 * - 组织管理员创建的内容仅本组织成员可见
 */
export class CourseModel {
  private readonly userId: string;
  private readonly organizationId?: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string, organizationId?: string) {
    this.userId = userId;
    this.organizationId = organizationId;
    this.db = db;
  }

  // ==================== 分类管理 ====================

  /**
   * 创建课程分类
   */
  createCategory = async (
    params: Omit<NewCourseCategory, 'id' | 'userId' | 'organizationId'>,
    trx?: Transaction,
  ) => {
    const db = trx || this.db;

    const result = await db
      .insert(courseCategories)
      .values({
        ...params,
        // 超管创建的分类默认公开
        isPublic: !this.organizationId,

        organizationId: this.organizationId,

        userId: this.userId,
      })
      .returning();

    return result[0];
  };

  /**
   * 获取分类列表
   * 返回当前用户可见的所有分类
   */
  findCategories = async () => {
    const conditions = [
      // 公开的分类（超管创建）
      and(eq(courseCategories.isPublic, true)),
    ];

    // 如果用户属于某个组织，也能看到该组织的分类
    if (this.organizationId) {
      conditions.push(eq(courseCategories.organizationId, this.organizationId));
    }

    return this.db.query.courseCategories.findMany({
      orderBy: [asc(courseCategories.sortOrder), desc(courseCategories.createdAt)],
      where: or(...conditions),
    });
  };

  /**
   * 根据 ID 查找分类
   */
  findCategoryById = async (id: string, trx?: Transaction) => {
    const db = trx || this.db;

    return db.query.courseCategories.findFirst({
      where: eq(courseCategories.id, id),
    });
  };

  /**
   * 更新分类
   */
  updateCategory = async (id: string, value: Partial<CourseCategoryItem>) => {
    const category = await this.findCategoryById(id);

    if (!category) {
      throw new Error('Category not found');
    }

    // 权限检查：只能更新自己创建的分类
    if (category.userId !== this.userId) {
      throw new Error('Permission denied');
    }

    return this.db
      .update(courseCategories)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(courseCategories.id, id))
      .returning();
  };

  /**
   * 删除分类（级联删除关联的文件）
   */
  deleteCategory = async (id: string) => {
    const category = await this.findCategoryById(id);

    if (!category) {
      throw new Error('Category not found');
    }

    // 权限检查：只能删除自己创建的分类
    if (category.userId !== this.userId) {
      throw new Error('Permission denied');
    }

    return this.db.transaction(async (trx) => {
      // 先删除该分类下的所有文件
      await trx.delete(courseFiles).where(eq(courseFiles.categoryId, id));

      // 删除分类
      await trx.delete(courseCategories).where(eq(courseCategories.id, id));
    });
  };

  // ==================== 文件管理 ====================

  /**
   * 创建课程文件
   */
  createFile = async (
    params: Omit<NewCourseFile, 'id' | 'userId' | 'organizationId'>,
    trx?: Transaction,
  ) => {
    const db = trx || this.db;

    // 验证分类是否存在且有权限
    const category = await this.findCategoryById(params.categoryId, trx);
    if (!category) {
      throw new Error('Category not found');
    }

    const result = await db
      .insert(courseFiles)
      .values({
        ...params,
        // 超管上传的文件默认公开
        isPublic: !this.organizationId,

        organizationId: this.organizationId,

        userId: this.userId,
      })
      .returning();

    return result[0];
  };

  /**
   * 获取文件列表
   * @param categoryId 分类ID，可选
   */
  findFiles = async (categoryId?: string) => {
    const conditions = [
      // 公开的文件（超管上传）
      and(eq(courseFiles.isPublic, true)),
    ];

    // 如果用户属于某个组织，也能看到该组织的文件
    if (this.organizationId) {
      conditions.push(eq(courseFiles.organizationId, this.organizationId));
    }

    const whereCondition = categoryId
      ? and(eq(courseFiles.categoryId, categoryId), or(...conditions))
      : or(...conditions);

    return this.db.query.courseFiles.findMany({
      orderBy: [desc(courseFiles.createdAt)],
      where: whereCondition,
    });
  };

  /**
   * 根据 ID 查找文件
   */
  findFileById = async (id: string, trx?: Transaction) => {
    const db = trx || this.db;

    return db.query.courseFiles.findFirst({
      where: eq(courseFiles.id, id),
    });
  };

  /**
   * 搜索文件
   */
  searchFiles = async (keyword: string, categoryId?: string) => {
    const conditions = [
      // 公开的文件（超管上传）
      and(eq(courseFiles.isPublic, true)),
    ];

    // 如果用户属于某个组织，也能看到该组织的文件
    if (this.organizationId) {
      conditions.push(eq(courseFiles.organizationId, this.organizationId));
    }

    const searchCondition = or(
      ilike(courseFiles.name, `%${keyword}%`),
      ilike(courseFiles.description, `%${keyword}%`),
    );

    const baseCondition = or(...conditions);

    const whereCondition = categoryId
      ? and(eq(courseFiles.categoryId, categoryId), baseCondition, searchCondition)
      : and(baseCondition, searchCondition);

    return this.db.query.courseFiles.findMany({
      orderBy: [desc(courseFiles.createdAt)],
      where: whereCondition,
    });
  };

  /**
   * 更新文件
   */
  updateFile = async (id: string, value: Partial<CourseFileItem>) => {
    const file = await this.findFileById(id);

    if (!file) {
      throw new Error('File not found');
    }

    // 权限检查：只能更新自己上传的文件
    if (file.userId !== this.userId) {
      throw new Error('Permission denied');
    }

    return this.db
      .update(courseFiles)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(courseFiles.id, id))
      .returning();
  };

  /**
   * 删除文件
   */
  deleteFile = async (id: string) => {
    const file = await this.findFileById(id);

    if (!file) {
      throw new Error('File not found');
    }

    // 权限检查：只能删除自己上传的文件
    if (file.userId !== this.userId) {
      throw new Error('Permission denied');
    }

    return this.db.delete(courseFiles).where(eq(courseFiles.id, id));
  };

  /**
   * 批量删除文件
   */
  deleteFiles = async (ids: string[]) => {
    if (ids.length === 0) return;

    // 查询所有文件，验证权限
    const files = await this.db.query.courseFiles.findMany({
      where: and(inArray(courseFiles.id, ids), eq(courseFiles.userId, this.userId)),
    });

    if (files.length === 0) return;

    const validIds = files.map((f) => f.id);

    return this.db.delete(courseFiles).where(inArray(courseFiles.id, validIds));
  };

  /**
   * 增加下载计数
   */
  incrementDownloadCount = async (id: string) => {
    const file = await this.findFileById(id);

    if (!file) {
      throw new Error('File not found');
    }

    return this.db
      .update(courseFiles)
      .set({
        downloadCount: (file.downloadCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(courseFiles.id, id));
  };
}
