import mongoose from 'mongoose';
import logger from '../config/logger.js';

const OLD_HOST = /https?:\/\/mycastnow-backend\.onrender\.com/g;
const NEW_HOST = 'https://api.mycastnow.com';

// Deep-replace in plain objects/arrays/strings only (ObjectId, Date, etc. are left untouched)
const rewrite = (value) => {
  if (typeof value === 'string') return value.replace(OLD_HOST, NEW_HOST);
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = rewrite(value[k]);
    return out;
  }
  return value;
};

/**
 * One-time, idempotent: media URLs saved while the backend lived on Render
 * (https://mycastnow-backend.onrender.com/api/upload/file/...) are moved to the production API domain.
 */
export const migrateMediaHost = async () => {
  const db = mongoose.connection.db;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  let updated = 0;

  for (const { name } of collections) {
    const col = db.collection(name);
    for await (const doc of col.find({})) {
      if (!JSON.stringify(doc).includes('mycastnow-backend.onrender.com')) continue;
      const { _id, ...rest } = doc;
      await col.replaceOne({ _id }, rewrite(rest));
      updated++;
    }
  }
  if (updated) logger.info(`Media host migration: updated ${updated} document(s) to ${NEW_HOST}`);
};
