const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    // 1. Who created it
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // ⚠️ CRITICAL: This must exactly match the name of your User model
        required: true
    },
    
    // 2. The Text (Optional, they might just post a photo)
    content: {
        type: String,
        default: '',
        trim: true
    },
    
    // 3. The File URL (Optional, they might just post text)
    mediaUrl: {
        type: String,
        default: ''
    },
    
    // 4. The File Type (Tells React how to render it)
    mediaType: {
        type: String,
        enum: ['text', 'image', 'video', 'document'], // Locks the  to onlydatabase accept these specific strings
        default: 'text'
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Must match your User model name exactly
    }],
    comments: [{
        text: { type: String, required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],
}, 
// 5. Automatic Timestamps (Crucial for the home feed timeline)
{ timestamps: true });

const PostModel = mongoose.model('Post', postSchema);

module.exports = PostModel;