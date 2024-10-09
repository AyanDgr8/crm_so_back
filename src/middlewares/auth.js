// src/middlewares/auth.js

import jwt from 'jsonwebtoken';
import dotenv from "dotenv";

dotenv.config();  // Load environment variables

export const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: "Access denied. No token provided." });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded token:", decoded); 
        req.user = decoded;  // Attach user data (including userId) to the request
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token." });
    }
};
