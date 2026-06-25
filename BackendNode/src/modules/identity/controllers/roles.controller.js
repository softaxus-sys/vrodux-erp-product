const Role       = require('../models/Role');
const Permission = require('../models/Permission');
const { paged, parsePaging } = require('../../../utils/helpers');
const { tenantFilter }       = require('../../../middleware/auth');
const { ok, fail }           = require('../../../utils/envelope');

const roleDto = r => ({
  id:          r._id,
  name:        r.name,
  description: r.description,
  isSystem:    r.isSystem,
  permissions: r.permissions,
  createdAt:   r.createdAt,
});

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const filter = { ...tenantFilter(req) };
    const [items, total] = await Promise.all([
      Role.find(filter).skip(skip).limit(pageSize).sort({ name: 1 }),
      Role.countDocuments(filter),
    ]);
    return ok(res, paged(items.map(roleDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const role = await Role.findOne({ _id: req.params.id, ...tenantFilter(req) }).populate('permissions');
    if (!role) return fail(res, 404, 'Role.NotFound', 'Role not found.');
    return ok(res, roleDto(role));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const exists = await Role.findOne({ name, ...tenantFilter(req) });
    if (exists) return fail(res, 409, 'Role.Duplicate', 'A role with this name already exists.');
    const role = await Role.create({ ...tenantFilter(req), name, description });
    return ok(res, roleDto(role), 201);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const role = await Role.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      { name, description, updatedAt: new Date() }
    );
    if (!role) return fail(res, 404, 'Role.NotFound', 'Role not found.');
    return ok(res, null);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const role = await Role.findOneAndDelete({ _id: req.params.id, ...tenantFilter(req), isSystem: false });
    if (!role) return fail(res, 404, 'Role.NotFound', 'Role not found or is a system role.');
    return ok(res, null);
  } catch (err) { next(err); }
};

exports.getPermissions = async (req, res, next) => {
  try {
    const role = await Role.findOne({ _id: req.params.id, ...tenantFilter(req) }).populate('permissions');
    if (!role) return fail(res, 404, 'Role.NotFound', 'Role not found.');
    return ok(res, role.permissions.map(p => ({ id: p._id, moduleId: p.moduleId, action: p.action, key: `${p.moduleId}.${p.action}` })));
  } catch (err) { next(err); }
};

exports.addPermission = async (req, res, next) => {
  try {
    const { permissionId } = req.body;
    const role = await Role.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!role) return fail(res, 404, 'Role.NotFound', 'Role not found.');
    if (!role.permissions.map(String).includes(String(permissionId))) role.permissions.push(permissionId);
    await role.save();
    return ok(res, true);
  } catch (err) { next(err); }
};
