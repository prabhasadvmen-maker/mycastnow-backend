import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Message from './models/Message.js';
import logger from './config/logger.js';

let io = null;

// userKey ("creator:<id>" | "company:<id>") -> number of open sockets
const online = new Map();

const roomOf = (role, id) => `${role}:${id}`;

export const isOnline = (role, id) => (online.get(roomOf(role, id)) || 0) > 0;

// Push an event to every open tab of a creator/company
export const emitToUser = (role, id, event, payload) => {
  if (!io || !id) return;
  io.to(roomOf(role, String(id))).emit(event, payload);
};

export function initSocket(httpServer, allowedOrigins = []) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
      credentials: true
    }
  });

  // JWT auth for every socket connection
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const user = jwt.verify(token, process.env.JWT_SECRET);
      if (!user?.id || !['creator', 'company'].includes(user.role)) return next(new Error('Unauthorized'));
      socket.user = { id: String(user.id), role: user.role };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    const key = roomOf(role, id);
    const peerRole = role === 'creator' ? 'company' : 'creator';

    socket.join(key);
    online.set(key, (online.get(key) || 0) + 1);
    if (online.get(key) === 1) io.emit('presence', { role, id, online: true });

    // Who is online right now? (client passes the ids it cares about)
    socket.on('presence:check', (ids = [], ack) => {
      if (typeof ack !== 'function') return;
      const list = Array.isArray(ids) ? ids.slice(0, 200) : [];
      ack(list.filter(pid => isOnline(peerRole, pid)).map(String));
    });

    // Typing indicator -> forwarded to the other party only
    socket.on('typing', ({ to, typing } = {}) => {
      if (!to) return;
      io.to(roomOf(peerRole, String(to))).emit('typing', { role, id, typing: !!typing });
    });

    // The reader has this conversation open: mark peer's messages as read
    socket.on('messages:mark-read', async ({ peerId } = {}) => {
      try {
        if (!peerId || !mongoose.Types.ObjectId.isValid(peerId)) return;
        const filter = role === 'creator'
          ? { creator: id, company: peerId, senderType: 'Company', read: false }
          : { company: id, creator: peerId, senderType: 'Creator', read: false };
        const res = await Message.updateMany(filter, { $set: { read: true } });
        if (res.modifiedCount > 0) {
          io.to(roomOf(peerRole, String(peerId))).emit('messages:read', { role, id });
          io.to(key).emit('conversation:read', { peerId: String(peerId) });
        }
      } catch (err) {
        logger.warn('mark-read socket error: ' + err.message);
      }
    });

    socket.on('disconnect', () => {
      const left = (online.get(key) || 1) - 1;
      if (left <= 0) {
        online.delete(key);
        io.emit('presence', { role, id, online: false });
      } else {
        online.set(key, left);
      }
    });
  });

  logger.info('🔌 Socket.IO real-time chat enabled');
  return io;
}
