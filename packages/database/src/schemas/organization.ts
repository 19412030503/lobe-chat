import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './_helpers';

// @ts-ignore - self reference defined in same scope
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  maxUsers: integer('max_users'),
  name: text('name').notNull().unique(),
  // @ts-ignore
  parentId: uuid('parent_id').references(() => organizations.id, { onDelete: 'set null' }),

  type: text('type').notNull(),
  ...timestamps,
});

export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationItem = typeof organizations.$inferSelect;
