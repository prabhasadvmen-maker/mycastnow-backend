import express from 'express';
import Casting from '../models/Casting.js';

const router = express.Router();

// GET all casting calls
router.get('/', async (req, res) => {
  try {
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
  }
});

// DELETE a casting call
router.delete('/:id', async (req, res) => {
  try {
    const deletedCasting = await Casting.findByIdAndDelete(req.params.id);
    if (!deletedCasting) return res.status(404).json({ message: 'Casting not found' });
    res.json({ message: 'Casting call deleted successfully' });
  } catch (error) {
    console.error('Error deleting casting:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
