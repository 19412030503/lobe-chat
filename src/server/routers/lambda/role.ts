import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { requireRoles } from '@/libs/trpc/lambda/middleware/roleGuard';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { RoleService } from '@/server/services/role';

const withDatabase = authedProcedure.use(serverDatabase);
const adminProcedure = withDatabase.use(requireRoles(['admin', 'root']));

const assignableRolesSchema = z.array(z.string().min(1)).min(1);

const normalize = (roles: string[]) =>
  roles.map((role) => role.trim().toLowerCase()).filter(Boolean);

const ensureServerDB = (ctx: { serverDB?: LobeChatDatabase }) => {
  if (!ctx.serverDB) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Server database is not available',
    });
  }
  return ctx.serverDB;
};

export const roleRouter = router({
  assignRoles: adminProcedure
    .input(
      z.object({
        roles: assignableRolesSchema,
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const roleService = new RoleService(ensureServerDB(ctx));
      const requested = normalize(input.roles);
      const actorRoles = normalize(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);

      if (requested.includes('root') && !actorRoles.includes('root')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only root user can assign root role.',
        });
      }

      const result = await roleService.assignRoles(input.userId, input.roles);
      const updatedRoles = await roleService.getUserRoles(input.userId);

      return { result, roles: updatedRoles };
    }),

  getUserRoles: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const roleService = new RoleService(ensureServerDB(ctx));
      return roleService.getUserRoles(input.userId);
    }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    const roleService = new RoleService(ensureServerDB(ctx));
    return roleService.listRoles();
  }),

  revokeRoles: adminProcedure
    .input(
      z.object({
        roles: assignableRolesSchema,
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const roleService = new RoleService(ensureServerDB(ctx));
      const requested = normalize(input.roles);
      const actorRoles = normalize(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);

      if (requested.includes('root') && !actorRoles.includes('root')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only root user can revoke root role.',
        });
      }

      const removed = await roleService.revokeRoles(input.userId, input.roles);
      const updatedRoles = await roleService.getUserRoles(input.userId);

      return { removed, roles: updatedRoles };
    }),
});
