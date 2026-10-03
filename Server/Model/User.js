const mongoose = require('mongoose');
const crypto = require('crypto'); // Built-in Node.js module for random generation
const { type } = require('os');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    profileImage: {
        type: String,
        default: "/default-avatar.png"
    },
    userName: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true
    },
    bio: {
        type: String,
        default: ''
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // CRITICAL: Make sure this exactly matches how you exported your User model (e.g., 'User' or 'user')
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' 
    }],
}, { timestamps: true });

// Pre-save hook to auto-generate a unique username if not provided
userSchema.pre('save', async function(next) {
    if (!this.userName) {
        // Create base username from name (or email prefix if name is missing)
        const source = this.name || this.email.split('@')[0];
        let baseUserName = source
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ''); // Remove spaces and special symbols

        // Fallback if name becomes empty after stripping characters
        if (!baseUserName) baseUserName = 'user';

        let uniqueUserName = baseUserName;
        let userExists = await mongoose.model('User').findOne({ userName: uniqueUserName });

        // If the username is already taken, append a random suffix until unique
        while (userExists) {
            const randomSuffix = crypto.randomBytes(3).toString('hex'); // Generates 6 random hex characters
            uniqueUserName = `${baseUserName}_${randomSuffix}`;
            userExists = await mongoose.model('User').findOne({ userName: uniqueUserName });
        }

        this.userName = uniqueUserName;
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;