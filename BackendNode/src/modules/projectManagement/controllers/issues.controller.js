const Issue   = require('../models/Issue');
const Comment = require('../models/IssueComment');
const Project = require('../models/Project');
const { tenantFilter, isSuperAdmin } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

const dto = i => ({
  id: i._id, projectId: i.projectId, columnId: i.columnId, sprintId: i.sprintId,
  epicId: i.epicId, title: i.title, description: i.description, type: i.type,
  priority: i.priority, status: i.status, assigneeId: i.assigneeId, assigneeName: i.assigneeName,
  reporterId: i.reporterId, reporterName: i.reporterName, storyPoints: i.storyPoints,
  dueDate: i.dueDate, order: i.order, labelIds: i.labelIds, createdAt: i.createdAt,
});

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.projectId) f.projectId = req.query.projectId;
    if (req.query.sprintId) f.sprintId = req.query.sprintId;
    if (req.query.columnId) f.columnId = req.query.columnId;
    if (req.query.status) f.status = req.query.status;
    if (req.query.assigneeId) f.assigneeId = req.query.assigneeId;
    const [items, total] = await Promise.all([
      Issue.find(f).sort({ order: 1, createdAt: -1 }).skip(skip).limit(pageSize),
      Issue.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const i = await Issue.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!i) return res.status(404).json({ code: 'Issue.NotFound', description: 'Issue not found.' });
    const uid = req.user.sub || req.user.id;
    const admin = isSuperAdmin(req);
    if (!admin) {
      const p = await Project.findOne({ _id: i.projectId, 'members.userId': uid, isDeleted: false });
      if (!p) return res.status(404).json({ code: 'Issue.NotFound', description: 'Issue not found.' });
    }
    res.json(dto(i));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const i = await Issue.create({ ...req.body, tenantId: req.user.tenant_id });
    res.status(201).json(dto(i));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const i = await Issue.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!i) return res.status(404).json({ code: 'Issue.NotFound', description: 'Issue not found.' });
    res.json(dto(i));
  } catch (err) { next(err); }
};

const move = async (req, res, next) => {
  try {
    const { columnId, order } = req.body;
    const i = await Issue.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { columnId, order, updatedAt: new Date() }, { new: true }
    );
    if (!i) return res.status(404).json({ code: 'Issue.NotFound', description: 'Issue not found.' });
    res.json(dto(i));
  } catch (err) { next(err); }
};

const moveToSprint = async (req, res, next) => {
  try {
    const i = await Issue.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { sprintId: req.body.sprintId, updatedAt: new Date() }, { new: true }
    );
    if (!i) return res.status(404).json({ code: 'Issue.NotFound', description: 'Issue not found.' });
    res.json(dto(i));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await Issue.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

// Comments
const commentDto = c => ({ id: c._id, issueId: c.issueId, projectId: c.projectId, authorId: c.authorId, authorName: c.authorName, content: c.content, createdAt: c.createdAt });

const listComments = async (req, res, next) => {
  try {
    const items = await Comment.find({ issueId: req.params.id, ...tenantFilter(req), isDeleted: false }).sort({ createdAt: 1 });
    res.json(items.map(commentDto));
  } catch (err) { next(err); }
};

const addComment = async (req, res, next) => {
  try {
    const issue = await Issue.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!issue) return res.status(404).json({ code: 'Issue.NotFound', description: 'Issue not found.' });
    const c = await Comment.create({ ...req.body, issueId: req.params.id, projectId: issue.projectId, authorId: req.user.sub || req.user.id, authorName: req.user.name || req.user.email, tenantId: req.user.tenant_id });
    res.status(201).json(commentDto(c));
  } catch (err) { next(err); }
};

const updateComment = async (req, res, next) => {
  try {
    const c = await Comment.findOneAndUpdate(
      { _id: req.params.commentId, issueId: req.params.id, ...tenantFilter(req), isDeleted: false },
      { content: req.body.content, updatedAt: new Date() }, { new: true }
    );
    if (!c) return res.status(404).json({ code: 'Comment.NotFound', description: 'Comment not found.' });
    res.json(commentDto(c));
  } catch (err) { next(err); }
};

const deleteComment = async (req, res, next) => {
  try {
    await Comment.findOneAndUpdate({ _id: req.params.commentId, issueId: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, move, moveToSprint, remove, listComments, addComment, updateComment, deleteComment };
