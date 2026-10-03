const jwt = require('jsonwebtoken')
const { getUser } = require('../jwt/jwt')

const verifyUser = (req, res, next) => {
    const authHeaders = req.headers.authorization;
    if (!authHeaders || !authHeaders.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeaders.split(' ')[1];
    try {
        const decoded = getUser(token)
        req.user = decoded
        next()
    } catch (error) {
        console.log("Error", error)
        res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
}

module.exports = verifyUser;