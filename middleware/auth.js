import jwt from 'jsonwebtoken';

export const auth = (req, res, next) => {
    try {
        const token = req.header("Authorization");

        if (!token) {
            return res.status(401).json({ message: "Access denied. No token provided." });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded; 
        next(); 
    } catch (error) {
        res.status(400).json({ message: "Invalid token." });
    }
};
