import express from 'express';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Creator from '../models/Creator.js';
import HelpTicket from '../models/HelpTicket.js';
import { verifyToken } from '../middleware/auth.js';
import logger from '../config/logger.js';
import { otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// ── OTP Store: Redis if REDIS_URL is set, else in-memory Map ────────────────
// To enable Redis: add REDIS_URL=redis://... to your .env
// In-memory is safe for single-instance (Render/Railway free tier).
let redisClient = null;

if (process.env.REDIS_URL) {
  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => logger.error('Redis error:', err.message));
    await redisClient.connect();
    logger.info('OTP store: Redis connected');
  } catch (err) {
    logger.warn('Redis unavailable, falling back to in-memory OTP store:', err.message);
    redisClient = null;
  }
}

const otpStore = new Map(); // used only when Redis is not available

const setOTP = async (phone, otp, ttlSeconds) => {
  if (redisClient) {
    await redisClient.set(`otp:${phone}`, otp, { EX: ttlSeconds });
  } else {
    otpStore.set(phone, { otp, expiry: Date.now() + ttlSeconds * 1000 });
  }
};

const getOTP = async (phone) => {
  if (redisClient) {
    const otp = await redisClient.get(`otp:${phone}`);
    return otp ? { otp, expiry: Infinity } : null; // Redis handles TTL natively
  }
  return otpStore.get(phone) || null;
};

const deleteOTP = async (phone) => {
  if (redisClient) {
    await redisClient.del(`otp:${phone}`);
  } else {
    otpStore.delete(phone);
  }
};

// Auto-cleanup expired OTPs from in-memory store every 10 minutes
setInterval(() => {
  if (redisClient) return; // Redis handles expiry natively
  const now = Date.now();
  for (const [phone, record] of otpStore.entries()) {
    if (now > record.expiry) otpStore.delete(phone);
  }
}, 10 * 60 * 1000);

// ──────────────────────────────────────────────────────────────────────────────
//  1. POST /send-otp — Generate & send OTP
// ──────────────────────────────────────────────────────────────────────────────
router.post('/send-otp', otpLimiter, async (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number. Must be exactly 10 digits.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // BUG 3 FIX: In production, wait for SMS confirmation before storing OTP.
  // Only store OTP after successful send to prevent phantom OTPs.
  if (process.env.NODE_ENV === 'production') {
    try {
      const response = await axios.post('https://apitxt.com/api/sendOTP', new URLSearchParams({
        authkey: process.env.APITXT_API_KEY,
        mobile: phone,
        otp,
        channel: 'sms',
        country: '91',
      }));
      if (response.data.status !== 'success' && response.data.status !== 200) {
        logger.warn(`APITxT warning for ${phone}:`, response.data);
        return res.status(502).json({ success: false, message: 'Failed to send OTP. Please try again.' });
      }
    } catch (err) {
      logger.error(`APITxT error for ${phone}: ${err.response?.data || err.message}`);
      return res.status(502).json({ success: false, message: 'SMS service unavailable. Please try again.' });
    }
  }

  await setOTP(phone, otp, 5 * 60); // 5 minutes TTL

  const responsePayload = { success: true, message: 'OTP sent successfully' };
  if (process.env.NODE_ENV !== 'production') {
    responsePayload.devOtp = otp;
  }

  res.json(responsePayload);
});

// ──────────────────────────────────────────────────────────────────────────────
//  2. POST /verify-otp — Verify OTP & issue JWT
// ──────────────────────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
  }

  const record = await getOTP(phone);

  if (!record) return res.status(400).json({ success: false, message: 'OTP not found or expired. Please request a new OTP.' });
  if (record.expiry !== Infinity && Date.now() > record.expiry) {
    await deleteOTP(phone);
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
  }
  if (record.otp !== otp.toString()) {
    return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
  }

  // OTP verified — delete immediately (one-time use)
  await deleteOTP(phone);

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

    const creatorResponse = creator.toObject();
    delete creatorResponse.password;

    res.json({
      success: true,
      message: 'Verified successfully',
      token,
      creator: creatorResponse,
      isNewUser
    });

  } catch (error) {
    logger.error('OTP verification error:', error);
    res.status(500).json({ success: false, message: 'Server error during verification' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  3. GET /me — Get logged-in creator profile
// ──────────────────────────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id).select('-password');
    if (!creator) return res.status(404).json({ message: 'Creator not found' });
    res.json(creator);
  } catch (error) {
    logger.error('Fetch creator me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  4. PUT /update-profile — Whitelist-based safe profile update
// ──────────────────────────────────────────────────────────────────────────────
router.put('/update-profile', verifyToken, async (req, res) => {
  try {
    // SECURITY: Only allow safe fields — never allow isApproved, status, role etc.
    const ALLOWED_FIELDS = [
      'basicDetails', 'professionalDetails', 'physicalDetails',
      'portfolio', 'pricing', 'availability', 'socialLinks',
      'settings', 'email', 'onboardingStep', 'isProfileComplete'
    ];

    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
    }

    const updatedCreator = await Creator.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!updatedCreator) return res.status(404).json({ success: false, message: 'Creator not found' });

    res.json({ success: true, creator: updatedCreator });
  } catch (error) {
    logger.error('Update creator profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  5. PUT /change-password — Secure password change
// ──────────────────────────────────────────────────────────────────────────────
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
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

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await Creator.findByIdAndUpdate(req.user.id, { $set: { password: hashedPassword } });

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    logger.error('Creator change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  6. GET /tickets — Fetch creator support tickets
// ──────────────────────────────────────────────────────────────────────────────
router.get('/tickets', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id).select('_id phone').lean();
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const tickets = await HelpTicket.find({
      $or: [
        { creatorId: creator._id },
        { creatorPhone: creator.phone }
      ]
    }).sort({ createdAt: -1 });

    res.json({ success: true, tickets });
  } catch (error) {
    logger.error('Fetch creator tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  7. POST /tickets — Submit a support ticket
// ──────────────────────────────────────────────────────────────────────────────
router.post('/tickets', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id).select('basicDetails phone email').lean();
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const { subject, category, priority, message } = req.body;
    if (!subject || !subject.trim() || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const ticket = await HelpTicket.create({
      subject: subject.trim(),
      category: category || 'General Query',
      priority: priority || 'Medium',
      message: message.trim(),
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
    logger.error('Create creator ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit ticket' });
  }
});

export default router;
