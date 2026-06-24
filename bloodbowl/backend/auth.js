import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_PLEASE';
const JWT_EXPIRES = '7d';

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: !!user.is_admin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function authMiddleware(required = true) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      if (!required) { req.user = null; return next(); }
      return res.status(401).json({ error: 'Token manquant' });
    }
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET);
      req.user = payload;
      next();
    } catch (err) {
      if (!required) { req.user = null; return next(); }
      res.status(401).json({ error: 'Token invalide' });
    }
  };
}

export function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Accès admin requis' });
  }
  next();
}
