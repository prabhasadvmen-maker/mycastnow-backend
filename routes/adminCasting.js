import express from 'express';
import Casting from '../models/Casting.js';

const router = express.Router();

// GET all casting calls
router.get('/', async (req, res) => {
  try {
<<<<<<< HEAD
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
    const { title, description, roleType, location, budget, deadline, status, image } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const newCasting = new Casting({
      title,
      description: description || '',
      roleType: roleType || 'Actor',
      location: location || '',
      budget: budget || '',
      deadline: deadline ? new Date(deadline) : undefined,
      status: status || 'Open',
      image: image || ''
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
    const { title, description, roleType, location, budget, deadline, status, image } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (roleType !== undefined) updateData.roleType = roleType;
    if (location !== undefined) updateData.location = location;
    if (budget !== undefined) updateData.budget = budget;
    if (deadline !== undefined) updateData.deadline = new Date(deadline);
    if (status !== undefined) updateData.status = status;
    if (image !== undefined) updateData.image = image;

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
=======
    const castings = await Casting.find().sort({ createdAt: -1 });
    res.json(castings);
  } catch (error) {
    console.error('Error fetching castings:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST a new casting call
router.post('/', async (req, res) => {
  try {
    const newCasting = new Casting(req.body);
    await newCasting.save();
    res.status(201).json(newCasting);
  } catch (error) {
    console.error('Error creating casting:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT (update) a casting call
router.put('/:id', async (req, res) => {
  try {
    const updatedCasting = await Casting.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedCasting) return res.status(404).json({ message: 'Casting not found' });
    res.json(updatedCasting);
  } catch (error) {
    console.error('Error updating casting:', error);
    res.status(500).json({ message: 'Server Error' });
>>>>>>> 1f70375fafd78a0f3779c2f53dc8f6e6fc24f30c
  }
});

// DELETE a casting call
router.delete('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const casting = await Casting.findByIdAndDelete(req.params.id);
    if (!casting) {
      return res.status(404).json({ message: 'Casting call not found' });
    }
    res.json({ success: true, message: 'Casting call deleted successfully' });
  } catch (error) {
    console.error('Error deleting casting call:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
=======
    const deletedCasting = await Casting.findByIdAndDelete(req.params.id);
    if (!deletedCasting) return res.status(404).json({ message: 'Casting not found' });
    res.json({ message: 'Casting call deleted successfully' });
  } catch (error) {
    console.error('Error deleting casting:', error);
    res.status(500).json({ message: 'Server Error' });
>>>>>>> 1f70375fafd78a0f3779c2f53dc8f6e6fc24f30c
  }
});

export default router;
