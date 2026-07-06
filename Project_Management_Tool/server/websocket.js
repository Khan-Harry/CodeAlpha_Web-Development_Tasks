import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import url from 'url';
import { JWT_SECRET } from './middleware/auth.js';
import { query } from './database.js';

// Map of userId -> Set of active WebSocket connections
const userConnections = new Map();

export function initWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = url.parse(request.url, true);
    const token = parsedUrl.query.token;

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.user = decoded;
        wss.emit('connection', ws, request);
      });
    });
  });

  wss.on('connection', (ws) => {
    const userId = ws.user.id;
    console.log(`WebSocket client connected: ${ws.user.username} (ID: ${userId})`);

    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(ws);

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        console.error('WebSocket received malformed message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket client disconnected: ${ws.user.username}`);
      const conns = userConnections.get(userId);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) {
          userConnections.delete(userId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for user ${ws.user.username}:`, err.message);
    });
  });
}

// Send real-time updates directly to a specific user
export function broadcastToUser(userId, message) {
  const conns = userConnections.get(userId);
  if (conns) {
    const payload = JSON.stringify(message);
    for (const ws of conns) {
      if (ws.readyState === 1) { // OPEN
        ws.send(payload);
      }
    }
  }
}

// Send real-time updates to all project members, excluding the sender
export async function broadcastToProjectMembers(projectId, senderUserId, message) {
  try {
    const members = await query.all('SELECT user_id FROM project_members WHERE project_id = ?', [projectId]);
    const payload = JSON.stringify(message);

    for (const member of members) {
      if (member.user_id === senderUserId) continue; // Skip sender

      const conns = userConnections.get(member.user_id);
      if (conns) {
        for (const ws of conns) {
          if (ws.readyState === 1) {
            ws.send(payload);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting to project members:', error);
  }
}
