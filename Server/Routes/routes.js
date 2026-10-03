const express = require('express')
const Router = express.Router()
const verifyUser = require('../middleware/verifyjwt')
const upload = require('../Multer/Multer');
const { handleSignUp, handleLogin, handleUpdateUser, handleCreatePost, handleGetPosts, handleCheckNewPosts, handleGetUserPosts, handleDeletePost, handleSearchUsers, handleFollowUser, handleUnfollowUser, handleGetConnections, handleGetPublicProfile, handleGetPublicPosts, handleToggleLike, handleAddComment, handleGetNotifications, handleMarkNotificationsRead } = require('../Controller/controller')

Router.post('/signup', handleSignUp)
Router.post('/login', handleLogin)
Router.put('/update-profile', verifyUser, upload.single('profileImage'), handleUpdateUser)
Router.post('/add-post', verifyUser, upload.single('media'), handleCreatePost);
Router.get('/get-posts', verifyUser, handleGetPosts)
Router.get('/check-new-posts', verifyUser, handleCheckNewPosts);
Router.get('/user-posts', verifyUser, handleGetUserPosts);
Router.delete('/delete-post/:id', verifyUser, handleDeletePost);
Router.get('/search-users', verifyUser, handleSearchUsers);
Router.post('/follow/:id', verifyUser, handleFollowUser);
Router.post('/unfollow/:id', verifyUser, handleUnfollowUser);
Router.get('/user-connections', verifyUser, handleGetConnections);
Router.get('/user/:id', verifyUser, handleGetPublicProfile);
Router.get('/user-posts/:id', verifyUser, handleGetPublicPosts);
Router.post('/like-post/:id', verifyUser, handleToggleLike);
Router.post('/comment-post/:id', verifyUser, handleAddComment);
Router.get('/notifications', verifyUser, handleGetNotifications);
Router.put('/notifications/mark-read', verifyUser, handleMarkNotificationsRead);

module.exports = Router