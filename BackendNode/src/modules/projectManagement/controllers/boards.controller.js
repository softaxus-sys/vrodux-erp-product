const BoardColumn = require('../models/BoardColumn');
const Sprint      = require('../models/Sprint');
const Label       = require('../models/Label');
const { tenantFilter } = require('../../../middleware/auth');

// Board Columns
const colDto = c => ({ id: c._id, projectId: c.projectId, name: c.name, order: c.order, color: c.color, createdAt: c.createdAt });

exports.listColumns = async (req, res, next) => {
  try {
    const items = await BoardColumn.find({ projectId: req.params.projectId, ...tenantFilter(req), isDeleted: false }).sort({ order: 1 });
    res.json(items.map(colDto));
  } catch (err) { next(err); }
};

exports.createColumn = async (req, res, next) => {
  try {
    const c = await BoardColumn.create({ ...req.body, projectId: req.params.projectId, tenantId: req.user.tenant_id });
    res.status(201).json(colDto(c));
  } catch (err) { next(err); }
};

exports.updateColumn = async (req, res, next) => {
  try {
    const c = await BoardColumn.findOneAndUpdate(
      { _id: req.params.columnId, projectId: req.params.projectId, ...tenantFilter(req) },
      { ...req.body }, { new: true }
    );
    if (!c) return res.status(404).json({ code: 'BoardColumn.NotFound', description: 'Column not found.' });
    res.json(colDto(c));
  } catch (err) { next(err); }
};

exports.deleteColumn = async (req, res, next) => {
  try {
    await BoardColumn.findOneAndUpdate({ _id: req.params.columnId, projectId: req.params.projectId, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.reorderColumns = async (req, res, next) => {
  try {
    const { columnIds } = req.body;
    await Promise.all(columnIds.map((id, i) => BoardColumn.findByIdAndUpdate(id, { order: i })));
    res.status(204).send();
  } catch (err) { next(err); }
};

// Sprints
const sprintDto = s => ({ id: s._id, projectId: s.projectId, name: s.name, goal: s.goal, startDate: s.startDate, endDate: s.endDate, status: s.status, createdAt: s.createdAt });

exports.listSprints = async (req, res, next) => {
  try {
    const items = await Sprint.find({ projectId: req.params.projectId, ...tenantFilter(req), isDeleted: false }).sort({ createdAt: -1 });
    res.json(items.map(sprintDto));
  } catch (err) { next(err); }
};

exports.createSprint = async (req, res, next) => {
  try {
    const s = await Sprint.create({ ...req.body, projectId: req.params.projectId, tenantId: req.user.tenant_id });
    res.status(201).json(sprintDto(s));
  } catch (err) { next(err); }
};

exports.updateSprint = async (req, res, next) => {
  try {
    const s = await Sprint.findOneAndUpdate(
      { _id: req.params.sprintId, projectId: req.params.projectId, ...tenantFilter(req) },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!s) return res.status(404).json({ code: 'Sprint.NotFound', description: 'Sprint not found.' });
    res.json(sprintDto(s));
  } catch (err) { next(err); }
};

exports.startSprint = async (req, res, next) => {
  try {
    const s = await Sprint.findOneAndUpdate(
      { _id: req.params.sprintId, projectId: req.params.projectId, ...tenantFilter(req), status: 'planning' },
      { status: 'active', updatedAt: new Date() }, { new: true }
    );
    if (!s) return res.status(404).json({ code: 'Sprint.NotFound', description: 'Sprint not found or cannot be started.' });
    res.json(sprintDto(s));
  } catch (err) { next(err); }
};

exports.completeSprint = async (req, res, next) => {
  try {
    const s = await Sprint.findOneAndUpdate(
      { _id: req.params.sprintId, projectId: req.params.projectId, ...tenantFilter(req), status: 'active' },
      { status: 'completed', updatedAt: new Date() }, { new: true }
    );
    if (!s) return res.status(404).json({ code: 'Sprint.NotFound', description: 'Sprint not found or cannot be completed.' });
    res.json(sprintDto(s));
  } catch (err) { next(err); }
};

exports.deleteSprint = async (req, res, next) => {
  try {
    await Sprint.findOneAndUpdate({ _id: req.params.sprintId, projectId: req.params.projectId, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

// Labels
const labelDto = l => ({ id: l._id, projectId: l.projectId, name: l.name, color: l.color, createdAt: l.createdAt });

exports.listLabels = async (req, res, next) => {
  try {
    const items = await Label.find({ projectId: req.params.projectId, ...tenantFilter(req), isDeleted: false }).sort({ name: 1 });
    res.json(items.map(labelDto));
  } catch (err) { next(err); }
};

exports.createLabel = async (req, res, next) => {
  try {
    const l = await Label.create({ ...req.body, projectId: req.params.projectId, tenantId: req.user.tenant_id });
    res.status(201).json(labelDto(l));
  } catch (err) { next(err); }
};

exports.updateLabel = async (req, res, next) => {
  try {
    const l = await Label.findOneAndUpdate(
      { _id: req.params.labelId, projectId: req.params.projectId, ...tenantFilter(req) },
      { ...req.body }, { new: true }
    );
    if (!l) return res.status(404).json({ code: 'Label.NotFound', description: 'Label not found.' });
    res.json(labelDto(l));
  } catch (err) { next(err); }
};

exports.deleteLabel = async (req, res, next) => {
  try {
    await Label.findOneAndUpdate({ _id: req.params.labelId, projectId: req.params.projectId, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};
