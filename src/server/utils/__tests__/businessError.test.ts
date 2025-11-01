import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';

import {
  BusinessErrorType,
  createBusinessError,
  createInternalError,
  createNotFoundError,
  createPermissionError,
} from '../businessError';

describe('businessError', () => {
  describe('createBusinessError', () => {
    it('should create a TRPCError with BAD_REQUEST code and default message', () => {
      const error = createBusinessError(BusinessErrorType.USER_ALREADY_EXISTS);

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('用户已存在');
    });

    it('should create a TRPCError with custom message', () => {
      const customMessage = '组织已达到最大用户数量限制（50人）';
      const error = createBusinessError(
        BusinessErrorType.ORGANIZATION_MAX_USERS_REACHED,
        customMessage,
      );

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe(customMessage);
    });

    it('should handle all business error types', () => {
      const errorTypes = [
        BusinessErrorType.USER_ALREADY_EXISTS,
        BusinessErrorType.USERNAME_ALREADY_EXISTS,
        BusinessErrorType.EMAIL_ALREADY_EXISTS,
        BusinessErrorType.ORGANIZATION_NOT_FOUND,
        BusinessErrorType.ORGANIZATION_HAS_USERS,
        BusinessErrorType.INSUFFICIENT_PERMISSIONS,
      ];

      errorTypes.forEach((type) => {
        const error = createBusinessError(type);
        expect(error).toBeInstanceOf(TRPCError);
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.message).toBeTruthy();
      });
    });
  });

  describe('createPermissionError', () => {
    it('should create a TRPCError with FORBIDDEN code and default message', () => {
      const error = createPermissionError();

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('权限不足');
    });

    it('should create a TRPCError with custom message', () => {
      const customMessage = '无权访问此资源';
      const error = createPermissionError(customMessage);

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe(customMessage);
    });
  });

  describe('createNotFoundError', () => {
    it('should create a TRPCError with NOT_FOUND code', () => {
      const error = createNotFoundError('用户');

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('用户不存在');
    });

    it('should support different resource names', () => {
      const resources = ['用户', '组织', '文件', '角色'];

      resources.forEach((resource) => {
        const error = createNotFoundError(resource);
        expect(error).toBeInstanceOf(TRPCError);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe(`${resource}不存在`);
      });
    });
  });

  describe('createInternalError', () => {
    it('should create a TRPCError with INTERNAL_SERVER_ERROR code and default message', () => {
      const error = createInternalError();

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toBe('操作失败，请稍后重试');
    });

    it('should create a TRPCError with custom message', () => {
      const customMessage = '数据库连接失败';
      const error = createInternalError(customMessage);

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toBe(customMessage);
    });
  });

  describe('error message consistency', () => {
    it('should have user-friendly Chinese messages', () => {
      const errors = [
        createBusinessError(BusinessErrorType.USER_ALREADY_EXISTS),
        createBusinessError(BusinessErrorType.USERNAME_ALREADY_EXISTS),
        createBusinessError(BusinessErrorType.EMAIL_ALREADY_EXISTS),
        createBusinessError(BusinessErrorType.ORGANIZATION_NOT_FOUND),
        createBusinessError(BusinessErrorType.ORGANIZATION_HAS_USERS),
        createBusinessError(BusinessErrorType.ORGANIZATION_MANAGEMENT_UNDELETABLE),
        createBusinessError(BusinessErrorType.ADMIN_MUST_BELONG_TO_ORGANIZATION),
        createBusinessError(BusinessErrorType.CANNOT_MANAGE_USER),
        createBusinessError(BusinessErrorType.ONLY_STUDENTS_CAN_BE_MANAGED),
      ];

      errors.forEach((error) => {
        expect(error.message).toMatch(/[\u4E00-\u9FA5]/); // Contains Chinese characters
        expect(error.message.length).toBeGreaterThan(0);
      });
    });

    it('should not contain technical jargon in messages', () => {
      const technicalTerms = ['throw', 'error', 'exception', 'failed', 'null', 'undefined'];

      const errors = [
        createBusinessError(BusinessErrorType.USER_ALREADY_EXISTS),
        createBusinessError(BusinessErrorType.ORGANIZATION_HAS_USERS),
        createPermissionError(),
        createNotFoundError('用户'),
      ];

      errors.forEach((error) => {
        technicalTerms.forEach((term) => {
          expect(error.message.toLowerCase()).not.toContain(term);
        });
      });
    });
  });
});
