import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { ADMIN_ROLE, ROOT_ROLE, type SystemRole, USER_ROLE } from '@/const/rbac';
import { OrganizationModel } from '@/database/models/organization';
import { UserModel } from '@/database/models/user';
import { organizations, users } from '@/database/schemas';
import { roles as rolesTable, userRoles } from '@/database/schemas/rbac';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { requireRoles } from '@/libs/trpc/lambda/middleware/roleGuard';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { RoleService } from '@/server/services/role';

const baseProcedure = authedProcedure.use(serverDatabase);
const adminOrRootProcedure = baseProcedure.use(requireRoles([ADMIN_ROLE, ROOT_ROLE]));

const ensureServerDB = (ctx: { serverDB?: LobeChatDatabase }) => {
  if (!ctx.serverDB) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
  }
  return ctx.serverDB;
};

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
  list: adminOrRootProcedure.query(async ({ ctx }) => {
    const db = ensureServerDB(ctx);
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
    const isRoot = roleSet.has(ROOT_ROLE);
    const isAdmin = roleSet.has(ADMIN_ROLE);

    if (!isRoot && !isAdmin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient role permissions' });
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
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient role permissions' });
      }

      const targetUser = await UserModel.findById(db, input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const roleService = new RoleService(db);
      const targetRolesResult = await roleService.getUserRoles(input.userId);
      const targetRoles = targetRolesResult.map((role) => role.name.toLowerCase());

      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin must belong to an organization',
          });
        }

        if (input.organizationId && input.organizationId !== actor.organizationId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot manage other organizations' });
        }

        if (!targetRoles.includes(USER_ROLE)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only students can be managed' });
        }

        if (
          targetUser.organizationId &&
          targetUser.organizationId !== actor.organizationId &&
          input.organizationId !== actor.organizationId
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot move students outside your organization',
          });
        }
      }

      if (input.organizationId) {
        const organization = await OrganizationModel.findById(db, input.organizationId);
        if (!organization) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization not found' });
        }
      }

      const userModel = new UserModel(db, input.userId);
      await userModel.updateUser({ organizationId: input.organizationId ?? null });

      const [summary] = await summarizeUsers(db, [input.userId]);
      return summary;
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
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient role permissions' });
      }

      if (isAdmin && input.role !== USER_ROLE) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'School admins can only assign student roles',
        });
      }

      const targetUser = await UserModel.findById(db, input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const roleService = new RoleService(db);
      const existingRolesResult = await roleService.getUserRoles(input.userId);
      const existingRoles = existingRolesResult.map((role) => role.name.toLowerCase());

      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId || actor.organizationId !== targetUser.organizationId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot manage this user' });
        }
      }

      if (input.role === ROOT_ROLE && !isRoot) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only root can assign root role' });
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
});
