import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'project.db');

const db = new DatabaseSync(dbPath);
console.log('Connected to the SQLite database via node:sqlite at:', dbPath);

// Helper query object returning promises for database queries
export const query = {
  run: async (sql, params = []) => {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { id: result.lastInsertRowid, changes: result.changes };
  },
  get: async (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },
  all: async (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }
};

export async function initDatabase() {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Create Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Projects Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Project Members Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      PRIMARY KEY (project_id, user_id)
    )
  `);

  // Create Tasks Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'done')) DEFAULT 'todo',
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Comments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Notifications Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed data if empty
  const userCheck = await query.get('SELECT COUNT(*) as count FROM users');
  if (userCheck.count === 0) {
    console.log('Seeding database with mock data...');
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('password123', salt);

    // Insert Users
    const u1 = await query.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', ['alice', 'alice@example.com', passHash]);
    const u2 = await query.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', ['bob', 'bob@example.com', passHash]);
    const u3 = await query.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', ['charlie', 'charlie@example.com', passHash]);

    // Insert Projects
    const p1 = await query.run('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)', [
      'Acme Web App',
      'Redesigning the corporate web application with a glassmorphic dashboard interface.',
      u1.id
    ]);
    const p2 = await query.run('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)', [
      'Marketing Campaign Q3',
      'Planning product launch events and social media marketing push.',
      u2.id
    ]);

    // Insert Project Members
    await query.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [p1.id, u1.id, 'owner']);
    await query.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [p1.id, u2.id, 'member']);
    await query.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [p1.id, u3.id, 'member']);

    await query.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [p2.id, u2.id, 'owner']);
    await query.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [p2.id, u1.id, 'member']);

    // Insert Tasks for Project 1 (Acme Web App)
    const t1 = await query.run('INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      p1.id,
      'Design Figma Mockups',
      'Create high-fidelity screens for dashboard, kanban board, and user profile page.',
      'done',
      'high',
      u1.id,
      '2026-07-15',
      0
    ]);
    const t2 = await query.run('INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      p1.id,
      'Set up Express & SQLite',
      'Initialize Node project, configure Express router, create tables, and seed database.',
      'in_progress',
      'medium',
      u2.id,
      '2026-07-20',
      0
    ]);
    const t3 = await query.run('INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      p1.id,
      'Integrate WebSocket Notifications',
      'Implement real-time updates for task movements, assign events, and message comments.',
      'todo',
      'high',
      u3.id,
      '2026-07-25',
      0
    ]);
    const t4 = await query.run('INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      p1.id,
      'Write End-to-End Tests',
      'Write tests checking user flow from registration to board tasks and comment editing.',
      'todo',
      'low',
      null,
      '2026-07-30',
      1
    ]);

    // Insert Tasks for Project 2 (Marketing Q3)
    await query.run('INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      p2.id,
      'Draft Press Release',
      'Write copy announcing the new platform release details and coordinate with PR agency.',
      'in_progress',
      'medium',
      u2.id,
      '2026-07-18',
      0
    ]);

    // Insert Comments
    await query.run('INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)', [
      t2.id,
      u1.id,
      'I have set up the basic repository structure. Bob, let me know if you need help with SQLite schema.'
    ]);
    await query.run('INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)', [
      t2.id,
      u2.id,
      'Thanks Alice! I am starting on the table definitions now.'
    ]);

    // Insert Notifications
    await query.run('INSERT INTO notifications (user_id, content) VALUES (?, ?)', [
      u2.id,
      'Alice added you to project \'Acme Web App\'.'
    ]);
    await query.run('INSERT INTO notifications (user_id, content) VALUES (?, ?)', [
      u3.id,
      'Alice added you to project \'Acme Web App\'.'
    ]);

    console.log('Database seeded successfully!');
  }
}

export default db;
