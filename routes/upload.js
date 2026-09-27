import express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const router = express.Router();

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  }
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.R2_BUCKET,
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, `portfolio/${Date.now().toString()}-${Math.round(Math.random()*1e9)}${ext}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for videos
});

router.post('/portfolio', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const fileUrls = req.files.map(file => {
      // Use our proxy route instead of the broken R2 public URL
      const backendUrl = `${req.protocol}://${req.get('host')}/api/upload/file/${file.key}`;
      return {
        url: backendUrl,
        type: file.mimetype
      };
    });

    res.json({ success: true, files: fileUrls });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Proxy route to fetch files from R2
router.get(/^\/file\/(.+)$/, async (req, res) => {
  try {
    const key = req.params[0]; 
    
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key
    });
    
    const response = await s3.send(command);
    
    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    }
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }
    
    response.Body.pipe(res);
  } catch (error) {
    console.error('Error fetching file from R2:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
