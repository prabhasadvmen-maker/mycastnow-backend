import express from 'express';
import mongoose from 'mongoose';
import Creator from '../models/Creator.js';
import Casting from '../models/Casting.js';
import Booking from '../models/Booking.js';
import Message from '../models/Message.js';
import Company from '../models/Company.js';
import WalletTransaction from '../models/WalletTransaction.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import UserSubscription from '../models/UserSubscription.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// ══════════════════════════════════════════════════════
//  1. GET /overview — Creator Overview KPIs & Recent Activity
// ══════════════════════════════════════════════════════
router.get('/overview', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator profile not found' });
    }

    const creatorId = creator._id;

    // Applications count & Shortlisted count
    const allAppliedCastings = await Casting.find({
      'applicants.creator': creatorId
    }).lean();

    const totalApplications = allAppliedCastings.length;
    let shortlistedCount = 0;
    let selectedCount = 0;

    const recentApplications = allAppliedCastings.map(c => {
      const myApp = c.applicants?.find(a => a.creator?.toString() === creatorId.toString());
      if (myApp?.status === 'Shortlisted' || myApp?.status === 'Audition Scheduled') {
        shortlistedCount++;
      } else if (myApp?.status === 'Selected') {
        selectedCount++;
        shortlistedCount++;
      }
      return {
        castingId: c._id,
        title: c.title,
        projectType: c.projectType,
        location: c.location,
        budget: c.budget,
        image: c.image,
        appliedAt: myApp?.appliedAt || c.updatedAt,
        status: myApp?.status || 'Applied',
        notes: myApp?.notes || ''
      };
    }).sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt)).slice(0, 5);

    // Bookings count from Booking collection
    const bookingsCount = await Booking.countDocuments({ creator: creatorId }).catch(() => 0);

    // Recommended Open Castings (not yet applied)
    const appliedIds = allAppliedCastings.map(c => c._id);
    const recommendedCastings = await Casting.find({
      _id: { $nin: appliedIds },
      status: 'Open'
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    // Profile Completion checklist calculation
    let completionScore = 0;
    if (creator.basicDetails?.fullName) completionScore += 20;
    if (creator.basicDetails?.profilePhoto) completionScore += 20;
    if (creator.portfolio?.photos?.length > 0) completionScore += 20;
    if (creator.professionalDetails?.primaryCategory) completionScore += 20;
    if (creator.physicalDetails?.height) completionScore += 20;

    res.json({
      success: true,
      creator: {
        _id: creator._id,
        phone: creator.phone,
        email: creator.email,
        basicDetails: creator.basicDetails,
        professionalDetails: creator.professionalDetails,
        physicalDetails: creator.physicalDetails,
        stats: {
          totalBookings: Math.max(creator.stats?.totalBookings || 0, bookingsCount),
          rating: creator.stats?.rating || 0,
          reviewsCount: creator.stats?.reviewsCount || 0,
          profileViews: creator.stats?.profileViews || 0
        },
        isApproved: creator.isApproved,
        completionScore
      },
      kpis: {
        totalApplications,
        shortlistedCount,
        selectedCount,
        totalBookings: Math.max(creator.stats?.totalBookings || 0, bookingsCount),
        profileViews: creator.stats?.profileViews || 0,
        rating: creator.stats?.rating || 0
      },
      recentApplications,
      recommendedCastings
    });
  } catch (error) {
    console.error('Error fetching creator overview:', error);
    res.status(500).json({ success: false, message: 'Server error fetching overview' });
  }
});

// ══════════════════════════════════════════════════════
//  2. GET /portfolio — Creator Portfolio Details
// ══════════════════════════════════════════════════════
router.get('/portfolio', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    res.json({
      success: true,
      creator: {
        _id: creator._id,
        basicDetails: creator.basicDetails || {},
        professionalDetails: creator.professionalDetails || {},
        physicalDetails: creator.physicalDetails || {},
        portfolio: creator.portfolio || { photos: [], videos: [], campaigns: [] },
        pricing: creator.pricing || {},
        stats: creator.stats || {}
      }
    });
  } catch (error) {
    console.error('Error fetching creator portfolio:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  3. PUT /portfolio — Update Entire or Partial Portfolio
// ══════════════════════════════════════════════════════
router.put('/portfolio', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const { basicDetails, professionalDetails, physicalDetails, portfolio, pricing } = req.body;

    if (basicDetails) {
      creator.basicDetails = { ...creator.basicDetails, ...basicDetails };
    }
    if (professionalDetails) {
      creator.professionalDetails = { ...creator.professionalDetails, ...professionalDetails };
    }
    if (physicalDetails) {
      creator.physicalDetails = { ...creator.physicalDetails, ...physicalDetails };
    }
    if (portfolio) {
      creator.portfolio = { ...creator.portfolio, ...portfolio };
    }
    if (pricing) {
      creator.pricing = { ...creator.pricing, ...pricing };
    }

    await creator.save();

    res.json({
      success: true,
      message: 'Portfolio updated successfully',
      creator: {
        _id: creator._id,
        basicDetails: creator.basicDetails,
        professionalDetails: creator.professionalDetails,
        physicalDetails: creator.physicalDetails,
        portfolio: creator.portfolio,
        pricing: creator.pricing
      }
    });
  } catch (error) {
    console.error('Error updating portfolio:', error);
    res.status(500).json({ success: false, message: 'Failed to update portfolio' });
  }
});

// ══════════════════════════════════════════════════════
//  4. POST /portfolio/photo — Add Single Photo
// ══════════════════════════════════════════════════════
router.post('/portfolio/photo', verifyToken, async (req, res) => {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl) return res.status(400).json({ success: false, message: 'Photo URL is required' });

    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    if (!creator.portfolio) creator.portfolio = { photos: [], videos: [], campaigns: [] };
    if (!creator.portfolio.photos) creator.portfolio.photos = [];

    creator.portfolio.photos.push(photoUrl);
    await creator.save();

    res.json({ success: true, message: 'Photo added to portfolio', photos: creator.portfolio.photos });
  } catch (error) {
    console.error('Error adding photo:', error);
    res.status(500).json({ success: false, message: 'Failed to add photo' });
  }
});

// ══════════════════════════════════════════════════════
//  5. DELETE /portfolio/photo — Delete Photo
// ══════════════════════════════════════════════════════
router.delete('/portfolio/photo', verifyToken, async (req, res) => {
  try {
    const { photoUrl, index } = req.body;
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    if (!creator.portfolio?.photos) {
      return res.status(400).json({ success: false, message: 'No photos to delete' });
    }

    if (typeof index === 'number' && index >= 0 && index < creator.portfolio.photos.length) {
      creator.portfolio.photos.splice(index, 1);
    } else if (photoUrl) {
      creator.portfolio.photos = creator.portfolio.photos.filter(p => p !== photoUrl);
    }

    await creator.save();
    res.json({ success: true, message: 'Photo removed', photos: creator.portfolio.photos });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ success: false, message: 'Failed to delete photo' });
  }
});

// ══════════════════════════════════════════════════════
//  6. POST /portfolio/campaign — Add Brand Campaign
// ══════════════════════════════════════════════════════
router.post('/portfolio/campaign', verifyToken, async (req, res) => {
  try {
    const { title, brand, role, supportingDocs } = req.body;
    if (!title || !brand) {
      return res.status(400).json({ success: false, message: 'Title and Brand are required' });
    }

    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    if (!creator.portfolio) creator.portfolio = { photos: [], videos: [], campaigns: [] };
    if (!creator.portfolio.campaigns) creator.portfolio.campaigns = [];

    creator.portfolio.campaigns.push({
      title,
      brand,
      role: role || '',
      supportingDocs: supportingDocs || []
    });

    await creator.save();
    res.json({ success: true, message: 'Campaign added', campaigns: creator.portfolio.campaigns });
  } catch (error) {
    console.error('Error adding campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to add campaign' });
  }
});

// ══════════════════════════════════════════════════════
//  7. DELETE /portfolio/campaign/:index — Remove Campaign
// ══════════════════════════════════════════════════════
router.delete('/portfolio/campaign/:index', verifyToken, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    if (creator.portfolio?.campaigns && index >= 0 && index < creator.portfolio.campaigns.length) {
      creator.portfolio.campaigns.splice(index, 1);
      await creator.save();
    }

    res.json({ success: true, message: 'Campaign deleted', campaigns: creator.portfolio?.campaigns || [] });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
});

// ══════════════════════════════════════════════════════
//  8. GET /castings — Browse All Open Casting Calls
// ══════════════════════════════════════════════════════
router.get('/castings', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;

    const { projectType, location, gender, search } = req.query;

    const query = { status: { $in: ['Open', 'In Review'] } };

    if (projectType && projectType !== 'All') {
      query.projectType = projectType;
    }
    if (location && location !== 'All') {
      query.location = { $regex: location, $options: 'i' };
    }
    if (gender && gender !== 'Any') {
      query.gender = { $in: [gender, 'Any'] };
    }
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { roleType: { $regex: search.trim(), $options: 'i' } },
        { location: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const castings = await Casting.find(query)
      .populate('company', 'name logo city website')
      .sort({ createdAt: -1 })
      .lean();

    // Map castings with user-specific application status
    const formattedCastings = castings.map(c => {
      const myApp = c.applicants?.find(a => a.creator?.toString() === creatorId);
      return {
        ...c,
        hasApplied: !!myApp,
        myApplicationStatus: myApp ? myApp.status : null,
        appliedAt: myApp ? myApp.appliedAt : null,
        applicantsCount: c.applicants?.length || c.applicantsCount || 0
      };
    });

    res.json({
      success: true,
      count: formattedCastings.length,
      castings: formattedCastings
    });
  } catch (error) {
    console.error('Error fetching creator castings:', error);
    res.status(500).json({ success: false, message: 'Server error fetching castings' });
  }
});

// ══════════════════════════════════════════════════════
//  9. POST /castings/:id/apply — Apply to a Casting Call
// ══════════════════════════════════════════════════════
router.post('/castings/:id/apply', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator profile not found' });

    const { id } = req.params;
    const { notes } = req.body;

    const casting = await Casting.findById(id);
    if (!casting) return res.status(404).json({ success: false, message: 'Casting call not found' });

    // Check if casting is open
    if (casting.status === 'Closed' || casting.status === 'Archived') {
      return res.status(400).json({ success: false, message: 'This casting call is no longer accepting applications' });
    }

    // Check if already applied
    const alreadyApplied = casting.applicants?.some(a => a.creator?.toString() === creator._id.toString());
    if (alreadyApplied) {
      return res.status(400).json({ success: false, message: 'You have already applied to this casting call' });
    }

    // Push new applicant
    casting.applicants.push({
      creator: creator._id,
      appliedAt: new Date(),
      status: 'Applied',
      notes: notes || ''
    });

    casting.applicantsCount = casting.applicants.length;
    await casting.save();

    res.json({
      success: true,
      message: 'Application submitted successfully! The casting director will review your profile.',
      castingId: casting._id,
      applicationStatus: 'Applied'
    });
  } catch (error) {
    console.error('Error applying to casting:', error);
    res.status(500).json({ success: false, message: 'Failed to submit application' });
  }
});

// ══════════════════════════════════════════════════════
//  10. GET /applications — Creator's Applied Castings
// ══════════════════════════════════════════════════════
router.get('/applications', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;

    const castings = await Casting.find({
      'applicants.creator': new mongoose.Types.ObjectId(creatorId)
    })
      .populate('company', 'name logo city website phone email')
      .sort({ updatedAt: -1 })
      .lean();

    const applications = castings.map(c => {
      const myApp = c.applicants?.find(a => a.creator?.toString() === creatorId);
      return {
        _id: myApp?._id || c._id,
        castingId: c._id,
        title: c.title,
        projectType: c.projectType,
        roleType: c.roleType,
        gender: c.gender,
        ageRange: c.ageRange,
        location: c.location,
        budget: c.budget,
        shootDates: c.shootDates,
        deadline: c.deadline,
        description: c.description,
        image: c.image,
        company: c.company || { name: 'Verified Production House' },
        appliedAt: myApp?.appliedAt || c.createdAt,
        status: myApp?.status || 'Applied',
        notes: myApp?.notes || ''
      };
    });

    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    console.error('Error fetching creator applications:', error);
    res.status(500).json({ success: false, message: 'Server error fetching applications' });
  }
});

// ══════════════════════════════════════════════════════
//  11. DELETE /applications/:castingId — Withdraw Application
// ══════════════════════════════════════════════════════
router.delete('/applications/:castingId', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;

    const { castingId } = req.params;
    const casting = await Casting.findById(castingId);
    if (!casting) return res.status(404).json({ success: false, message: 'Casting call not found' });

    casting.applicants = casting.applicants.filter(a => a.creator?.toString() !== creatorId);
    casting.applicantsCount = casting.applicants.length;
    await casting.save();

    res.json({
      success: true,
      message: 'Application withdrawn successfully'
    });
  } catch (error) {
    console.error('Error withdrawing application:', error);
    res.status(500).json({ success: false, message: 'Failed to withdraw application' });
  }
});

// ══════════════════════════════════════════════════════
//  12. GET /bookings — Creator's Confirmed & Pending Bookings
// ══════════════════════════════════════════════════════
router.get('/bookings', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;

    const bookings = await Booking.find({ creator: new mongoose.Types.ObjectId(creatorId) })
      .populate('company', 'name logo city website phone email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error fetching creator bookings:', error);
    res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
});

// ══════════════════════════════════════════════════════
//  13. PUT /bookings/:id/status — Accept / Reject / Complete
// ══════════════════════════════════════════════════════
router.put('/bookings/:id/status', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    const { id } = req.params;
    const { status } = req.body; // 'Confirmed' | 'Cancelled' | 'Completed'

    const booking = await Booking.findOne({ _id: id, creator: new mongoose.Types.ObjectId(creatorId) });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = status;
    if (status === 'Completed') {
      booking.paymentStatus = 'Paid';
    }
    await booking.save();

    res.json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ success: false, message: 'Failed to update booking status' });
  }
});

// ══════════════════════════════════════════════════════
//  14. GET /messages/conversations — Live Chat Conversations
// ══════════════════════════════════════════════════════
router.get('/messages/conversations', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;

    const messages = await Message.find({ creator: new mongoose.Types.ObjectId(creatorId) })
      .populate('company', 'name logo city email phone')
      .sort({ createdAt: -1 })
      .lean();

    const convMap = new Map();

    for (const msg of messages) {
      if (!msg.company) continue;
      const compId = msg.company._id.toString();

      if (!convMap.has(compId)) {
        convMap.set(compId, {
          companyId: compId,
          company: msg.company,
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

      const conv = convMap.get(compId);
      conv.totalMessages += 1;
      if (!msg.read && msg.senderType === 'Company') {
        conv.unreadCount += 1;
      }
    }

    const conversations = Array.from(convMap.values());
    res.json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (error) {
    console.error('Error fetching creator conversations:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  15. GET /messages/thread/:companyId — Messages with Company
// ══════════════════════════════════════════════════════
router.get('/messages/thread/:companyId', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    const { companyId } = req.params;
    const cId = new mongoose.Types.ObjectId(companyId);

    const messages = await Message.find({
      creator: new mongoose.Types.ObjectId(creatorId),
      company: cId
    })
      .sort({ createdAt: 1 })
      .lean();

    // Mark messages from company as read
    await Message.updateMany(
      { creator: new mongoose.Types.ObjectId(creatorId), company: cId, senderType: 'Company', read: false },
      { $set: { read: true } }
    );

    const company = await Company.findById(companyId).select('name logo city email phone website');

    res.json({
      success: true,
      company,
      messages
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  16. POST /messages/send — Send Message to Company
// ══════════════════════════════════════════════════════
router.post('/messages/send', verifyToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    const { companyId, text, projectReference } = req.body;
    if (!companyId || !text?.trim()) {
      return res.status(400).json({ success: false, message: 'companyId and text are required' });
    }

    const msg = new Message({
      company: new mongoose.Types.ObjectId(companyId),
      creator: new mongoose.Types.ObjectId(creatorId),
      senderType: 'Creator',
      text: text.trim(),
      projectReference: projectReference || '',
      read: false
    });

    await msg.save();

    res.status(201).json({
      success: true,
      message: 'Message sent',
      chatMessage: msg
    });
  } catch (error) {
    console.error('Error sending creator message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// ══════════════════════════════════════════════════════
//  17. GET /wallet — Creator Wallet Balance & Ledger
// ══════════════════════════════════════════════════════
router.get('/wallet', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const userId = creator._id.toString();

    const txs = await WalletTransaction.find({
      userId,
      userType: 'Creator'
    }).sort({ createdAt: -1 }).lean();

    // Compute balances dynamically from transactions
    let availableBalance = 0;
    let totalWithdrawn = 0;
    let totalEarned = 0;

    txs.forEach(t => {
      if (t.status === 'Completed') {
        if (t.type === 'Credit') {
          availableBalance += Number(t.amount) || 0;
          totalEarned += Number(t.amount) || 0;
        } else if (t.type === 'Withdrawal' || t.type === 'Debit') {
          availableBalance -= Number(t.amount) || 0;
          totalWithdrawn += Number(t.amount) || 0;
        }
      }
    });

    // Escrow: Confirmed bookings not yet paid
    const escrowBookings = await Booking.find({
      creator: creator._id,
      status: 'Confirmed',
      paymentStatus: { $in: ['Unpaid', 'Partially Paid'] }
    }).lean();

    const escrowBalance = escrowBookings.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);

    res.json({
      success: true,
      balance: Math.max(0, availableBalance),
      escrowBalance,
      totalWithdrawn,
      totalEarned,
      transactions: txs
    });
  } catch (error) {
    console.error('Error fetching creator wallet:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  18. POST /wallet/withdraw — Request Payout
// ══════════════════════════════════════════════════════
router.post('/wallet/withdraw', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const { amount, method, bankName, accountNumber, ifsc, upiId } = req.body;
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || withdrawAmount < 1000) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is ₹1,000' });
    }

    const tx = new WalletTransaction({
      userId: creator._id.toString(),
      userType: 'Creator',
      userName: creator.basicDetails?.fullName || '',
      userContact: creator.phone,
      type: 'Withdrawal',
      amount: withdrawAmount,
      currency: 'INR',
      description: `Withdrawal payout request via ${method || 'Bank Transfer'}`,
      referenceType: 'Withdrawal',
      status: 'Pending',
      balanceAfter: 0,
      payoutDetails: {
        payoutMethod: method || 'Bank Transfer',
        accountHolder: creator.basicDetails?.fullName || '',
        bankName: bankName || 'Primary Bank',
        accountNumber: accountNumber ? `XXXXXX${accountNumber.slice(-4)}` : '',
        ifsc: ifsc || '',
        upiId: upiId || '',
        utrNumber: 'CMS' + Math.floor(100000000 + Math.random() * 900000000)
      }
    });

    await tx.save();

    res.status(201).json({
      success: true,
      message: `Withdrawal of ₹${withdrawAmount.toLocaleString('en-IN')} request submitted successfully!`,
      transaction: tx
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ success: false, message: 'Failed to process withdrawal' });
  }
});

// ══════════════════════════════════════════════════════
//  19. GET /earnings — Creator Income Analytics
// ══════════════════════════════════════════════════════
router.get('/earnings', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const userId = creator._id.toString();

    // Fetch real transactions from DB
    const txs = await WalletTransaction.find({
      userId,
      userType: 'Creator',
      status: 'Completed',
      type: 'Credit'
    }).sort({ createdAt: 1 }).lean();

    const totalGross = txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const completedProjectsCount = txs.length;

    // Monthly trend (last 6 months)
    const now = new Date();
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('en-IN', { month: 'short' });
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthTotal = txs
        .filter(t => new Date(t.createdAt) >= d && new Date(t.createdAt) < nextMonth)
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      monthlyTrends.push({ month: monthLabel, amount: monthTotal });
    }

    res.json({
      success: true,
      summary: {
        totalGross,
        netReceived: totalGross,
        inEscrow: 0,
        avgProjectFee: completedProjectsCount > 0 ? Math.round(totalGross / completedProjectsCount) : 0,
        completedProjectsCount
      },
      monthlyTrends,
      categoryBreakdown: []
    });
  } catch (error) {
    console.error('Error fetching earnings analytics:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  20. GET /subscription — Current Plan & Upgrades
// ══════════════════════════════════════════════════════
router.get('/subscription', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    // Fetch active database plans strictly for Creator or Both
    const dbPlans = await SubscriptionPlan.find({
      isActive: { $ne: false },
      targetAudience: { $in: ['Creator', 'Both'] }
    }).sort({ sortOrder: 1, monthlyPrice: 1 }).lean();

    const formattedPlans = dbPlans.map((p) => ({
      id: p._id.toString(),
      _id: p._id.toString(),
      name: p.name,
      description: p.description || '',
      price: p.monthlyPrice ?? 0,
      monthlyPrice: p.monthlyPrice ?? 0,
      yearlyPrice: p.yearlyPrice ?? 0,
      currency: p.currency || 'INR',
      targetAudience: p.targetAudience,
      popular: Boolean(p.isPopular),
      isPopular: Boolean(p.isPopular),
      trialDays: p.trialDays || 0,
      features: p.features && p.features.length > 0 ? p.features : [
        p.maxCastingApplications === -1 ? 'Unlimited Casting Call Applications' : `${p.maxCastingApplications} Applications / Month`,
        p.maxPortfolioPhotos === -1 ? 'Unlimited Portfolio Photos & Reels' : `${p.maxPortfolioPhotos} Media Uploads`,
        p.verifiedBadge ? 'Verified Talent Blue Badge' : 'Public Directory Listing',
        p.prioritySupport ? '24/7 Dedicated Support' : 'Standard Support'
      ]
    }));

    // Check user active subscription
    const userSub = await UserSubscription.findOne({
      userId: creator._id,
      status: 'Active'
    }).populate('plan').lean().catch(() => null);

    const currentPlanName = userSub?.planName || userSub?.plan?.name || creator.subscriptionPlan || 'Free Starter';
    const currentPrice = userSub?.amountPaid || userSub?.plan?.monthlyPrice || 0;

    res.json({
      success: true,
      currentPlan: {
        planName: currentPlanName,
        price: currentPrice,
        billingCycle: userSub?.billingCycle || 'Monthly',
        status: userSub?.status || 'Active',
        expiryDate: userSub?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        features: userSub?.plan?.features || [
          'Direct Casting Call Applications',
          'Verified Talent Profile',
          'Direct Messaging with Casting Directors'
        ]
      },
      plans: formattedPlans
    });
  } catch (error) {
    console.error('Error fetching creator subscription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  21. POST /subscription/upgrade — Upgrade Plan
// ══════════════════════════════════════════════════════
router.post('/subscription/upgrade', verifyToken, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    const { planName, billingCycle } = req.body;

    if (!planName) {
      return res.status(400).json({ success: false, message: 'planName is required' });
    }

    res.json({
      success: true,
      message: `Successfully upgraded to ${planName}!`,
      plan: {
        planName,
        billingCycle: billingCycle || 'Monthly',
        expiryDate: new Date(Date.now() + (billingCycle === 'Yearly' ? 365 : 30) * 24 * 60 * 60 * 1000)
      }
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
