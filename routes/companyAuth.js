import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Company from '../models/Company.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!fs.existsSync('uploads/companies')) {
  fs.mkdirSync('uploads/companies', { recursive: true });
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/companies/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.post('/signup', upload.single('logo'), async (req, res) => {
  try {
    const { name, email, password, industry, website, location } = req.body;

    const existing = await Company.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const companyData = {
      name,
      email,
      password,
      industry,
      website,
      location,
      isActive: true,
      isApproved: false,
      approvalStatus: 'pending'
    };

    if (req.file) {
      // Use x-forwarded-proto for correct HTTPS detection behind proxy
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      companyData.logo = `${protocol}://${req.get('host')}/uploads/companies/${req.file.filename}`;
    }

    const newCompany = new Company(companyData);
    await newCompany.save();

    const companyResponse = newCompany.toObject();
    delete companyResponse.password;

    res.status(201).json({
      message: 'Registration successful. Your account is pending Super Admin approval.',
      pendingApproval: true,
      company: companyResponse
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Check company approval status by email
router.get('/status', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const company = await Company.findOne({ email: email.toLowerCase() }).select('name email isApproved approvalStatus rejectionReason');
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
    console.error('Status check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const company = await Company.findOne({ email });
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

    const isCompanyApproved = company.isApproved === true || company.approvalStatus === 'approved';

    if (company.approvalStatus === 'rejected') {
      return res.status(403).json({
        message: `Your company application was declined. Reason: ${company.rejectionReason || 'Does not meet requirements'}`
      });
    }

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
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin impersonation — requires valid admin JWT
router.post('/admin-login/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
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
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const company = await Company.findById(decoded.id).select('-password');

    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!company.isActive) return res.status(403).json({ message: 'Account disabled' });

    res.json(company);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Change Password for Company
router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const company = await Company.findById(decoded.id);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, company.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await Company.findByIdAndUpdate(decoded.id, {
      $set: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error changing password', error: error.message });
  }
});

// Update Profile
router.put('/update-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);

    const allowedFields = [
      'name', 'phone', 'industry', 'website', 'location',
      'tagline', 'description', 'address', 'city', 'state',
      'pincode', 'gst', 'cin', 'pan', 'contactPerson', 'socialLinks', 'logo'
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const updated = await Company.findByIdAndUpdate(
      decoded.id,
      { $set: updates },
      { returnDocument: 'after' }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      company: updated
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile', error: error.message });
  }
});

export default router;
