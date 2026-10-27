import express from 'express';
import Creator from '../models/Creator.js';
import Payment from '../models/Payment.js';

const router = express.Router();

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const backend = process.env.BACKEND_URL || 'https://api.mycastnow.com';
  return url.replace(/^http:\/\/(localhost|127\.0\.0\.1):5000/, backend);
};

const sanitizeCreatorDoc = (doc) => {
  if (doc.basicDetails?.profilePhoto) {
    doc.basicDetails.profilePhoto = sanitizeUrl(doc.basicDetails.profilePhoto);
  }
  if (Array.isArray(doc.portfolio?.photos)) {
    doc.portfolio.photos = doc.portfolio.photos.map(sanitizeUrl);
  }
  if (Array.isArray(doc.portfolio?.videos)) {
    doc.portfolio.videos = doc.portfolio.videos.map(sanitizeUrl);
  }
  if (doc.introVideo) {
    doc.introVideo = sanitizeUrl(doc.introVideo);
  }
  return doc;
};

// GET all creators
router.get('/', async (req, res) => {
  try {
    const creators = await Creator.find().sort({ createdAt: -1 });
    const formatted = creators.map(c => {
      const doc = c.toObject();
      if (!doc.isProfileComplete && doc.status !== 'approved' && doc.status !== 'rejected') {
        doc.status = 'incomplete';
      }
      if (!doc.basicDetails) doc.basicDetails = {};
      if (!doc.basicDetails.profilePhoto || doc.basicDetails.profilePhoto.startsWith('blob:')) {
        doc.basicDetails.profilePhoto = doc.portfolio?.photos?.[0] || '';
      }
      return sanitizeCreatorDoc(doc);
    });
    res.json(formatted);
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
    const doc = creator.toObject();
    if (!doc.isProfileComplete && doc.status !== 'approved' && doc.status !== 'rejected') {
      doc.status = 'incomplete';
    }
    if (!doc.basicDetails) doc.basicDetails = {};
    if (!doc.basicDetails.profilePhoto || doc.basicDetails.profilePhoto.startsWith('blob:')) {
      doc.basicDetails.profilePhoto = doc.portfolio?.photos?.[0] || '';
    }
    res.json(sanitizeCreatorDoc(doc));
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT update creator status (Approve/Reject)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // 'approved', 'rejected', 'pending', 'incomplete'
    if (!['approved', 'rejected', 'pending', 'incomplete'].includes(status)) {
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

// DELETE creator account completely (Preserving financial/payment ledger permanently)
router.delete('/:id', async (req, res) => {
  try {
    const creator = await Creator.findById(req.params.id);
    if (!creator) return res.status(404).json({ message: 'Creator not found' });

    const ONBOARDING_FEE = Number(process.env.CREATOR_ONBOARDING_FEE) || 499;
    const hasPaid = creator.onboardingFeePaid || Boolean(creator.onboardingPaymentId);

    // If the creator made an onboarding payment, ensure it exists in the permanent Payment collection
    if (hasPaid) {
      const paymentId = creator.onboardingPaymentId || `legacy_pay_${creator._id}`;
      const orderId = creator.onboardingOrderId || `legacy_order_${creator._id}`;
      const paidAt = creator.onboardingPaidAt || creator.createdAt || new Date();
      const creatorName = creator.basicDetails?.fullName || 'Deleted Creator';
      const creatorPhone = creator.phone || '';
      const creatorEmail = creator.email || '';
      const profilePhoto = creator.basicDetails?.profilePhoto || '';

      const isFree = (paymentId && paymentId.startsWith('free_')) || (orderId && orderId.startsWith('free_'));
      const fallbackAmount = isFree ? 0 : ONBOARDING_FEE;

      await Payment.findOneAndUpdate(
        {
          $or: [
            { paymentId: paymentId },
            { creatorId: creator._id }
          ]
        },
        {
          $setOnInsert: {
            amount: fallbackAmount,
            currency: 'INR',
            paymentType: 'onboarding_fee',
            orderId,
            paymentId,
            onboardingPaymentId: paymentId,
            onboardingOrderId: orderId,
            onboardingPaidAt: paidAt,
            status: 'paid',
            paidAt
          },
          $set: {
            creatorId: creator._id,
            creatorName,
            creatorPhone,
            creatorEmail,
            profilePhoto,
            basicDetails: {
              fullName: creatorName,
              profilePhoto
            },
            phone: creatorPhone,
            email: creatorEmail,
            isCreatorDeleted: true,
            deletedAt: new Date()
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // Freeze and preserve all payment records for this creator as isCreatorDeleted: true
    await Payment.updateMany(
      { creatorId: creator._id },
      {
        $set: {
          isCreatorDeleted: true,
          deletedAt: new Date(),
          creatorName: creator.basicDetails?.fullName || 'Deleted Creator',
          creatorPhone: creator.phone || '',
          'basicDetails.fullName': creator.basicDetails?.fullName || 'Deleted Creator',
          'basicDetails.profilePhoto': creator.basicDetails?.profilePhoto || '',
          phone: creator.phone || ''
        }
      }
    );

    // Now delete only the Creator profile document
    await Creator.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Creator deleted successfully. Payment records retained.' });
  } catch (error) {
    console.error('Error deleting creator:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
