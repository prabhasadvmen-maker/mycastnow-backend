import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'superadmin@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const adminExists = await Admin.findOne({ email: adminEmail });
    
    if (adminExists) {
      console.log(`Admin ${adminEmail} already exists`);
      process.exit(0);
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    await Admin.create({
      email: adminEmail,
      password: hashedPassword,
      role: 'Super Admin'
    });
    
    console.log(`Admin created successfully: ${adminEmail} / ${adminPassword}`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();
