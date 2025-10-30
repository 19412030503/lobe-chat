'use client';

import isEqual from 'fast-deep-equal';
import { useMemo } from 'react';

import { enableAuth } from '@/const/auth';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

type RoleMatcherOptions = {
  allOf?: string[];
  anyOf?: string[];
  not?: string[];
};

const normalizeRoles = (roles?: string[]) =>
  Array.from(
    new Set(
      (roles ?? [])
        .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
        .map((role) => role.trim().toLowerCase()),
    ),
  );

export const useUserRoles = () => {
  const roles = useUserStore(
    (s) => s.roles ?? [],
    (a, b) => isEqual(a, b),
  );
  return useMemo(() => normalizeRoles(roles), [roles]);
};

export const useHasRole = (options?: RoleMatcherOptions) => {
  const roles = useUserRoles();
  const roleSet = useMemo(() => new Set(roles), [roles]);
  const isLoaded = useUserStore(authSelectors.isLoaded);
  const isLoginWithAuth = useUserStore(authSelectors.isLoginWithAuth);

  const normalizedOptions = useMemo(() => {
    const anyOf = normalizeRoles(options?.anyOf);
    const allOf = normalizeRoles(options?.allOf);
    const not = normalizeRoles(options?.not);
    return { allOf, anyOf, not };
  }, [options?.allOf, options?.anyOf, options?.not]);

  const allowed = useMemo(() => {
    if (!enableAuth) return true;
    if (!isLoginWithAuth) return false;

    const { anyOf, allOf, not } = normalizedOptions;
    const anyMatched = anyOf.length === 0 || anyOf.some((role) => roleSet.has(role));
    const allMatched = allOf.every((role) => roleSet.has(role));
    const notMatched = not.every((role) => !roleSet.has(role));

    return anyMatched && allMatched && notMatched;
  }, [normalizedOptions, roleSet, isLoginWithAuth]);

  return {
    allowed,
    loading: enableAuth && !isLoaded,
    roles,
  };
};
