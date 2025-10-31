import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { StateCreator } from 'zustand/vanilla';

import { message } from '@/components/AntdStaticMethods';
import type { CourseCategoryItem, CourseFileItem } from '@/database/schemas';
import { lambdaClient } from '@/libs/trpc/client';

// ==================== 类型定义 ====================

export interface CourseState {
  // 分类状态
  categories: CourseCategoryItem[];
  currentCategoryId: string | null;

  // 文件状态
  files: CourseFileItem[];
  isLoadingCategories: boolean;
  isLoadingFiles: boolean;
}

export interface CourseAction {
  // 分类操作
  createCategory: (name: string, description?: string) => Promise<void>;
  // 文件操作
  createFile: (file: {
    categoryId: string;
    description?: string;
    fileType: string;
    name: string;
    size: number;
    url: string;
  }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  deleteFiles: (ids: string[]) => Promise<void>;

  loadCategories: () => Promise<void>;
  loadFiles: (categoryId?: string) => Promise<void>;
  setCurrentCategory: (categoryId: string | null) => void;
  updateCategory: (id: string, name: string, description?: string) => Promise<void>;
}

export type CourseStore = CourseState & CourseAction;

// ==================== 初始状态 ====================

const initialState: CourseState = {
  categories: [],
  currentCategoryId: null,
  files: [],
  isLoadingCategories: false,
  isLoadingFiles: false,
};

// ==================== Store 实现 ====================

const createStore: StateCreator<CourseStore, [['zustand/devtools', never]]> = (set, get) => ({
  ...initialState,

  createCategory: async (name, description) => {
    try {
      const category = await lambdaClient.course.createCategory.mutate({ description, name });
      set({ categories: [...get().categories, category] });
      message.success('创建分类成功');
    } catch (error) {
      console.error('Failed to create category:', error);
      message.error('创建分类失败');
      throw error;
    }
  },

  createFile: async (file) => {
    try {
      const newFile = await lambdaClient.course.createFile.mutate(file);
      set({ files: [...get().files, newFile] });
      message.success('上传文件成功');
    } catch (error) {
      console.error('Failed to create file:', error);
      message.error('上传文件失败');
      throw error;
    }
  },

  deleteCategory: async (id) => {
    try {
      await lambdaClient.course.deleteCategory.mutate({ id });
      set({ categories: get().categories.filter((cat) => cat.id !== id) });
      message.success('删除分类成功');
    } catch (error) {
      console.error('Failed to delete category:', error);
      message.error('删除分类失败');
      throw error;
    }
  },

  deleteFile: async (id) => {
    try {
      await lambdaClient.course.deleteFile.mutate({ id });
      set({ files: get().files.filter((file) => file.id !== id) });
      message.success('删除文件成功');
    } catch (error) {
      console.error('Failed to delete file:', error);
      message.error('删除文件失败');
      throw error;
    }
  },

  deleteFiles: async (ids) => {
    try {
      await lambdaClient.course.deleteFiles.mutate({ ids });
      set({ files: get().files.filter((file) => !ids.includes(file.id)) });
      message.success(`成功删除 ${ids.length} 个文件`);
    } catch (error) {
      console.error('Failed to delete files:', error);
      message.error('批量删除文件失败');
      throw error;
    }
  },

  // 分类操作
  loadCategories: async () => {
    set({ isLoadingCategories: true });
    try {
      const categories = await lambdaClient.course.getCategories.query();
      set({ categories });
    } catch (error) {
      console.error('Failed to load categories:', error);
      message.error('加载分类失败');
    } finally {
      set({ isLoadingCategories: false });
    }
  },

  // 文件操作
  loadFiles: async (categoryId) => {
    set({ isLoadingFiles: true });
    try {
      const files = await lambdaClient.course.getFiles.query({ categoryId });
      set({ files });
    } catch (error) {
      console.error('Failed to load files:', error);
      message.error('加载文件失败');
    } finally {
      set({ isLoadingFiles: false });
    }
  },

  setCurrentCategory: (categoryId) => {
    set({ currentCategoryId: categoryId });
    get().loadFiles(categoryId || undefined);
  },

  updateCategory: async (id, name, description) => {
    try {
      await lambdaClient.course.updateCategory.mutate({ description, id, name });
      const categories = get().categories.map((cat) =>
        cat.id === id
          ? { ...cat, description: description ?? null, name, updatedAt: new Date() }
          : cat,
      ) as CourseCategoryItem[];
      set({ categories });
      message.success('更新分类成功');
    } catch (error) {
      console.error('Failed to update category:', error);
      message.error('更新分类失败');
      throw error;
    }
  },
});

// ==================== Store 导出 ====================

export const useCourseStore = createWithEqualityFn<CourseStore>()(
  devtools(createStore, { name: 'CourseStore' }),
  shallow,
);
