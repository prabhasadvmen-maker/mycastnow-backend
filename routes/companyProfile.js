import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Company from '../models/Company.js';
import HelpTicket from '../models/HelpTicket.js';

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

// Helper to resolve company cleanly
const resolveCompany = async (req) => {
  const rawId = getCompanyId(req);
  let company = null;
  if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
    company = await Company.findById(rawId);
  }
  if (!company) {
    company = await Company.findOne();
  }
  return company;
};

// ══════════════════════════════════════════════════════
//  GET / — Company Profile Details
// ══════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const company = await resolveCompany(req);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const compObj = company.toObject ? company.toObject() : company;
    delete compObj.password;

    res.json({
      success: true,
      company: {
        ...compObj,
        id: compObj._id
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
    const company = await resolveCompany(req);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

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
      company._id,
      { $set: updateFields },
      { returnDocument: 'after' }
    ).select('-password');

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

// ══════════════════════════════════════════════════════
//  Support Tickets for Company
// ══════════════════════════════════════════════════════
router.get('/tickets', async (req, res) => {
  try {
    const company = await resolveCompany(req);
    const cId = company?._id;

    const filter = cId ? {
      $or: [
        { companyId: cId },
        { senderId: cId }
      ]
    } : { senderType: 'Company' };

    const tickets = await HelpTicket.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, tickets });
  } catch (err) {
    console.error('Fetch company tickets error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const company = await resolveCompany(req);
    const cId = company?._id;

    const { subject, category, priority, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const ticket = await HelpTicket.create({
      subject,
      category: category || 'General Query',
      priority: priority || 'Medium',
      message,
      companyId: cId || undefined,
      companyName: company?.name || 'Production Studio',
      companyEmail: company?.email || '',
      senderType: 'Company'
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully! Our team will respond shortly.',
      ticket
    });
  } catch (err) {
    console.error('Create company ticket error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
