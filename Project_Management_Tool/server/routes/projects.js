import express from 'express';
import { query } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { broadcastToUser, broadcastToProjectMembers } from '../websocket.js';

const router = express.Router();

// Get all projects for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await query.all(`
      SELECT p.*, pm.role 
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
    `, [req.user.id]);
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Create a new project
router.post('/', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectResult = await query.run(
      'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
      [name, description || '', req.user.id]
    );
    const projectId = projectResult.id;

    // Add owner to members
    await query.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, req.user.id, 'owner']
    );

    res.status(201).json({
      id: projectId,
      name,
      description,
      owner_id: req.user.id,
      role: 'owner'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Get project details
router.get('/:id', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  try {
    const member = await query.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, req.user.id]);
    if (!member) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }

    const project = await query.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    project.role = member.role;
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Get project members
router.get('/:id/members', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  try {
    const member = await query.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, req.user.id]);
    if (!member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await query.all(`
      SELECT u.id, u.username, u.email, pm.role
      FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `, [projectId]);
    res.json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Add collaborator to project
router.post('/:id/members', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const inviter = await query.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, req.user.id]);
    if (!inviter) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const project = await query.get('SELECT name FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const userToAdd = await query.get('SELECT id, username, email FROM users WHERE username = ?', [username]);
    if (!userToAdd) {
      return res.status(404).json({ error: `User '${username}' not found` });
    }

    const existingMember = await query.get('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userToAdd.id]);
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    await query.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, userToAdd.id, 'member']
    );

    // Create database notification
    const content = `${req.user.username} added you to project '${project.name}'.`;
    await query.run('INSERT INTO notifications (user_id, content) VALUES (?, ?)', [userToAdd.id, content]);

    // Send real-time updates via WebSockets
    broadcastToUser(userToAdd.id, {
      type: 'NOTIFICATION_RECEIVED',
      data: { content, is_read: 0, created_at: new Date().toISOString() }
    });

    broadcastToProjectMembers(projectId, req.user.id, {
      type: 'MEMBER_JOINED',
      projectId,
      data: { id: userToAdd.id, username: userToAdd.username, email: userToAdd.email, role: 'member' }
    });

    res.status(201).json({
      id: userToAdd.id,
      username: userToAdd.username,
      email: userToAdd.email,
      role: 'member'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// Delete a project
router.delete('/:id', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  try {
    const project = await query.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the project owner can delete this project' });
    }

    await query.run('DELETE FROM projects WHERE id = ?', [projectId]);
    
    // Broadcast delete event
    broadcastToProjectMembers(projectId, req.user.id, {
      type: 'PROJECT_DELETED',
      projectId
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
