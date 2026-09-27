import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import companyAuthRoutes from './routes/companyAuth.js';
import creatorAuthRoutes from './routes/creatorAuth.js';
import adminCreatorsRoutes from './routes/adminCreators.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/companyAuth', companyAuthRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/creatorAuth', creatorAuthRoutes);
app.use('/api/admin/creators', adminCreatorsRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/dashboard/stats', (req, res) => {
  // Mock data for dashboard
  res.json({
    totalNGOs: 1,
    totalUsers: 2,
    totalDonations: '6.0L',
    activeVolunteers: 8,
    monthlyTrends: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      donations: [2.5, 3.0, 4.2, 5.0, 4.8, 6.0],
      expenses: [1.2, 1.5, 2.0, 2.5, 2.2, 3.0]
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
