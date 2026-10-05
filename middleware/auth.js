import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
  });
};

export const requireCompany = (req, res, next) => {
  verifyToken(req, res, () => {
    if (!req.user || req.user.role !== 'company') {
      return res.status(403).json({ message: 'Forbidden: Company access required' });
    }
    next();
  });
};

export const requireCreator = (req, res, next) => {
  verifyToken(req, res, () => {
    if (!req.user || req.user.role !== 'creator') {
      return res.status(403).json({ message: 'Forbidden: Creator access required' });
    }
    next();
  });
};
