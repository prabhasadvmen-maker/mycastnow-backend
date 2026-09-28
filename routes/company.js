import express from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import Company from '../models/Company.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const bucketName = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
const useR2 = Boolean(
  bucketName &&
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
);
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
    s3: s3,
    bucket: bucketName,
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '');
      cb(null, `companies/${Date.now().toString()}-${sanitizedName}`);
    }
  });
} else {
  import('fs').then(fs => {
    if (!fs.existsSync('uploads/companies')) {
      fs.mkdirSync('uploads/companies', { recursive: true });
    }
  });
  
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/companies');
    },
    filename: function (req, file, cb) {
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '');
      cb(null, `${Date.now().toString()}-${sanitizedName}`);
    }
  });
}

const upload = multer({ storage });

// Create Company
router.post('/', upload.single('logo'), async (req, res) => {
  try {
    const { name, email, password, industry, website, location } = req.body;
    
    const existing = await Company.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Company with this email already exists' });
    }

    let logoUrl = '';
    if (req.file) {
      if (useR2) {
        logoUrl = `${process.env.R2_PUBLIC_URL}/${req.file.key}`;
      } else {
        logoUrl = `${req.protocol}://${req.get('host')}/uploads/companies/${req.file.filename}`;
      }
    }

    const newCompany = new Company({
      name, email, password, industry, website, location, logo: logoUrl
    });

    await newCompany.save();
    
    // Don't return password
    const companyResponse = newCompany.toObject();
    delete companyResponse.password;
    
    res.status(201).json(companyResponse);
  } catch (err) {
    console.error('Error creating company:', err);
    res.status(500).json({ message: 'Server Error while creating company' });
  }
});

// Get Companies
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find().select('-password').sort({ createdAt: -1 });
    res.json(companies);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ message: 'Server Error while fetching companies' });
  }
});

// Edit Company
router.put('/:id', upload.single('logo'), async (req, res) => {
  try {
    const { name, email, password, industry, website, location } = req.body;
    const company = await Company.findById(req.params.id);
    
    if (!company) return res.status(404).json({ message: 'Company not found' });
    
    // Check if email changed and if new email already exists
    if (email && email !== company.email) {
      const existing = await Company.findOne({ email });
      if (existing) return res.status(400).json({ message: 'Email already in use' });
      company.email = email;
    }

    if (name) company.name = name;
    if (password) company.password = password; // pre-save hook will hash it
    if (industry) company.industry = industry;
    if (website) company.website = website;
    if (location) company.location = location;

    if (req.file) {
      if (useR2) {
        company.logo = `${process.env.R2_PUBLIC_URL}/${req.file.key}`;
      } else {
        company.logo = `${req.protocol}://${req.get('host')}/uploads/companies/${req.file.filename}`;
      }
    }

    await company.save();
    
    const companyResponse = company.toObject();
    delete companyResponse.password;
    
    res.json(companyResponse);
  } catch (err) {
    console.error('Error updating company:', err);
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
    console.error('Error toggling status:', err);
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
    console.error('Error deleting company:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
