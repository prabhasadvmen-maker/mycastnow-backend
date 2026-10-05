import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Creator from '../models/Creator.js';
import { verifyToken } from '../middleware/auth.js';
import ProfileBoost from '../models/ProfileBoost.js';
import TalentCart from '../models/TalentCart.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Message from '../models/Message.js';

const router = express.Router();

// Optional auth helper — does NOT block the request if token is missing/invalid
const getOptionalUserId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.id || null;
  } catch {
    return null;
  }
};

router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      gender,
      city,
      experience,
      minPrice,
      maxPrice,
      isVerified,
      isBoosted,
      sort = 'boosted',
      page = 1,
      limit = 8
    } = req.query;

    const companyId = getOptionalUserId(req);

    // Build Mongo Query
    const query = {
      status: 'approved',
      isActive: { $ne: false }
    };

    // Category Filter
    if (category && category !== 'All') {
      query['professionalDetails.primaryCategory'] = new RegExp(`^${category}$`, 'i');
    }

    // Gender Filter
    if (gender && gender !== 'All') {
      query['basicDetails.gender'] = new RegExp(`^${gender}$`, 'i');
    }

    // City Filter
    if (city && city !== 'All') {
      query['basicDetails.city'] = new RegExp(`^${city}$`, 'i');
    }

    // Experience Filter
    if (experience && experience !== 'All') {
      query['professionalDetails.experience'] = new RegExp(experience, 'i');
    }

    // Verification
    if (isVerified === 'true') {
      query['verification.status'] = 'Verified';
    }

    // Pricing Filter (dayRate)
    if (minPrice || maxPrice) {
      query['pricing.dayRate'] = {};
      if (minPrice) query['pricing.dayRate'].$gte = Number(minPrice);
      if (maxPrice) query['pricing.dayRate'].$lte = Number(maxPrice);
    }

    // Free Text Search
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { 'basicDetails.fullName': { $regex: s, $options: 'i' } },
        { 'basicDetails.bio': { $regex: s, $options: 'i' } },
        { 'basicDetails.city': { $regex: s, $options: 'i' } },
        { 'professionalDetails.primaryCategory': { $regex: s, $options: 'i' } },
        { 'professionalDetails.subCategory': { $regex: s, $options: 'i' } },
        { 'professionalDetails.skills': { $regex: s, $options: 'i' } },
        { 'basicDetails.languages': { $regex: s, $options: 'i' } }
      ];
    }

    // Fetch matching creators
    let creators = await Creator.find(query).lean();

    // Fetch active profile boosts
    const now = new Date();
    const activeBoosts = await ProfileBoost.find({
      status: 'Active',
      endDate: { $gte: now }
    }).lean();

    const boostMap = new Map();
    activeBoosts.forEach(b => {
      boostMap.set(b.creator?.toString(), b);
    });

    // Fetch company's cart items if logged in
    let cartCreatorIds = new Set();
    if (companyId) {
      const cartItems = await TalentCart.find({ company: companyId }).select('creator').lean();
      cartItems.forEach(item => cartCreatorIds.add(item.creator.toString()));
    }

    // Format & Enrich Talents
    let talents = creators.map(c => {
      const boost = boostMap.get(c._id.toString());
      const hasBoost = Boolean(boost);
      const isCarted = cartCreatorIds.has(c._id.toString());

      const fullName = c.basicDetails?.fullName || c.name || 'Professional Talent';
      const profilePhoto = c.basicDetails?.profilePhoto || c.portfolio?.photos?.[0] || '';
      const dayRate = c.pricing?.dayRate || (c.pricing?.hourlyRate ? c.pricing.hourlyRate * 8 : 10000);
      const hourlyRate = c.pricing?.hourlyRate || Math.round(dayRate / 8);

      return {
        id: c._id,
        _id: c._id,
        fullName,
        profilePhoto,
        city: c.basicDetails?.city || 'India',
        gender: c.basicDetails?.gender || 'Not specified',
        bio: c.basicDetails?.bio || 'Passionate creative professional open for brand shoots, campaigns, and film projects.',
        languages: c.basicDetails?.languages || ['Hindi', 'English'],
        category: c.professionalDetails?.primaryCategory || 'Model',
        subCategory: c.professionalDetails?.subCategory || 'Commercial',
        skills: c.professionalDetails?.skills || ['Modeling', 'Acting'],
        experience: c.professionalDetails?.experience || '1-3 Years',
        previousBrands: c.professionalDetails?.previousBrands || [],
        photos: c.portfolio?.photos || [],
        videos: c.portfolio?.videos || [],
        photoCount: c.portfolio?.photos?.length || 0,
        videoCount: c.portfolio?.videos?.length || 0,
        pricing: {
          dayRate,
          hourlyRate,
          projectRate: c.pricing?.projectRate || dayRate * 3
        },
        physicalDetails: {
          height: c.physicalDetails?.height || "5'9\"",
          weight: c.physicalDetails?.weight || "68 kg",
          chest: c.physicalDetails?.chest || '38"',
          waist: c.physicalDetails?.waist || '32"',
          hips: c.physicalDetails?.hips || '36"',
          eyeColor: c.physicalDetails?.eyeColor || 'Brown',
          hairColor: c.physicalDetails?.hairColor || 'Black',
          complexion: c.physicalDetails?.complexion || 'Fair'
        },
        availability: c.availability?.status || 'Available',
        isVerified: c.verification?.status === 'Verified' || c.isApproved,
        rating: c.stats?.rating || 4.8,
        reviewsCount: c.stats?.reviewsCount || 12,
        totalBookings: c.stats?.totalBookings || 8,
        isBoosted: hasBoost,
        boostBadge: hasBoost ? (boost.planName || 'Spotlight VIP') : null,
        isInCart: isCarted
      };
    });

    // Boost filter
    if (isBoosted === 'true') {
      talents = talents.filter(t => t.isBoosted);
    }

    // Sorting Logic
    if (sort === 'boosted') {
      talents.sort((a, b) => {
        if (a.isBoosted && !b.isBoosted) return -1;
        if (!a.isBoosted && b.isBoosted) return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
    } else if (sort === 'rating') {
      talents.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'price_low') {
      talents.sort((a, b) => a.pricing.dayRate - b.pricing.dayRate);
    } else if (sort === 'price_high') {
      talents.sort((a, b) => b.pricing.dayRate - a.pricing.dayRate);
    } else if (sort === 'experience') {
      talents.sort((a, b) => b.totalBookings - a.totalBookings);
    }

    // Total Count before pagination
    const totalMatching = talents.length;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 8);
    const totalPages = Math.max(1, Math.ceil(totalMatching / limitNum));

    // Slice for pagination
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedTalents = talents.slice(startIndex, startIndex + limitNum);

    // Dynamic Metadata for Filters
    const allApprovedCreators = await Creator.find({ status: 'approved' }).lean();
    const categoriesSet = new Set();
    const subCategoriesSet = new Set();
    const citiesSet = new Set();

    allApprovedCreators.forEach(c => {
      if (c.professionalDetails?.primaryCategory) categoriesSet.add(c.professionalDetails.primaryCategory);
      if (c.professionalDetails?.subCategory) subCategoriesSet.add(c.professionalDetails.subCategory);
      if (c.basicDetails?.city) citiesSet.add(c.basicDetails.city);
    });

    // Increment impressions for boosted creators seen on current page
    if (activeBoosts.length > 0) {
      const displayedBoostIds = activeBoosts
        .filter(b => paginatedTalents.some(t => t.id.toString() === b.creator.toString()))
        .map(b => b._id);

      if (displayedBoostIds.length > 0) {
        ProfileBoost.updateMany(
          { _id: { $in: displayedBoostIds } },
          { $inc: { impressions: 1 } }
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      total: totalMatching,
      page: pageNum,
      limit: limitNum,
      totalPages,
      talents: paginatedTalents,
      cartCount: cartCreatorIds.size,
      metadata: {
        categories: Array.from(categoriesSet),
        subCategories: Array.from(subCategoriesSet),
        cities: Array.from(citiesSet),
        experienceLevels: ['Fresher', '1-3 Years', '3-5 Years', '5+ Years']
      }
    });

  } catch (err) {
    console.error('Find Talent Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});


// ══════════════════════════════════════════════════════
//  POST /cart/toggle — Add/Remove from Talent Cart
// ══════════════════════════════════════════════════════
router.post('/cart/toggle', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { creatorId, roleInterest, notes } = req.body;

    if (!creatorId) {
      return res.status(400).json({ success: false, message: 'creatorId is required' });
    }

    const cId = new mongoose.Types.ObjectId(companyId);
    const crId = new mongoose.Types.ObjectId(creatorId);

    const existing = await TalentCart.findOne({ company: cId, creator: crId });

    let isInCart = false;
    if (existing) {
      await TalentCart.findByIdAndDelete(existing._id);
      isInCart = false;
    } else {
      await TalentCart.create({
        company: cId,
        creator: crId,
        roleInterest: roleInterest || 'Lead Role / Shoot',
        notes: notes || ''
      });
      isInCart = true;
    }

    const count = await TalentCart.countDocuments({ company: cId });

    res.json({
      success: true,
      isInCart,
      cartCount: count,
      message: isInCart ? 'Talent added to Cart' : 'Talent removed from Cart'
    });
  } catch (err) {
    console.error('Toggle cart error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  GET /cart/list — Get Company Cart Items
// ══════════════════════════════════════════════════════
router.get('/cart/list', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const cId = new mongoose.Types.ObjectId(companyId);

    const items = await TalentCart.find({ company: cId })
      .populate('creator')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (err) {
    console.error('Fetch cart list error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  POST /book — Direct Booking / Casting Call Invitation (FIXED)
// ══════════════════════════════════════════════════════
router.post('/book', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const { creatorId, projectTitle, projectType, eventDate, location, amount, description } = req.body;

    if (!creatorId || !projectTitle || !eventDate) {
      return res.status(400).json({ success: false, message: 'creatorId, projectTitle, and eventDate are required' });
    }

    const cId = new mongoose.Types.ObjectId(companyId);
    const crId = new mongoose.Types.ObjectId(creatorId);

    const booking = new Booking({
      company: cId,
      creator: crId,
      projectTitle: projectTitle.trim(),
      projectType: projectType || 'Brand Shoot',
      eventDate: new Date(eventDate),
      location: location || 'Mumbai Studio',
      amount: Number(amount) || 15000,
      description: description || 'Direct casting booking request from Production House.',
      status: 'Pending',
      paymentStatus: 'Unpaid' // Valid enum: ['Unpaid', 'Partially Paid', 'Paid', 'Refunded']
    });

    await booking.save();

    // Automatically connect company with creator inbox upon hiring
    try {
      await Message.create({
        company: cId,
        creator: crId,
        senderType: 'Company',
        text: `Hello! We have submitted a booking offer for "${projectTitle}" (${projectType || 'Commercial Shoot'}) on ${new Date(eventDate).toLocaleDateString('en-GB')}. Agreed Budget: ₹${amount || 15000}. Looking forward to coordinating here!`,
        projectReference: projectTitle
      });
    } catch (msgErr) {
      console.warn('Booking message notice:', msgErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Direct booking invitation sent to Creator successfully!',
      booking
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ success: false, message: 'Server error creating booking', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  GET /bookings — All Bookings / Hires of this Company
// ══════════════════════════════════════════════════════
router.get('/bookings', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const cId = new mongoose.Types.ObjectId(companyId);

    const bookings = await Booking.find({ company: cId })
      .populate('creator', 'basicDetails professionalDetails phone email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(b => ({
        ...b,
        id: b._id
      }))
    });
  } catch (err) {
    console.error('Fetch company bookings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  POST /cart/clear — Clear All Items from Cart
// ══════════════════════════════════════════════════════
router.post('/cart/clear', verifyToken, async (req, res) => {
  try {
    const companyId = req.user.id;
    const cId = new mongoose.Types.ObjectId(companyId);

    await TalentCart.deleteMany({ company: cId });

    res.json({
      success: true,
      message: 'Talent cart cleared successfully'
    });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  PUT /bookings/:id/status — Update Booking Status
// ══════════════════════════════════════════════════════
router.put('/bookings/:id/status', async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateData = { status };
    if (cancelReason) updateData.cancelReason = cancelReason;

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: 'after' }
    ).populate('creator', 'basicDetails professionalDetails phone email');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({
      success: true,
      message: `Booking marked as ${status}`,
      booking: updated
    });
  } catch (err) {
    console.error('Update booking status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  PUT /bookings/:id/payment — Update Payment Status
// ══════════════════════════════════════════════════════
router.put('/bookings/:id/payment', async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!['Unpaid', 'Partially Paid', 'Paid', 'Refunded'].includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { paymentStatus } },
      { returnDocument: 'after' }
    ).populate('creator', 'basicDetails professionalDetails phone email');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      booking: updated
    });
  } catch (err) {
    console.error('Update payment status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  DELETE /bookings/:id — Delete Booking Record
// ══════════════════════════════════════════════════════
router.delete('/bookings/:id', async (req, res) => {
  try {
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  GET /:id — Single Talent Detailed Portfolio & Reviews
// ══════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid talent ID' });
    }

    const creator = await Creator.findById(req.params.id).lean();
    if (!creator) {
      return res.status(404).json({ success: false, message: 'Talent not found' });
    }

    const companyId = getOptionalUserId(req);

    // Check Boost
    const activeBoost = await ProfileBoost.findOne({
      creator: creator._id,
      status: 'Active',
      endDate: { $gte: new Date() }
    }).lean();

    // Increment click count if boosted
    if (activeBoost) {
      ProfileBoost.findByIdAndUpdate(activeBoost._id, { $inc: { clicks: 1 } }).catch(() => {});
    }

    // Check cart
    let isInCart = false;
    if (companyId) {
      const cartItem = await TalentCart.findOne({ company: companyId, creator: creator._id });
      isInCart = Boolean(cartItem);
    }

    // Get Reviews for this Creator
    const reviews = await Review.find({
      targetId: creator._id.toString(),
      reviewType: 'CompanyToCreator'
    }).sort({ createdAt: -1 }).limit(10).lean();

    const dayRate = creator.pricing?.dayRate || 10000;

    res.json({
      success: true,
      talent: {
        ...creator,
        fullName: creator.basicDetails?.fullName || creator.name || 'Talent Profile',
        profilePhoto: creator.basicDetails?.profilePhoto || creator.portfolio?.photos?.[0] || '',
        isBoosted: Boolean(activeBoost),
        boostBadge: activeBoost?.planName || null,
        isInCart,
        reviews,
        pricing: {
          dayRate,
          hourlyRate: creator.pricing?.hourlyRate || Math.round(dayRate / 8),
          projectRate: creator.pricing?.projectRate || dayRate * 3
        }
      }
    });
  } catch (err) {
    console.error('Talent details error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
