/* eslint-disable sort-keys-fix/sort-keys-fix  */
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, timestamptz } from './_helpers';
import { organizations } from './organization';
import { users } from './user';

export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  code: text('code').unique().notNull(),

  creatorId: text('creator_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),

  expiresAt: timestamptz('expires_at').notNull(),
  usedAt: timestamptz('used_at'),
  usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),

  ...timestamps,
});

export type NewInviteCode = typeof inviteCodes.$inferInsert;
export type InviteCodeItem = typeof inviteCodes.$inferSelect;
