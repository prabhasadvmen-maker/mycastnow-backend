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

    logger.info('Seeding subscription plans (3 Company Studio Plans)...');
    await SubscriptionPlan.insertMany([
      {
        name: 'Starter Casting Studio',
        description: 'Essential casting & scouting tools for independent filmmakers and boutique agencies.',
        targetAudience: 'Company',
        monthlyPrice: 4999,
        yearlyPrice: 49990,
        currency: 'INR',
        features: [
          'Up to 5 Active Casting Calls',
          'Direct Messaging with 25 Talents/mo',
          'Standard Escrow Protection',
          'Email & Chat Support',
          'Access to Verified Talent Directory'
        ],
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
        sortOrder: 1
      },
      {
        name: 'Pro Production House',
        description: 'Full-featured power package for high-volume film shoots, OTT shows, and ad campaigns.',
        targetAudience: 'Company',
        monthlyPrice: 12999,
        yearlyPrice: 129990,
        currency: 'INR',
        features: [
          'Unlimited Active Casting Calls',
          'Unlimited Direct Talent Messaging',
          '0% Platform Escrow Fee',
          'Verified Studio Blue Badge',
          'Dedicated Casting Coordinator',
          'Instant Audition Video Downloads',
          'Priority Search Placement'
        ],
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
        name: 'Enterprise Film Studio',
        description: 'Custom SLA, multi-user seats, and bespoke talent contracting for major studios.',
        targetAudience: 'Company',
        monthlyPrice: 29999,
        yearlyPrice: 299990,
        currency: 'INR',
        features: [
          'Everything in Pro Studio',
          'Unlimited Casting Submissions',
          'Multi-Seat Team Accounts (10 Users)',
          'Custom Legal NDAs & Contracts',
          'Dedicated Account Director',
          'API Integration & Webhooks',
          'VIP 24/7 Phone & WhatsApp Support'
        ],
        maxCastingApplications: -1,
        maxPortfolioPhotos: -1,
        maxBookingsPerMonth: -1,
        prioritySupport: true,
        verifiedBadge: true,
        featuredListing: true,
        badgeColor: 'gold',
        isPopular: false,
        trialDays: 14,
        isActive: true,
        sortOrder: 3
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
