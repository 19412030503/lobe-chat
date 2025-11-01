import { eq } from 'drizzle-orm';

import { organizations, users } from '../schemas';
import type { OrganizationItem } from '../schemas';
import type { LobeChatDatabase } from '../type';

export type OrganizationMutation = {
  maxUsers?: number | null;
  name?: string;
  parentId?: string | null;
  type?: string;
};

export const OrganizationModel = {
  async create(
    db: LobeChatDatabase,
    params: { maxUsers?: number | null; name: string; parentId?: string | null; type: string },
  ): Promise<OrganizationItem | undefined> {
    const result = await db
      .insert(organizations)
      .values({
        maxUsers: params.maxUsers ?? null,
        name: params.name,
        parentId: params.parentId ?? null,
        type: params.type,
      })
      .returning();

    const rows = Array.isArray(result) ? (result as OrganizationItem[]) : [];
    return rows[0];
  },

  async delete(db: LobeChatDatabase, id: string): Promise<OrganizationItem | undefined> {
    const result = await db.delete(organizations).where(eq(organizations.id, id)).returning();

    const rows = Array.isArray(result) ? (result as OrganizationItem[]) : [];
    return rows[0];
  },

  async findById(db: LobeChatDatabase, id: string) {
    return db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  },

  async getUserCount(db: LobeChatDatabase, id: string): Promise<number> {
    const result = await db.select().from(users).where(eq(users.organizationId, id));
    return result.length;
  },

  async hasUsers(db: LobeChatDatabase, id: string) {
    const existingUser = await db.query.users.findFirst({ where: eq(users.organizationId, id) });
    return Boolean(existingUser);
  },

  async list(db: LobeChatDatabase) {
    return db.select().from(organizations);
  },

  async update(
    db: LobeChatDatabase,
    id: string,
    params: OrganizationMutation,
  ): Promise<OrganizationItem | undefined> {
    const payload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (params.maxUsers !== undefined) payload.maxUsers = params.maxUsers ?? null;
    if (params.name !== undefined) payload.name = params.name;
    if (params.type !== undefined) payload.type = params.type;
    if (params.parentId !== undefined) payload.parentId = params.parentId ?? null;

    const result = await db
      .update(organizations)
      .set(payload)
      .where(eq(organizations.id, id))
      .returning();

    const rows = Array.isArray(result) ? (result as OrganizationItem[]) : [];
    return rows[0];
  },
};
