import type { LobeChatDatabase } from '@lobechat/database';

import {
  ORGANIZATION_TYPE_MANAGEMENT,
  ORGANIZATION_TYPE_SCHOOL,
  OrganizationType,
} from '@/const/rbac';
import { OrganizationModel } from '@/database/models/organization';
import {
  BusinessErrorType,
  createBusinessError,
  createInternalError,
  createNotFoundError,
} from '@/server/utils/businessError';

export interface CreateOrganizationInput {
  maxUsers?: number | null;
  name: string;
  parentId?: string | null;
  type: OrganizationType;
}

export interface UpdateOrganizationInput {
  maxUsers?: number | null;
  name?: string;
  parentId?: string | null;
  type?: OrganizationType;
}

export class OrganizationService {
  constructor(private readonly db: LobeChatDatabase) {}

  listOrganizations = async () => {
    return OrganizationModel.list(this.db);
  };

  createOrganization = async ({ maxUsers, name, parentId, type }: CreateOrganizationInput) => {
    if (!name.trim()) {
      throw createBusinessError(BusinessErrorType.ORGANIZATION_NAME_REQUIRED);
    }

    if (!([ORGANIZATION_TYPE_MANAGEMENT, ORGANIZATION_TYPE_SCHOOL] as string[]).includes(type)) {
      throw createBusinessError(BusinessErrorType.ORGANIZATION_TYPE_UNSUPPORTED);
    }

    const organization = await OrganizationModel.create(this.db, {
      maxUsers: maxUsers ?? null,
      name: name.trim(),
      parentId: parentId ?? null,
      type,
    });

    if (!organization) {
      throw createInternalError('创建组织失败');
    }

    return organization;
  };

  updateOrganization = async (id: string, input: UpdateOrganizationInput) => {
    const existing = await OrganizationModel.findById(this.db, id);
    if (!existing) {
      throw createNotFoundError('组织');
    }

    if (existing.type === ORGANIZATION_TYPE_MANAGEMENT && input.type) {
      throw createBusinessError(BusinessErrorType.ORGANIZATION_TYPE_IMMUTABLE);
    }

    if (
      input.type &&
      !([ORGANIZATION_TYPE_MANAGEMENT, ORGANIZATION_TYPE_SCHOOL] as string[]).includes(input.type)
    ) {
      throw createBusinessError(BusinessErrorType.ORGANIZATION_TYPE_UNSUPPORTED);
    }

    const updated = await OrganizationModel.update(this.db, id, input);
    if (!updated) {
      throw createInternalError('更新组织失败');
    }
    return updated;
  };

  deleteOrganization = async (id: string) => {
    const existing = await OrganizationModel.findById(this.db, id);
    if (!existing) {
      throw createNotFoundError('组织');
    }

    if (existing.type === ORGANIZATION_TYPE_MANAGEMENT) {
      throw createBusinessError(BusinessErrorType.ORGANIZATION_MANAGEMENT_UNDELETABLE);
    }

    if (await OrganizationModel.hasUsers(this.db, id)) {
      throw createBusinessError(BusinessErrorType.ORGANIZATION_HAS_USERS);
    }

    const removed = await OrganizationModel.delete(this.db, id);
    if (!removed) {
      throw createInternalError('删除组织失败');
    }
    return removed;
  };
}
