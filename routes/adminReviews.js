import express from 'express';
import Review from '../models/Review.js';

const router = express.Router();

// ══════════════════════════════════════════════════════
//  1. STATS: Comprehensive reviews overview
// ══════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [
      totalCount,
      companyToCreatorCount,
      creatorToCompanyCount,
      ratingAgg,
      c2cRatingAgg,
      cr2cRatingAgg,
      starDistribution
    ] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ reviewType: 'CompanyToCreator' }),
      Review.countDocuments({ reviewType: 'CreatorToCompany' }),
      // Overall Average
      Review.aggregate([
        { $group: { _id: null, avg: { $avg: '$rating' } } }
      ]),
      // Company to Creator Average
      Review.aggregate([
        { $match: { reviewType: 'CompanyToCreator' } },
        { $group: { _id: null, avg: { $avg: '$rating' } } }
      ]),
      // Creator to Company Average
      Review.aggregate([
        { $match: { reviewType: 'CreatorToCompany' } },
        { $group: { _id: null, avg: { $avg: '$rating' } } }
      ]),
      // 1 to 5 star counts
      Review.aggregate([
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ])
    ]);

    const stars = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    starDistribution.forEach(s => {
      if (s._id >= 1 && s._id <= 5) stars[s._id] = s.count;
    });

    res.json({
      success: true,
      stats: {
        totalReviews: totalCount,
        companyToCreatorCount,
        creatorToCompanyCount,
        averageRating: Number((ratingAgg[0]?.avg || 0).toFixed(1)),
        avgCompanyToCreator: Number((c2cRatingAgg[0]?.avg || 0).toFixed(1)),
        avgCreatorToCompany: Number((cr2cRatingAgg[0]?.avg || 0).toFixed(1)),
        stars
      }
    });
  } catch (err) {
    console.error('Review stats error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  2. GET /: Filter & fetch all reviews
// ══════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { type, rating, status, search, limit = 100 } = req.query;
    const filter = {};

    if (type && type !== 'All') {
      filter.reviewType = type;
    }
    if (rating && rating !== 'All') {
      filter.rating = Number(rating);
    }
    if (status && status !== 'All') {
      filter.status = status;
    }

    let reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      reviews = reviews.filter(r =>
        r.reviewerName?.toLowerCase().includes(q) ||
        r.targetName?.toLowerCase().includes(q) ||
        r.projectTitle?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.comment?.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  3. PUT /:id/status: Moderate status (Published, Flagged, Hidden)
// ══════════════════════════════════════════════════════
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Published', 'Pending', 'Flagged', 'Hidden'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updated = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    res.json({ success: true, message: 'Review status updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  4. DELETE /:id: Delete review
// ══════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

export default router;
