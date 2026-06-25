const { verify } = require('../config/jwt');

/**
 * Verifies the Bearer JWT and attaches decoded payload to req.user.
 * Mirrors the .NET JWT bearer middleware + TenantContextMiddleware.
 *
 * Claims in token:
 *   sub           — user UUID
 *   email         — user email
 *   username      — display username
 *   firstName / lastName
 *   tenant_id     — tenant UUID (null for super-admin)
 *   is_super_admin — "true" | "false"
 *   permission[]  — array of permission keys
 *   modules       — comma-separated licensed module ids
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'Unauthorized', description: 'Missing bearer token.' });
  }

  try {
    const token   = header.slice(7);
    const decoded = verify(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ code: 'Unauthorized', description: 'Invalid or expired token.' });
  }
}

/**
 * requirePermission(key) — mirrors [RequirePermission] attribute.
 * Bypasses check for super-admin.
 */
function requirePermission(key) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: 'Unauthorized', description: 'Not authenticated.' });

    if (user.is_super_admin === 'true' || user.is_super_admin === true) return next();

    const perms = Array.isArray(user.permission) ? user.permission : [user.permission].filter(Boolean);
    if (perms.includes(key)) return next();

    return res.status(403).json({ code: 'Permission.Denied', description: `Missing permission: ${key}` });
  };
}

/** Tenant helper — resolves tenantId from the JWT */
function tenantId(req) {
  return req.user?.tenant_id || null;
}

/** True if the caller is the global super-admin (no tenant) */
function isSuperAdmin(req) {
  return req.user?.is_super_admin === 'true' || req.user?.is_super_admin === true;
}

/** Build a base MongoDB filter scoped to the caller's tenant */
function tenantFilter(req, extra = {}) {
  if (isSuperAdmin(req)) return extra;
  return { tenantId: tenantId(req), ...extra };
}

module.exports = { authenticate, requirePermission, tenantId, isSuperAdmin, tenantFilter };
