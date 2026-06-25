const router  = require('express').Router();
const proj    = require('../controllers/projects.controller');
const boards  = require('../controllers/boards.controller');
const issues  = require('../controllers/issues.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Projects
router.get('/projects',                                                proj.list);
router.get('/projects/:id',                                            proj.getById);
router.post('/projects',                                               proj.create);
router.put('/projects/:id',                                            proj.update);
router.delete('/projects/:id',                                         proj.remove);

// Project Members
router.get('/projects/:projectId/members',                             proj.getMembers);
router.post('/projects/:projectId/members',                            proj.addMember);
router.put('/projects/:projectId/members/:memberId',                   proj.updateMemberRole);
router.delete('/projects/:projectId/members/:memberId',                proj.removeMember);

// Board Columns
router.get('/projects/:projectId/columns',                             boards.listColumns);
router.post('/projects/:projectId/columns',                            boards.createColumn);
router.put('/projects/:projectId/columns/:columnId',                   boards.updateColumn);
router.delete('/projects/:projectId/columns/:columnId',                boards.deleteColumn);
router.patch('/projects/:projectId/columns/reorder',                   boards.reorderColumns);

// Sprints
router.get('/projects/:projectId/sprints',                             boards.listSprints);
router.post('/projects/:projectId/sprints',                            boards.createSprint);
router.put('/projects/:projectId/sprints/:sprintId',                   boards.updateSprint);
router.post('/projects/:projectId/sprints/:sprintId/start',            boards.startSprint);
router.post('/projects/:projectId/sprints/:sprintId/complete',         boards.completeSprint);
router.delete('/projects/:projectId/sprints/:sprintId',                boards.deleteSprint);

// Labels
router.get('/projects/:projectId/labels',                              boards.listLabels);
router.post('/projects/:projectId/labels',                             boards.createLabel);
router.put('/projects/:projectId/labels/:labelId',                     boards.updateLabel);
router.delete('/projects/:projectId/labels/:labelId',                  boards.deleteLabel);

// Issues
router.get('/issues',                                                  issues.list);
router.get('/issues/:id',                                              issues.getById);
router.post('/issues',                                                 issues.create);
router.put('/issues/:id',                                              issues.update);
router.patch('/issues/:id/move',                                       issues.move);
router.patch('/issues/:id/move-to-sprint',                             issues.moveToSprint);
router.delete('/issues/:id',                                           issues.remove);

// Comments
router.get('/issues/:id/comments',                                     issues.listComments);
router.post('/issues/:id/comments',                                    issues.addComment);
router.put('/issues/:id/comments/:commentId',                          issues.updateComment);
router.delete('/issues/:id/comments/:commentId',                       issues.deleteComment);

module.exports = router;
