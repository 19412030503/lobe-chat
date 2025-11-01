import { TRPCError } from '@trpc/server';

/**
 * 业务错误类型
 * 用于标识不同的业务场景错误
 */
export enum BusinessErrorType {
  ADMIN_MUST_BELONG_TO_ORGANIZATION = 'ADMIN_MUST_BELONG_TO_ORGANIZATION',
  CANNOT_MANAGE_OTHER_ORGANIZATIONS = 'CANNOT_MANAGE_OTHER_ORGANIZATIONS',
  CANNOT_MANAGE_USER = 'CANNOT_MANAGE_USER',
  CANNOT_MODIFY_OTHER_ORGANIZATIONS_QUOTA = 'CANNOT_MODIFY_OTHER_ORGANIZATIONS_QUOTA',
  CANNOT_MOVE_STUDENTS_OUTSIDE_ORGANIZATION = 'CANNOT_MOVE_STUDENTS_OUTSIDE_ORGANIZATION',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  MANAGEMENT_ORGANIZATION_ALREADY_EXISTS = 'MANAGEMENT_ORGANIZATION_ALREADY_EXISTS',
  ONLY_ROOT_CAN_ASSIGN_ROOT_ROLE = 'ONLY_ROOT_CAN_ASSIGN_ROOT_ROLE',
  ONLY_STUDENTS_CAN_BE_MANAGED = 'ONLY_STUDENTS_CAN_BE_MANAGED',
  ORGANIZATION_HAS_USERS = 'ORGANIZATION_HAS_USERS',
  ORGANIZATION_MANAGEMENT_UNDELETABLE = 'ORGANIZATION_MANAGEMENT_UNDELETABLE',
  ORGANIZATION_MAX_USERS_REACHED = 'ORGANIZATION_MAX_USERS_REACHED',
  ORGANIZATION_NAME_REQUIRED = 'ORGANIZATION_NAME_REQUIRED',
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  ORGANIZATION_TYPE_IMMUTABLE = 'ORGANIZATION_TYPE_IMMUTABLE',
  ORGANIZATION_TYPE_UNSUPPORTED = 'ORGANIZATION_TYPE_UNSUPPORTED',
  QUOTA_LIMIT_EXCEEDED = 'QUOTA_LIMIT_EXCEEDED',
  SCHOOL_ADMIN_CAN_ONLY_ASSIGN_STUDENT_ROLE = 'SCHOOL_ADMIN_CAN_ONLY_ASSIGN_STUDENT_ROLE',
  USERNAME_ALREADY_EXISTS = 'USERNAME_ALREADY_EXISTS',
  USERNAME_EXISTS_IN_AUTH_SYSTEM = 'USERNAME_EXISTS_IN_AUTH_SYSTEM',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_NOT_IN_ORGANIZATION = 'USER_NOT_IN_ORGANIZATION',
}

/**
 * 业务错误消息映射表
 */
const businessErrorMessages: Record<BusinessErrorType, string> = {
  [BusinessErrorType.ADMIN_MUST_BELONG_TO_ORGANIZATION]: '管理员必须属于某个组织',
  [BusinessErrorType.CANNOT_MANAGE_OTHER_ORGANIZATIONS]: '无权管理其他组织',
  [BusinessErrorType.CANNOT_MANAGE_USER]: '无权管理该用户',
  [BusinessErrorType.CANNOT_MODIFY_OTHER_ORGANIZATIONS_QUOTA]: '无权修改其他组织的额度',
  [BusinessErrorType.CANNOT_MOVE_STUDENTS_OUTSIDE_ORGANIZATION]: '不能将学生移动到本组织之外',
  [BusinessErrorType.EMAIL_ALREADY_EXISTS]: '邮箱已存在',
  [BusinessErrorType.INSUFFICIENT_BALANCE]: '余额不足',
  [BusinessErrorType.INSUFFICIENT_PERMISSIONS]: '权限不足',
  [BusinessErrorType.MANAGEMENT_ORGANIZATION_ALREADY_EXISTS]: '管理组织已存在',
  [BusinessErrorType.ONLY_ROOT_CAN_ASSIGN_ROOT_ROLE]: '只有超级管理员可以分配超级管理员角色',
  [BusinessErrorType.ONLY_STUDENTS_CAN_BE_MANAGED]: '只能管理学生用户',
  [BusinessErrorType.ORGANIZATION_HAS_USERS]: '组织内还有用户，无法删除',
  [BusinessErrorType.ORGANIZATION_MANAGEMENT_UNDELETABLE]: '管理组织不能删除',
  [BusinessErrorType.ORGANIZATION_MAX_USERS_REACHED]: '组织已达到最大用户数量限制',
  [BusinessErrorType.ORGANIZATION_NAME_REQUIRED]: '组织名称不能为空',
  [BusinessErrorType.ORGANIZATION_NOT_FOUND]: '组织不存在',
  [BusinessErrorType.ORGANIZATION_TYPE_IMMUTABLE]: '管理组织类型不能修改',
  [BusinessErrorType.ORGANIZATION_TYPE_UNSUPPORTED]: '不支持的组织类型',
  [BusinessErrorType.QUOTA_LIMIT_EXCEEDED]: '额度已超出限制',
  [BusinessErrorType.SCHOOL_ADMIN_CAN_ONLY_ASSIGN_STUDENT_ROLE]: '学校管理员只能分配学生角色',
  [BusinessErrorType.USERNAME_ALREADY_EXISTS]: '用户名已存在',
  [BusinessErrorType.USERNAME_EXISTS_IN_AUTH_SYSTEM]: '用户名在认证系统中已存在',
  [BusinessErrorType.USER_ALREADY_EXISTS]: '用户已存在',
  [BusinessErrorType.USER_NOT_FOUND]: '用户不存在',
  [BusinessErrorType.USER_NOT_IN_ORGANIZATION]: '用户不属于指定组织',
};

/**
 * 创建业务错误
 * 这是一个工具函数，用于创建标准化的业务异常
 *
 * @param type - 业务错误类型
 * @param customMessage - 自定义错误消息（可选），用于需要动态参数的场景
 * @returns TRPCError 实例
 *
 * @example
 * throw createBusinessError(BusinessErrorType.USER_ALREADY_EXISTS);
 * throw createBusinessError(BusinessErrorType.ORGANIZATION_MAX_USERS_REACHED, `组织已达到最大用户数量限制（50人）`);
 */
export function createBusinessError(type: BusinessErrorType, customMessage?: string): TRPCError {
  const message = customMessage ?? businessErrorMessages[type];

  return new TRPCError({
    code: 'BAD_REQUEST',
    message,
  });
}

/**
 * 创建权限不足错误
 * @param customMessage - 自定义错误消息
 */
export function createPermissionError(customMessage?: string): TRPCError {
  return new TRPCError({
    code: 'FORBIDDEN',
    message: customMessage ?? businessErrorMessages[BusinessErrorType.INSUFFICIENT_PERMISSIONS],
  });
}

/**
 * 创建资源未找到错误
 * @param resourceName - 资源名称
 */
export function createNotFoundError(resourceName: string): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: `${resourceName}不存在`,
  });
}

/**
 * 创建内部服务器错误
 * @param customMessage - 自定义错误消息
 */
export function createInternalError(customMessage?: string): TRPCError {
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: customMessage ?? '操作失败，请稍后重试',
  });
}
