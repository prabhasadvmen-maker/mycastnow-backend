import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import Company from '../models/Company.js';

const router = express.Router();

// Multer config for signup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/companies/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.post('/signup', upload.single('logo'), async (req, res) => {
  try {
    const { name, email, password, industry, website, location } = req.body;
    
    // Check if email exists
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
      isActive: true // Active by default
    };

    if (req.file) {
      companyData.logo = `${req.protocol}://${req.get('host')}/uploads/companies/${req.file.filename}`;
    }

    const newCompany = new Company(companyData);
    await newCompany.save();

    const token = jwt.sign(
      { id: newCompany._id, email: newCompany.email, role: 'company' },
      process.env.JWT_SECRET || 'fallback_secret_for_dev_only',
      { expiresIn: '7d' }
    );

    const companyResponse = newCompany.toObject();
    delete companyResponse.password;

    res.status(201).json({
      message: 'Company registered successfully',
      token,
      company: companyResponse
    });
  } catch (err) {
    console.error('Signup error:', err);
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

    const token = jwt.sign(
      { id: company._id, email: company.email, role: 'company' },
      process.env.JWT_SECRET || 'fallback_secret_for_dev_only',
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

// For Admin to login as a company without password
router.post('/admin-login/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const token = jwt.sign(
      { id: company._id, email: company.email, role: 'company' },
      process.env.JWT_SECRET || 'fallback_secret_for_dev_only',
      { expiresIn: '1d' }
    );

    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.json({
      message: 'Admin impersonation successful',
      token,
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    const company = await Company.findById(decoded.id).select('-password');
    
    if (!company) return res.status(404).json({ message: 'Company not found' });
    if (!company.isActive) return res.status(403).json({ message: 'Account disabled' });
    
    res.json(company);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
