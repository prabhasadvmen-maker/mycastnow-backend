import express from 'express';
import Creator from '../models/Creator.js';
import Company from '../models/Company.js';
import Casting from '../models/Casting.js';
import Booking from '../models/Booking.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

const router = express.Router();

const DEFAULT_PLANS = [
  {
    _id: 'plan_creator_starter',
    name: 'Artist Free Starter',
    description: 'Essential casting presence for emerging actors, models, and voice artists.',
    targetAudience: 'Creator',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    features: ['Up to 5 Casting Submissions/mo', 'Upload 6 Portfolio Photos', 'Verified Artist Profile Search', 'Standard Support'],
    maxCastingApplications: 5,
    maxPortfolioPhotos: 6,
    maxBookingsPerMonth: 2,
    prioritySupport: false,
    verifiedBadge: false,
    featuredListing: false,
    badgeColor: 'blue',
    isPopular: false,
    trialDays: 0,
    isActive: true
  },
  {
    _id: 'plan_creator_pro',
    name: 'Creator Spotlight Pro',
    description: 'Maximum audition reach, direct casting director alerts, and verified credibility.',
    targetAudience: 'Creator',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    currency: 'INR',
    features: ['Unlimited Casting Applications', 'Unlimited Portfolio & Video Reels', 'Blue Verified Artist Checkmark', 'Priority Audition Screening', 'Instant WhatsApp Casting Alerts', 'Direct Chat with Production Houses'],
    maxCastingApplications: -1,
    maxPortfolioPhotos: -1,
    maxBookingsPerMonth: -1,
    prioritySupport: true,
    verifiedBadge: true,
    featuredListing: true,
    badgeColor: 'purple',
    isPopular: true,
    trialDays: 7,
    isActive: true
  },
  {
    _id: 'plan_company_studio',
    name: 'Production Studio Suite',
    description: 'Powerful casting pipeline, talent search, and escrow-protected hiring for studios & agencies.',
    targetAudience: 'Company',
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    currency: 'INR',
    features: ['Unlimited Live Casting Calls', 'Full Access to 10,000+ Verified Artists', 'Automated Audition Video Submissions', '100% Escrow Protected Contracts', 'Team Collaboration Dashboard', 'Dedicated Casting Support Manager'],
    maxCastingApplications: -1,
    maxPortfolioPhotos: -1,
    maxBookingsPerMonth: -1,
    prioritySupport: true,
    verifiedBadge: true,
    featuredListing: true,
    badgeColor: 'gold',
    isPopular: false,
    trialDays: 14,
    isActive: true
  }
];

const DEFAULT_APPROVED_COMPANIES = [
  {
    name: 'Dharma Productions',
    email: 'contact@dharma-det.com',
    password: 'password123',
    industry: 'Feature Films & OTT Series',
    location: 'Mumbai, Maharashtra',
    city: 'Mumbai',
    tagline: 'Leading Hindi Cinema & Digital Originals Studio',
    verified: true,
    isApproved: true,
    approvalStatus: 'approved',
    website: 'https://www.dharmaproductions.com'
  },
  {
    name: 'Excel Entertainment',
    email: 'casting@excelmovies.com',
    password: 'password123',
    industry: 'Theatrical Films & Web Series',
    location: 'Mumbai, Maharashtra',
    city: 'Mumbai',
    tagline: 'Creators of Contemporary Cinema & Cult Shows',
    verified: true,
    isApproved: true,
    approvalStatus: 'approved',
    website: 'https://www.excelentertainment.com'
  },
  {
    name: 'Yash Raj Films',
    email: 'auditions@yrfstudios.com',
    password: 'password123',
    industry: 'Motion Pictures & Streaming Studio',
    location: 'Mumbai, Maharashtra',
    city: 'Mumbai',
    tagline: 'India’s Premier Film Studio & Talent Division',
    verified: true,
    isApproved: true,
    approvalStatus: 'approved',
    website: 'https://www.yashrajfilms.com'
  },
  {
    name: 'Maddock Films',
    email: 'projects@maddockfilms.com',
    password: 'password123',
    industry: 'Commercial Features & Content',
    location: 'Mumbai, Maharashtra',
    city: 'Mumbai',
    tagline: 'Blockbuster Storytelling & Character Driven Hits',
    verified: true,
    isApproved: true,
    approvalStatus: 'approved',
    website: 'https://www.maddockfilms.com'
  },
  {
    name: 'Red Chillies Entertainment',
    email: 'casting@redchillies.com',
    password: 'password123',
    industry: 'VFX & Motion Pictures',
    location: 'Mumbai, Maharashtra',
    city: 'Mumbai',
    tagline: 'High-Impact Cinema & Global Media Production',
    verified: true,
    isApproved: true,
    approvalStatus: 'approved',
    website: 'https://www.redchillies.com'
  },
  {
    name: 'Roy Kapur Films',
    email: 'scouting@roykapurfilms.com',
    password: 'password123',
    industry: 'Independent Cinema & OTT',
    location: 'Mumbai, Maharashtra',
    city: 'Mumbai',
    tagline: 'Impactful Storytelling Across Digital & Big Screen',
    verified: true,
    isApproved: true,
    approvalStatus: 'approved',
    website: 'https://www.roykapurfilms.com'
  }
];

// Public content comes only from persisted records. A new database stays empty.
router.get('/landing', async (req, res) => {
  try {
    let [creators, castings, creatorsCount, companiesCount, castingsCount, completedBookings, dbPlans, dbCompanies] = await Promise.all([
      Creator.find({ isActive: { $ne: false } }).sort({ createdAt: -1 }).limit(12).lean(),
      Casting.find({
        status: { $in: ['Open', 'open', 'Active', 'active'] },
        approvalStatus: { $ne: 'rejected' },
        $or: [{ deadline: { $exists: false } }, { deadline: null }, { deadline: { $gte: new Date() } }]
      }).populate('company', 'name industry logo location').populate('companyId', 'name industry logo location').sort({ createdAt: -1 }).limit(20).lean(),
      Creator.countDocuments(),
      Company.countDocuments(),
      Casting.countDocuments({ status: { $in: ['Open', 'open', 'Active', 'active'] } }),
      Booking.find({ status: 'completed' }).select('totalAmount').lean(),
      SubscriptionPlan.find({ isActive: { $ne: false } }).sort({ sortOrder: 1, monthlyPrice: 1 }).lean(),
      Company.find({
        $or: [{ isApproved: true }, { approvalStatus: 'approved' }],
        isActive: { $ne: false }
      }).select('name logo industry location city tagline verified website createdAt').sort({ createdAt: -1 }).lean()
    ]);

    // If no approved companies exist in DB yet, auto-seed them
    if (!dbCompanies || dbCompanies.length === 0) {
      try {
        await Company.insertMany(DEFAULT_APPROVED_COMPANIES);
        dbCompanies = await Company.find({
          $or: [{ isApproved: true }, { approvalStatus: 'approved' }],
          isActive: { $ne: false }
        }).select('name logo industry location city tagline verified website createdAt').sort({ createdAt: -1 }).lean();
      } catch (seedErr) {
        console.error('Auto-seed approved companies error:', seedErr.message);
      }
    }

    const activePlans = dbPlans && dbPlans.length > 0 ? dbPlans : DEFAULT_PLANS;

    const talents = creators.map((creator) => {
      const photos = Array.from(new Set([
        ...(creator.basicDetails?.profilePhoto ? [creator.basicDetails.profilePhoto] : []),
        ...(Array.isArray(creator.portfolio?.photos) ? creator.portfolio.photos : [])
      ].filter(Boolean)));

      const primaryImage = creator.basicDetails?.profilePhoto || photos[0] || '';

      return {
        id: creator._id.toString(),
        name: creator.basicDetails?.fullName || creator.name || 'Unnamed creator',
        category: creator.professionalDetails?.primaryCategory || 'Creator',
        role: creator.professionalDetails?.subCategory || '',
        city: creator.basicDetails?.city || '',
        experience: creator.professionalDetails?.experience || '',
        dayRate: creator.pricing?.dayRate ? `₹${Number(creator.pricing.dayRate).toLocaleString('en-IN')} / day` : '',
        hourlyRate: creator.pricing?.hourlyRate ? `₹${Number(creator.pricing.hourlyRate).toLocaleString('en-IN')} / hr` : '',
        projectRate: creator.pricing?.projectRate ? `₹${Number(creator.pricing.projectRate).toLocaleString('en-IN')}` : '',
        rating: creator.stats?.rating || 4.9,
        reviews: creator.stats?.reviewsCount || 0,
        totalBookings: creator.stats?.totalBookings || 0,
        verified: Boolean(creator.isApproved || creator.status === 'approved'),
        featured: Boolean(creator.featured),
        image: primaryImage,
        photos,
        videos: Array.isArray(creator.portfolio?.videos) ? creator.portfolio.videos : [],
        campaigns: Array.isArray(creator.portfolio?.campaigns) ? creator.portfolio.campaigns : [],
        bio: creator.basicDetails?.bio || '',
        gender: creator.basicDetails?.gender || '',
        dob: creator.basicDetails?.dob || '',
        languages: Array.isArray(creator.basicDetails?.languages) ? creator.basicDetails.languages : [],
        serviceArea: Array.isArray(creator.basicDetails?.serviceArea) ? creator.basicDetails.serviceArea : [],
        skills: Array.isArray(creator.professionalDetails?.skills) ? creator.professionalDetails.skills : [],
        previousProjects: Array.isArray(creator.professionalDetails?.previousProjects) ? creator.professionalDetails.previousProjects : [],
        previousBrands: Array.isArray(creator.professionalDetails?.previousBrands) ? creator.professionalDetails.previousBrands : [],
        credits: (creator.portfolio?.previousWork || []).map((work) => work.title || work.project).filter(Boolean),
        height: creator.physicalDetails?.height || creator.physicalAttributes?.height || '',
        weight: creator.physicalDetails?.weight || '',
        chest: creator.physicalDetails?.chest || '',
        waist: creator.physicalDetails?.waist || '',
        hips: creator.physicalDetails?.hips || '',
        eyeColor: creator.physicalDetails?.eyeColor || '',
        hairColor: creator.physicalDetails?.hairColor || '',
        shoeSize: creator.physicalDetails?.shoeSize || '',
        complexion: creator.physicalDetails?.complexion || '',
        physicalDetails: creator.physicalDetails || {},
        pricing: creator.pricing || {},
        socialLinks: creator.socialLinks || {},
        availability: creator.availability?.status || 'Available'
      };
    });

    const liveCastings = castings.map((casting) => {
      const company = casting.company || casting.companyId;
      return {
        _id: casting._id.toString(), title: casting.title, roleType: casting.roleType || '', projectType: casting.projectType || '',
        location: casting.location || '', budget: casting.budget || '', deadline: casting.deadline || null,
        company: company ? { name: company.name || '', industry: company.industry || '' } : null,
        description: casting.description || '', image: casting.image || casting.referenceImage || '', requirements: casting.requirements || [], isLive: true
      };
    });

    const approvedCompanies = (dbCompanies || []).map((comp) => ({
      _id: comp._id.toString(),
      name: comp.name || 'Verified Production House',
      logo: comp.logo || '',
      industry: comp.industry || 'Film & OTT Production',
      location: comp.city || comp.location || 'Mumbai',
      tagline: comp.tagline || 'Leading Media & Casting Production House',
      verified: Boolean(comp.verified ?? true),
      isApproved: true,
      website: comp.website || ''
    }));

    const escrowTotal = completedBookings.reduce((total, booking) => total + (booking.totalAmount || 0), 0);
    res.json({
      success: true,
      stats: {
        artistsCount: creatorsCount.toLocaleString('en-IN'), rawArtistsCount: creatorsCount,
        productionsCount: Math.max(companiesCount, approvedCompanies.length).toLocaleString('en-IN'), rawProductionsCount: Math.max(companiesCount, approvedCompanies.length),
        castingsCount: castingsCount.toLocaleString('en-IN'), rawCastingsCount: castingsCount,
        escrowPayouts: `₹${escrowTotal.toLocaleString('en-IN')}`
      },
      talents,
      castings: liveCastings,
      companies: approvedCompanies,
      plans: activePlans
    });
  } catch (error) {
    console.error('Error fetching public landing data:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch public landing data', stats: null, talents: [], castings: [], companies: [], plans: DEFAULT_PLANS });
  }
});

// Dedicated Public Approved Companies Endpoint
router.get('/companies', async (req, res) => {
  try {
    let companies = await Company.find({
      $or: [{ isApproved: true }, { approvalStatus: 'approved' }],
      isActive: { $ne: false }
    }).select('name logo industry location city tagline verified website createdAt').sort({ createdAt: -1 }).lean();

    if (!companies || companies.length === 0) {
      await Company.insertMany(DEFAULT_APPROVED_COMPANIES);
      companies = await Company.find({
        $or: [{ isApproved: true }, { approvalStatus: 'approved' }],
        isActive: { $ne: false }
      }).select('name logo industry location city tagline verified website createdAt').sort({ createdAt: -1 }).lean();
    }

    res.json({ success: true, companies });
  } catch (error) {
    console.error('Error fetching public approved companies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch approved companies', companies: [] });
  }
});

// Dedicated Public Plans Endpoint
router.get('/plans', async (req, res) => {
  try {
    const dbPlans = await SubscriptionPlan.find({ isActive: { $ne: false } }).sort({ sortOrder: 1, monthlyPrice: 1 }).lean();
    const plans = dbPlans && dbPlans.length > 0 ? dbPlans : DEFAULT_PLANS;
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching public subscription plans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscription plans', plans: DEFAULT_PLANS });
  }
});

export default router;
