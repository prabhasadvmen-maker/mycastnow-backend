import rateLimit from 'express-rate-limit';

// ── Generic API rate limiter (all routes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  // Image/video files: a single page loads many of them, so don't count them (caused 429s)
  skip: (req) => req.originalUrl.startsWith('/api/upload/file/'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// ── Auth routes (login / signup) — strict
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful logins
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

// ── OTP send — very strict (prevent SMS bombing)
// Per-phone rate limiting: max 1 OTP per 5 minutes
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.body.phone || req.ip, // Rate limit by phone number
  message: {
    success: false,
    message: 'You can only request one OTP every 5 minutes. Please wait before trying again.'
  },
  skip: (req, res) => {
    // Skip rate limiting for test numbers
    const testNumbers = ['9876543210', '9999999999'];
    return testNumbers.includes(req.body.phone);
  }
});

// ── Signup route limiter (prevent account creation spam)
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many signup attempts from this IP. Please try again after 1 hour.'
  }
});
