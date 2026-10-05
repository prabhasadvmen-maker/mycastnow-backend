import SubscriptionPlan from '../models/SubscriptionPlan.js';
import logger from './logger.js';

const seedSubscriptionPlans = async () => {
  try {
    logger.info('Checking subscription plans...');
    const planCount = await SubscriptionPlan.countDocuments();
    logger.info(`Found ${planCount} existing plans`);

    if (planCount > 0) {
      logger.info('Plans already exist, skipping seed');
      return;
    }

    logger.info('Seeding subscription plans...');
    await SubscriptionPlan.insertMany([
      {
        name: 'Artist Starter',
        description: 'Basic access to casting calls and talent directory profile.',
        targetAudience: 'Creator',
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: 'INR',
        features: ['5 Applications / month', '6 Portfolio Photos', 'Verified Artist Profile Search', 'Standard Support'],
        maxCastingApplications: 5,
        maxPortfolioPhotos: 6,
        maxBookingsPerMonth: 2,
        prioritySupport: false,
        verifiedBadge: false,
        featuredListing: false,
        badgeColor: 'blue',
        isPopular: false,
        trialDays: 0,
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'Creator Spotlight Pro',
        description: 'Full audition power, direct WhatsApp alerts, and verified blue checkmark.',
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
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'All-Access Pro Network',
        description: 'Dual-purpose plan for actor-producers, casting directors & creator studios.',
        targetAudience: 'Both',
        monthlyPrice: 2499,
        yearlyPrice: 24990,
        currency: 'INR',
        features: ['Unlimited Audition Submissions & Casting Calls', 'Unlimited Talent Search & Direct Contact', 'Verified Checkmark for Talent & Production', 'Escrow Protected Contracts & Zero Fees', 'Dedicated Account Manager'],
        maxCastingApplications: -1,
        maxPortfolioPhotos: -1,
        maxBookingsPerMonth: -1,
        prioritySupport: true,
        verifiedBadge: true,
        featuredListing: true,
        badgeColor: 'purple',
        isPopular: false,
        trialDays: 7,
        isActive: true,
        sortOrder: 3
      },
      {
        name: 'Starter Casting Studio',
        description: 'Essential scouting & casting pipeline for independent producers.',
        targetAudience: 'Company',
        monthlyPrice: 4999,
        yearlyPrice: 49990,
        currency: 'INR',
        features: ['Up to 5 Active Casting Calls', 'Direct Messaging with 25 Talents/mo', 'Standard Escrow Protection', 'Email & Chat Support'],
        maxCastingApplications: 5,
        maxPortfolioPhotos: 20,
        maxBookingsPerMonth: 10,
        prioritySupport: false,
        verifiedBadge: false,
        featuredListing: false,
        badgeColor: 'blue',
        isPopular: false,
        trialDays: 0,
        isActive: true,
        sortOrder: 4
      },
      {
        name: 'Pro Production House',
        description: 'Full-featured power package for high-volume shoots, OTT shows, and films.',
        targetAudience: 'Company',
        monthlyPrice: 12999,
        yearlyPrice: 129990,
        currency: 'INR',
        features: ['Unlimited Active Casting Calls', 'Unlimited Direct Talent Messaging', '0% Platform Escrow Fee', 'Verified Studio Blue Badge', 'Dedicated Casting Coordinator', 'Instant Audition Video Downloads'],
        maxCastingApplications: -1,
        maxPortfolioPhotos: -1,
        maxBookingsPerMonth: -1,
        prioritySupport: true,
        verifiedBadge: true,
        featuredListing: true,
        badgeColor: 'gold',
        isPopular: true,
        trialDays: 14,
        isActive: true,
        sortOrder: 5
      }
    ], { ordered: false });
    logger.info('✅ Subscription plans seeded successfully');
  } catch (err) {
    if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
      logger.info('Plans already exist (duplicate key), continuing...');
    } else {
      logger.error('Subscription plan seed error:', err.message);
    }
  }
};

export default seedSubscriptionPlans;
