import express from 'express';
import { query } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { broadcastToUser, broadcastToProjectMembers } from '../websocket.js';

const router = express.Router();

// Get comments for a task
router.get('/task/:taskId', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  try {
    const task = await query.get('SELECT project_id FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const member = await query.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [task.project_id, req.user.id]);
    if (!member) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }

    const comments = await query.all(`
      SELECT c.*, u.username as author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `, [taskId]);

    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Add comment to task
router.post('/task/:taskId', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  try {
    const task = await query.get('SELECT project_id, title, assigned_to FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const member = await query.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [task.project_id, req.user.id]);
    if (!member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query.run(`
      INSERT INTO comments (task_id, user_id, content)
      VALUES (?, ?, ?)
    `, [taskId, req.user.id, content]);

    const commentId = result.id;
    const newComment = await query.get(`
      SELECT c.*, u.username as author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [commentId]);

    // Broadcast WebSocket comment updates to project members
    broadcastToProjectMembers(task.project_id, req.user.id, {
      type: 'COMMENT_CREATED',
      projectId: task.project_id,
      taskId: Number(taskId),
      data: newComment
    });

    // Notify assignee if not the commenter
    if (task.assigned_to && Number(task.assigned_to) !== req.user.id) {
      const project = await query.get('SELECT name FROM projects WHERE id = ?', [task.project_id]);
      const notifContent = `${req.user.username} commented on your task '${task.title}' in '${project.name}': "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`;
      await query.run('INSERT INTO notifications (user_id, content) VALUES (?, ?)', [task.assigned_to, notifContent]);
      
      broadcastToUser(Number(task.assigned_to), {
        type: 'NOTIFICATION_RECEIVED',
        data: { content: notifContent, is_read: 0, created_at: new Date().toISOString() }
      });
    }

    res.status(201).json(newComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

export default router;
