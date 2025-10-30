'use client';

import { PropsWithChildren, ReactNode } from 'react';

import { useHasRole } from '@/hooks/useHasRole';

export interface HasRoleProps extends PropsWithChildren {
  allOf?: string[];
  anyOf?: string[];
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  not?: string[];
}

const HasRole = ({
  allOf,
  anyOf,
  children,
  fallback = null,
  loadingFallback = null,
  not,
}: HasRoleProps) => {
  const { allowed, loading } = useHasRole({ allOf, anyOf, not });

  if (loading) return loadingFallback ?? null;
  if (!allowed) return fallback ?? null;

  return children;
};

export default HasRole;
