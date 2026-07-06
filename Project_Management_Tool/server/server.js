import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './database.js';
import { initWebSocket } from './websocket.js';

// Route imports
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import commentsRouter from './routes/comments.js';
import notificationsRouter from './routes/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/notifications', notificationsRouter);

// Serve static assets from Vite build in client/dist
const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Fallback for SPA routing: send index.html
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      // If client/dist doesn't exist yet, send a message
      res.status(200).send(`
        <div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f0c1b; color: #fff; padding: 20px; text-align: center;">
          <h1 style="color: #a855f7; font-size: 2.5rem; margin-bottom: 10px;">Project Management Tool Server</h1>
          <p style="font-size: 1.2rem; margin-bottom: 20px;">The backend API is running successfully.</p>
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px dashed rgba(255, 255, 255, 0.1); padding: 15px 30px; border-radius: 8px;">
            <p style="margin: 0; color: #cbd5e1;">API URL: <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: #f43f5e;">http://localhost:${PORT}/api</code></p>
            <p style="margin: 10px 0 0 0; color: #888; font-size: 0.9rem;">To access the dashboard, run the frontend with <code>npm run dev</code> in the client folder.</p>
          </div>
        </div>
      `);
    }
  });
});

const server = http.createServer(app);

// Initialize WebSockets
initWebSocket(server);

// Initialize Database and Start Server
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Server is running on port ${PORT}`);
    console.log(` API Endpoint: http://localhost:${PORT}/api`);
    console.log(` WebSocket upgrade route configured`);
    console.log(`==================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
