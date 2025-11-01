import { and, eq, sql } from 'drizzle-orm';

import {
  MemberQuotaItem,
  ModelCreditItem,
  ModelCreditTransactionItem,
  ModelUsageItem,
  type NewMemberQuota,
  type NewModelCredit,
  type NewModelCreditTransaction,
  type NewModelUsage,
  memberQuotas,
  modelCreditTransactions,
  modelCredits,
  modelUsages,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

export class ModelCreditModel {
  constructor(private readonly db: LobeChatDatabase) {}

  getByOrganization = async (organizationId: string, trx?: Transaction) => {
    const db = trx || this.db;

    return db.query.modelCredits.findFirst({
      where: eq(modelCredits.organizationId, organizationId),
    });
  };

  ensure = async (
    organizationId: string,
    initialBalance: number = 0,
    trx?: Transaction,
  ): Promise<ModelCreditItem> => {
    const db = trx || this.db;

    const result = await db
      .insert(modelCredits)
      .values({
        balance: initialBalance,
        organizationId,
      } satisfies NewModelCredit)
      .onConflictDoUpdate({
        set: {
          updatedAt: new Date(),
        },
        target: modelCredits.organizationId,
      })
      .returning();

    return result[0];
  };

  adjustBalance = async (
    organizationId: string,
    delta: number,
    trx?: Transaction,
  ): Promise<ModelCreditItem | undefined> => {
    const db = trx || this.db;

    const result = await db
      .update(modelCredits)
      .set({
        balance: sql`${modelCredits.balance} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(modelCredits.organizationId, organizationId))
      .returning();

    return result[0];
  };

  setBalance = async (
    organizationId: string,
    balance: number,
    trx?: Transaction,
  ): Promise<ModelCreditItem | undefined> => {
    const db = trx || this.db;

    const result = await db
      .update(modelCredits)
      .set({
        balance,
        updatedAt: new Date(),
      })
      .where(eq(modelCredits.organizationId, organizationId))
      .returning();

    return result[0];
  };
}

export class MemberQuotaModel {
  constructor(private readonly db: LobeChatDatabase) {}

  get = async (organizationId: string, userId: string, trx?: Transaction) => {
    const db = trx || this.db;

    return db.query.memberQuotas.findFirst({
      where: and(eq(memberQuotas.organizationId, organizationId), eq(memberQuotas.userId, userId)),
    });
  };

  ensure = async (
    organizationId: string,
    userId: string,
    trx?: Transaction,
  ): Promise<MemberQuotaItem> => {
    const db = trx || this.db;

    const result = await db
      .insert(memberQuotas)
      .values({
        limit: null,
        organizationId,
        period: 'total',
        used: 0,
        userId,
      } satisfies NewMemberQuota)
      .onConflictDoUpdate({
        set: { updatedAt: new Date() },
        target: [memberQuotas.organizationId, memberQuotas.userId],
      })
      .returning();

    return result[0];
  };

  setLimit = async (
    organizationId: string,
    userId: string,
    limit: number | null,
    trx?: Transaction,
  ): Promise<MemberQuotaItem | undefined> => {
    const db = trx || this.db;

    const result = await db
      .update(memberQuotas)
      .set({
        limit,
        updatedAt: new Date(),
      })
      .where(and(eq(memberQuotas.organizationId, organizationId), eq(memberQuotas.userId, userId)))
      .returning();

    return result[0];
  };

  incrementUsed = async (
    organizationId: string,
    userId: string,
    delta: number,
    trx?: Transaction,
  ): Promise<MemberQuotaItem | undefined> => {
    const db = trx || this.db;

    const result = await db
      .update(memberQuotas)
      .set({
        updatedAt: new Date(),
        used: sql`GREATEST(${memberQuotas.used} + ${delta}, 0)`,
      })
      .where(and(eq(memberQuotas.organizationId, organizationId), eq(memberQuotas.userId, userId)))
      .returning();

    return result[0];
  };

  resetUsed = async (
    organizationId: string,
    userId: string,
    trx?: Transaction,
  ): Promise<MemberQuotaItem | undefined> => {
    const db = trx || this.db;

    const result = await db
      .update(memberQuotas)
      .set({
        updatedAt: new Date(),
        used: 0,
      })
      .where(and(eq(memberQuotas.organizationId, organizationId), eq(memberQuotas.userId, userId)))
      .returning();

    return result[0];
  };
}

export class ModelUsageModel {
  constructor(private readonly db: LobeChatDatabase) {}

  create = async (payload: NewModelUsage, trx?: Transaction): Promise<ModelUsageItem> => {
    const db = trx || this.db;

    const result = await db.insert(modelUsages).values(payload).returning();

    return result[0];
  };
}

export class ModelCreditTransactionModel {
  constructor(private readonly db: LobeChatDatabase) {}

  create = async (
    payload: NewModelCreditTransaction,
    trx?: Transaction,
  ): Promise<ModelCreditTransactionItem> => {
    const db = trx || this.db;

    const result = await db.insert(modelCreditTransactions).values(payload).returning();

    return result[0];
  };
}
