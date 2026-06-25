const crypto      = require('crypto');
const User         = require('../models/User');
const Role         = require('../models/Role');
const Permission   = require('../models/Permission');
const RefreshToken = require('../models/RefreshToken');
const jwtCfg       = require('../../../config/jwt');
const { ok, fail } = require('../../../utils/envelope');

// ── helpers ───────────────────────────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function buildPermissionKeys(user) {
  const roles = await Role.find({ _id: { $in: user.roles } }).populate('permissions');
  const keys  = new Set();
  for (const role of roles) {
    for (const perm of role.permissions) {
      keys.add(`${perm.moduleId}.${perm.action}`);
    }
  }
  return [...keys];
}

async function buildUserDto(user) {
  const roles = await Role.find({ _id: { $in: user.roles } }).populate('permissions');
  const roleDtos = roles.map(r => ({
    id:          r._id,
    name:        r.name,
    description: r.description || '',
    isSystem:    r.isSystem || false,
    userCount:   0,
    permissions: (r.permissions || []).map(p => ({
      id:       p._id,
      moduleId: p.moduleId,
      action:   p.action,
      description: '',
      key:      `${p.moduleId}.${p.action}`,
    })),
  }));

  return {
    id:            user._id,
    email:         user.email,
    username:      user.username,
    firstName:     user.firstName,
    lastName:      user.lastName,
    fullName:      `${user.firstName} ${user.lastName}`.trim(),
    status:        user.status,
    emailVerified: true,
    avatarUrl:     user.avatarUrl || null,
    phoneNumber:   user.phoneNumber || null,
    lastLoginAt:   new Date().toISOString(),
    createdAt:     user.createdAt,
    roles:         roleDtos,
  };
}

async function issueTokenPair(user, tenantId) {
  const userDto        = await buildUserDto(user);
  const permissionKeys = userDto.roles.flatMap(r => r.permissions.map(p => p.key));
  const uniqueKeys     = [...new Set(permissionKeys)];

  const accessPayload = {
    sub:          user._id.toString(),
    email:        user.email,
    username:     user.username,
    firstName:    user.firstName,
    lastName:     user.lastName,
    status:       user.status,
    is_super_admin: String(user.isSuperAdmin),
    ...(tenantId ? {
      tenant_id:   String(tenantId),
      tenant_slug: user._tenantSlug || '',
      tenant_name: user._tenantName || '',
    } : {}),
    permission: uniqueKeys,
  };

  const accessToken     = jwtCfg.signAccess(accessPayload);
  const accessTokenExp  = new Date(Date.now() + (jwtCfg.accessMinutes || 60) * 60_000);
  const rawRefresh      = crypto.randomBytes(64).toString('base64');
  const tokenHash       = hashToken(rawRefresh);
  const expiresAt       = new Date(Date.now() + jwtCfg.refreshDays * 86400_000);

  await RefreshToken.create({ userId: user._id, tokenHash, expiresAt });

  return {
    accessToken,
    refreshToken:       rawRefresh,
    accessTokenExpiry:  accessTokenExp.toISOString(),
    user:               userDto,
  };
}

function userDto(user) {
  return {
    id:          user._id,
    username:    user.username,
    firstName:   user.firstName,
    lastName:    user.lastName,
    fullName:    `${user.firstName} ${user.lastName}`.trim(),
    email:       user.email,
    phoneNumber: user.phoneNumber || null,
    avatarUrl:   user.avatarUrl || null,
    status:      user.status,
    emailVerified: true,
    lastLoginAt: new Date().toISOString(),
    isSuperAdmin: user.isSuperAdmin,
    roles:       user.roles,
    createdAt:   user.createdAt,
  };
}

// ── POST /api/auth — login ────────────────────────────────────────────────────

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (!user || !(await user.comparePassword(password))) {
      return fail(res, 401, 'Auth.InvalidCredentials', 'Invalid email or password.');
    }
    if (user.status !== 'active') {
      return fail(res, 403, 'Auth.AccountInactive', 'Account is inactive.');
    }
    const tokens = await issueTokenPair(user, user.tenantId);
    return ok(res, tokens);
  } catch (err) { next(err); }
};

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

exports.refresh = async (req, res, next) => {
  try {
    const { token: rawToken } = req.body;
    if (!rawToken) return fail(res, 400, 'BadRequest', 'token required.');

    const tokenHash = hashToken(rawToken);
    const stored    = await RefreshToken.findOne({ tokenHash, revokedAt: null });
    if (!stored || stored.expiresAt < new Date()) {
      return fail(res, 401, 'Auth.InvalidRefreshToken', 'Refresh token expired or invalid.');
    }

    stored.revokedAt = new Date();
    await stored.save();

    const user = await User.findById(stored.userId);
    if (!user || user.isDeleted) return fail(res, 401, 'Auth.UserNotFound', 'User not found.');

    const tokens = await issueTokenPair(user, user.tenantId);
    return ok(res, tokens);
  } catch (err) { next(err); }
};

// ── POST /api/auth/revoke ─────────────────────────────────────────────────────

exports.revoke = async (req, res, next) => {
  try {
    const { token: rawToken } = req.body;
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
    }
    return ok(res, true);
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).populate('roles');
    if (!user || user.isDeleted) return fail(res, 404, 'User.NotFound', 'User not found.');
    return ok(res, userDto(user));
  } catch (err) { next(err); }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, phoneNumber, avatarUrl } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.sub,
      { firstName, lastName, phoneNumber, avatarUrl, updatedAt: new Date() },
      { new: true }
    );
    return ok(res, userDto(user));
  } catch (err) { next(err); }
};

// ── POST /api/auth/me/change-password ────────────────────────────────────────

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.sub);
    if (!(await user.comparePassword(currentPassword))) {
      return fail(res, 400, 'Auth.WrongPassword', 'Current password is incorrect.');
    }
    user.passwordHash = await User.hashPassword(newPassword);
    user.updatedAt    = new Date();
    await user.save();
    return ok(res, null);
  } catch (err) { next(err); }
};

// ── POST /api/auth/forgot-password ───────────────────────────────────────────

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (user) console.log(`[ForgotPassword] Reset requested for ${email}`);
    return ok(res, { message: 'If this email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
};

// ── POST /api/auth/reset-password ────────────────────────────────────────────

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (!user) return fail(res, 400, 'Auth.InvalidResetToken', 'Invalid reset token.');
    user.passwordHash = await User.hashPassword(newPassword);
    user.updatedAt    = new Date();
    await user.save();
    return ok(res, null);
  } catch (err) { next(err); }
};

module.exports.userDto        = userDto;
module.exports.buildPermissionKeys = buildPermissionKeys;
