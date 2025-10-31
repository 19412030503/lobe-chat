import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  ADMIN_ROLE,
  ORGANIZATION_TYPE_MANAGEMENT,
  ORGANIZATION_TYPE_SCHOOL,
  ROOT_ROLE,
} from '@/const/rbac';
import { OrganizationModel } from '@/database/models/organization';
import { UserModel } from '@/database/models/user';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { requireRoles } from '@/libs/trpc/lambda/middleware/roleGuard';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { OrganizationService } from '@/server/services/organization';

const baseProcedure = authedProcedure.use(serverDatabase);
const rootProcedure = baseProcedure.use(requireRoles([ROOT_ROLE]));
const adminOrRootProcedure = baseProcedure.use(requireRoles([ADMIN_ROLE, ROOT_ROLE]));

const organizationTypeSchema = z.enum([ORGANIZATION_TYPE_MANAGEMENT, ORGANIZATION_TYPE_SCHOOL]);

const createOrganizationSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
  type: organizationTypeSchema,
});

const updateOrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  type: organizationTypeSchema.optional(),
});

const deleteOrganizationSchema = z.object({
  id: z.string().uuid(),
});

const ensureServerDB = (ctx: { serverDB?: LobeChatDatabase }) => {
  if (!ctx.serverDB) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
  }
  return ctx.serverDB;
};

export const organizationRouter = router({
  create: rootProcedure.input(createOrganizationSchema).mutation(async ({ ctx, input }) => {
    const db = ensureServerDB(ctx);
    const service = new OrganizationService(db);

    if (input.type === ORGANIZATION_TYPE_MANAGEMENT) {
      // ensure only one management organization exists
      const existing = await OrganizationModel.list(db);
      if (existing.some((item) => item.type === ORGANIZATION_TYPE_MANAGEMENT)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Management organization already exists',
        });
      }
    }

    return service.createOrganization(input);
  }),

  delete: rootProcedure.input(deleteOrganizationSchema).mutation(async ({ ctx, input }) => {
    const db = ensureServerDB(ctx);
    const service = new OrganizationService(db);

    await service.deleteOrganization(input.id);
    return { success: true };
  }),

  list: adminOrRootProcedure.query(async ({ ctx }) => {
    const db = ensureServerDB(ctx);
    const service = new OrganizationService(db);

    const userRoles = new Set(
      (ctx.userRoles ?? ctx.nextAuth?.roles ?? []).map((role) => role.toLowerCase()),
    );

    if (userRoles.has(ROOT_ROLE)) {
      return service.listOrganizations();
    }

    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const actor = await UserModel.findById(db, ctx.userId);
    if (!actor?.organizationId) {
      return [];
    }

    const organization = await OrganizationModel.findById(db, actor.organizationId);
    return organization ? [organization] : [];
  }),

  update: rootProcedure.input(updateOrganizationSchema).mutation(async ({ ctx, input }) => {
    const db = ensureServerDB(ctx);
    const service = new OrganizationService(db);

    return service.updateOrganization(input.id, {
      name: input.name,
      parentId: input.parentId,
      type: input.type,
    });
  }),
});
