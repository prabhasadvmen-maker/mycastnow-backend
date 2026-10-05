import mongoose from 'mongoose';
import logger from './logger.js';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    logger.error('FATAL: MONGODB_URI environment variable is not set!');
    process.exit(1);
  }

  const options = {
    serverSelectionTimeoutMS: 10000, // Fail fast if MongoDB not reachable
    socketTimeoutMS: 45000,
    maxPoolSize: 10,                 // Max concurrent DB connections
    minPoolSize: 2,
    heartbeatFrequencyMS: 10000
  };

  try {
    await mongoose.connect(mongoUri, options);
    logger.info('✅ MongoDB connected successfully');
  } catch (err) {
    logger.error(`MongoDB initial connection failed: ${err.message}`);
    process.exit(1);
  }

  // ── Auto-reconnect on disconnect ───────────────────────────────────────────
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — attempting reconnect...');
    setTimeout(() => {
      mongoose.connect(mongoUri, options).catch(err => {
        logger.error(`MongoDB reconnect failed: ${err.message}`);
      });
    }, 5000);
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });
};

export default connectDB;
