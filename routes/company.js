import express from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import path from 'path';
import Company from '../models/Company.js';
import logger from '../config/logger.js';

const router = express.Router();

const bucketName = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
const useR2 = Boolean(
  bucketName &&
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
);

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
  }
};

let storage;

if (useR2) {
  const s3 = new S3Client({
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
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `companies/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  });
} else {
  import('fs').then(fs => {
    if (!fs.existsSync('uploads/companies')) {
      fs.mkdirSync('uploads/companies', { recursive: true });
    }
  });

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/companies'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  });
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB for logos
});

// Create Company
router.post('/', upload.single('logo'), async (req, res) => {
  try {
    const { name, email, password, industry, website, location } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await Company.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'Company with this email already exists' });
    }

    let logoUrl = '';
    if (req.file) {
      logoUrl = useR2
        ? `${process.env.R2_PUBLIC_URL}/${req.file.key}`
        : `${process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`}/uploads/companies/${req.file.filename}`;
    }

    const newCompany = new Company({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password, // Company model's pre-save hook hashes this
      industry: industry || '',
      website: website || '',
      location: location || '',
      logo: logoUrl,
      isApproved: true,
      approvalStatus: 'approved',
      verified: true
    });

    await newCompany.save();

    const companyResponse = newCompany.toObject();
    delete companyResponse.password;

    res.status(201).json(companyResponse);
  } catch (err) {
    logger.error('Error creating company:', err);
    res.status(500).json({ message: 'Server Error while creating company' });
  }
});

// Get Companies
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find().select('-password').sort({ createdAt: -1 });
    res.json(companies);
  } catch (err) {
    logger.error('Error fetching companies:', err);
    res.status(500).json({ message: 'Server Error while fetching companies' });
  }
});

// Edit Company
router.put('/:id', upload.single('logo'), async (req, res) => {
  try {
    const { name, email, password, industry, website, location } = req.body;
    const company = await Company.findById(req.params.id);

    if (!company) return res.status(404).json({ message: 'Company not found' });

    if (email && email.toLowerCase().trim() !== company.email) {
      const existing = await Company.findOne({ email: email.toLowerCase().trim() });
      if (existing) return res.status(400).json({ message: 'Email already in use' });
      company.email = email.toLowerCase().trim();
    }

    if (name) company.name = name.trim();
    if (password) company.password = password; // pre-save hook will hash it
    if (industry) company.industry = industry;
    if (website) company.website = website;
    if (location) company.location = location;

    if (req.file) {
      company.logo = useR2
        ? `${process.env.R2_PUBLIC_URL}/${req.file.key}`
        : `${process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`}/uploads/companies/${req.file.filename}`;
    }

    await company.save();

    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.json(companyResponse);
  } catch (err) {
    logger.error('Error updating company:', err);
    res.status(500).json({ message: 'Server Error while updating company' });
  }
});

// Toggle Status
router.put('/:id/status', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    company.isActive = !company.isActive;
    await company.save();

    res.json({ message: 'Status updated successfully', isActive: company.isActive });
  } catch (err) {
    logger.error('Error toggling status:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Approve Company
router.put('/:id/approve', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    company.isApproved = true;
    company.approvalStatus = 'approved';
    company.verified = true;
    company.approvedAt = new Date();
    company.approvedBy = req.body.approvedBy || 'Super Admin';
    company.rejectionReason = '';
    await company.save();

    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.json({ message: `Company "${company.name}" approved successfully`, success: true, company: companyResponse });
  } catch (err) {
    logger.error('Error approving company:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Reject Company
router.put('/:id/reject', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    company.isApproved = false;
    company.approvalStatus = 'rejected';
    company.verified = false;
    company.rejectionReason = req.body.reason || 'Does not meet platform requirements';
    await company.save();

    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.json({ message: `Company "${company.name}" rejected`, success: true, company: companyResponse });
  } catch (err) {
    logger.error('Error rejecting company:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Delete Company
router.delete('/:id', async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    res.json({ message: 'Company deleted successfully' });
  } catch (err) {
    logger.error('Error deleting company:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
