const User       = require('../models/User');
const Role       = require('../models/Role');
const { paged, parsePaging } = require('../../../utils/helpers');
const { tenantFilter }       = require('../../../middleware/auth');
const { userDto }            = require('./auth.controller');
const { ok, fail }           = require('../../../utils/envelope');

const summaryDto = u => ({
  id:            u._id,
  email:         u.email,
  username:      u.username,
  fullName:      `${u.firstName} ${u.lastName}`.trim(),
  status:        u.status,
  emailVerified: true,
  createdAt:     u.createdAt,
  roleCount:     Array.isArray(u.roles) ? u.roles.length : 0,
});

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const filter = { ...tenantFilter(req), isDeleted: false };
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ username: re }, { email: re }, { firstName: re }, { lastName: re }];
    }
    const [items, total] = await Promise.all([
      User.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);
    return ok(res, paged(items.map(summaryDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }).populate('roles');
    if (!user) return fail(res, 404, 'User.NotFound', 'User not found.');
    return ok(res, userDto(user));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { username, firstName, lastName, email, password, phoneNumber, avatarUrl } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase(), isDeleted: false, tenantId: req.user.tenant_id || null });
    if (exists) return fail(res, 409, 'User.Duplicate', 'A user with this email already exists.');
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      tenantId: req.user.tenant_id || null,
      username, firstName, lastName,
      email: email.toLowerCase(),
      passwordHash, phoneNumber, avatarUrl,
    });
    return ok(res, userDto(user), 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { firstName, lastName, phoneNumber, avatarUrl } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { firstName, lastName, phoneNumber, avatarUrl, updatedAt: new Date() },
      { new: true }
    ).populate('roles');
    if (!user) return fail(res, 404, 'User.NotFound', 'User not found.');
    return ok(res, userDto(user));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      { isDeleted: true, updatedAt: new Date() }
    );
    if (!user) return fail(res, 404, 'User.NotFound', 'User not found.');
    return ok(res, null);
  } catch (err) { next(err); }
};

exports.assignRole = async (req, res, next) => {
  try {
    const { roleId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, 'User.NotFound', 'User not found.');
    if (!user.roles.map(String).includes(String(roleId))) user.roles.push(roleId);
    await user.save();
    return ok(res, true);
  } catch (err) { next(err); }
};

exports.removeRole = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { $pull: { roles: req.params.roleId } });
    return ok(res, null);
  } catch (err) { next(err); }
};

exports.adminResetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!user) return fail(res, 404, 'User.NotFound', 'User not found.');
    user.passwordHash = await User.hashPassword(newPassword);
    user.updatedAt    = new Date();
    await user.save();
    return ok(res, null);
  } catch (err) { next(err); }
};
