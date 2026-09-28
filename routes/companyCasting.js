import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Casting from '../models/Casting.js';
import Creator from '../models/Creator.js';

const router = express.Router();

// Helper to extract company ID from Authorization header
const getCompanyId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    return decoded?.id || null;
  } catch (err) {
    return null;
  }
};

// ══════════════════════════════════════════════════════
//  GET / — All Company Casting Notices + Performance Stats
// ══════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req) || '6ab8136cb407882f7d42a180';
    const cId = new mongoose.Types.ObjectId(companyId);

    const { status, search } = req.query;

    const query = {
      $or: [
        { company: cId },
        { company: null } // Include unassigned platform test castings
      ]
    };

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const castings = await Casting.find(query)
      .populate('applicants.creator', 'basicDetails professionalDetails phone email')
      .sort({ createdAt: -1 })
      .lean();

    // Compute Company Casting KPIs
    const allCompanyCastings = await Casting.find({
      $or: [{ company: cId }, { company: null }]
    }).lean();

    const totalCastings = allCompanyCastings.length;
    const openCastings = allCompanyCastings.filter(c => c.status === 'Open').length;
    
    let totalApplicants = 0;
    let shortlistedCount = 0;

    allCompanyCastings.forEach(c => {
      const appCount = c.applicants?.length || c.applicantsCount || 0;
      totalApplicants += appCount;
      if (c.applicants && c.applicants.length > 0) {
        shortlistedCount += c.applicants.filter(a => a.status === 'Shortlisted' || a.status === 'Selected').length;
      }
    });

    res.json({
      success: true,
      stats: {
        totalCastings,
        openCastings,
        totalApplicants,
        shortlistedCount
      },
      castings: castings.map(c => ({
        ...c,
        id: c._id,
        applicantsCount: c.applicants?.length || c.applicantsCount || 0
      }))
    });

  } catch (err) {
    console.error('Fetch company castings error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  POST / — Create New Casting Call Notice
// ══════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req) || '6ab8136cb407882f7d42a180';
    const cId = new mongoose.Types.ObjectId(companyId);

    const {
      title,
      projectType,
      roleType,
      gender,
      ageRange,
      location,
      shootDates,
      budget,
      deadline,
      description,
      requirements,
      image
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Project / Casting title is required' });
    }

    const newCasting = new Casting({
      company: cId,
      title: title.trim(),
      projectType: projectType || 'Brand Shoot',
      roleType: roleType || 'Actor',
      gender: gender || 'Any',
      ageRange: ageRange || '20-30 Years',
      location: location || 'Mumbai',
      shootDates: shootDates || '',
      budget: budget || '₹20,000 - ₹35,000 / day',
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      description: description || '',
      requirements: Array.isArray(requirements) ? requirements : (requirements ? requirements.split(',').map(s => s.trim()) : []),
      image: image || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80',
      status: 'Open',
      applicantsCount: 0,
      applicants: []
    });

    const saved = await newCasting.save();

    res.status(201).json({
      success: true,
      message: 'Casting call posted successfully!',
      casting: saved
    });

  } catch (err) {
    console.error('Create casting call error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  GET /:id — Casting Notice with Full Applicants Roster
// ══════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const casting = await Casting.findById(req.params.id)
      .populate({
        path: 'applicants.creator',
        select: 'basicDetails professionalDetails physicalDetails pricing portfolio phone email'
      })
      .lean();

    if (!casting) {
      return res.status(404).json({ success: false, message: 'Casting call not found' });
    }

    res.json({
      success: true,
      casting: {
        ...casting,
        id: casting._id,
        applicantsCount: casting.applicants?.length || casting.applicantsCount || 0
      }
    });

  } catch (err) {
    console.error('Fetch casting details error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  PUT /:id/applicant/status — Shortlist, Schedule or Hire Applicant
// ══════════════════════════════════════════════════════
router.put('/:id/applicant/status', async (req, res) => {
  try {
    const { creatorId, status, notes } = req.body;

    if (!creatorId || !status) {
      return res.status(400).json({ success: false, message: 'creatorId and status are required' });
    }

    const casting = await Casting.findById(req.params.id);
    if (!casting) {
      return res.status(404).json({ success: false, message: 'Casting call not found' });
    }

    const applicant = casting.applicants.find(a => a.creator.toString() === creatorId.toString());
    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found in this casting call' });
    }

    applicant.status = status;
    if (notes !== undefined) applicant.notes = notes;

    await casting.save();

    res.json({
      success: true,
      message: `Applicant status updated to ${status}`,
      applicant
    });

  } catch (err) {
    console.error('Update applicant status error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  PUT /:id/status — Toggle Status (Open, Closed, Archived)
// ══════════════════════════════════════════════════════
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Open', 'In Review', 'Closed', 'Archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updated = await Casting.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Casting call not found' });
    }

    res.json({
      success: true,
      message: `Casting call status updated to ${status}`,
      casting: updated
    });

  } catch (err) {
    console.error('Update casting status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════
//  DELETE /:id — Delete Casting Call
// ══════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Casting.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Casting call not found' });
    }

    res.json({
      success: true,
      message: 'Casting notice deleted successfully'
    });

  } catch (err) {
    console.error('Delete casting error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
