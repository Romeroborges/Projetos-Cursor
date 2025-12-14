const ROLE_PERMISSIONS = {
    ADMIN: [
        'users:read',
        'users:write',
        'tables:read',
        'tables:write',
        'products:read',
        'products:write',
        'orders:read',
        'orders:write',
        'orders:close',
        'cash:read',
        'cash:write',
        'reports:read',
    ],
    GERENTE: [
        'users:read',
        'tables:read',
        'tables:write',
        'products:read',
        'products:write',
        'orders:read',
        'orders:write',
        'orders:close',
        'cash:read',
        'cash:write',
        'reports:read',
    ],
    ATENDENTE: ['tables:read', 'products:read', 'orders:read', 'orders:write'],
    CAIXA: ['tables:read', 'orders:read', 'orders:close', 'cash:read', 'cash:write', 'reports:read'],
};
export function hasPermission(role, perm) {
    return ROLE_PERMISSIONS[role].includes(perm);
}
