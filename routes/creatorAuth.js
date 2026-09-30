import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Creator from '../models/Creator.js';
import HelpTicket from '../models/HelpTicket.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// In-memory OTP store (Use Redis for production multi-instance)
const otpStore = {};

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ success: false, message: 'Invalid phone number. Must be 10 digits.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { otp, expiry: Date.now() + 5 * 60 * 1000 };

  axios.post('https://apitxt.com/api/sendOTP', new URLSearchParams({
    authkey: process.env.APITXT_API_KEY,
    mobile: phone,
    otp,
    channel: 'sms',
    country: '91',
  })).then(response => {
    if (response.data.status !== 'success' && response.data.status !== 200) {
      console.warn('APITxT Warning in background:', response.data);
    }
  }).catch(err => {
    console.error('APITxT Error in background:', err.response?.data || err.message);
  });

  const responsePayload = { success: true, message: 'OTP sent successfully' };
  // Only expose OTP in non-production for testing
  if (process.env.NODE_ENV !== 'production') {
    responsePayload.devOtp = otp;
  }

  res.json(responsePayload);
});

// 2. Verify OTP & Login/Signup
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore[phone];

  if (!record) return res.status(400).json({ success: false, message: 'OTP not found or expired' });
  if (Date.now() > record.expiry) return res.status(400).json({ success: false, message: 'OTP expired' });
  if (record.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });

  delete otpStore[phone];

  try {
    let creator = await Creator.findOne({ phone });
    let isNewUser = false;

    if (!creator) {
      creator = new Creator({
        phone,
        onboardingStep: 1,
        isProfileComplete: false,
        isApproved: false
      });
      await creator.save();
      isNewUser = true;
    } else {
      if (creator.status === 'rejected') {
        const reason = creator.rejectionReason || 'No specific reason provided.';
        return res.status(403).json({ success: false, message: `Your profile was rejected. Reason: ${reason}` });
      }
      if (!creator.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been disabled by the admin.' });
      }
    }

    const token = jwt.sign(
      { id: creator._id, phone: creator.phone, role: 'creator' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Verified successfully',
      token,
      creator,
      isNewUser
    });

  } catch (error) {
    console.error('Error during OTP verification / Creator lookup:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 3. Get Current Creator Profile
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const creator = await Creator.findById(decoded.id);

    if (!creator) return res.status(404).json({ message: 'Creator not found' });

    res.json(creator);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// 4. Update Creator Profile
router.put('/update-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);

    const updatedCreator = await Creator.findByIdAndUpdate(
      decoded.id,
      { $set: req.body },
      { returnDocument: 'after' }
    );

    res.json({ success: true, creator: updatedCreator });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// 5. Change or Set Password for Creator
router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const creator = await Creator.findById(decoded.id);

    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    if (creator.password && currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, creator.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await Creator.findByIdAndUpdate(decoded.id, {
      $set: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Creator change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// 6. Creator Support Tickets — GET
router.get('/tickets', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const creator = await Creator.findById(decoded.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const tickets = await HelpTicket.find({
      $or: [
        { creatorId: creator._id },
        { creatorPhone: creator.phone }
      ]
    }).sort({ createdAt: -1 });

    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Fetch creator tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
});

// 6b. Creator Support Tickets — POST
router.post('/tickets', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const creator = await Creator.findById(decoded.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const { subject, category, priority, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const ticket = await HelpTicket.create({
      subject,
      category: category || 'General Query',
      priority: priority || 'Medium',
      message,
      creatorId: creator._id,
      creatorName: creator.basicDetails?.fullName || 'Creator',
      creatorPhone: creator.phone || '',
      creatorEmail: creator.email || '',
      senderType: 'Creator'
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully! Our talent helpdesk will respond shortly.',
      ticket
    });
  } catch (error) {
    console.error('Create creator ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit ticket' });
  }
});

export default router;
