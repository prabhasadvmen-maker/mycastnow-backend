import express from 'express';
import Booking from '../models/Booking.js';
import Company from '../models/Company.js';
import Creator from '../models/Creator.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET all bookings (with full company + creator info)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, paymentStatus, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    let bookings = await Booking.find(filter)
      .populate('company', 'name email logo location industry')
      .populate('creator', 'basicDetails.fullName basicDetails.profilePhoto professionalDetails.primaryCategory phone')
      .populate('castingCall', 'title roleType')
      .sort({ createdAt: -1 });

    // Search filter (after populate)
    if (search) {
      const q = search.toLowerCase();
      bookings = bookings.filter(b => {
        const companyName = b.company?.name?.toLowerCase() || '';
        const creatorName = b.creator?.basicDetails?.fullName?.toLowerCase() || '';
        const projectTitle = b.projectTitle?.toLowerCase() || '';
        return companyName.includes(q) || creatorName.includes(q) || projectTitle.includes(q);
      });
    }

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET summary stats for dashboard
// ─────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, pending, confirmed, completed, cancelled, revenue] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'Pending' }),
      Booking.countDocuments({ status: 'Confirmed' }),
      Booking.countDocuments({ status: 'Completed' }),
      Booking.countDocuments({ status: 'Cancelled' }),
      Booking.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    res.json({
      total,
      pending,
      confirmed,
      completed,
      cancelled,
      totalRevenue: revenue[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET single booking by ID
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('company', 'name email logo location industry website')
      .populate('creator', 'basicDetails professionalDetails physicalDetails phone pricing')
      .populate('castingCall', 'title roleType location budget deadline');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST create a new booking
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      company, creator, castingCall,
      projectTitle, projectType, description,
      eventDate, eventEndDate, location, duration,
      amount, currency, paymentStatus,
      status, notes
    } = req.body;

    if (!company || !creator || !projectTitle || !eventDate) {
      return res.status(400).json({
        message: 'company, creator, projectTitle, and eventDate are required'
      });
    }

    // Verify company and creator exist
    const [companyExists, creatorExists] = await Promise.all([
      Company.findById(company),
      Creator.findById(creator)
    ]);

    if (!companyExists) return res.status(404).json({ message: 'Company not found' });
    if (!creatorExists) return res.status(404).json({ message: 'Creator not found' });

    const booking = new Booking({
      company, creator,
      castingCall: castingCall || null,
      projectTitle, projectType: projectType || 'Other',
      description: description || '',
      eventDate: new Date(eventDate),
      eventEndDate: eventEndDate ? new Date(eventEndDate) : null,
      location: location || '',
      duration: duration || '',
      amount: amount || 0,
      currency: currency || 'INR',
      paymentStatus: paymentStatus || 'Unpaid',
      status: status || 'Pending',
      notes: notes || ''
    });

    const saved = await booking.save();
    const populated = await Booking.findById(saved._id)
      .populate('company', 'name email logo location industry')
      .populate('creator', 'basicDetails.fullName basicDetails.profilePhoto professionalDetails.primaryCategory phone');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// PUT update booking status only
// ─────────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  try {
    const { status, cancelReason, paymentStatus } = req.body;
    const allowed = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const update = {};
    if (status) update.status = status;
    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (cancelReason) update.cancelReason = cancelReason;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { returnDocument: 'after' }
    )
      .populate('company', 'name email logo location industry')
      .populate('creator', 'basicDetails.fullName basicDetails.profilePhoto professionalDetails.primaryCategory phone');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// PUT update full booking
// ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const {
      projectTitle, projectType, description,
      eventDate, eventEndDate, location, duration,
      amount, paymentStatus, status, notes, cancelReason
    } = req.body;

    const update = {};
    if (projectTitle) update.projectTitle = projectTitle;
    if (projectType) update.projectType = projectType;
    if (description !== undefined) update.description = description;
    if (eventDate) update.eventDate = new Date(eventDate);
    if (eventEndDate) update.eventEndDate = new Date(eventEndDate);
    if (location !== undefined) update.location = location;
    if (duration !== undefined) update.duration = duration;
    if (amount !== undefined) update.amount = amount;
    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (cancelReason !== undefined) update.cancelReason = cancelReason;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { returnDocument: 'after' }
    )
      .populate('company', 'name email logo location industry')
      .populate('creator', 'basicDetails.fullName basicDetails.profilePhoto professionalDetails.primaryCategory phone');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// DELETE booking
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

export default router;
