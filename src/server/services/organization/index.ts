import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';

import {
  ORGANIZATION_TYPE_MANAGEMENT,
  ORGANIZATION_TYPE_SCHOOL,
  OrganizationType,
} from '@/const/rbac';
import { OrganizationModel } from '@/database/models/organization';

export interface CreateOrganizationInput {
  name: string;
  parentId?: string | null;
  type: OrganizationType;
}

export interface UpdateOrganizationInput {
  name?: string;
  parentId?: string | null;
  type?: OrganizationType;
}

export class OrganizationService {
  constructor(private readonly db: LobeChatDatabase) {}

  listOrganizations = async () => {
    return OrganizationModel.list(this.db);
  };

  createOrganization = async ({ name, parentId, type }: CreateOrganizationInput) => {
    if (!name.trim()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization name is required' });
    }

    if (!([ORGANIZATION_TYPE_MANAGEMENT, ORGANIZATION_TYPE_SCHOOL] as string[]).includes(type)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported organization type' });
    }

    const organization = await OrganizationModel.create(this.db, {
      name: name.trim(),
      parentId: parentId ?? null,
      type,
    });

    if (!organization) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create organization',
      });
    }

    return organization;
  };

  updateOrganization = async (id: string, input: UpdateOrganizationInput) => {
    const existing = await OrganizationModel.findById(this.db, id);
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    if (existing.type === ORGANIZATION_TYPE_MANAGEMENT && input.type) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Management organization type cannot be changed',
      });
    }

    if (
      input.type &&
      !([ORGANIZATION_TYPE_MANAGEMENT, ORGANIZATION_TYPE_SCHOOL] as string[]).includes(input.type)
    ) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported organization type' });
    }

    const updated = await OrganizationModel.update(this.db, id, input);
    if (!updated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update organization',
      });
    }
    return updated;
  };

  deleteOrganization = async (id: string) => {
    const existing = await OrganizationModel.findById(this.db, id);
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    if (existing.type === ORGANIZATION_TYPE_MANAGEMENT) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot delete management organization',
      });
    }

    if (await OrganizationModel.hasUsers(this.db, id)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Organization has users and cannot be deleted',
      });
    }

    const removed = await OrganizationModel.delete(this.db, id);
    if (!removed) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete organization',
      });
    }
    return removed;
  };
}
