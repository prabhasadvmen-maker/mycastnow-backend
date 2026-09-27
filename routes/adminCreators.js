import express from 'express';
import Creator from '../models/Creator.js';

const router = express.Router();

// GET all creators
router.get('/', async (req, res) => {
  try {
    const creators = await Creator.find().sort({ createdAt: -1 });
    res.json(creators);
  } catch (error) {
    console.error('Error fetching creators:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET single creator
router.get('/:id', async (req, res) => {
  try {
    const creator = await Creator.findById(req.params.id);
    if (!creator) return res.status(404).json({ message: 'Creator not found' });
    res.json(creator);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT update creator status (Approve/Reject)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const isApproved = status === 'approved';
    const updatePayload = { status, isApproved };
    
    if (status === 'rejected') {
      updatePayload.rejectionReason = rejectionReason || '';
    } else if (status === 'approved') {
      updatePayload.rejectionReason = ''; // clear reason on approval
    }

    const updatedCreator = await Creator.findByIdAndUpdate(
      req.params.id,
      { $set: updatePayload },
      { returnDocument: 'after' }
    );

    if (!updatedCreator) return res.status(404).json({ message: 'Creator not found' });

    res.json({ success: true, creator: updatedCreator, message: `Creator successfully ${status}` });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT update creator active/inactive status
router.put('/:id/active', async (req, res) => {
  try {
    const { isActive } = req.body;
    const updatedCreator = await Creator.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive } },
      { returnDocument: 'after' }
    );
    if (!updatedCreator) return res.status(404).json({ message: 'Creator not found' });
    res.json({ success: true, creator: updatedCreator });
  } catch (error) {
    console.error('Error toggling active status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// DELETE creator account completely
router.delete('/:id', async (req, res) => {
  try {
    const deletedCreator = await Creator.findByIdAndDelete(req.params.id);
    if (!deletedCreator) return res.status(404).json({ message: 'Creator not found' });
    res.json({ success: true, message: 'Creator deleted successfully' });
  } catch (error) {
    console.error('Error deleting creator:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
