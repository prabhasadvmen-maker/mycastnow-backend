import express from 'express';
import os from 'os';
import mongoose from 'mongoose';
import SystemSettings from '../models/SystemSettings.js';
import HelpTicket from '../models/HelpTicket.js';

const router = express.Router();

// Helper to get or init system settings
const getOrCreateSettings = async () => {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({
      platformName: 'MyCastNow',
      supportEmail: 'support@mycastnow.com',
      supportPhone: '+91 98765 43210',
      platformCommissionPercent: 10,
      boostCommissionPercent: 15,
      minWithdrawalAmount: 500,
      currency: 'INR',
      maintenanceMode: false,
      allowNewRegistrations: true,
      autoApproveCreators: false,
      autoApproveCastings: true,
      emailNotifications: true,
      smsNotifications: false,
      systemNotice: 'Platform is running smoothly in production mode.'
    });
  }
  return settings;
};

// GET System Settings
router.get('/', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// UPDATE System Settings
router.put('/', async (req, res) => {
  try {
    let settings = await getOrCreateSettings();
    
    const allowedFields = [
      'platformName', 'supportEmail', 'supportPhone', 
      'platformCommissionPercent', 'boostCommissionPercent', 
      'minWithdrawalAmount', 'currency', 'maintenanceMode', 
      'allowNewRegistrations', 'autoApproveCreators', 
      'autoApproveCastings', 'emailNotifications', 
      'smsNotifications', 'systemNotice'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();
    res.json({ success: true, message: 'Settings saved successfully', settings });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// GET System Diagnostics for Help Section
router.get('/diagnostics', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = { 0: 'Disconnected', 1: 'Connected', 2: 'Connecting', 3: 'Disconnecting' };
    
    // Memory and CPU
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const usedMem = totalMem - freeMem;
    const processMem = Math.round(process.memoryUsage().rss / (1024 * 1024));

    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    res.json({
      success: true,
      diagnostics: {
        serverStatus: 'Online',
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()} (${os.arch()})`,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        totalMemoryMB: totalMem,
        usedMemoryMB: usedMem,
        processMemoryMB: processMem,
        database: {
          status: dbStatusMap[dbState] || 'Unknown',
          connected: dbState === 1,
          name: mongoose.connection.name || 'mycastnow',
          host: mongoose.connection.host || 'localhost'
        },
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 5000,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch diagnostics' });
  }
});

// GET FAQs for Help Section
router.get('/faqs', (req, res) => {
  const faqs = [
    {
      id: 'faq-1',
      category: 'Profile & Account Security',
      question: 'How do I update my Super Admin password or profile details?',
      answer: 'Go to Settings > Profile tab or Security tab, or click the profile avatar on the top-right header and select "Edit Profile". You can change your name, email, phone, bio, and update your password with current password verification.'
    },
    {
      id: 'faq-2',
      category: 'Castings & Bookings',
      question: 'How do bookings and casting approvals work?',
      answer: 'Companies create casting calls with requirements and dates. Creators apply to these castings. When a company chooses a creator, a Booking is created. In the Bookings section, click any booking to view the complete details popup with creator and company information.'
    },
    {
      id: 'faq-3',
      category: 'Finance & Payments',
      question: 'Where can platform commissions and minimum withdrawal limits be adjusted?',
      answer: 'Navigate to Settings > Platform & Fees. You can modify the platform commission %, boost commission %, and minimum creator withdrawal amount. Changes take effect immediately across all transactions.'
    },
    {
      id: 'faq-4',
      category: 'Creators & Verification',
      question: 'How do I verify or suspend a creator profile?',
      answer: 'Navigate to "Creator Profiles" in the sidebar. Click on any creator to inspect their portfolio, KYC, and applications. Use the status toggle to verify, feature, or temporarily suspend accounts.'
    },
    {
      id: 'faq-5',
      category: 'System Maintenance',
      question: 'What happens when Maintenance Mode is toggled on?',
      answer: 'When Maintenance Mode is enabled in Settings, the public portal displays a temporary maintenance notification to creators and companies while Super Admin retains full administrative access.'
    }
  ];

  res.json({ success: true, faqs });
});

// Support / Help Tickets
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await HelpTicket.find().sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching tickets' });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const { subject, category, priority, message, adminEmail } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const ticket = await HelpTicket.create({
      subject,
      category: category || 'General Query',
      priority: priority || 'Medium',
      message,
      adminEmail: adminEmail || 'superadmin@mycastnow.com'
    });

    res.status(201).json({ success: true, message: 'Support ticket submitted successfully', ticket });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Error submitting ticket' });
  }
});

export default router;
