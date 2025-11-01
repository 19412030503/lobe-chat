import type { LobeChatDatabase } from '@lobechat/database';
import { eq } from 'drizzle-orm';

import {
  MemberQuotaModel,
  ModelCreditModel,
  ModelCreditTransactionModel,
  ModelUsageModel,
} from '@/database/models/modelCredit';
import type {
  MemberQuotaItem,
  ModelCreditItem,
  ModelUsageItem,
} from '@/database/schemas/modelCredit';
import { users } from '@/database/schemas/user';

export type ModelCreditErrorCode =
  | 'USER_ORGANIZATION_REQUIRED'
  | 'ORGANIZATION_CREDIT_INSUFFICIENT'
  | 'MEMBER_QUOTA_EXCEEDED';

export class ModelCreditError extends Error {
  code: ModelCreditErrorCode;

  constructor(code: ModelCreditErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ModelCreditError';
  }
}

export type UsageType = 'text' | 'image' | 'threeD' | 'audio' | 'other';

export interface AllowanceContext {
  memberQuota: MemberQuotaItem;
  organization: ModelCreditItem;
  organizationId: string;
}

export interface AllowanceCheckOptions {
  organizationId?: string;
  requiredCredits: number;
  userId: string;
}

export interface ChargeUsageInput {
  credits: number;
  organizationId?: string;
  reason?: string;
  usage: {
    countUsed?: number | null;
    inputTokens?: number | null;
    metadata?: Record<string, unknown> | null;
    model?: string | null;
    outputTokens?: number | null;
    provider?: string | null;
    totalTokens?: number | null;
    usageType: UsageType;
  };
  userId: string;
}

export interface ChargeUsageResult {
  memberQuota: MemberQuotaItem;
  organization: ModelCreditItem;
  usage: ModelUsageItem;
}

export class ModelCreditService {
  private readonly creditModel: ModelCreditModel;
  private readonly memberQuotaModel: MemberQuotaModel;
  private readonly usageModel: ModelUsageModel;
  private readonly transactionModel: ModelCreditTransactionModel;

  constructor(private readonly db: LobeChatDatabase) {
    this.creditModel = new ModelCreditModel(db);
    this.memberQuotaModel = new MemberQuotaModel(db);
    this.usageModel = new ModelUsageModel(db);
    this.transactionModel = new ModelCreditTransactionModel(db);
  }

  private resolveOrganizationId = async (userId: string): Promise<string> => {
    const user = await this.db.query.users.findFirst({
      columns: { organizationId: true },
      where: eq(users.id, userId),
    });

    if (!user?.organizationId) {
      throw new ModelCreditError(
        'USER_ORGANIZATION_REQUIRED',
        'User must belong to an organization to use credits',
      );
    }

    return user.organizationId;
  };

  ensureAllowance = async ({
    userId,
    organizationId,
    requiredCredits,
  }: AllowanceCheckOptions): Promise<AllowanceContext> => {
    const resolvedOrganizationId = organizationId ?? (await this.resolveOrganizationId(userId));

    const organization = await this.creditModel.ensure(resolvedOrganizationId, 0);
    const memberQuota = await this.memberQuotaModel.ensure(resolvedOrganizationId, userId);

    if (requiredCredits > 0 && organization.balance < requiredCredits) {
      throw new ModelCreditError(
        'ORGANIZATION_CREDIT_INSUFFICIENT',
        'Organization credit balance is insufficient',
      );
    }

    if (
      requiredCredits > 0 &&
      memberQuota.limit !== null &&
      memberQuota.limit !== undefined &&
      memberQuota.used + requiredCredits > memberQuota.limit
    ) {
      throw new ModelCreditError('MEMBER_QUOTA_EXCEEDED', 'Member quota has been exhausted');
    }

    return {
      memberQuota,
      organization,
      organizationId: resolvedOrganizationId,
    };
  };

  charge = async (
    { userId, organizationId, credits, usage, reason }: ChargeUsageInput,
    context?: AllowanceContext,
  ): Promise<ChargeUsageResult> => {
    if (credits < 0) {
      throw new Error('credits must be a positive number');
    }

    const resolvedOrganizationId =
      organizationId ?? context?.organizationId ?? (await this.resolveOrganizationId(userId));

    const allowance =
      context ??
      (await this.ensureAllowance({
        organizationId: resolvedOrganizationId,
        requiredCredits: credits,
        userId,
      }));

    const result = await this.db.transaction(async (tx) => {
      const organizationSnapshot =
        allowance.organization ?? (await this.creditModel.ensure(resolvedOrganizationId, 0, tx));

      if (organizationSnapshot.balance < credits) {
        throw new ModelCreditError(
          'ORGANIZATION_CREDIT_INSUFFICIENT',
          'Organization credit balance is insufficient',
        );
      }

      const updatedOrganization =
        credits === 0
          ? organizationSnapshot
          : await this.creditModel.adjustBalance(resolvedOrganizationId, -credits, tx);

      if (!updatedOrganization) {
        throw new ModelCreditError(
          'ORGANIZATION_CREDIT_INSUFFICIENT',
          'Failed to adjust organization credit balance',
        );
      }

      if (updatedOrganization.balance < 0) {
        throw new ModelCreditError(
          'ORGANIZATION_CREDIT_INSUFFICIENT',
          'Organization credit balance is insufficient',
        );
      }

      const memberQuotaSnapshot =
        allowance.memberQuota ??
        (await this.memberQuotaModel.ensure(resolvedOrganizationId, userId, tx));

      if (
        memberQuotaSnapshot.limit !== null &&
        memberQuotaSnapshot.limit !== undefined &&
        memberQuotaSnapshot.used + credits > memberQuotaSnapshot.limit
      ) {
        throw new ModelCreditError('MEMBER_QUOTA_EXCEEDED', 'Member quota has been exhausted');
      }

      const updatedMemberQuota =
        credits === 0
          ? memberQuotaSnapshot
          : await this.memberQuotaModel.incrementUsed(resolvedOrganizationId, userId, credits, tx);

      if (!updatedMemberQuota) {
        throw new ModelCreditError('MEMBER_QUOTA_EXCEEDED', 'Failed to update member quota');
      }

      const usageRecord = await this.usageModel.create(
        {
          countUsed: usage.countUsed ?? undefined,
          creditCost: credits,
          inputTokens: usage.inputTokens ?? undefined,
          metadata: usage.metadata ?? undefined,
          model: usage.model ?? undefined,
          organizationId: resolvedOrganizationId,
          outputTokens: usage.outputTokens ?? undefined,
          provider: usage.provider ?? undefined,
          totalTokens: usage.totalTokens ?? undefined,
          usageType: usage.usageType,
          userId,
        },
        tx,
      );

      await this.transactionModel.create(
        {
          balanceAfter: updatedOrganization.balance,
          delta: -credits,
          organizationId: resolvedOrganizationId,
          reason: reason ?? usage.usageType,
          usageId: usageRecord.id,
          userId,
        },
        tx,
      );

      return {
        memberQuota: updatedMemberQuota,
        organization: updatedOrganization,
        usage: usageRecord,
      };
    });

    return result;
  };

  rechargeOrganization = async (
    organizationId: string,
    delta: number,
    operatorId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<ModelCreditItem> => {
    if (delta === 0) {
      throw new Error('Recharge delta cannot be zero');
    }

    await this.creditModel.ensure(organizationId, 0);

    const updated = await this.db.transaction(async (tx) => {
      const updatedOrg = await this.creditModel.adjustBalance(organizationId, delta, tx);
      if (!updatedOrg) {
        throw new Error('Failed to adjust organization balance');
      }

      await this.transactionModel.create(
        {
          balanceAfter: updatedOrg.balance,
          delta,
          metadata,
          organizationId,
          reason: delta > 0 ? 'recharge' : 'adjust',
          usageId: null,
          userId: operatorId,
        },
        tx,
      );

      return updatedOrg;
    });

    return updated;
  };

  resetMemberUsage = async (organizationId: string, userId: string) => {
    return this.memberQuotaModel.resetUsed(organizationId, userId);
  };

  setOrganizationBalance = async (
    organizationId: string,
    balance: number,
    operatorId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<ModelCreditItem> => {
    const current = await this.creditModel.ensure(organizationId, 0);
    const delta = balance - current.balance;

    if (delta === 0) return current;

    return this.rechargeOrganization(organizationId, delta, operatorId, metadata);
  };

  setMemberQuotaLimit = async (
    organizationId: string,
    userId: string,
    limit: number | null,
  ): Promise<MemberQuotaItem> => {
    await this.memberQuotaModel.ensure(organizationId, userId);
    const updated = await this.memberQuotaModel.setLimit(organizationId, userId, limit);
    if (updated) return updated;

    const quota = await this.memberQuotaModel.get(organizationId, userId);
    if (!quota) {
      throw new ModelCreditError(
        'USER_ORGANIZATION_REQUIRED',
        'Member quota not found for specified user',
      );
    }
    return quota;
  };
}
