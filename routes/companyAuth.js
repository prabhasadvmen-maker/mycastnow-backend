import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import path from 'path';
import Company from '../models/Company.js';
import { verifyToken } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// ── R2 / S3 Upload Setup ──────────────────────────────────────────────────────
const useR2 = Boolean(
  process.env.R2_BUCKET &&
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
);

let s3 = null;
if (useR2) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
  });
}

// Use memory storage for all uploads (will pipe to R2 or save to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    }
  }
});

// ── Helper: Upload buffer to R2 or return local path ─────────────────────────
async function uploadLogo(file, req) {
  if (!file) return null;

  const ext = path.extname(file.originalname) || '.jpg';
  const key = `logos/company-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

  if (useR2 && s3) {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    }));
    // Return public CDN URL
    const publicUrl = process.env.R2_PUBLIC_URL || `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET}`;
    return `${publicUrl}/${key}`;
  } else {
    // Local fallback (development only)
    const fs = await import('fs');
    const localDir = 'uploads/companies';
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const localPath = `${localDir}/${key.replace('logos/', '')}`;
    fs.writeFileSync(localPath, file.buffer);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    return `${protocol}://${req.get('host')}/uploads/companies/${path.basename(localPath)}`;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
//  POST /signup — Company Registration
// ──────────────────────────────────────────────────────────────────────────────
router.post('/signup', upload.single('logo'), async (req, res) => {
  try {
    const { name, email, password, industry, website, location } = req.body;

    // Input validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Company name is required' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await Company.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Upload logo to R2 / local
    const logoUrl = await uploadLogo(req.file, req);

    const newCompany = new Company({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      industry: industry || '',
      website: website || '',
      location: location || '',
      logo: logoUrl || '',
      isActive: true,
      isApproved: false,
      approvalStatus: 'pending'
    });

    await newCompany.save();

    const companyResponse = newCompany.toObject();
    delete companyResponse.password;

    res.status(201).json({
      message: 'Registration successful. Your account is pending Super Admin approval.',
      pendingApproval: true,
      company: companyResponse
    });
  } catch (err) {
    logger.error('Company signup error:', err);
    res.status(500).json({ message: err.message || 'Server error during registration' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  GET /status — Check company approval status
// ──────────────────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const company = await Company.findOne({ email: email.toLowerCase() })
      .select('name email isApproved approvalStatus rejectionReason')
      .lean();

    if (!company) return res.status(404).json({ message: 'Company not found' });

    const isApproved = company.isApproved === true || company.approvalStatus === 'approved';
    res.json({
      name: company.name,
      email: company.email,
      isApproved,
      approvalStatus: company.approvalStatus || (isApproved ? 'approved' : 'pending'),
      rejectionReason: company.rejectionReason || ''
    });
  } catch (error) {
    logger.error('Company status check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  POST /login — Company Login
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const company = await Company.findOne({ email: email.toLowerCase().trim() });
    if (!company) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!company.isActive) {
      return res.status(403).json({ message: 'Your account is disabled. Please contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (company.approvalStatus === 'rejected') {
      return res.status(403).json({
        message: `Your application was declined. Reason: ${company.rejectionReason || 'Does not meet requirements'}`
      });
    }

    const isCompanyApproved = company.isApproved === true || company.approvalStatus === 'approved';
    if (!isCompanyApproved) {
      const companyResponse = company.toObject();
      delete companyResponse.password;
      return res.status(202).json({
        pendingApproval: true,
        approvalStatus: company.approvalStatus || 'pending',
        message: 'Your account is awaiting Super Admin approval. You will be notified within 24 hours.',
        company: companyResponse
      });
    }

    const token = jwt.sign(
      { id: company._id, email: company.email, role: 'company' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.json({
      message: 'Login successful',
      token,
      company: companyResponse
    });
  } catch (error) {
    logger.error('Company login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  POST /admin-login/:id — Admin impersonation
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin-login/:id', verifyToken, async (req, res) => {
  try {
    // BUG 5 FIX: use verifyToken middleware — req.user is already verified
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const companyToken = jwt.sign(
      { id: company._id, email: company.email, role: 'company' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.json({
      message: 'Admin impersonation successful',
      token: companyToken,
      company: companyResponse
    });
  } catch (error) {
    logger.error('Admin company impersonation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  GET /me — Get logged-in company
// ──────────────────────────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const company = await Company.findById(req.user.id).select('-password');
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!company.isActive) return res.status(403).json({ message: 'Account disabled' });
    res.json(company);
  } catch (error) {
    logger.error('Fetch company me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  PUT /change-password — Company password change (FIXED: was using undefined decoded)
// ──────────────────────────────────────────────────────────────────────────────
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const company = await Company.findById(req.user.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
    }

    const isMatch = await bcrypt.compare(currentPassword, company.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // FIXED: was using undefined 'decoded.id', now uses req.user.id from verifyToken
    await Company.findByIdAndUpdate(req.user.id, { $set: { password: hashedPassword } });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Company change password error:', error);
    res.status(500).json({ success: false, message: 'Server error changing password' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  PUT /update-profile — Whitelist-safe profile update
// ──────────────────────────────────────────────────────────────────────────────
router.put('/update-profile', verifyToken, async (req, res) => {
  try {
    const ALLOWED_FIELDS = [
      'name', 'phone', 'industry', 'website', 'location',
      'tagline', 'description', 'address', 'city', 'state',
      'pincode', 'gst', 'cin', 'pan', 'contactPerson', 'socialLinks', 'logo'
    ];

    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
    }

    const updated = await Company.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({ success: true, message: 'Profile updated successfully', company: updated });
  } catch (error) {
    logger.error('Update company profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

export default router;
