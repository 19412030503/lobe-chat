import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ADMIN_ROLE, ROOT_ROLE, type SystemRole, USER_ROLE } from '@/const/rbac';
import { OrganizationModel } from '@/database/models/organization';
import { UserModel } from '@/database/models/user';
import { organizations, users } from '@/database/schemas';
import { roles as rolesTable, userRoles } from '@/database/schemas/rbac';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { requireRoles } from '@/libs/trpc/lambda/middleware/roleGuard';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { casdoorService } from '@/server/services/casdoor';
import { ModelCreditService } from '@/server/services/modelCredit';
import { RoleService } from '@/server/services/role';
import {
  BusinessErrorType,
  createBusinessError,
  createInternalError,
  createNotFoundError,
  createPermissionError,
} from '@/server/utils/businessError';

const baseProcedure = authedProcedure.use(serverDatabase);
const adminOrRootProcedure = baseProcedure.use(requireRoles([ADMIN_ROLE, ROOT_ROLE]));

const ensureServerDB = (ctx: { serverDB?: LobeChatDatabase }) => {
  if (!ctx.serverDB) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
  }
  return ctx.serverDB;
};

const setQuotaSchema = z.object({
  limit: z.number().min(0).nullable(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

const normalizeRoles = (roles: (string | null | undefined)[] | undefined): Set<SystemRole> => {
  const normalized = (roles ?? [])
    .filter((role): role is string => typeof role === 'string' && role.length > 0)
    .map((role) => role.toLowerCase())
    .filter((role): role is SystemRole =>
      [ROOT_ROLE, ADMIN_ROLE, USER_ROLE].includes(role as SystemRole),
    );

  return new Set(normalized);
};

interface UserSummary {
  email?: string;
  fullName?: string;
  id: string;
  organization?: {
    id: string;
    name: string;
    type: string;
  };
  roles: SystemRole[];
  username?: string;
}

const summarizeUsers = async (db: LobeChatDatabase, userIds: string[]): Promise<UserSummary[]> => {
  if (userIds.length === 0) return [];

  const rows = await db
    .select({
      organization: organizations,
      user: users,
    })
    .from(users)
    .leftJoin(organizations, eq(users.organizationId, organizations.id))
    .where(inArray(users.id, userIds));

  const roleRows = await db
    .select({ role: rolesTable.name, userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
    .where(inArray(userRoles.userId, userIds));

  const roleMap = new Map<string, SystemRole[]>();
  roleRows.forEach(({ userId, role }) => {
    if (!role) return;
    const normalized = role.toLowerCase();
    if (!['root', 'admin', 'user'].includes(normalized)) return;
    const prev = roleMap.get(userId) ?? [];
    if (!prev.includes(normalized as SystemRole)) {
      roleMap.set(userId, [...prev, normalized as SystemRole]);
    }
  });

  return rows.map(({ user, organization }) => ({
    email: user.email ?? undefined,
    fullName: user.fullName ?? undefined,
    id: user.id,
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          type: organization.type,
        }
      : undefined,
    roles: roleMap.get(user.id) ?? [],
    username: user.username ?? undefined,
  }));
};

export const adminUserRouter = router({
  createUser: adminOrRootProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        email: z.string().email(),
        name: z.string().min(1),
        organizationId: z.string().uuid().nullable().optional(),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);
      const isAdmin = roleSet.has(ADMIN_ROLE);

      if (!isRoot && !isAdmin) {
        throw createPermissionError();
      }

      // 学校管理员只能在自己的组织创建用户
      let finalOrganizationId = input.organizationId;
      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId) {
          throw createBusinessError(BusinessErrorType.ADMIN_MUST_BELONG_TO_ORGANIZATION);
        }
        finalOrganizationId = actor.organizationId;
      }

      // 验证组织是否存在并检查用户数量限制
      if (finalOrganizationId) {
        const organization = await OrganizationModel.findById(db, finalOrganizationId);
        if (!organization) {
          throw createNotFoundError('组织');
        }

        // 检查组织是否已达到最大用户数量
        if (organization.maxUsers !== null && organization.maxUsers !== undefined) {
          const currentUserCount = await OrganizationModel.getUserCount(db, finalOrganizationId);
          if (currentUserCount >= organization.maxUsers) {
            throw createBusinessError(
              BusinessErrorType.ORGANIZATION_MAX_USERS_REACHED,
              `组织已达到最大用户数量限制（${organization.maxUsers}人）`,
            );
          }
        }
      }

      // 检查本地数据库中用户名是否已存在
      const existingUserByUsername = await db.query.users.findFirst({
        where: eq(users.username, input.name),
      });
      if (existingUserByUsername) {
        throw createBusinessError(BusinessErrorType.USERNAME_ALREADY_EXISTS);
      }

      // 检查本地数据库中邮箱是否已存在
      const existingUserByEmail = await UserModel.findByEmail(db, input.email);
      if (existingUserByEmail) {
        throw createBusinessError(BusinessErrorType.EMAIL_ALREADY_EXISTS);
      }

      // 检查 Casdoor 中用户名是否已存在
      try {
        const casdoorUser = await casdoorService.getUser(input.name);
        if (casdoorUser?.data?.data) {
          throw createBusinessError(BusinessErrorType.USERNAME_EXISTS_IN_AUTH_SYSTEM);
        }
      } catch (error) {
        // getUser 抛出错误说明用户不存在，可以继续创建
        if (error instanceof TRPCError) {
          throw error;
        }
        // 其他错误继续执行（用户不存在是正常情况）
      }

      // 在 Casdoor 创建用户
      try {
        await casdoorService.createUser({
          displayName: input.displayName,
          email: input.email,
          name: input.name,
          password: input.password,
        });
      } catch (error) {
        throw createInternalError(error instanceof Error ? error.message : '创建用户失败');
      }

      // 在本地数据库创建用户记录
      const userId = randomUUID();
      const result = await UserModel.createUser(db, {
        email: input.email,
        fullName: input.displayName || input.name,
        id: userId,
        organizationId: finalOrganizationId,
        username: input.name,
      });

      if (result.duplicate) {
        throw createBusinessError(BusinessErrorType.USER_ALREADY_EXISTS);
      }

      if (!result.user) {
        throw createInternalError('创建用户失败');
      }

      // 为新用户分配默认角色（学生）
      const roleService = new RoleService(db);
      await roleService.assignRoles(result.user.id, [USER_ROLE]);

      const [summary] = await summarizeUsers(db, [result.user.id]);
      return summary;
    }),

  list: adminOrRootProcedure.query(async ({ ctx }) => {
    const db = ensureServerDB(ctx);
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
    const isRoot = roleSet.has(ROOT_ROLE);
    const isAdmin = roleSet.has(ADMIN_ROLE);

    if (!isRoot && !isAdmin) {
      throw createPermissionError();
    }

    let rows;
    if (isRoot) {
      rows = await db
        .select({ organization: organizations, user: users })
        .from(users)
        .leftJoin(organizations, eq(users.organizationId, organizations.id));
    } else {
      const actor = await UserModel.findById(db, ctx.userId);
      if (!actor?.organizationId) {
        return [];
      }

      rows = await db
        .select({ organization: organizations, user: users })
        .from(users)
        .leftJoin(organizations, eq(users.organizationId, organizations.id))
        .where(eq(users.organizationId, actor.organizationId));
    }

    const userIds = rows.map(({ user }) => user.id);
    const summaries = await summarizeUsers(db, userIds);

    if (isRoot) return summaries;

    return summaries.filter((item) => item.roles.includes(USER_ROLE));
  }),

  setOrganization: adminOrRootProcedure
    .input(
      z.object({
        organizationId: z.string().uuid().nullable(),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);
      const isAdmin = roleSet.has(ADMIN_ROLE);

      if (!isRoot && !isAdmin) {
        throw createPermissionError();
      }

      const targetUser = await UserModel.findById(db, input.userId);
      if (!targetUser) {
        throw createNotFoundError('用户');
      }

      const roleService = new RoleService(db);
      const targetRolesResult = await roleService.getUserRoles(input.userId);
      const targetRoles = targetRolesResult.map((role) => role.name.toLowerCase());

      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId) {
          throw createBusinessError(BusinessErrorType.ADMIN_MUST_BELONG_TO_ORGANIZATION);
        }

        if (input.organizationId && input.organizationId !== actor.organizationId) {
          throw createBusinessError(BusinessErrorType.CANNOT_MANAGE_OTHER_ORGANIZATIONS);
        }

        if (!targetRoles.includes(USER_ROLE)) {
          throw createBusinessError(BusinessErrorType.ONLY_STUDENTS_CAN_BE_MANAGED);
        }

        if (
          targetUser.organizationId &&
          targetUser.organizationId !== actor.organizationId &&
          input.organizationId !== actor.organizationId
        ) {
          throw createBusinessError(BusinessErrorType.CANNOT_MOVE_STUDENTS_OUTSIDE_ORGANIZATION);
        }
      }

      if (input.organizationId) {
        const organization = await OrganizationModel.findById(db, input.organizationId);
        if (!organization) {
          throw createNotFoundError('组织');
        }

        // 如果用户之前不在该组织，检查组织是否已达到最大用户数量
        if (
          targetUser.organizationId !== input.organizationId &&
          organization.maxUsers !== null &&
          organization.maxUsers !== undefined
        ) {
          const currentUserCount = await OrganizationModel.getUserCount(db, input.organizationId);
          if (currentUserCount >= organization.maxUsers) {
            throw createBusinessError(
              BusinessErrorType.ORGANIZATION_MAX_USERS_REACHED,
              `组织已达到最大用户数量限制（${organization.maxUsers}人）`,
            );
          }
        }
      }

      const userModel = new UserModel(db, input.userId);
      await userModel.updateUser({ organizationId: input.organizationId ?? null });

      const [summary] = await summarizeUsers(db, [input.userId]);
      return summary;
    }),

  setQuota: adminOrRootProcedure.input(setQuotaSchema).mutation(async ({ ctx, input }) => {
    const db = ensureServerDB(ctx);
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
    const isRoot = roleSet.has(ROOT_ROLE);
    const isAdmin = roleSet.has(ADMIN_ROLE);

    if (!isRoot && !isAdmin) {
      throw createPermissionError();
    }

    let targetOrganizationId = input.organizationId;
    if (!isRoot) {
      const actor = await UserModel.findById(db, ctx.userId);
      if (!actor?.organizationId) {
        throw createBusinessError(BusinessErrorType.ADMIN_MUST_BELONG_TO_ORGANIZATION);
      }

      if (actor.organizationId !== input.organizationId) {
        throw createBusinessError(BusinessErrorType.CANNOT_MODIFY_OTHER_ORGANIZATIONS_QUOTA);
      }

      targetOrganizationId = actor.organizationId;
    }

    const targetUser = await UserModel.findById(db, input.userId);
    if (!targetUser) {
      throw createNotFoundError('用户');
    }

    if (targetUser.organizationId !== targetOrganizationId) {
      throw createBusinessError(BusinessErrorType.USER_NOT_IN_ORGANIZATION);
    }

    const creditService = new ModelCreditService(db);
    const quota = await creditService.setMemberQuotaLimit(
      targetOrganizationId,
      input.userId,
      input.limit ?? null,
    );

    return {
      memberQuota: quota,
      success: true,
    };
  }),

  setRole: adminOrRootProcedure
    .input(
      z.object({
        role: z.enum([ROOT_ROLE, ADMIN_ROLE, USER_ROLE]),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);
      const isAdmin = roleSet.has(ADMIN_ROLE);

      if (!isRoot && !isAdmin) {
        throw createPermissionError();
      }

      if (isAdmin && input.role !== USER_ROLE) {
        throw createBusinessError(BusinessErrorType.SCHOOL_ADMIN_CAN_ONLY_ASSIGN_STUDENT_ROLE);
      }

      const targetUser = await UserModel.findById(db, input.userId);
      if (!targetUser) {
        throw createNotFoundError('用户');
      }

      const roleService = new RoleService(db);
      const existingRolesResult = await roleService.getUserRoles(input.userId);
      const existingRoles = existingRolesResult.map((role) => role.name.toLowerCase());

      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId || actor.organizationId !== targetUser.organizationId) {
          throw createBusinessError(BusinessErrorType.CANNOT_MANAGE_USER);
        }
      }

      if (input.role === ROOT_ROLE && !isRoot) {
        throw createBusinessError(BusinessErrorType.ONLY_ROOT_CAN_ASSIGN_ROOT_ROLE);
      }

      const toRemove = existingRoles.filter((role) => role !== input.role);
      if (toRemove.length > 0) {
        await roleService.revokeRoles(input.userId, toRemove);
      }

      if (!existingRoles.includes(input.role)) {
        await roleService.assignRoles(input.userId, [input.role]);
      }

      const [summary] = await summarizeUsers(db, [input.userId]);
      return summary;
    }),

  toggleUserStatus: adminOrRootProcedure
    .input(
      z.object({
        isForbidden: z.boolean(),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);
      const isAdmin = roleSet.has(ADMIN_ROLE);

      if (!isRoot && !isAdmin) {
        throw createPermissionError();
      }

      const targetUser = await UserModel.findById(db, input.userId);
      if (!targetUser) {
        throw createNotFoundError('用户');
      }

      // 学校管理员只能管理本组织用户
      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId || actor.organizationId !== targetUser.organizationId) {
          throw createBusinessError(BusinessErrorType.CANNOT_MANAGE_USER);
        }

        // 学校管理员只能管理学生
        const roleService = new RoleService(db);
        const targetRolesResult = await roleService.getUserRoles(input.userId);
        const targetRoles = targetRolesResult.map((role) => role.name.toLowerCase());
        if (!targetRoles.includes(USER_ROLE)) {
          throw createBusinessError(BusinessErrorType.ONLY_STUDENTS_CAN_BE_MANAGED);
        }
      }

      // 在 Casdoor 更新用户状态
      try {
        const casdoorUsername = targetUser.username || targetUser.email;
        if (!casdoorUsername) {
          throw new Error('User has no username or email');
        }

        if (input.isForbidden) {
          await casdoorService.disableUser(casdoorUsername);
        } else {
          await casdoorService.enableUser(casdoorUsername);
        }
      } catch (error) {
        throw createInternalError(error instanceof Error ? error.message : '更新用户状态失败');
      }

      const [summary] = await summarizeUsers(db, [input.userId]);
      return summary;
    }),
});
