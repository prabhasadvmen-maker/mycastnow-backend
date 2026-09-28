import express from 'express';
import Casting from '../models/Casting.js';

const router = express.Router();

// GET all casting calls
router.get('/', async (req, res) => {
  try {
    const { status, roleType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (roleType) filter.roleType = roleType;

    const castings = await Casting.find(filter).sort({ createdAt: -1 });
    res.json(castings);
  } catch (error) {
    console.error('Error fetching castings:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// GET single casting call by ID
router.get('/:id', async (req, res) => {
  try {
    const casting = await Casting.findById(req.params.id);
    if (!casting) {
      return res.status(404).json({ message: 'Casting call not found' });
    }
    res.json(casting);
  } catch (error) {
    console.error('Error fetching casting details:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// POST create a new casting call
router.post('/', async (req, res) => {
  try {
    const {
      title, description, roleType, projectType, location,
      budget, deadline, status, image, gender, ageRange, shootDates, requirements
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const newCasting = new Casting({
      title: title.trim(),
      description: description || '',
      roleType: roleType || 'Actor',
      projectType: projectType || 'Brand Shoot',
      gender: gender || 'Any',
      ageRange: ageRange || '20-30 Years',
      location: location || 'Mumbai',
      shootDates: shootDates || '',
      budget: budget || '₹20,000 - ₹35,000 / day',
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: status || 'Open',
      image: image || '',
      requirements: requirements || []
    });

    const savedCasting = await newCasting.save();
    res.status(201).json(savedCasting);
  } catch (error) {
    console.error('Error creating casting call:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// PUT update an existing casting call
router.put('/:id', async (req, res) => {
  try {
    const {
      title, description, roleType, projectType, location,
      budget, deadline, status, image, gender, ageRange, shootDates, requirements
    } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (roleType !== undefined) updateData.roleType = roleType;
    if (projectType !== undefined) updateData.projectType = projectType;
    if (gender !== undefined) updateData.gender = gender;
    if (ageRange !== undefined) updateData.ageRange = ageRange;
    if (shootDates !== undefined) updateData.shootDates = shootDates;
    if (location !== undefined) updateData.location = location;
    if (budget !== undefined) updateData.budget = budget;
    if (deadline !== undefined) updateData.deadline = new Date(deadline);
    if (status !== undefined) updateData.status = status;
    if (image !== undefined) updateData.image = image;
    if (requirements !== undefined) updateData.requirements = requirements;

    const updatedCasting = await Casting.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!updatedCasting) {
      return res.status(404).json({ message: 'Casting call not found' });
    }

    res.json(updatedCasting);
  } catch (error) {
    console.error('Error updating casting call:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// DELETE a casting call
router.delete('/:id', async (req, res) => {
  try {
    const casting = await Casting.findByIdAndDelete(req.params.id);
    if (!casting) {
      return res.status(404).json({ message: 'Casting call not found' });
    }
    res.json({ success: true, message: 'Casting call deleted successfully' });
  } catch (error) {
    console.error('Error deleting casting call:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

export default router;
