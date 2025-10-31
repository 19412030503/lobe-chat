import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { CourseService } from '@/server/services/course';

const courseProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  // 获取用户的组织ID（需要从用户信息中获取）
  const user = await ctx.serverDB.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, ctx.userId),
  });

  return opts.next({
    ctx: {
      courseService: new CourseService(ctx.serverDB, ctx.userId, user?.organizationId || undefined),
    },
  });
});

export const courseRouter = router({
  // ==================== 分类管理 ====================

  /**
   * 创建课程分类
   */
  createCategory: courseProcedure
    .input(
      z.object({
        clientId: z.string().optional(),
        description: z.string().optional(),
        metadata: z.any().optional(),
        name: z.string().min(1, '分类名称不能为空'),
        sortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.courseService.createCategory(input);
    }),

  // ==================== 文件管理 ====================
  /**
   * 创建课程文件
   */
  createFile: courseProcedure
    .input(
      z.object({
        categoryId: z.string(),
        clientId: z.string().optional(),
        description: z.string().optional(),
        fileType: z.string(),
        metadata: z.any().optional(),
        name: z.string().min(1, '文件名不能为空'),
        size: z.number(),
        url: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.courseService.createFile(input);
    }),

  /**
   * 删除分类
   */
  deleteCategory: courseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.courseService.deleteCategory(input.id);
    }),

  /**
   * 删除文件
   */
  deleteFile: courseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.courseService.deleteFile(input.id);
    }),

  /**
   * 批量删除文件
   */
  deleteFiles: courseProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.courseService.deleteFiles(input.ids);
    }),

  /**
   * 获取分类列表
   */
  getCategories: courseProcedure.query(async ({ ctx }) => {
    return ctx.courseService.getCategories();
  }),

  /**
   * 根据 ID 获取分类
   */
  getCategoryById: courseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.courseService.getCategoryById(input.id);
      if (!category) {
        throw new Error('Category not found');
      }
      return category;
    }),

  /**
   * 根据 ID 获取文件
   */
  getFileById: courseProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const file = await ctx.courseService.getFileById(input.id);
    if (!file) {
      throw new Error('File not found');
    }
    return file;
  }),

  /**
   * 获取文件列表
   */
  getFiles: courseProcedure
    .input(
      z
        .object({
          categoryId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.courseService.getFiles(input?.categoryId);
    }),

  /**
   * 增加下载计数
   */
  incrementDownloadCount: courseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.courseService.incrementDownloadCount(input.id);
    }),

  /**
   * 搜索文件
   */
  searchFiles: courseProcedure
    .input(
      z.object({
        categoryId: z.string().optional(),
        keyword: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.courseService.searchFiles(input.keyword, input.categoryId);
    }),

  /**
   * 更新分类
   */
  updateCategory: courseProcedure
    .input(
      z.object({
        description: z.string().optional(),
        id: z.string(),
        name: z.string().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.courseService.updateCategory(id, data);
      return result[0];
    }),

  /**
   * 更新文件
   */
  updateFile: courseProcedure
    .input(
      z.object({
        description: z.string().optional(),
        id: z.string(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.courseService.updateFile(id, data);
      return result[0];
    }),
});
