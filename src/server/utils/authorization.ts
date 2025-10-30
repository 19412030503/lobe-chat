import { TRPCError } from '@trpc/server';

type RoleSource = string[] | undefined | null;

const normalize = (roles: RoleSource) => {
  if (!roles) return new Set<string>();
  return new Set(roles.map((role) => role.trim().toLowerCase()).filter(Boolean));
};

export const hasRequiredRole = (roles: RoleSource, expected: string | string[]): boolean => {
  const normalized = normalize(roles);
  const requirements = Array.isArray(expected) ? expected : [expected];
  return requirements
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean)
    .some((role) => normalized.has(role));
};

export const assertHasRole = (
  roles: RoleSource,
  expected: string | string[],
  error?: Error,
): void => {
  if (hasRequiredRole(roles, expected)) return;

  if (error) throw error;
  throw new TRPCError({ code: 'FORBIDDEN', message: 'insufficient role permission' });
};
