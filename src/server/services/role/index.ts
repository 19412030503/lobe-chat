import type { LobeChatDatabase } from '@lobechat/database';

import { type RoleIdentifier, RoleModel } from '@/database/models/role';
import type { PermissionItem, RoleItem } from '@/database/schemas';
import { pino } from '@/libs/logger';

export type AssignRolesResult = {
  assigned: number;
  missing: string[];
};

export class RoleService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  async listRoles(): Promise<RoleItem[]> {
    return RoleModel.listActiveRoles(this.db);
  }

  async getUserRoles(userId: string): Promise<RoleItem[]> {
    return RoleModel.getUserRoles(this.db, userId);
  }

  async getUserPermissions(userId: string): Promise<PermissionItem[]> {
    return RoleModel.getUserPermissions(this.db, userId);
  }

  async assignRoles(userId: string, roleNames: string[]): Promise<AssignRolesResult> {
    const normalized = RoleService.normalizeRoleNames(roleNames);

    if (normalized.length === 0) return { assigned: 0, missing: [] };

    const candidates = await RoleModel.getActiveRolesByNames(this.db, normalized);
    const { missing, identified } = RoleService.splitRoles(normalized, candidates);

    if (missing.length > 0) {
      pino.warn(`[RoleService] 未找到角色: ${missing.join(', ')}`);
    }

    if (identified.length === 0) return { assigned: 0, missing };

    await RoleModel.addUserRoles(
      this.db,
      userId,
      identified.map((role) => role.id),
    );

    return { assigned: identified.length, missing };
  }

  async revokeRoles(userId: string, roleNames: string[]): Promise<number> {
    const normalized = RoleService.normalizeRoleNames(roleNames);
    if (normalized.length === 0) return 0;

    const candidates = await RoleModel.getRolesByNames(this.db, normalized);
    if (candidates.length === 0) return 0;

    return RoleModel.removeUserRoles(
      this.db,
      userId,
      candidates.map((role) => role.id),
    );
  }

  private static normalizeRoleNames(roleNames: string[]): string[] {
    const normalized = roleNames
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0);

    return Array.from(new Set(normalized));
  }

  private static splitRoles(input: string[], found: RoleIdentifier[]) {
    const foundSet = new Set(found.map((item) => item.name));
    const missing = input.filter((name) => !foundSet.has(name));

    return {
      identified: found,
      missing,
    };
  }
}
