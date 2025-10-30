import { LobeChatDatabase } from '@lobechat/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PermissionItem, RoleItem } from '@/database/schemas';

import { RoleService } from './index';

const roleModelMocks = vi.hoisted(() => ({
  addUserRoles: vi.fn(),
  getActiveRolesByNames: vi.fn(),
  getRolesByNames: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserRoles: vi.fn(),
  listActiveRoles: vi.fn(),
  removeUserRoles: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock('@/database/models/role', () => ({
  RoleModel: roleModelMocks,
}));

vi.mock('@/libs/logger', () => ({
  pino: loggerMocks,
}));

describe('RoleService', () => {
  const mockDB = {} as LobeChatDatabase;
  let service: RoleService;

  beforeEach(() => {
    service = new RoleService(mockDB);
    Object.values(roleModelMocks).forEach((mockFn) => mockFn.mockReset());
    loggerMocks.warn.mockReset();
  });

  it('should list active roles', async () => {
    const roles: RoleItem[] = [
      {
        id: 1,
        name: 'user',
        displayName: '基础用户',
        description: 'desc',
        isSystem: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      },
    ];
    roleModelMocks.listActiveRoles.mockResolvedValue(roles);

    const result = await service.listRoles();

    expect(roleModelMocks.listActiveRoles).toHaveBeenCalledWith(mockDB);
    expect(result).toEqual(roles);
  });

  it('should get user roles', async () => {
    const roles: RoleItem[] = [
      {
        id: 2,
        name: 'admin',
        displayName: '管理员',
        description: 'desc',
        isSystem: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      },
    ];
    roleModelMocks.getUserRoles.mockResolvedValue(roles);

    const result = await service.getUserRoles('user-1');

    expect(roleModelMocks.getUserRoles).toHaveBeenCalledWith(mockDB, 'user-1');
    expect(result).toEqual(roles);
  });

  it('should assign roles and report missing ones', async () => {
    roleModelMocks.getActiveRolesByNames.mockResolvedValue([{ id: 2, name: 'admin' }]);

    const result = await service.assignRoles('user-1', [' Admin ', 'unknown', 'admin']);

    expect(roleModelMocks.getActiveRolesByNames).toHaveBeenCalledWith(mockDB, ['admin']);
    expect(roleModelMocks.addUserRoles).toHaveBeenCalledWith(mockDB, 'user-1', [2]);
    expect(result).toEqual({ assigned: 1, missing: ['unknown'] });
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it('should skip assignment when no valid roles provided', async () => {
    const result = await service.assignRoles('user-1', ['   ']);

    expect(roleModelMocks.getActiveRolesByNames).not.toHaveBeenCalled();
    expect(roleModelMocks.addUserRoles).not.toHaveBeenCalled();
    expect(result).toEqual({ assigned: 0, missing: [] });
  });

  it('should return missing roles when none found', async () => {
    roleModelMocks.getActiveRolesByNames.mockResolvedValue([]);

    const result = await service.assignRoles('user-1', ['root']);

    expect(roleModelMocks.addUserRoles).not.toHaveBeenCalled();
    expect(result).toEqual({ assigned: 0, missing: ['root'] });
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it('should revoke roles', async () => {
    roleModelMocks.getRolesByNames.mockResolvedValue([
      { id: 1, name: 'user' },
      { id: 2, name: 'admin' },
    ]);
    roleModelMocks.removeUserRoles.mockResolvedValue(2);

    const result = await service.revokeRoles('user-2', ['User', 'ADMIN']);

    expect(roleModelMocks.getRolesByNames).toHaveBeenCalledWith(mockDB, ['user', 'admin']);
    expect(roleModelMocks.removeUserRoles).toHaveBeenCalledWith(mockDB, 'user-2', [1, 2]);
    expect(result).toBe(2);
  });

  it('should handle revoke when nothing matches', async () => {
    roleModelMocks.getRolesByNames.mockResolvedValue([]);

    const result = await service.revokeRoles('user-2', ['ghost']);

    expect(roleModelMocks.removeUserRoles).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it('should get user permissions', async () => {
    const permissionsList: PermissionItem[] = [
      {
        id: 1,
        code: 'app.basic',
        name: '基础功能',
        description: 'desc',
        category: 'application',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      },
    ];
    roleModelMocks.getUserPermissions.mockResolvedValue(permissionsList);

    const result = await service.getUserPermissions('user-3');

    expect(roleModelMocks.getUserPermissions).toHaveBeenCalledWith(mockDB, 'user-3');
    expect(result).toEqual(permissionsList);
  });
});
