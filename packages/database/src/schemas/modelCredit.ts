/* eslint-disable sort-keys-fix/sort-keys-fix  */
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamps } from './_helpers';
import { organizations } from './organization';
import { users } from './user';

export const modelCredits = pgTable(
  'model_credits',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('modelCredits'))
      .primaryKey(),

    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),

    balance: integer('balance').notNull().default(0),

    metadata: jsonb('metadata'),

    ...timestamps,
  },
  (t) => ({
    organizationUnique: uniqueIndex('model_credits_organization_unique').on(t.organizationId),
  }),
);

export type NewModelCredit = typeof modelCredits.$inferInsert;
export type ModelCreditItem = typeof modelCredits.$inferSelect;

export const memberQuotas = pgTable(
  'member_quotas',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('memberQuotas'))
      .primaryKey(),

    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),

    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    limit: integer('limit'),

    used: integer('used').notNull().default(0),

    period: varchar('period', { length: 32 }).notNull().default('total'),

    metadata: jsonb('metadata'),

    ...timestamps,
  },
  (t) => ({
    organizationUserUnique: uniqueIndex('member_quotas_org_user_unique').on(
      t.organizationId,
      t.userId,
    ),
    organizationIdx: index('member_quotas_organization_idx').on(t.organizationId),
    userIdx: index('member_quotas_user_idx').on(t.userId),
  }),
);

export type NewMemberQuota = typeof memberQuotas.$inferInsert;
export type MemberQuotaItem = typeof memberQuotas.$inferSelect;

export const modelUsages = pgTable(
  'model_usage',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('modelUsage'))
      .primaryKey(),

    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    usageType: varchar('usage_type', { length: 32 }).notNull(),

    model: text('model'),
    provider: text('provider'),

    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),

    countUsed: integer('count_used'),

    creditCost: integer('credit_cost').notNull(),

    metadata: jsonb('metadata'),

    ...timestamps,
  },
  (t) => ({
    organizationIdx: index('model_usage_organization_idx').on(t.organizationId),
    userIdx: index('model_usage_user_idx').on(t.userId),
    typeIdx: index('model_usage_type_idx').on(t.usageType),
  }),
);

export type NewModelUsage = typeof modelUsages.$inferInsert;
export type ModelUsageItem = typeof modelUsages.$inferSelect;

export const modelCreditTransactions = pgTable(
  'model_credit_transactions',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('modelCreditTransactions'))
      .primaryKey(),

    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    usageId: text('usage_id').references(() => modelUsages.id, { onDelete: 'set null' }),

    delta: integer('delta').notNull(),
    balanceAfter: integer('balance_after'),

    reason: varchar('reason', { length: 64 }),

    metadata: jsonb('metadata'),

    ...timestamps,
  },
  (t) => ({
    organizationIdx: index('model_credit_transactions_org_idx').on(t.organizationId),
    userIdx: index('model_credit_transactions_user_idx').on(t.userId),
    usageIdx: index('model_credit_transactions_usage_idx').on(t.usageId),
  }),
);

export type NewModelCreditTransaction = typeof modelCreditTransactions.$inferInsert;
export type ModelCreditTransactionItem = typeof modelCreditTransactions.$inferSelect;
