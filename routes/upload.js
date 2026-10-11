import express from 'express';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import logger from '../config/logger.js';

const router = express.Router();

const bucketName = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
const useR2 = Boolean(
  bucketName &&
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
);

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf'
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

let s3 = null;
let storage;

if (useR2) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
  });

  storage = multerS3({
    s3,
    bucket: bucketName,
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `portfolio/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  });
} else {
  import('fs').then(fs => {
    if (!fs.existsSync('uploads/portfolio')) {
      fs.mkdirSync('uploads/portfolio', { recursive: true });
    }
  });

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/portfolio'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  });
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});

const getBaseUrl = (req) => {
  if (process.env.BACKEND_URL && (process.env.NODE_ENV === 'production' || !req.get('host')?.includes('localhost'))) {
    return process.env.BACKEND_URL.replace(/\/+$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${req.get('host')}`;
};

router.post('/upload-direct', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let fileUrl;
    const baseUrl = getBaseUrl(req);
    if (useR2 && req.file.key) {
      fileUrl = `${baseUrl}/api/upload/file/${req.file.key}`;
    } else {
      fileUrl = `${baseUrl}/uploads/portfolio/${req.file.filename}`;
    }

    res.json({ success: true, url: fileUrl, type: req.file.mimetype });
  } catch (error) {
    logger.error('Direct upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.post('/portfolio', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const baseUrl = getBaseUrl(req);
    const fileUrls = req.files.map(file => {
      if (useR2 && file.key) {
        return { url: `${baseUrl}/api/upload/file/${file.key}`, type: file.mimetype };
      }
      return {
        url: `${baseUrl}/uploads/portfolio/${file.filename}`,
        type: file.mimetype
      };
    });

    res.json({ success: true, files: fileUrls });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

router.post('/presigned-url', async (req, res) => {
  try {
    const { filename, fileType } = req.body;
    if (!filename || !fileType) {
      return res.status(400).json({ error: 'Filename and fileType are required' });
    }
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    const ext = path.extname(filename).toLowerCase();
    const key = `portfolio/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    if (useR2 && s3) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: fileType
      });

      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      const publicUrl = `${getBaseUrl(req)}/api/upload/file/${key}`;

      res.json({ success: true, uploadUrl, fileUrl: publicUrl, key });
    } else {
      res.status(400).json({ error: 'R2 is not configured on the server' });
    }
  } catch (error) {
    logger.error('Presigned URL error:', error);
    res.status(500).json({ error: 'Failed to generate pre-signed URL' });
  }
});

router.get(/^\/file\/(.+)$/, async (req, res) => {
  try {
    const rawKey = req.params[0];

    const normalizedKey = path.normalize(rawKey).replace(/\\/g, '/');
    const allowedPrefixes = ['portfolio/', 'companies/', 'logos/', 'avatars/', 'documents/'];
    if (
      normalizedKey.includes('..') ||
      !allowedPrefixes.some(p => normalizedKey.startsWith(p))
    ) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (useR2 && s3) {
      const command = new GetObjectCommand({ Bucket: bucketName, Key: normalizedKey });
      const response = await s3.send(command);

      const ext = path.extname(normalizedKey).toLowerCase();
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.pdf': 'application/pdf'
      };
      const contentType = mimeTypes[ext] || (response.ContentType && response.ContentType !== 'application/octet-stream' ? response.ContentType : 'image/jpeg');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (response.ContentLength) res.setHeader('Content-Length', response.ContentLength);
      return response.Body.pipe(res);
    } else {
      const fs = await import('fs');
      const localFilePath = path.join(process.cwd(), 'uploads', normalizedKey);
      const uploadsRoot = path.join(process.cwd(), 'uploads');
      if (!localFilePath.startsWith(uploadsRoot)) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      if (fs.existsSync(localFilePath)) {
        return res.sendFile(localFilePath);
      }
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    logger.error('Error fetching file:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
