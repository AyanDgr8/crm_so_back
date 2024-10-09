// src/middleware/adminMiddleware.js

export const adminMiddleware = (req, res, next) => {
    // Check if the user is authenticated and has a role
    if (req.user) {
        console.log(`User Role: ${req.user.role}`);
        
        if (req.user.role === 'Admin') {
            return next(); // User is admin, proceed to the next middleware or route handler
        } else {
            return res.status(403).json({ message: 'Access denied. You do not have the necessary permissions.' });
        }
    } else {
        return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }
};
