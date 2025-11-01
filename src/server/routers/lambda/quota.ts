import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { ADMIN_ROLE, ROOT_ROLE, USER_ROLE } from '@/const/rbac';
import { UserModel } from '@/database/models/user';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { requireRoles } from '@/libs/trpc/lambda/middleware/roleGuard';
import { serverDatabase } from '@/libs/trpc/lambda/middleware/serverDatabase';
import { ModelCreditService } from '@/server/services/modelCredit';

const baseProcedure = authedProcedure.use(serverDatabase);
const rootProcedure = baseProcedure.use(requireRoles([ROOT_ROLE]));
const adminOrRootProcedure = baseProcedure.use(requireRoles([ADMIN_ROLE, ROOT_ROLE]));

const ensureServerDB = (ctx: { serverDB?: LobeChatDatabase }) => {
  if (!ctx.serverDB) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
  }
  return ctx.serverDB;
};

const normalizeRoles = (roles: (string | null | undefined)[] | undefined): Set<string> => {
  const normalized = (roles ?? [])
    .filter((role): role is string => typeof role === 'string' && role.length > 0)
    .map((role) => role.toLowerCase())
    .filter((role): role is string =>
      [ROOT_ROLE, ADMIN_ROLE, USER_ROLE].includes(role as typeof ROOT_ROLE),
    );

  return new Set(normalized);
};

// Query schema
const usageQuerySchema = z.object({
  endDate: z.string().datetime().optional(),
  limit: z.number().int().positive().max(1000).optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0),
  startDate: z.string().datetime().optional(),
});

const organizationUsageQuerySchema = usageQuerySchema.extend({
  organizationId: z.string().uuid(),
});

const setMemberQuotaSchema = z.object({
  limit: z.number().int().nullable(), // null 表示无限制
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const quotaRouter = router({
  // User: 查询所属组织的额度信息
  getMyOrganizationCredit: baseProcedure.query(async ({ ctx }) => {
    const db = ensureServerDB(ctx);
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const user = await UserModel.findById(db, ctx.userId);
    if (!user?.organizationId) {
      return null;
    }

    const orgCredit = await db.query.modelCredits.findFirst({
      where: (table, { eq }) => eq(table.organizationId, user.organizationId!),
      with: {
        organization: {
          columns: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!orgCredit) {
      return null;
    }

    return {
      balance: orgCredit.balance,
      organization: orgCredit.organization,
      organizationId: orgCredit.organizationId,
      updatedAt: orgCredit.updatedAt,
    };
  }),

  // User: 查询个人额度信息
  getMyQuota: baseProcedure.query(async ({ ctx }) => {
    const db = ensureServerDB(ctx);
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const user = await UserModel.findById(db, ctx.userId);
    if (!user?.organizationId) {
      return null;
    }

    const creditService = new ModelCreditService(db);
    const quota = await db.query.memberQuotas.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.organizationId, user.organizationId!), eq(table.userId, ctx.userId!)),
    });

    if (!quota) {
      // 确保成员额度存在
      const ensuredQuota = await creditService.setMemberQuotaLimit(
        user.organizationId,
        ctx.userId,
        null,
      );
      return {
        limit: ensuredQuota.limit,
        organizationId: ensuredQuota.organizationId,
        used: ensuredQuota.used,
      };
    }

    return {
      limit: quota.limit,
      organizationId: quota.organizationId,
      used: quota.used,
    };
  }),

  // Admin/Root: 获取使用统计
  getUsageStatistics: adminOrRootProcedure
    .input(
      z
        .object({
          organizationId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);

      let targetOrganizationId: string | null = null;

      if (!isRoot) {
        // Admin 只能查询自己组织的统计
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'User must belong to an organization',
          });
        }
        targetOrganizationId = actor.organizationId;
      } else if (input?.organizationId) {
        // Root 可以指定组织
        targetOrganizationId = input.organizationId;
      }

      // 统计数据
      const whereClause = targetOrganizationId
        ? { organizationId: targetOrganizationId }
        : undefined;

      // 查询所有使用记录
      const usages = await db.query.modelUsages.findMany({
        columns: {
          countUsed: true,
          creditCost: true,
          inputTokens: true,
          organizationId: true,
          outputTokens: true,
          totalTokens: true,
          usageType: true,
          userId: true,
        },
        where: whereClause
          ? (table, { eq }) => eq(table.organizationId, whereClause.organizationId!)
          : undefined,
      });

      // 统计组织总使用额度
      const totalCreditsUsed = usages.reduce((sum, usage) => sum + (usage.creditCost || 0), 0);

      // 统计每个用户的详细使用情况
      interface UserStats {
        credits: number;
        imageCount: number;
        textTokens: number;
        threeDCount: number;
        userId: string;
      }

      const userStatsMap = new Map<string, UserStats>();
      usages.forEach((usage) => {
        if (usage.userId) {
          const stats = userStatsMap.get(usage.userId) || {
            credits: 0,
            imageCount: 0,
            textTokens: 0,
            threeDCount: 0,
            userId: usage.userId,
          };

          stats.credits += usage.creditCost || 0;

          switch (usage.usageType) {
            case 'text': {
              stats.textTokens += usage.totalTokens || 0;
              break;
            }
            case 'image': {
              stats.imageCount += usage.countUsed || 0;
              break;
            }
            case 'threeD': {
              stats.threeDCount += usage.countUsed || 0;
              break;
            }
          }

          userStatsMap.set(usage.userId, stats);
        }
      });

      // 获取所有用户列表（按消耗额度降序）
      const allUsersStats = Array.from(userStatsMap.values()).sort((a, b) => b.credits - a.credits);

      // 查询用户信息
      const userIds = allUsersStats.map((u) => u.userId);
      const users = userIds.length
        ? await db.query.users.findMany({
            columns: {
              email: true,
              fullName: true,
              id: true,
            },
            where: (table, { inArray }) => inArray(table.id, userIds),
          })
        : [];

      const allUsersWithInfo = allUsersStats.map((item) => {
        const user = users.find((u) => u.id === item.userId);
        return {
          credits: item.credits,
          imageCount: item.imageCount,
          textTokens: item.textTokens,
          threeDCount: item.threeDCount,
          user: user || null,
          userId: item.userId,
        };
      });

      // 统计文字使用 token 数
      const textUsages = usages.filter((u) => u.usageType === 'text');
      const totalTextTokens = textUsages.reduce((sum, usage) => sum + (usage.totalTokens || 0), 0);
      const totalInputTokens = textUsages.reduce((sum, usage) => sum + (usage.inputTokens || 0), 0);
      const totalOutputTokens = textUsages.reduce(
        (sum, usage) => sum + (usage.outputTokens || 0),
        0,
      );

      // 统计图片使用次数
      const imageUsages = usages.filter((u) => u.usageType === 'image');
      const totalImageCount = imageUsages.reduce((sum, usage) => sum + (usage.countUsed || 0), 0);

      // 统计 3D 使用次数
      const threeDUsages = usages.filter((u) => u.usageType === 'threeD');
      const totalThreeDCount = threeDUsages.reduce((sum, usage) => sum + (usage.countUsed || 0), 0);

      // 统计音频使用次数
      const audioUsages = usages.filter((u) => u.usageType === 'audio');
      const totalAudioCount = audioUsages.reduce((sum, usage) => sum + (usage.countUsed || 0), 0);

      // 获取组织信息
      let organizationInfo = null;
      if (targetOrganizationId) {
        organizationInfo = await db.query.organizations.findFirst({
          columns: {
            id: true,
            name: true,
            type: true,
          },
          where: (table, { eq }) => eq(table.id, targetOrganizationId!),
        });
      }

      return {
        allUsers: allUsersWithInfo,
        audio: {
          totalCount: totalAudioCount,
        },
        image: {
          totalCount: totalImageCount,
        },
        organization: organizationInfo,
        organizationId: targetOrganizationId,
        text: {
          totalInputTokens,
          totalOutputTokens,
          totalTokens: totalTextTokens,
        },
        threeD: {
          totalCount: totalThreeDCount,
        },
        totalCreditsUsed,
      };
    }),

  // Root: 查询所有组织的额度信息
  listAllOrganizationCredits: rootProcedure.query(async ({ ctx }) => {
    const db = ensureServerDB(ctx);

    // 先查询所有组织
    const allOrganizations = await db.query.organizations.findMany({
      columns: {
        id: true,
        name: true,
        type: true,
      },
    });

    // 为每个组织确保有额度记录
    const creditService = new ModelCreditService(db);
    const results = await Promise.all(
      allOrganizations.map(async (org) => {
        // 确保组织有额度记录（如果不存在则创建，初始余额为 0）
        const credit = await db.query.modelCredits.findFirst({
          where: (table, { eq }) => eq(table.organizationId, org.id),
        });

        let balance = 0;
        let updatedAt = new Date();

        // 如果没有额度记录，创建一个初始额度为 0 的记录
        if (!credit) {
          const newCredit = await creditService['creditModel'].ensure(org.id, 0);
          balance = newCredit.balance;
          updatedAt = newCredit.updatedAt;
        } else {
          balance = credit.balance;
          updatedAt = credit.updatedAt;
        }

        // 计算组织的总使用额度（所有成员的已使用额度之和）
        const memberQuotas = await db.query.memberQuotas.findMany({
          where: (table, { eq }) => eq(table.organizationId, org.id),
        });

        const totalUsed = memberQuotas.reduce((sum, quota) => sum + (quota.used || 0), 0);
        const totalBalance = balance + totalUsed; // 总额度 = 剩余额度 + 已使用额度

        return {
          balance, // 剩余额度
          organization: org,
          organizationId: org.id,
          totalBalance, // 总额度
          totalUsed, // 已使用额度
          updatedAt,
        };
      }),
    );

    return results;
  }),

  // Root: 查询所有使用记录
  listAllUsages: rootProcedure.input(usageQuerySchema).query(async ({ ctx, input }) => {
    const db = ensureServerDB(ctx);

    const usages = await db.query.modelUsages.findMany({
      limit: input.limit,
      offset: input.offset,
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: {
        organization: {
          columns: {
            id: true,
            name: true,
          },
        },
        user: {
          columns: {
            email: true,
            fullName: true,
            id: true,
            username: true,
          },
        },
      },
    });

    return usages.map((usage) => ({
      createdAt: usage.createdAt,
      creditCost: usage.creditCost,
      id: usage.id,
      model: usage.model,
      organization: usage.organization,
      provider: usage.provider,
      totalTokens: usage.totalTokens,
      usageType: usage.usageType,
      user: usage.user,
    }));
  }),

  // Root/Admin: 查询组织成员额度列表
  listMemberQuotas: adminOrRootProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);

      // Admin只能查询自己组织的成员
      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId || actor.organizationId !== input.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Can only query your own organization',
          });
        }
      }

      // 查询该组织的所有用户
      const orgUsers = await db.query.users.findMany({
        columns: {
          email: true,
          fullName: true,
          id: true,
          username: true,
        },
        where: (table, { eq }) => eq(table.organizationId, input.organizationId),
      });

      // 为每个用户确保有额度记录
      const creditService = new ModelCreditService(db);
      const results = await Promise.all(
        orgUsers.map(async (user) => {
          // 查找现有的额度记录
          let quota = await db.query.memberQuotas.findFirst({
            where: (table, { and, eq }) =>
              and(eq(table.organizationId, input.organizationId), eq(table.userId, user.id)),
          });

          // 如果不存在，创建一个初始记录（无限额）
          if (!quota) {
            const newQuota = await creditService['memberQuotaModel'].ensure(
              input.organizationId,
              user.id,
            );
            quota = newQuota;
          }

          return {
            limit: quota.limit,
            organizationId: quota.organizationId,
            used: quota.used,
            user: user,
            userId: quota.userId,
          };
        }),
      );

      return results;
    }),

  // User: 查询个人使用记录
  listMyUsages: baseProcedure.input(usageQuerySchema).query(async ({ ctx, input }) => {
    const db = ensureServerDB(ctx);
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const usages = await db.query.modelUsages.findMany({
      limit: input.limit,
      offset: input.offset,
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      where: (table, { eq }) => eq(table.userId, ctx.userId!),
    });

    return usages.map((usage) => ({
      createdAt: usage.createdAt,
      creditCost: usage.creditCost,
      id: usage.id,
      model: usage.model,
      provider: usage.provider,
      totalTokens: usage.totalTokens,
      usageType: usage.usageType,
    }));
  }),

  // Admin: 查询本组织使用记录
  listOrganizationUsages: adminOrRootProcedure
    .input(organizationUsageQuerySchema)
    .query(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);

      // Admin只能查询自己组织的记录
      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId || actor.organizationId !== input.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Can only query your own organization',
          });
        }
      }

      const usages = await db.query.modelUsages.findMany({
        limit: input.limit,
        offset: input.offset,
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        where: (table, { eq }) => eq(table.organizationId, input.organizationId),
        with: {
          user: {
            columns: {
              email: true,
              fullName: true,
              id: true,
              username: true,
            },
          },
        },
      });

      return usages.map((usage) => ({
        createdAt: usage.createdAt,
        creditCost: usage.creditCost,
        id: usage.id,
        model: usage.model,
        provider: usage.provider,
        totalTokens: usage.totalTokens,
        usageType: usage.usageType,
        user: usage.user,
      }));
    }),

  // Admin/Root: 重置成员已使用额度
  resetMemberUsage: adminOrRootProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);

      // Admin只能重置自己组织的成员
      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId || actor.organizationId !== input.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Can only reset quota for your own organization members',
          });
        }
      }

      // 验证目标用户是否属于该组织
      const targetUser = await UserModel.findById(db, input.userId);
      if (!targetUser || targetUser.organizationId !== input.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User does not belong to this organization',
        });
      }

      const creditService = new ModelCreditService(db);
      const quota = await creditService.resetMemberUsage(input.organizationId, input.userId);

      if (!quota) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member quota not found',
        });
      }

      return {
        limit: quota.limit,
        organizationId: quota.organizationId,
        success: true,
        used: quota.used,
        userId: quota.userId,
      };
    }),

  // Admin/Root: 设置成员额度限制
  setMemberQuota: adminOrRootProcedure
    .input(setMemberQuotaSchema)
    .mutation(async ({ ctx, input }) => {
      const db = ensureServerDB(ctx);
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const roleSet = normalizeRoles(ctx.userRoles ?? ctx.nextAuth?.roles ?? []);
      const isRoot = roleSet.has(ROOT_ROLE);

      // Admin只能设置自己组织的成员
      if (!isRoot) {
        const actor = await UserModel.findById(db, ctx.userId);
        if (!actor?.organizationId || actor.organizationId !== input.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Can only set quota for your own organization members',
          });
        }
      }

      // 验证目标用户是否属于该组织
      const targetUser = await UserModel.findById(db, input.userId);
      if (!targetUser || targetUser.organizationId !== input.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User does not belong to this organization',
        });
      }

      const creditService = new ModelCreditService(db);
      const quota = await creditService.setMemberQuotaLimit(
        input.organizationId,
        input.userId,
        input.limit,
      );

      return {
        limit: quota.limit,
        organizationId: quota.organizationId,
        success: true,
        used: quota.used,
        userId: quota.userId,
      };
    }),
});
