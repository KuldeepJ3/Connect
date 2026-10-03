const UserModel = require('../Model/User')
const bcrypt = require('bcrypt') //PassWord Hash
const { setUser, getUser } = require('../jwt/jwt')
const PostModel = require('../Model/posts')
const NotificationModel = require('../Model/notification');
const fs = require('fs');
const path = require('path');

async function handleSignUp(req, res) {
    const body = req.body

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.password, saltRounds);

    try {
        const User = await UserModel.create({
            name: body.name,
            email: body.email,
            password: hashedPassword,
            profileImage: body.profileImage || "/default-avatar.png"
        })

        const token = setUser(User)

        return res.json({
            status: "Success",
            message: "User Created Successfully",
            token: token
        })
    } catch (error) {
        console.log("BACKEND CRASHED BECAUSE: ", error);

        if (error.code === 11000) {
            return res.status(400).json({ message: "Email Already Exists!" })
        }
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

async function handleLogin(req, res) {
    const { email, password } = req.body;

    try {
        const user = await UserModel.findOne({ email })
        if (!user) return res.status(404).json({ status: "Failed", message: "No Such User" })

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = setUser(user)
            return res.status(200).json({ message: "User Login Successfull", token: token })
        }

        return res.status(401).json({ status: "Failed", message: "Incorrect Password" });
    } catch (error) {
        return res.json({ status: "Failed", message: error.message })
    }
}

const handleUpdateUser = async (req, res) => {
    try {
        const { bio, username, location } = req.body; 
        
        // Find the user first or build an update object
        let updateData = {
            bio,
            username,
            location
        };

        // If a new image was uploaded to Cloudinary, attach the new URL
        if (req.file) {
            updateData.profileImage = req.file.path; // The secure Cloudinary URL
        }

        // Update the user in MongoDB
        const updatedUser = await UserModel.findByIdAndUpdate(
            req.user._id, 
            updateData, 
            { new: true } // Returns the newly updated document
        );

        res.status(200).json({ success: true, user: updatedUser });

    } catch (error) {
        console.error("Profile update failed:", error);
        res.status(500).json({ success: false, message: "Server error during profile update" });
    }
};

const handleCreatePost = async (req, res) => {
    try {
        console.log("Body:", req.body); // Check if the text arrived
        console.log("File:", req.file);
        const { content } = req.body;
        let typeOfMedia = 'text';
        let fileUrl = '';

        // req.file now comes from Cloudinary, not your local disk!
        if (req.file) {
            fileUrl = req.file.path; // This is now a live https://res.cloudinary.com/... URL
            const mime = req.file.mimetype;

            if (mime.startsWith('image/')) {
                typeOfMedia = 'image';
            } else if (mime.startsWith('video/')) {
                typeOfMedia = 'video';
            } else {
                typeOfMedia = 'document';
            }
        }

        // Create and save the new post to MongoDB...
        const newPost = new PostModel({
            content,
            mediaUrl: fileUrl,
            mediaType: typeOfMedia,
            author: req.user._id
        });

        await newPost.save();
        res.status(201).json({ success: true, post: newPost });

    } catch (error) {
        console.error("Post creation failed:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

async function handleGetPosts(req, res) {
    try {
        // .find() gets all posts
        // .sort({ createdAt: -1 }) orders them newest first
        // .populate() swaps the raw author ID for the actual user object
        const posts = await PostModel.find()
            .sort({ createdAt: -1 })
            .populate('author', 'name userName profileImage') // We only pull the fields we actually need
            .populate('comments.author', 'name userName profileImage');

        res.status(200).json({ success: true, posts: posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function handleCheckNewPosts(req, res) {
    try {
        const { after } = req.query;

        if (!after) {
            return res.status(400).json({ success: false, message: "Missing 'after' timestamp" });
        }

        // $gt means "Greater Than". We only want posts created AFTER this exact millisecond.
        const newPosts = await PostModel.find({ createdAt: { $gt: new Date(after) } })
            .sort({ createdAt: -1 })
            .populate('author', 'name userName profileImage')
            .populate('comments.author', 'name userName profileImage');

        res.status(200).json({ success: true, posts: newPosts });
    } catch (error) {
        console.error("Error checking new posts:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Fetch posts for the logged-in user only
async function handleGetUserPosts(req, res) {
    try {
        const posts = await PostModel.find({ author: req.user._id })
            .sort({ createdAt: -1 })
            .populate('author', 'name userName profileImage')
            .populate('comments.author', 'name userName profileImage');

        res.status(200).json({ success: true, posts }); 
    } catch (error) {
        console.error("Error fetching user posts:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function handleDeletePost(req, res) {
    try {
        const postId = req.params.id;

        // 1. Delete the database record and capture the deleted document
        const deletedPost = await PostModel.findOneAndDelete({
            _id: postId,
            author: req.user._id
        });

        if (!deletedPost) {
            return res.status(404).json({ success: false, message: "Post not found or unauthorized to delete" });
        }

        // 2. If the post had media, delete it from the hard drive
        if (deletedPost.mediaUrl) {
            // Extract just the filename from the saved URL
            // e.g., splits "public/uploads/12345.jpg" to get "12345.jpg"
            const urlParts = deletedPost.mediaUrl.replace(/\\/g, '/').split('/uploads/');

            if (urlParts.length > 1) {
                const fileName = urlParts.pop();

                // Construct the exact path to the file on your server
                // NOTE: Adjust '../public/uploads' if your folder structure is different
                const filePath = path.join(__dirname, '../uploads', fileName);

                // fs.unlink silently deletes the file. 
                // We wrap it in a try/catch so if the file is already missing, the app doesn't crash.
                fs.unlink(filePath, (err) => {
                    if (err) console.error("Could not delete file from disk:", err.message);
                });
            }
        }

        res.status(200).json({ success: true, message: "Post and media deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function handleSearchUsers(req, res) {
    try {
        const { q } = req.query;
        if (!q) return res.status(200).json({ success: true, users: [] });

        // Search both name and userName using a case-insensitive regex ($options: 'i')
        // We use $ne (Not Equal) to ensure the current logged-in user doesn't show up in their own search
        const users = await UserModel.find({
            _id: { $ne: req.user._id },
            $or: [
                { userName: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } }
            ]
        })
            .select('name userName profileImage followers') // Only fetch the data we actually need to render the UI
            .limit(10); // Hard cap to prevent massive database payloads

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Follow a user
async function handleFollowUser(req, res) {
    try {
        const targetId = req.params.id;
        const currentUserId = req.user._id;

        if (targetId === currentUserId.toString()) {
            return res.status(400).json({ success: false, message: "You cannot follow yourself" });
        }

        // 1. Add target user to current user's 'following' array
        await UserModel.findByIdAndUpdate(currentUserId, {
            $addToSet: { following: targetId }
        });

        // 2. Add current user to target user's 'followers' array
        await UserModel.findByIdAndUpdate(targetId, {
            $addToSet: { followers: currentUserId }
        });

        // Create Follow Notification
        await NotificationModel.create({
            receiver: targetId,
            sender: currentUserId,
            type: 'follow'
        });

        res.status(200).json({ success: true, message: "Successfully followed user" });
    } catch (error) {
        console.error("Follow error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Unfollow a user
async function handleUnfollowUser(req, res) {
    try {
        const targetId = req.params.id;
        const currentUserId = req.user._id;

        // 1. Remove target user from current user's 'following' array
        await UserModel.findByIdAndUpdate(currentUserId, {
            $pull: { following: targetId }
        });

        // 2. Remove current user from target user's 'followers' array
        await UserModel.findByIdAndUpdate(targetId, {
            $pull: { followers: currentUserId }
        });

        res.status(200).json({ success: true, message: "Successfully unfollowed user" });
    } catch (error) {
        console.error("Unfollow error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function handleGetConnections(req, res) {
    try {
        // Find the user and populate both arrays with the specific fields we need for the UI
        const user = await UserModel.findById(req.user._id)
            .populate('followers', 'name userName profileImage')
            .populate('following', 'name userName profileImage');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({
            success: true,
            followers: user.followers,
            following: user.following
        });
    } catch (error) {
        console.error("Error fetching connections:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Fetch a public user's profile details
async function handleGetPublicProfile(req, res) {
    try {
        const targetId = req.params.id;

        // Find user and exclude sensitive data like passwords (if any)
        const user = await UserModel.findById(targetId)
            .select('name userName bio profileImage followers following');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, profile: user });
    } catch (error) {
        console.error("Error fetching public profile:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Fetch a public user's posts
async function handleGetPublicPosts(req, res) {
    try {
        const targetId = req.params.id;

        const posts = await PostModel.find({ author: targetId })
            .sort({ createdAt: -1 })
            .populate('author', 'name userName profileImage')
            .populate('comments.author', 'name userName profileImage')

        res.status(200).json({ success: true, posts });
    } catch (error) {
        console.error("Error fetching public posts:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Toggle Like on a Post
async function handleToggleLike(req, res) {
    try {
        const postId = req.params.id;
        const userId = req.user._id;

        const post = await PostModel.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        // Check if the user has already liked the post
        const hasLiked = post.likes.includes(userId);

        if (hasLiked) {
            // Unlike: Remove the user's ID
            await PostModel.findByIdAndUpdate(postId, { $pull: { likes: userId } });
            return res.status(200).json({ success: true, message: "Unliked", liked: false });
        } else {
            // Like: Add the user's ID
            await PostModel.findByIdAndUpdate(postId, { $addToSet: { likes: userId } });

            // Create Notification (Only if they aren't liking their own post)
            if (post.author.toString() !== userId.toString()) {
                await NotificationModel.create({
                    receiver: post.author,
                    sender: userId,
                    type: 'like',
                    post: postId
                });
            }
            return res.status(200).json({ success: true, message: "Liked", liked: true });
            // Like: Add the user's ID
        }
    } catch (error) {
        console.error("Like toggle error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Add a Comment to a Post
async function handleAddComment(req, res) {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const { text } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ success: false, message: "Comment cannot be empty" });
        }

        // Use $push to add the new comment object
        const updatedPost = await PostModel.findByIdAndUpdate(
            postId,
            {
                $push: {
                    comments: { text: text.trim(), author: userId }
                }
            },
            { new: true } // Returns the updated document
        ).populate({
            path: 'comments.author',
            select: 'name userName profileImage'
        });

        const post = await PostModel.findById(postId);
        if (post.author.toString() !== userId.toString()) {
            await NotificationModel.create({
                receiver: post.author,
                sender: userId,
                type: 'comment',
                post: postId
            });
        }

        if (!updatedPost) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        res.status(200).json({ success: true, post: updatedPost });
    } catch (error) {
        console.error("Comment error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Fetch Notifications
async function handleGetNotifications(req, res) {
    try {
        const notifications = await NotificationModel.find({ receiver: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20) // Only grab the 20 most recent to keep the payload light
            .populate('sender', 'name userName profileImage')
            .populate('post', 'content mediaType'); // Gives context to what was liked/commented

        // Calculate how many are unseen to show the red dot
        const unreadCount = notifications.filter(n => !n.isRead).length;

        res.status(200).json({ success: true, notifications, unreadCount });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Mark Notifications as Read
async function handleMarkNotificationsRead(req, res) {
    try {
        // Update all unread notifications for this user to "read"
        await NotificationModel.updateMany(
            { receiver: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );
        res.status(200).json({ success: true, message: "Notifications marked as read" });
    } catch (error) {
        console.error("Error updating notifications:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    handleSignUp,
    handleLogin,
    handleUpdateUser,
    handleCreatePost,
    handleGetPosts,
    handleCheckNewPosts,
    handleGetUserPosts,
    handleDeletePost,
    handleSearchUsers,
    handleFollowUser,
    handleUnfollowUser,
    handleGetConnections,
    handleGetPublicProfile,
    handleGetPublicPosts,
    handleToggleLike,
    handleAddComment,
    handleGetNotifications,
    handleMarkNotificationsRead
}