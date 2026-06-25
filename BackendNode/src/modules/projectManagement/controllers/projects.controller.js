const Project     = require('../models/Project');
const BoardColumn = require('../models/BoardColumn');
const Issue       = require('../models/Issue');
const { tenantFilter, isSuperAdmin } = require('../../../middleware/auth');

// Summary DTO (list) — needs issue counts
const summaryDto = p => ({
  id:              p._id,
  key:             p.key || '',
  name:            p.name,
  description:     p.description || null,
  status:          p.status || 'active',
  leadName:        p.leadName || null,
  totalIssues:     p._totalIssues || 0,
  todoCount:       p._todoCount   || 0,
  inProgressCount: p._inProgress  || 0,
  doneCount:       p._doneCount   || 0,
  createdAt:       p.createdAt,
});

// Detail DTO (single)
const dto = p => ({
  id:              p._id,
  key:             p.key || '',
  name:            p.name,
  description:     p.description || null,
  status:          p.status || 'active',
  leadName:        p.leadName || null,
  leadId:          p.leadId || null,
  nextIssueNumber: p.nextIssueNumber || 1,
  memberCount:     (p.members || []).length,
  startDate:       p.startDate || null,
  endDate:         p.endDate   || null,
  createdAt:       p.createdAt,
  updatedAt:       p.updatedAt || null,
});

const canAccess = (p, uid, isAdmin) => {
  if (isAdmin) return true;
  return (p.members || []).some(m => m.userId === uid);
};

const list = async (req, res, next) => {
  try {
    const uid   = req.user.sub || req.user.id;
    const admin = isSuperAdmin(req);
    const f     = { ...tenantFilter(req), isDeleted: false };
    if (!admin) f['members.userId'] = uid;
    const projects = await Project.find(f).sort({ createdAt: -1 });
    // Attach issue counts per project
    const results = await Promise.all(projects.map(async p => {
      const issues = await Issue.find({ projectId: String(p._id), isDeleted: false }).select('status');
      p._totalIssues = issues.length;
      p._todoCount   = issues.filter(i => i.status === 'todo').length;
      p._inProgress  = issues.filter(i => i.status === 'in_progress' || i.status === 'in-progress').length;
      p._doneCount   = issues.filter(i => i.status === 'done').length;
      return p;
    }));
    res.json(results.map(summaryDto));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const uid = req.user.sub || req.user.id;
    const admin = isSuperAdmin(req);
    const p = await Project.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!p || !canAccess(p, uid, admin)) return res.status(404).json({ code: 'Project.NotFound', description: 'Project not found.' });
    res.json(dto(p));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const uid = req.user.sub || req.user.id;
    const userName = req.user.name || req.user.username || req.user.email || 'Unknown';
    const p = await Project.create({
      ...req.body, tenantId: req.user.tenant_id,
      members: uid ? [{ userId: uid, userName, userEmail: req.user.email, role: 'owner' }] : [],
    });
    const defaultCols = ['To Do', 'In Progress', 'In Review', 'Done'];
    await BoardColumn.insertMany(defaultCols.map((name, i) => ({ tenantId: req.user.tenant_id, projectId: String(p._id), name, order: i })));
    res.status(201).json(dto(p));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const p = await Project.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!p) return res.status(404).json({ code: 'Project.NotFound', description: 'Project not found.' });
    res.json(dto(p));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await Project.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

// Members
const getMembers = async (req, res, next) => {
  try {
    const p = await Project.findOne({ _id: req.params.projectId, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json({ code: 'Project.NotFound', description: 'Project not found.' });
    res.json((p.members || []).map(m => ({ id: m._id, projectId: req.params.projectId, userId: m.userId, userName: m.userName, userEmail: m.userEmail, role: m.role, createdAt: m.createdAt })));
  } catch (err) { next(err); }
};

const addMember = async (req, res, next) => {
  try {
    const p = await Project.findOne({ _id: req.params.projectId, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json({ code: 'Project.NotFound', description: 'Project not found.' });
    const existing = p.members.find(m => m.userId === req.body.userId);
    if (existing) return res.status(409).json({ code: 'ProjectMember.Duplicate', description: 'User is already a member of this project.' });
    p.members.push({ userId: req.body.userId, userName: req.body.userName, userEmail: req.body.userEmail, role: req.body.role || 'member' });
    await p.save();
    const added = p.members[p.members.length - 1];
    res.json({ id: added._id, projectId: req.params.projectId, userId: added.userId, userName: added.userName, userEmail: added.userEmail, role: added.role, createdAt: added.createdAt });
  } catch (err) { next(err); }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const p = await Project.findOne({ _id: req.params.projectId, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json({ code: 'Project.NotFound', description: 'Project not found.' });
    const member = p.members.id(req.params.memberId);
    if (!member) return res.status(404).json({ code: 'ProjectMember.NotFound', description: 'Member not found.' });
    const owners = p.members.filter(m => m.role === 'owner');
    if (member.role === 'owner' && owners.length === 1 && req.body.role !== 'owner') {
      return res.status(409).json({ code: 'ProjectMember.Conflict', description: 'Cannot change the role of the only owner of a project.' });
    }
    member.role = req.body.role;
    await p.save();
    res.json({ id: member._id, projectId: req.params.projectId, userId: member.userId, userName: member.userName, userEmail: member.userEmail, role: member.role, createdAt: member.createdAt });
  } catch (err) { next(err); }
};

const removeMember = async (req, res, next) => {
  try {
    const p = await Project.findOne({ _id: req.params.projectId, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json({ code: 'Project.NotFound', description: 'Project not found.' });
    const member = p.members.id(req.params.memberId);
    if (!member) return res.status(404).json({ code: 'ProjectMember.NotFound', description: 'Member not found.' });
    const owners = p.members.filter(m => m.role === 'owner');
    if (member.role === 'owner' && owners.length === 1) {
      return res.status(409).json({ code: 'ProjectMember.Conflict', description: 'Cannot remove the only owner of a project.' });
    }
    member.deleteOne();
    await p.save();
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, remove, getMembers, addMember, updateMemberRole, removeMember };
