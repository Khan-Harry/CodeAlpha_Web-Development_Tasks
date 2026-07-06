import express from 'express';
import { query } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { broadcastToUser, broadcastToProjectMembers } from '../websocket.js';

const router = express.Router();

async function checkMembership(projectId, userId) {
  const member = await query.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
  return !!member;
}

// Get all tasks for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  try {
    const isMember = await checkMembership(projectId, req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }

    const tasks = await query.all(`
      SELECT t.*, u.username as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = ?
      ORDER BY t.position ASC, t.created_at ASC
    `, [projectId]);

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Create a new task
router.post('/project/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const { title, description, status, priority, assigned_to, due_date } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  try {
    const isMember = await checkMembership(projectId, req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const colStatus = status || 'todo';
    const posRow = await query.get('SELECT MAX(position) as maxPos FROM tasks WHERE project_id = ? AND status = ?', [projectId, colStatus]);
    const position = (posRow && posRow.maxPos !== null) ? posRow.maxPos + 1 : 0;

    const result = await query.run(`
      INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, title, description || '', colStatus, priority || 'medium', assigned_to || null, due_date || null, position]);

    const taskId = result.id;
    const newTask = await query.get(`
      SELECT t.*, u.username as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `, [taskId]);

    // Send WebSocket broadcast
    broadcastToProjectMembers(projectId, req.user.id, {
      type: 'TASK_CREATED',
      projectId,
      data: newTask
    });

    // Notify assignee
    if (assigned_to && Number(assigned_to) !== req.user.id) {
      const project = await query.get('SELECT name FROM projects WHERE id = ?', [projectId]);
      const content = `${req.user.username} assigned you the task '${title}' in '${project.name}'.`;
      await query.run('INSERT INTO notifications (user_id, content) VALUES (?, ?)', [assigned_to, content]);
      broadcastToUser(Number(assigned_to), {
        type: 'NOTIFICATION_RECEIVED',
        data: { content, is_read: 0, created_at: new Date().toISOString() }
      });
    }

    res.status(201).json(newTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Update a task
router.put('/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;
  const { title, description, status, priority, assigned_to, due_date, position } = req.body;

  try {
    const task = await query.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isMember = await checkMembership(task.project_id, req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const oldAssignee = task.assigned_to;
    const newAssignee = assigned_to === undefined ? oldAssignee : (assigned_to === null ? null : Number(assigned_to));

    const updatedTitle = title !== undefined ? title : task.title;
    const updatedDesc = description !== undefined ? description : task.description;
    const updatedStatus = status !== undefined ? status : task.status;
    const updatedPriority = priority !== undefined ? priority : task.priority;
    const updatedAssigned = assigned_to !== undefined ? (assigned_to === null ? null : Number(assigned_to)) : task.assigned_to;
    const updatedDueDate = due_date !== undefined ? due_date : task.due_date;
    const updatedPosition = position !== undefined ? position : task.position;

    await query.run(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, due_date = ?, position = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updatedTitle, updatedDesc, updatedStatus, updatedPriority, updatedAssigned, updatedDueDate, updatedPosition, taskId]);

    const updatedTask = await query.get(`
      SELECT t.*, u.username as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `, [taskId]);

    // Send WebSocket broadcast
    broadcastToProjectMembers(task.project_id, req.user.id, {
      type: 'TASK_UPDATED',
      projectId: task.project_id,
      data: updatedTask
    });

    // Notify assignee if changed and not self-assigned
    if (newAssignee && newAssignee !== oldAssignee && newAssignee !== req.user.id) {
      const project = await query.get('SELECT name FROM projects WHERE id = ?', [task.project_id]);
      const content = `${req.user.username} assigned you the task '${updatedTask.title}' in '${project.name}'.`;
      await query.run('INSERT INTO notifications (user_id, content) VALUES (?, ?)', [newAssignee, content]);
      broadcastToUser(newAssignee, {
        type: 'NOTIFICATION_RECEIVED',
        data: { content, is_read: 0, created_at: new Date().toISOString() }
      });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Delete a task
router.delete('/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;
  try {
    const task = await query.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isMember = await checkMembership(task.project_id, req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query.run('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Broadcast delete event
    broadcastToProjectMembers(task.project_id, req.user.id, {
      type: 'TASK_DELETED',
      projectId: task.project_id,
      taskId: Number(taskId)
    });

    res.json({ message: 'Task deleted successfully', taskId: Number(taskId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

export default router;
