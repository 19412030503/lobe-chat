import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import { ADMIN_ROLE, ROOT_ROLE } from '@/const/rbac';
import { inviteCodes, users } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { requireRoles } from '@/libs/trpc/lambda/middleware/roleGuard';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { CasdoorService } from '@/server/services/casdoor';

const baseProcedure = authedProcedure.use(serverDatabase);
const adminOrRootProcedure = baseProcedure.use(requireRoles([ADMIN_ROLE, ROOT_ROLE]));

// 生成随机邀请码
const generateCode = () => {
  return (
    randomBytes(8)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') || ''
  );
};

export const inviteRouter = router({
  // 生成邀请码（仅管理员）
  generateInviteCode: adminOrRootProcedure.mutation(async ({ ctx }) => {
    const db = ctx.serverDB;
    if (!db) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
    }

    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    // 获取用户的组织ID
    const user = await db.query.users.findFirst({
      where: (users: any, { eq }: any) => eq(users.id, ctx.userId),
    });

    const code = generateCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天有效期

    // 插入到数据库
    const [inviteCode] = await db
      .insert(inviteCodes)
      .values({
        code,
        creatorId: ctx.userId,
        expiresAt,
        organizationId: user?.organizationId || null,
      })
      .returning();

    return inviteCode;
  }),

  // 获取我的邀请码
  getMyInviteCode: adminOrRootProcedure.query(async ({ ctx }) => {
    const db = ctx.serverDB;
    if (!db) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
    }

    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    // 查询最新的未使用邀请码
    const inviteCode = await db.query.inviteCodes.findFirst({
      orderBy: (codes: any, { desc }: any) => [desc(codes.createdAt)],
      where: (codes: any, { and, eq, isNull, or, gt }: any) =>
        and(
          eq(codes.creatorId, ctx.userId),
          isNull(codes.usedAt),
          or(isNull(codes.expiresAt), gt(codes.expiresAt, new Date())),
        ),
    });

    return inviteCode || null;
  }),

  // 加入组织（已登录用户使用邀请码加入组织）
  joinOrganization: baseProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.serverDB;
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // 验证邀请码
      const inviteCode = await db.query.inviteCodes.findFirst({
        where: (codes: any, { eq }: any) => eq(codes.code, input.code),
      });

      if (!inviteCode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid invite code' });
      }

      if (inviteCode.usedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite code already used' });
      }

      if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite code expired' });
      }

      // 更新用户的组织ID
      await db
        .update(users)
        .set({ organizationId: inviteCode.organizationId })
        .where(eq(users.id, ctx.userId));

      // 标记邀请码为已使用
      await db
        .update(inviteCodes)
        .set({
          usedAt: new Date(),
          usedBy: ctx.userId,
        })
        .where(eq(inviteCodes.id, inviteCode.id));

      return {
        organizationId: inviteCode.organizationId,
        success: true,
      };
    }),

  // 使用邀请码创建用户
  useInviteCode: baseProcedure
    .input(
      z.object({
        code: z.string().min(1),
        displayName: z.string().optional(),
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.serverDB;
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // 验证邀请码
      const inviteCode = await db.query.inviteCodes.findFirst({
        where: (codes: any, { eq }: any) => eq(codes.code, input.code),
      });

      if (!inviteCode) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid invite code' });
      }

      if (inviteCode.usedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite code already used' });
      }

      if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite code expired' });
      }

      // 通过 Casdoor 创建用户
      const casdoorService = new CasdoorService();
      const casdoorUser = await casdoorService.createUser({
        displayName: input.displayName || input.name,
        email: input.email,
        name: input.name,
        password: input.password,
      });

      // 在本地数据库创建用户记录
      const casdoorUserData = casdoorUser.data as any;
      const [user] = await db
        .insert(users)
        .values({
          email: input.email,
          fullName: input.displayName || input.name,
          id: casdoorUserData.id || casdoorUserData.name || input.name,
          organizationId: inviteCode.organizationId,
          username: input.name,
        })
        .returning();

      // 标记邀请码为已使用
      await db
        .update(inviteCodes)
        .set({
          usedAt: new Date(),
          usedBy: user.id,
        })
        .where(eq(inviteCodes.id, inviteCode.id));

      return {
        success: true,
        userId: user.id,
      };
    }),

  // 验证邀请码
  validateInviteCode: baseProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = ctx.serverDB;
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // 从数据库验证邀请码
      const inviteCode = await db.query.inviteCodes.findFirst({
        where: (codes: any, { eq }: any) => eq(codes.code, input.code),
      });

      if (!inviteCode) {
        return { valid: false };
      }

      // 检查是否已使用
      if (inviteCode.usedAt) {
        return { valid: false };
      }

      // 检查是否过期
      if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
        return { valid: false };
      }

      return {
        organizationId: inviteCode.organizationId,
        valid: true,
      };
    }),
});
