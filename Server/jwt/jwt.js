const jwt = require('jsonwebtoken')
const secretKey = "YRFN9_GB|NNB:MI{"

const setUser = (user) => {
    return jwt.sign({
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        profileImage: user.profileImage
    }, secretKey)
}

const getUser = (token) => {
    return jwt.verify(token, secretKey)
}

module.exports = {
    setUser, 
    getUser
}