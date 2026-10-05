import express from 'express';
import Company from '../models/Company.js';
import HelpTicket from '../models/HelpTicket.js';
import { verifyToken } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const company = await Company.findById(req.user.id).select('-password');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, company: { ...company.toObject(), id: company._id } });
  } catch (err) {
    logger.error('Fetch company profile error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.put('/', verifyToken, async (req, res) => {
  try {
    const {
      name, logo, phone, industry, website, location,
      tagline, description, address, city, state,
      pincode, gst, cin, pan, contactPerson, socialLinks
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
      req.user.id,
      { $set: updateFields },
      { returnDocument: 'after' }
    ).select('-password');

    if (!updated) return res.status(404).json({ success: false, message: 'Company not found' });

    res.json({ success: true, message: 'Company profile updated successfully!', company: updated });
  } catch (err) {
    logger.error('Update company profile error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.get('/tickets', verifyToken, async (req, res) => {
  try {
    const cId = req.user.id;
    const tickets = await HelpTicket.find({
      $or: [{ companyId: cId }, { senderId: cId }]
    }).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    logger.error('Fetch company tickets error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.post('/tickets', verifyToken, async (req, res) => {
  try {
    const company = await Company.findById(req.user.id).select('name email').lean();
    const { subject, category, priority, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const ticket = await HelpTicket.create({
      subject,
      category: category || 'General Query',
      priority: priority || 'Medium',
      message,
      companyId: req.user.id,
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
    logger.error('Create company ticket error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
