/* eslint-disable sort-keys-fix/sort-keys-fix  */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { idGenerator } from '../utils/idGenerator';
import { timestamps } from './_helpers';
import { organizations } from './organization';
import { users } from './user';

/**
 * 课程分类表
 * 用于组织和分类课程内容
 */
export const courseCategories = pgTable(
  'course_categories',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('courseCategories'))
      .primaryKey(),

    name: text('name').notNull(),
    description: text('description'),

    // 排序权重，用于控制显示顺序
    sortOrder: integer('sort_order').default(0),

    // 创建者ID
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // 组织ID，用于组织级别的权限控制
    // 如果为 null，则表示该分类是超管创建的全局分类
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    // 是否公开（超管创建的分类默认公开）
    isPublic: boolean('is_public').default(false),

    clientId: text('client_id'),
    metadata: jsonb('metadata'),

    ...timestamps,
  },
  (t) => ({
    clientIdUnique: uniqueIndex('course_categories_client_id_user_id_unique').on(
      t.clientId,
      t.userId,
    ),
    organizationIdx: index('course_categories_organization_idx').on(t.organizationId),
  }),
);

export const insertCourseCategoriesSchema = createInsertSchema(courseCategories);

export type NewCourseCategory = typeof courseCategories.$inferInsert;
export type CourseCategoryItem = typeof courseCategories.$inferSelect;

/**
 * 课程文件表
 * 存储上传的课程资料文件
 */
export const courseFiles = pgTable(
  'course_files',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('courseFiles'))
      .primaryKey(),

    // 文件基本信息
    name: text('name').notNull(),
    fileType: varchar('file_type', { length: 255 }).notNull(),
    size: integer('size').notNull(),
    url: text('url').notNull(),

    // 所属分类
    categoryId: text('category_id')
      .references(() => courseCategories.id, { onDelete: 'cascade' })
      .notNull(),

    // 上传者信息
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // 组织ID，继承自分类或上传者
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    // 是否公开（超管上传的文件默认公开）
    isPublic: boolean('is_public').default(false),

    // 文件描述和备注
    description: text('description'),

    // 下载次数统计
    downloadCount: integer('download_count').default(0),

    clientId: text('client_id'),
    metadata: jsonb('metadata'),

    ...timestamps,
  },
  (t) => ({
    categoryIdx: index('course_files_category_idx').on(t.categoryId),
    organizationIdx: index('course_files_organization_idx').on(t.organizationId),
    clientIdUnique: uniqueIndex('course_files_client_id_user_id_unique').on(t.clientId, t.userId),
  }),
);

export const insertCourseFilesSchema = createInsertSchema(courseFiles);

export type NewCourseFile = typeof courseFiles.$inferInsert;
export type CourseFileItem = typeof courseFiles.$inferSelect;
