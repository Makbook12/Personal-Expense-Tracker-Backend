// filepath: c:\Users\mkand\Personal-Expense-Tracker\server\middleware\authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json("Access denied");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json("User not found");
    req.user = user;
    next();
  } catch {
    res.status(403).json("Invalid token");
  }
}