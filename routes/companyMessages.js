import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Creator from '../models/Creator.js';
import Company from '../models/Company.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/conversations', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const cId = new mongoose.Types.ObjectId(companyId);

    // Get distinct creators this company has exchanged messages with
    const messages = await Message.find({ company: cId })
      .populate('creator', 'basicDetails professionalDetails phone email portfolio')
      .sort({ createdAt: -1 })
      .lean();

    // Group by creator
    const convMap = new Map();

    for (const msg of messages) {
      if (!msg.creator) continue;
      const crId = msg.creator._id.toString();

      if (!convMap.has(crId)) {
        convMap.set(crId, {
          creatorId: crId,
          creator: msg.creator,
          lastMessage: {
            text: msg.text,
            senderType: msg.senderType,
            createdAt: msg.createdAt
          },
          projectReference: msg.projectReference || '',
          unreadCount: 0,
          totalMessages: 0
        });
      }

      const conv = convMap.get(crId);
      conv.totalMessages += 1;
      if (!msg.read && msg.senderType === 'Creator') {
        conv.unreadCount += 1;
      }
    }

    const conversations = Array.from(convMap.values());

    res.json({
      success: true,
      count: conversations.length,
      conversations
    });

  } catch (err) {
    console.error('Fetch conversations error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.get('/thread/:creatorId', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const cId = new mongoose.Types.ObjectId(companyId);
    const crId = new mongoose.Types.ObjectId(req.params.creatorId);

    // Fetch Creator info
    const creator = await Creator.findById(crId)
      .select('basicDetails professionalDetails portfolio phone email')
      .lean();

    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }

    // Fetch all messages
    const messages = await Message.find({
      company: cId,
      creator: crId
    }).sort({ createdAt: 1 }).lean();

    // Mark unread messages from creator as read
    await Message.updateMany(
      { company: cId, creator: crId, senderType: 'Creator', read: false },
      { $set: { read: true } }
    );

    res.json({
      success: true,
      creator,
      messages: messages.map(m => ({
        ...m,
        id: m._id
      }))
    });

  } catch (err) {
    console.error('Fetch thread error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

router.post('/send', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { creatorId, text, projectReference, attachment } = req.body;

    if (!creatorId || !text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'creatorId and message text are required' });
    }

    const cId = new mongoose.Types.ObjectId(companyId);
    const crId = new mongoose.Types.ObjectId(creatorId);

    const message = new Message({
      company: cId,
      creator: crId,
      senderType: 'Company',
      text: text.trim(),
      projectReference: projectReference || '',
      attachment: attachment || { url: '', fileType: '', name: '' },
      read: false
    });

    const saved = await message.save();

    res.status(201).json({
      success: true,
      message: saved
    });

  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Server error sending message', error: err.message });
  }
});

router.post('/creator-reply', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { creatorId, text, projectReference } = req.body;

    if (!creatorId || !text) {
      return res.status(400).json({ success: false, message: 'creatorId and text required' });
    }

    const cId = new mongoose.Types.ObjectId(companyId);
    const crId = new mongoose.Types.ObjectId(creatorId);

    const message = new Message({
      company: cId,
      creator: crId,
      senderType: 'Creator',
      text: text.trim(),
      projectReference: projectReference || '',
      read: false
    });

    const saved = await message.save();

    res.status(201).json({
      success: true,
      message: saved
    });

  } catch (err) {
    console.error('Creator reply error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
