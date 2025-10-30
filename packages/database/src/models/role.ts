import { and, eq, inArray } from 'drizzle-orm';

import {
  type PermissionItem,
  type RoleItem,
  permissions,
  rolePermissions,
  roles,
  userRoles,
} from '../schemas/rbac';
import type { LobeChatDatabase } from '../type';

export type RoleIdentifier = {
  id: number;
  name: string;
};

export const RoleModel = {
  async addUserRoles(
    db: LobeChatDatabase,
    userId: string,
    roleIds: number[],
  ): Promise<void> {
    if (roleIds.length === 0) return;

    await db
      .insert(userRoles)
      .values(roleIds.map((roleId) => ({ roleId, userId })))
      .onConflictDoNothing();
  },

  async getActiveRolesByNames(
    db: LobeChatDatabase,
    names: string[],
  ): Promise<RoleIdentifier[]> {
    if (names.length === 0) return [];

    return db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(and(inArray(roles.name, names), eq(roles.isActive, true)));
  },

  async getPermissionsByRoleIds(
    db: LobeChatDatabase,
    roleIds: number[],
  ): Promise<PermissionItem[]> {
    if (roleIds.length === 0) return [];

    const rows = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    const unique = new Map<string, PermissionItem>();
    rows.forEach(({ permission }) => {
      unique.set(permission.code, permission);
    });

    return [...unique.values()];
  },

  async getRolesByNames(db: LobeChatDatabase, names: string[]): Promise<RoleIdentifier[]> {
    if (names.length === 0) return [];

    return db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(inArray(roles.name, names));
  },

  async getUserPermissions(db: LobeChatDatabase, userId: string): Promise<PermissionItem[]> {
    const rows = await db
      .select({ permission: permissions })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));

    const unique = new Map<string, PermissionItem>();
    rows.forEach(({ permission }) => {
      unique.set(permission.code, permission);
    });

    return [...unique.values()];
  },

  async getUserRoles(db: LobeChatDatabase, userId: string): Promise<RoleItem[]> {
    const rows = await db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return rows.map((row) => row.role);
  },

  async listActiveRoles(db: LobeChatDatabase): Promise<RoleItem[]> {
    return db.select().from(roles).where(eq(roles.isActive, true));
  },

  async removeUserRoles(
    db: LobeChatDatabase,
    userId: string,
    roleIds: number[],
  ): Promise<number> {
    if (roleIds.length === 0) return 0;

    const rows = await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), inArray(userRoles.roleId, roleIds)))
      .returning({ roleId: userRoles.roleId });

    return rows.length;
  },
};
