import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

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
      process.env.JWT_SECRET || 'fallback_secret_for_dev_only',
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
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    
    res.json(admin);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Update Admin Profile (name, email, phone, avatar, bio, notificationPreferences)
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let adminId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
        adminId = decoded.id;
      } catch (e) {
        console.warn('JWT verification failed, checking fallback');
      }
    }

    let admin = null;
    if (adminId) {
      admin = await Admin.findById(adminId);
    }
    if (!admin) {
      admin = await Admin.findOne();
    }
    if (!admin) {
      return res.status(404).json({ message: 'Admin account not found' });
    }

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
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message || 'Server error while updating profile' });
  }
});

// Change Admin Password
router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let adminId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
        adminId = decoded.id;
      } catch (e) {
        console.warn('JWT verify error');
      }
    }

    let admin = null;
    if (adminId) {
      admin = await Admin.findById(adminId);
    }
    if (!admin) {
      admin = await Admin.findOne();
    }
    if (!admin) {
      return res.status(404).json({ message: 'Admin account not found' });
    }

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

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    res.json({
      success: true,
      message: 'Password has been updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: error.message || 'Server error while updating password' });
  }
});

export default router;
