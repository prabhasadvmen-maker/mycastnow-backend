import express from 'express';
import Review from '../models/Review.js';

const router = express.Router();

// ══════════════════════════════════════════════════════
//  1. POST /: Submit a review (Company -> Creator OR Creator -> Company)
// ══════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const {
      reviewType, // 'CompanyToCreator' | 'CreatorToCompany'
      reviewerType,
      reviewerId,
      reviewerName,
      reviewerEmail,
      reviewerPhoto,
      targetType,
      targetId,
      targetName,
      targetPhoto,
      projectTitle,
      bookingId,
      rating,
      criteria,
      title,
      comment
    } = req.body;

    if (!reviewType || !reviewerId || !targetId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'reviewType, reviewerId, targetId, rating, and comment are required.'
      });
    }

    const newReview = new Review({
      reviewType,
      reviewerType: reviewerType || (reviewType === 'CompanyToCreator' ? 'Company' : 'Creator'),
      reviewerId,
      reviewerName: reviewerName || 'Verified User',
      reviewerEmail: reviewerEmail || '',
      reviewerPhoto: reviewerPhoto || '',
      targetType: targetType || (reviewType === 'CompanyToCreator' ? 'Creator' : 'Company'),
      targetId,
      targetName: targetName || 'Target User',
      targetPhoto: targetPhoto || '',
      projectTitle: projectTitle || 'Casting Shoot',
      bookingId: bookingId || null,
      rating: Number(rating),
      criteria: criteria || { professionalism: 5, communication: 5, punctuality: 5, workQuality: 5 },
      title: title || '',
      comment,
      status: 'Published'
    });

    const saved = await newReview.save();
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      data: saved
    });
  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  2. GET /target/:targetId: Get public reviews of a Creator/Company
// ══════════════════════════════════════════════════════
router.get('/target/:targetId', async (req, res) => {
  try {
    const reviews = await Review.find({
      targetId: req.params.targetId,
      status: 'Published'
    }).sort({ createdAt: -1 });

    const avg = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1))
      : 0;

    res.json({
      success: true,
      count: reviews.length,
      averageRating: avg,
      data: reviews
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

export default router;
