import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { verifyToken } from '../middleware/auth.js';
import logger from '../config/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: admin._id,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Admin Profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: 'Admin account not found' });

    const { name, email, phone, avatar, bio, notificationPreferences } = req.body;

    if (email && email.toLowerCase() !== admin.email.toLowerCase()) {
      const existing = await Admin.findOne({ email: email.toLowerCase(), _id: { $ne: admin._id } });
      if (existing) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
      admin.email = email.toLowerCase().trim();
    }

    if (name !== undefined) admin.name = name;
    if (phone !== undefined) admin.phone = phone;
    if (avatar !== undefined) admin.avatar = avatar;
    if (bio !== undefined) admin.bio = bio;
    if (notificationPreferences !== undefined) {
      admin.notificationPreferences = {
        ...admin.notificationPreferences,
        ...notificationPreferences
      };
    }

    await admin.save();

    const sanitizedAdmin = admin.toObject();
    delete sanitizedAdmin.password;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizedAdmin
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ message: error.message || 'Server error while updating profile' });
  }
});

// Change Admin Password
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: 'Admin account not found' });

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    res.json({
      success: true,
      message: 'Password has been updated successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ message: error.message || 'Server error while updating password' });
  }
});

export default router;
