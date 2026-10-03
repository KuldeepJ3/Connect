const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who gets the notification
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },   // Who did the action
    type: { type: String, enum: ['like', 'comment', 'follow'], required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // Optional: Only for likes/comments
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);