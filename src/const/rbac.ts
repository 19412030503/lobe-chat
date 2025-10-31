export const ROOT_ROLE = 'root' as const;
export const ADMIN_ROLE = 'admin' as const;
export const USER_ROLE = 'user' as const;

export const SYSTEM_ROLES = [ROOT_ROLE, ADMIN_ROLE, USER_ROLE] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ORGANIZATION_TYPE_MANAGEMENT = 'management' as const;
export const ORGANIZATION_TYPE_SCHOOL = 'school' as const;

export const ORGANIZATION_TYPES = [ORGANIZATION_TYPE_MANAGEMENT, ORGANIZATION_TYPE_SCHOOL] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
