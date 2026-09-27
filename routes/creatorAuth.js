import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import Creator from '../models/Creator.js';

const router = express.Router();

// In-memory OTP store (Use Redis for production)
const otpStore = {};

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ success: false, message: 'Invalid phone number. Must be 10 digits.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { otp, expiry: Date.now() + 5 * 60 * 1000 }; // 5 min expiry

  // Fire and forget the SMS to APITxT so the user doesn't wait for the network request!
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

  // Return instantly for the "fast wala kam" magic auto-fill
  res.json({ success: true, message: 'OTP sent instantly', devOtp: otp });
});

// 2. Verify OTP & Login/Signup
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore[phone];

  if (!record) return res.status(400).json({ success: false, message: 'OTP not found or expired' });
  if (Date.now() > record.expiry) return res.status(400).json({ success: false, message: 'OTP expired' });
  if (record.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });

  // OTP is correct, clear it
  delete otpStore[phone];

  try {
    // Check if creator exists
    let creator = await Creator.findOne({ phone });
    let isNewUser = false;

    if (!creator) {
      // Create new creator
      creator = new Creator({
        phone,
        onboardingStep: 1,
        isProfileComplete: false,
        isApproved: false
      });
      await creator.save();
      isNewUser = true;
    } else {
      // If creator exists, check if they are rejected or disabled
      if (creator.status === 'rejected') {
        const reason = creator.rejectionReason || 'No specific reason provided.';
        return res.status(403).json({ success: false, message: `Your profile was rejected. Reason: ${reason}` });
      }
      if (!creator.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been disabled by the admin.' });
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: creator._id, phone: creator.phone, role: 'creator' },
      process.env.JWT_SECRET || 'fallback_secret_for_dev_only',
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    const creator = await Creator.findById(decoded.id);

    if (!creator) return res.status(404).json({ message: 'Creator not found' });
    
    res.json(creator);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// 4. Update Creator Profile (For Onboarding & Settings)
router.put('/update-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    
    const updateData = req.body;
    
    const updatedCreator = await Creator.findByIdAndUpdate(
      decoded.id,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    res.json({ success: true, creator: updatedCreator });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

export default router;
