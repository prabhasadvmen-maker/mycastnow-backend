import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Company from '../models/Company.js';

const router = express.Router();

const getCompanyId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    return decoded?.id || null;
  } catch (err) {
    return null;
  }
};

// ══════════════════════════════════════════════════════
//  GET / — Company Profile Details
// ══════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req) || '6ab8136cb407882f7d42a180';
    const cId = new mongoose.Types.ObjectId(companyId);

    const company = await Company.findById(cId).select('-password').lean();
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({
      success: true,
      company: {
        ...company,
        id: company._id
      }
    });

  } catch (err) {
    console.error('Fetch company profile error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  PUT / — Update Company Profile
// ══════════════════════════════════════════════════════
router.put('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req) || '6ab8136cb407882f7d42a180';
    const cId = new mongoose.Types.ObjectId(companyId);

    const {
      name,
      logo,
      phone,
      industry,
      website,
      location,
      tagline,
      description,
      address,
      city,
      state,
      pincode,
      gst,
      cin,
      pan,
      contactPerson,
      socialLinks
    } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (logo !== undefined) updateFields.logo = logo;
    if (phone !== undefined) updateFields.phone = phone;
    if (industry) updateFields.industry = industry;
    if (website !== undefined) updateFields.website = website;
    if (location) updateFields.location = location;
    if (tagline !== undefined) updateFields.tagline = tagline;
    if (description !== undefined) updateFields.description = description;

    if (address !== undefined) updateFields.address = address;
    if (city !== undefined) updateFields.city = city;
    if (state !== undefined) updateFields.state = state;
    if (pincode !== undefined) updateFields.pincode = pincode;

    if (gst !== undefined) updateFields.gst = gst;
    if (cin !== undefined) updateFields.cin = cin;
    if (pan !== undefined) updateFields.pan = pan;

    if (contactPerson) updateFields.contactPerson = contactPerson;
    if (socialLinks) updateFields.socialLinks = socialLinks;

    const updated = await Company.findByIdAndUpdate(
      cId,
      { $set: updateFields },
      { returnDocument: 'after' }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({
      success: true,
      message: 'Company profile updated successfully!',
      company: updated
    });

  } catch (err) {
    console.error('Update company profile error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
