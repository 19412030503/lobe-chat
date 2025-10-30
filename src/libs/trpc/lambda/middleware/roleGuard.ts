import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';

import { RoleService } from '@/server/services/role';

import type { LambdaContext } from '../context';
import { trpc } from '../init';

const normalizeRoles = (roles: string[] | undefined | null) => {
  if (!roles) return new Set<string>();
  return new Set(roles.map((role) => role.trim().toLowerCase()).filter(Boolean));
};

export const requireRoles = (allowed: string | string[]) => {
  const required = Array.isArray(allowed) ? allowed : [allowed];
  const expected = required.map((role) => role.trim().toLowerCase()).filter(Boolean);

  return trpc.middleware(async (opts) => {
    const ctx = opts.ctx as LambdaContext & { serverDB?: LobeChatDatabase };

    const userRoles = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles);
    const hasRole = expected.some((role) => userRoles.has(role));

    if (!hasRole) {
      if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      if (!ctx.serverDB) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient role permissions' });
      }

      const roleService = new RoleService(ctx.serverDB);
      const roles = await roleService.getUserRoles(ctx.userId);
      roles.forEach((role) => userRoles.add(role.name));
    }

    if (!expected.some((role) => userRoles.has(role))) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient role permissions' });
    }

    return opts.next({
      ctx: {
        ...ctx,
        userRoles: Array.from(userRoles),
      },
    });
  });
};
