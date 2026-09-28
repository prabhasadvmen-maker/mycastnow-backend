import express from 'express';
import Creator from '../models/Creator.js';
import Company from '../models/Company.js';

const router = express.Router();

// Fetch all users (Creators & Companies combined)
router.get('/', async (req, res) => {
  try {
    const creators = await Creator.find({}, 'phone email basicDetails.fullName professionalDetails.primaryCategory status isActive createdAt');
    const companies = await Company.find({}, 'phone email companyName industry status isActive createdAt');

    const formattedCreators = creators.map(c => ({
      _id: c._id,
      name: c.basicDetails?.fullName || 'Unnamed Creator',
      contact: c.email || c.phone,
      role: 'Creator',
      category: c.professionalDetails?.primaryCategory || 'N/A',
      status: c.status,
      isActive: c.isActive,
      createdAt: c.createdAt
    }));

    const formattedCompanies = companies.map(c => ({
      _id: c._id,
      name: c.companyName || 'Unnamed Company',
      contact: c.email || c.phone,
      role: 'Company',
      category: c.industry || 'N/A',
      status: c.status,
      isActive: c.isActive,
      createdAt: c.createdAt
    }));

    const allUsers = [...formattedCreators, ...formattedCompanies].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Toggle Suspend (isActive)
router.put('/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;
    
    if (role === 'Creator') {
      await Creator.findByIdAndUpdate(id, { isActive });
    } else if (role === 'Company') {
      await Company.findByIdAndUpdate(id, { isActive });
    } else {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    res.json({ success: true, message: `User ${isActive ? 'restored' : 'suspended'} successfully` });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
