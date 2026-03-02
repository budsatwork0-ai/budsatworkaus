export type UserRole = 'admin' | 'employee' | 'customer';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  employee: 2,
  customer: 1,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  employee: 'Employee',
  customer: 'Customer',
};

export function resolveUserRole(rawRole: unknown): UserRole {
  const value = String(rawRole || '').toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'employee' || value === 'worker' || value === 'crew') return 'employee';
  return 'customer';
}

export function homePathForRole(role: UserRole): string {
  if (role === 'admin') return '/dashboard';
  if (role === 'employee') return '/crew';
  return '/portal';
}

export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
