import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '../Context/UserContext';

function Home() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // Post States
    const [posts, setPosts] = useState([]);
    const [postContent, setPostContent] = useState('');
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [unseenPosts, setUnseenPosts] = useState([]);
    const latestPostTime = useRef(null); 
    const containerRef = useRef(null);

    // Search & Network States
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Interaction States
    const [activeCommentPost, setActiveCommentPost] = useState(null);
    const [commentTexts, setCommentTexts] = useState({});

    // Notification States
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    // Interactive spotlight
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (containerRef.current) {
                containerRef.current.style.setProperty('--mouse-x', `${e.clientX}px`);
                containerRef.current.style.setProperty('--mouse-y', `${e.clientY}px`);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Initial Data Fetch (Posts & Notifications)
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const token = localStorage.getItem('Token');
                const headers = { 'Authorization': `Bearer ${token}` };

                // Fetch Posts
                axios.get(`${API_URL}/get-posts`, { headers }).then(res => {
                    if (res.data.success) setPosts(res.data.posts);
                }).catch(err => console.error("Error fetching posts:", err));

                // Fetch Notifications
                axios.get(`${API_URL}/notifications`, { headers }).then(res => {
                    if (res.data.success) {
                        setNotifications(res.data.notifications);
                        setUnreadCount(res.data.unreadCount);
                    }
                }).catch(err => console.error("Error fetching notifications:", err));

            } catch (error) {
                console.error("Initial load error:", error);
            }
        };
        fetchInitialData();
    }, [API_URL]);

    // Track the latest post timestamp whenever the main feed updates
    useEffect(() => {
        if (posts.length > 0) {
            latestPostTime.current = posts[0].createdAt;
        }
    }, [posts]);

    // Background polling every 15 seconds (Posts & Notifications)
    useEffect(() => {
        const pollBackgroundData = async () => {
            try {
                const token = localStorage.getItem('Token');
                const headers = { 'Authorization': `Bearer ${token}` };

                // Poll Posts
                if (latestPostTime.current) {
                    axios.get(`${API_URL}/check-new-posts?after=${latestPostTime.current}`, { headers })
                        .then(res => {
                            if (res.data.success && res.data.posts.length > 0) {
                                setUnseenPosts(res.data.posts);
                            }
                        }).catch(err => console.error("Silent post fetch error:", err));
                }

                // Poll Notifications
                axios.get(`${API_URL}/notifications`, { headers })
                    .then(res => {
                        if (res.data.success) {
                            setNotifications(res.data.notifications);
                            setUnreadCount(res.data.unreadCount);
                        }
                    }).catch(err => console.error("Silent notif fetch error:", err));

            } catch (error) {
                console.error("Polling error:", error);
            }
        };

        const intervalId = setInterval(pollBackgroundData, 15000); 
        return () => clearInterval(intervalId); 
    }, [API_URL]);

    // DEBOUNCED SEARCH ENGINE
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim()) {
                setIsSearching(true);
                try {
                    const token = localStorage.getItem('Token');
                    const response = await axios.get(`${API_URL}/search-users?q=${searchQuery}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.data.success) {
                        setSearchResults(response.data.users);
                    }
                } catch (error) {
                    console.error("Search error:", error);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, API_URL]);

    // OPTIMISTIC FOLLOW MECHANICS
    const handleToggleFollow = async (targetUserId, isCurrentlyFollowing) => {
        setSearchResults(prevResults => prevResults.map(u => {
            if (u._id === targetUserId) {
                return {
                    ...u,
                    followers: isCurrentlyFollowing
                        ? u.followers.filter(id => id !== user._id)
                        : [...u.followers, user._id]
                };
            }
            return u;
        }));

        try {
            const token = localStorage.getItem('Token');
            const endpoint = isCurrentlyFollowing ? `/unfollow/${targetUserId}` : `/follow/${targetUserId}`;
            await axios.post(`${API_URL}${endpoint}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Follow toggle failed:", error);
        }
    };

    // OPTIMISTIC LIKE MECHANICS
    const handleToggleLike = async (postId, hasLiked) => {
        setPosts(currentPosts => currentPosts.map(p => {
            if (p._id === postId) {
                return {
                    ...p,
                    likes: hasLiked
                        ? p.likes.filter(id => id !== user._id)
                        : [...(p.likes || []), user._id]
                };
            }
            return p;
        }));

        try {
            const token = localStorage.getItem('Token');
            await axios.post(`${API_URL}/like-post/${postId}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Like toggle failed:", error);
        }
    };

    // COMMENT POST MECHANICS
    const handleAddComment = async (postId) => {
        const text = commentTexts[postId];
        if (!text?.trim()) return;

        const optimisticComment = {
            _id: Date.now().toString(),
            text: text.trim(),
            author: user,
            createdAt: new Date().toISOString()
        };

        setPosts(currentPosts => currentPosts.map(p => 
            p._id === postId ? { ...p, comments: [...(p.comments || []), optimisticComment] } : p
        ));
        
        setCommentTexts({ ...commentTexts, [postId]: '' });

        try {
            const token = localStorage.getItem('Token');
            const res = await axios.post(`${API_URL}/comment-post/${postId}`, { text }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setPosts(currentPosts => currentPosts.map(p => 
                    p._id === postId ? res.data.post : p
                ));
            }
        } catch (error) {
            console.error("Comment failed:", error);
        }
    };

    // NOTIFICATION MECHANICS
    const toggleNotifications = async () => {
        const willOpen = !isNotifOpen;
        setIsNotifOpen(willOpen);
        setIsSearchOpen(false); // Close search if open

        if (willOpen && unreadCount > 0) {
            setUnreadCount(0); // Optimistically clear red dot
            try {
                const token = localStorage.getItem('Token');
                await axios.put(`${API_URL}/notifications/mark-read`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (error) {
                console.error("Error marking notifications read:", error);
            }
        }
    };

    const handleShowNewPosts = () => {
        setPosts([...unseenPosts, ...posts]);
        setUnseenPosts([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getImageUrl = (imagePath) => {
        if (!imagePath) return "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";
        if (imagePath.startsWith('http')) return imagePath;
        
        const normalizedPath = imagePath.replace(/\\/g, '/');
        
        if (normalizedPath.includes('/uploads/')) {
            const fileName = normalizedPath.split('/').pop();
            return `${API_URL}/uploads/${fileName}`;
        }
        return imagePath;
    };

    const timeAgo = (dateString) => {
        const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const handleLogout = () => {
        localStorage.removeItem('Token');
        navigate('/login');
    };

    const handleMediaChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedMedia(file);
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                setMediaPreview(URL.createObjectURL(file));
            } else {
                setMediaPreview('document'); 
            }
        }
    };

    const removeMedia = () => {
        setSelectedMedia(null);
        setMediaPreview(null);
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!postContent.trim() && !selectedMedia) return;

        setIsLoading(true);

        try {
            const token = localStorage.getItem('Token');
            const formData = new FormData();

            formData.append('content', postContent);
            if (selectedMedia) {
                formData.append('media', selectedMedia);
            }

            const response = await axios.post(`${API_URL}/add-post`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                const newPost = {
                    ...response.data.post,
                    author: response.data.post.author?.name ? response.data.post.author : user,
                    likes: [],
                    comments: []
                };

                setPosts([newPost, ...posts]);
                setPostContent('');
                removeMedia();
            }
        } catch (error) {
            console.error("Failed to create post:", error);
            alert("Failed to create post. Try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const closeSearchModal = () => {
        setIsSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col min-h-screen w-full bg-[#050505] text-zinc-100 font-sans selection:bg-white selection:text-black relative overflow-x-hidden"
        >
            <div
                className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 fixed"
                style={{ background: `radial-gradient(1000px circle at var(--mouse-x, 50vw) var(--mouse-y, 50vh), rgba(255,255,255,0.05), transparent 40%)` }}
            ></div>

            <header className="relative z-40 w-full border-b border-zinc-800/60 bg-black/40 backdrop-blur-xl px-4 sm:px-6 lg:px-12 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white text-black flex items-center justify-center font-bold text-base sm:text-lg rounded-md shadow-[0_0_15px_rgba(255,255,255,0.2)] shrink-0">C</div>
                    <span className="hidden min-[360px]:block text-base sm:text-lg font-semibold tracking-tight text-white">Connect</span>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 relative">
                    
                    {/* SEARCH ICON */}
                    <button 
                        onClick={() => { setIsSearchOpen(true); setIsNotifOpen(false); }}
                        className="p-1.5 sm:p-2 rounded-full bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-800/80 shadow-sm"
                        title="Find People"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </button>

                    {/* NOTIFICATION BELL */}
                    <div className="relative">
                        <button 
                            onClick={toggleNotifications}
                            className={`p-1.5 sm:p-2 rounded-full transition-all border shadow-sm relative ${isNotifOpen ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800/80'}`}
                            title="Notifications"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black animate-pulse"></span>
                            )}
                        </button>

                        {/* NOTIFICATION DROPDOWN */}
                        {isNotifOpen && (
                            <>
                                {/* Invisible overlay to close dropdown when clicking outside */}
                                <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)}></div>
                                
                                <div className="absolute top-full right-0 mt-3 w-80 sm:w-96 bg-[#0a0a0c] border border-zinc-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between">
                                        <h3 className="font-semibold text-white text-sm">Notifications</h3>
                                    </div>
                                    <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-zinc-500 text-sm">No recent activity.</div>
                                        ) : (
                                            notifications.map((notif) => (
                                                <div 
                                                    key={notif._id} 
                                                    onClick={() => {
                                                        setIsNotifOpen(false);
                                                        navigate(`/user/${notif.sender?._id}`);
                                                    }}
                                                    className={`p-4 border-b border-zinc-800/40 hover:bg-zinc-900/60 transition-colors cursor-pointer flex gap-3 ${!notif.isRead ? 'bg-zinc-900/20' : ''}`}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0 relative">
                                                        {notif.sender?.profileImage ? (
                                                            <img src={getImageUrl(notif.sender.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center font-bold text-white text-xs">{notif.sender?.name?.[0]?.toUpperCase()}</div>
                                                        )}
                                                        {/* Icon Badge overlay */}
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-black flex items-center justify-center bg-zinc-800">
                                                            {notif.type === 'like' && <svg className="w-2.5 h-2.5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>}
                                                            {notif.type === 'comment' && <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>}
                                                            {notif.type === 'follow' && <svg className="w-2.5 h-2.5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" /></svg>}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-center">
                                                        <p className="text-xs text-zinc-300">
                                                            <span className="font-semibold text-white">{notif.sender?.name}</span>
                                                            {notif.type === 'like' && ' liked your post.'}
                                                            {notif.type === 'comment' && ' commented on your post.'}
                                                            {notif.type === 'follow' && ' started following you.'}
                                                        </p>
                                                        <span className="text-[10px] text-zinc-500 mt-0.5">{timeAgo(notif.createdAt)}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group py-1 sm:py-1.5 px-1 sm:px-3 rounded-full bg-transparent sm:bg-zinc-900/60 hover:bg-zinc-900 sm:border border-zinc-800/80 transition-all sm:shadow-sm"
                        title="View Profile"
                    >
                        <div className="w-6 h-6 sm:w-6 sm:h-6 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-white font-semibold text-xs shrink-0">
                            {user?.profileImage ? (
                                <img src={getImageUrl(user.profileImage)} alt="Profile" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"; }} />
                            ) : (
                                <span>{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
                            )}
                        </div>
                        <span className="hidden sm:block text-xs font-medium text-zinc-300 group-hover:text-white transition font-mono max-w-[80px] md:max-w-[150px] truncate">
                            @{user?.userName || user?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}
                        </span>
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981] ml-0 sm:ml-1 shrink-0"></span>
                    </div>

                    <button onClick={handleLogout} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-[10px] sm:text-xs font-medium rounded-lg transition-all active:scale-95 shrink-0">
                        Sign out
                    </button>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 md:p-10 flex flex-col justify-start gap-4 sm:gap-6">

                {/* CREATE POST WIDGET */}
                <div className="w-full rounded-xl sm:rounded-2xl border border-zinc-800/80 bg-black/60 backdrop-blur-md p-4 sm:p-5 shadow-2xl">
                    <form onSubmit={handleCreatePost} className="space-y-3 sm:space-y-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-white font-semibold text-xs sm:text-sm shrink-0 mt-1">
                                {user?.profileImage ? (
                                    <img src={getImageUrl(user.profileImage)} alt="Profile" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"; }} />
                                ) : (
                                    <span>{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
                                )}
                            </div>

                            <div className="w-full">
                                <textarea
                                    rows="2"
                                    value={postContent}
                                    onChange={(e) => setPostContent(e.target.value)}
                                    placeholder="What's happening in your creative space?"
                                    className="w-full bg-transparent text-zinc-100 text-sm placeholder:text-zinc-600 outline-none resize-none pt-1 sm:pt-2 font-light"
                                ></textarea>

                                {mediaPreview && (
                                    <div className="relative mt-2 w-max max-w-full">
                                        <button type="button" onClick={removeMedia} className="absolute -top-2 -right-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg z-10 transition">✕</button>
                                        {mediaPreview === 'document' ? (
                                            <div className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-amber-400 flex items-center gap-2">📄 {selectedMedia?.name}</div>
                                        ) : selectedMedia?.type.startsWith('video/') ? (
                                            <video src={mediaPreview} className="max-h-40 rounded-lg border border-zinc-800 object-contain bg-black/50" />
                                        ) : (
                                            <img src={mediaPreview} alt="Preview" className="max-h-40 rounded-lg border border-zinc-800 object-contain bg-black/50" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-zinc-900">
                            <div className="flex items-center gap-1 sm:gap-2">
                                <label className="p-1.5 sm:p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs">
                                    <svg className="w-4 h-4 sm:w-4 sm:h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="hidden sm:inline">Photo</span>
                                    <input type="file" accept="image/*" onChange={handleMediaChange} className="hidden" />
                                </label>
                                <label className="p-1.5 sm:p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs">
                                    <svg className="w-4 h-4 sm:w-4 sm:h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    <span className="hidden sm:inline">Video</span>
                                    <input type="file" accept="video/*" onChange={handleMediaChange} className="hidden" />
                                </label>
                                <label className="p-1.5 sm:p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs">
                                    <svg className="w-4 h-4 sm:w-4 sm:h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    <span className="hidden sm:inline">Document</span>
                                    <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleMediaChange} className="hidden" />
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || (!postContent.trim() && !selectedMedia)}
                                className="px-4 py-1.5 sm:px-5 sm:py-2 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                            >
                                {isLoading ? "Broadcasting..." : "Post"}
                            </button>
                        </div>
                    </form>
                </div>

                {/* FEED STREAM */}
                {unseenPosts.length > 0 && (
                    <div className="sticky top-4 sm:top-6 z-50 flex justify-center mb-4 transition-all duration-300">
                        <button
                            onClick={handleShowNewPosts}
                            className="px-5 py-1.5 sm:px-6 sm:py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] sm:text-xs font-bold rounded-full shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all active:scale-95 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            Show {unseenPosts.length} new post{unseenPosts.length > 1 ? 's' : ''}
                        </button>
                    </div>
                )}

                {posts.length === 0 ? (
                    <div className="w-full rounded-xl sm:rounded-2xl border border-zinc-800/80 bg-black/40 backdrop-blur-md p-6 sm:p-8 text-center flex flex-col items-center justify-center min-h-[220px] sm:min-h-[280px] shadow-2xl">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 shadow-inner">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" /></svg>
                        </div>
                        <h3 className="text-sm font-medium text-white mb-1">Your network stream is quiet</h3>
                        <p className="text-xs text-zinc-500 max-w-xs font-light px-4">Be the first to share something in your space.</p>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                        {posts.map(post => {
                            const hasLiked = post.likes?.includes(user?._id);
                            
                            return (
                                <article key={post._id} className="w-full rounded-xl sm:rounded-2xl border border-zinc-800/80 bg-black/40 backdrop-blur-md p-4 sm:p-6 shadow-2xl">

                                    {/* Post Header */}
                                    <div 
                                        onClick={() => navigate(`/user/${post.author?._id}`)}
                                        className="flex items-center gap-3 mb-4 cursor-pointer group w-max"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0">
                                            {post.author?.profileImage ? (
                                                <img src={getImageUrl(post.author.profileImage)} alt={post.author.name} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"; }}/>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-bold text-white text-xs">{post.author?.name?.[0]?.toUpperCase()}</div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-zinc-300 transition-colors">{post.author?.name || 'Unknown User'}</h3>
                                            <span className="text-[11px] text-zinc-500 font-mono">@{post.author?.userName || 'user'}</span>
                                        </div>
                                    </div>

                                    {/* Post Content */}
                                    {post.content && (
                                        <p className="text-sm font-light text-zinc-300 leading-relaxed mb-4 whitespace-pre-wrap">
                                            {post.content}
                                        </p>
                                    )}

                                    {/* Post Media */}
                                    {post.mediaUrl && (
                                        <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800/60 bg-black/50">
                                            {post.mediaType === 'image' && (
                                                <img src={getImageUrl(post.mediaUrl)} alt="Post attachment" className="w-full max-h-[500px] object-cover" />
                                            )}
                                            {post.mediaType === 'video' && (
                                                <video src={getImageUrl(post.mediaUrl)} controls className="w-full max-h-[500px] object-contain" />
                                            )}
                                            {post.mediaType === 'document' && (
                                                <div className="p-4 flex items-center gap-3">
                                                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    </div>
                                                    <a href={getImageUrl(post.mediaUrl)} download target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:underline">
                                                        View Attached Document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ACTION BAR (Likes & Comments) */}
                                    <div className="flex items-center gap-5 mt-4 pt-4 border-t border-zinc-800/60">
                                        <button 
                                            onClick={() => handleToggleLike(post._id, hasLiked)}
                                            className={`flex items-center gap-1.5 transition-colors ${hasLiked ? 'text-red-500' : 'text-zinc-400 hover:text-white'}`}
                                        >
                                            {hasLiked ? (
                                                <svg className="w-5 h-5 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                            )}
                                            <span className="text-xs font-medium">{post.likes?.length || 0}</span>
                                        </button>

                                        <button 
                                            onClick={() => setActiveCommentPost(activeCommentPost === post._id ? null : post._id)}
                                            className={`flex items-center gap-1.5 transition-colors ${activeCommentPost === post._id ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'}`} 
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            <span className="text-xs font-medium">{post.comments?.length || 0}</span>
                                        </button>
                                    </div>

                                    {/* EXPANDABLE COMMENT SECTION */}
                                    {activeCommentPost === post._id && (
                                        <div className="mt-4 pt-4 border-t border-zinc-800/60 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                            
                                            {/* Comment List */}
                                            <div className="max-h-48 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
                                                {post.comments?.length === 0 ? (
                                                    <p className="text-xs text-zinc-500 text-center py-2 italic">No comments yet. Be the first to reply.</p>
                                                ) : (
                                                    post.comments?.map((comment, idx) => (
                                                        <div key={comment._id || idx} className="flex gap-2.5">
                                                            <div 
                                                                onClick={() => navigate(`/user/${comment.author?._id}`)}
                                                                className="w-6 h-6 rounded-full bg-zinc-800 shrink-0 overflow-hidden border border-zinc-700 cursor-pointer"
                                                            >
                                                                {comment.author?.profileImage ? (
                                                                    <img src={getImageUrl(comment.author.profileImage)} alt="avatar" className="w-full h-full object-cover"/>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white">
                                                                        {comment.author?.name?.[0]?.toUpperCase() || 'U'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col bg-zinc-900/50 p-2.5 rounded-r-xl rounded-bl-xl border border-zinc-800/50 w-full">
                                                                <span 
                                                                    onClick={() => navigate(`/user/${comment.author?._id}`)}
                                                                    className="text-[10px] font-medium text-zinc-400 mb-0.5 cursor-pointer hover:text-white transition-colors"
                                                                >
                                                                    @{comment.author?.userName || 'user'}
                                                                </span>
                                                                <p className="text-xs text-zinc-200 font-light whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Comment Input Box */}
                                            <div className="flex gap-2 items-end">
                                                <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0 overflow-hidden border border-zinc-700">
                                                     {user?.profileImage ? (
                                                         <img src={getImageUrl(user.profileImage)} alt="avatar" className="w-full h-full object-cover"/>
                                                     ) : (
                                                         <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white">
                                                             {user?.name?.[0]?.toUpperCase() || 'U'}
                                                         </div>
                                                     )}
                                                </div>
                                                <div className="flex-1 relative">
                                                    <textarea
                                                        rows="1"
                                                        placeholder="Post a reply..."
                                                        value={commentTexts[post._id] || ''}    
                                                        onChange={(e) => setCommentTexts({...commentTexts, [post._id]: e.target.value})}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleAddComment(post._id);
                                                            }
                                                        }}
                                                        className="w-full bg-black/50 border border-zinc-800 text-zinc-100 text-xs px-3 py-2.5 rounded-lg outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none pr-10 min-h-[38px] flex items-center"
                                                    />
                                                    <button
                                                        onClick={() => handleAddComment(post._id)}
                                                        disabled={!commentTexts[post._id]?.trim()}
                                                        className="absolute right-2 bottom-2 p-1 text-emerald-500 hover:text-emerald-400 disabled:opacity-30 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    </button>
                                                </div>
                                            </div>

                                        </div>
                                    )}

                                </article>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ================= SEARCH & NETWORK MODAL ================= */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-sm transition-opacity" onClick={closeSearchModal}>
                    <div 
                        className="w-full max-w-md bg-[#0a0a0c] border border-zinc-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-zinc-800/80 relative flex items-center">
                            <svg className="absolute left-7 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input 
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name or username..."
                                className="w-full bg-zinc-900/50 border border-zinc-800 text-white text-sm pl-10 pr-4 py-2.5 rounded-xl outline-none focus:border-zinc-500 transition-colors"
                            />
                            <button onClick={closeSearchModal} className="ml-3 text-zinc-400 hover:text-white p-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto">
                            {isSearching ? (
                                <div className="py-10 text-center text-zinc-500 text-sm">Searching network...</div>
                            ) : searchResults.length > 0 ? (
                                <div className="flex flex-col">
                                    {searchResults.map((resultUser) => {
                                        const isFollowing = resultUser.followers?.includes(user._id);

                                        return (
                                            <div key={resultUser._id} className="flex items-center justify-between p-4 border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors">
                                                
                                                <div 
                                                    className="flex items-center gap-3 cursor-pointer group"
                                                    onClick={() => {
                                                        closeSearchModal();
                                                        navigate(`/user/${resultUser._id}`);
                                                    }}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0">
                                                        {resultUser.profileImage ? (
                                                            <img src={getImageUrl(resultUser.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                                                        ) : (   
                                                            <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm">
                                                                {resultUser.name?.[0]?.toUpperCase() || 'U'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-white group-hover:text-zinc-300 transition-colors">{resultUser.name}</span>
                                                        <span className="text-[11px] text-zinc-500 font-mono">@{resultUser.userName}</span>
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => handleToggleFollow(resultUser._id, isFollowing)}
                                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                                        isFollowing 
                                                            ? 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-red-500/50 hover:bg-red-500/10'
                                                            : 'bg-white text-black hover:bg-zinc-200'
                                                    }`}
                                                >
                                                    {isFollowing ? 'Following' : 'Follow'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : searchQuery.trim().length > 0 ? (
                                <div className="py-10 text-center text-zinc-500 text-sm">No users found.</div>
                            ) : (
                                <div className="py-10 text-center text-zinc-600 text-xs font-light">Type a name or username to search</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <footer className="relative z-10 w-full border-t border-zinc-900 px-4 sm:px-6 lg:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] sm:text-[11px] text-zinc-500 font-medium tracking-widest uppercase">
                <span>© 2026 Connect Inc.</span>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
            </footer>
        </div>
    );
}

export default Home;