import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '../Context/UserContext';

function Profile() {
    const { user, setUser } = useContext(UserContext);
    const navigate = useNavigate();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // UI States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // User Posts States
    const [userPosts, setUserPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);

    // Interaction States
    const [commentTexts, setCommentTexts] = useState({});

    // Connections (Followers/Following) States
    const [connectionsData, setConnectionsData] = useState({ followers: [], following: [] });
    const [connectionsModal, setConnectionsModal] = useState({ isOpen: false, type: 'followers' });

    // Edit Form State
    const [editForm, setEditForm] = useState({
        name: user?.name || '',
        userName: user?.userName || '',
        bio: user?.bio || '',
    });

    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);

    const containerRef = useRef(null);

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

    // Fetch User Posts & Connections on Mount
    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const token = localStorage.getItem('Token');
                
                // Fetch Posts
                const postsRes = await axios.get(`${API_URL}/user-posts`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (postsRes.data.success) {
                    setUserPosts(postsRes.data.posts);
                }

                // Fetch Followers/Following Lists
                const connectionsRes = await axios.get(`${API_URL}/user-connections`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }); 
                if (connectionsRes.data.success) {
                    setConnectionsData({
                        followers: connectionsRes.data.followers,
                        following: connectionsRes.data.following
                    });
                }

            } catch (error) {
                console.error("Error fetching profile data:", error);
            }
        };
        fetchProfileData();
    }, [API_URL]);

    // Handle Delete Post
    const handleDeletePost = async (postId) => {
        const confirmDelete = window.confirm("Are you sure you want to permanently delete this post?");
        if (!confirmDelete) return;

        try {
            const token = localStorage.getItem('Token');
            const response = await axios.delete(`${API_URL}/delete-post/${postId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                setUserPosts(userPosts.filter(post => post._id !== postId));
                setSelectedPost(null);
            }
        } catch (error) {
            console.error("Failed to delete post:", error);
            alert("Could not delete the post. Please try again.");
        }
    };

    // OPTIMISTIC LIKE MECHANICS
    const handleToggleLike = async (postId, hasLiked) => {
        const updateLikes = (p) => ({
            ...p,
            likes: hasLiked ? p.likes.filter(id => id !== user._id) : [...(p.likes || []), user._id]
        });

        setUserPosts(currentPosts => currentPosts.map(p => p._id === postId ? updateLikes(p) : p));
        if (selectedPost?._id === postId) setSelectedPost(updateLikes(selectedPost));

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

        const updateComments = (p) => ({ ...p, comments: [...(p.comments || []), optimisticComment] });

        setUserPosts(currentPosts => currentPosts.map(p => p._id === postId ? updateComments(p) : p));
        if (selectedPost?._id === postId) setSelectedPost(updateComments(selectedPost));
        
        setCommentTexts({ ...commentTexts, [postId]: '' });

        try {
            const token = localStorage.getItem('Token');
            const res = await axios.post(`${API_URL}/comment-post/${postId}`, { text }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data.success) {
                setUserPosts(currentPosts => currentPosts.map(p => p._id === postId ? res.data.post : p));
                if (selectedPost?._id === postId) setSelectedPost(res.data.post);
            }
        } catch (error) {
            console.error("Comment failed:", error);
        }
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

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedPhoto(file);
            setPhotoPreview(URL.createObjectURL(file)); 
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const token = localStorage.getItem('Token');
            const formData = new FormData();

            formData.append('name', editForm.name);
            formData.append('userName', editForm.userName);
            formData.append('bio', editForm.bio);

            if (selectedPhoto) {
                formData.append('profileImage', selectedPhoto);
            }

            const response = await axios.put(`${API_URL}/update-profile`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                setUser((prevUser) => ({
                    ...prevUser,
                    name: response.data.user.name,
                    email: response.data.user.email,
                    bio: response.data.user.bio,
                    profileImage: response.data.user.profileImage
                }));
                if (response.data.token) {
                    localStorage.setItem('Token', response.data.token);
                }
                setUser(response.data.user);
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error("Failed to update profile:", error.response?.data?.message || error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const closeEditModal = () => {
        setIsModalOpen(false);
        setSelectedPhoto(null);
        setPhotoPreview(null);
        setEditForm({
            name: user?.name || '',
            userName: user?.userName || '',
            bio: user?.bio || '',
        });
    };

    const openConnectionsModal = (type) => {
        setConnectionsModal({ isOpen: true, type });
    };

    const handleUserClick = (targetUserId) => {
        navigate(`/user/${targetUserId}`);
    };

    return (
        <div ref={containerRef} className="flex flex-col min-h-screen w-full bg-[#050505] text-zinc-100 font-sans selection:bg-white selection:text-black relative overflow-x-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 fixed" style={{ background: `radial-gradient(1000px circle at var(--mouse-x, 50vw) var(--mouse-y, 50vh), rgba(255,255,255,0.05), transparent 40%)` }}></div>

            <header className="relative z-10 w-full border-b border-zinc-800/60 bg-black/40 backdrop-blur-xl px-4 sm:px-6 lg:px-12 py-3 sm:py-4 flex items-center justify-between">
                <div onClick={() => navigate('/')} className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white text-black flex items-center justify-center font-bold text-base sm:text-lg rounded-md shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform shrink-0">
                        C
                    </div>
                    <span className="hidden min-[360px]:block text-base sm:text-lg font-semibold tracking-tight text-white group-hover:text-zinc-300 transition-colors">
                        Connect
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-zinc-500 font-medium tracking-widest uppercase">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 md:p-12 flex flex-col justify-start">
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-12 mb-12 sm:mb-16">
                    <div className="w-24 h-24 sm:w-36 sm:h-36 shrink-0 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center text-white font-semibold text-2xl shadow-xl">
                        {user?.profileImage ? (
                            <img src={getImageUrl(user.profileImage)} alt="Profile" onError={(e) => { e.target.onerror = null; e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"; }} className="w-full h-full object-cover" />
                        ) : (
                            <span>{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
                        )}
                    </div>

                    <div className="flex flex-col items-center sm:items-start w-full">
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-4 sm:mb-5">
                            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-white font-mono">
                                {user?.userName || user?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}
                            </h1>
                            <button onClick={() => setIsModalOpen(true)} className="px-5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-semibold rounded-lg transition-all active:scale-95 shadow-sm">
                                Edit profile
                            </button>
                        </div>

                        <div className="flex items-center gap-6 sm:gap-8 mb-5 text-sm sm:text-base">
                            <div className="flex gap-1.5"><span className="font-bold text-white">{userPosts.length}</span> <span className="text-zinc-400 font-light">posts</span></div>
                            <div onClick={() => openConnectionsModal('followers')} className="flex gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                                <span className="font-bold text-white">{connectionsData.followers.length}</span> <span className="text-zinc-400 font-light">followers</span>
                            </div>
                            <div onClick={() => openConnectionsModal('following')} className="flex gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                                <span className="font-bold text-white">{connectionsData.following.length}</span> <span className="text-zinc-400 font-light">following</span>
                            </div>
                        </div>

                        <div className="text-center sm:text-left text-sm max-w-md space-y-1">
                            <p className="font-semibold text-zinc-100">{user?.name || 'Creative User'}</p>
                            <p className="text-zinc-400 font-light leading-relaxed whitespace-pre-wrap">
                                {user?.bio || 'Digital creator. Building the new standard for creative networking.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="w-full flex items-center justify-center border-t border-zinc-900 mb-6">
                    <div className="flex gap-12">
                        <button className="py-4 border-t border-white text-xs font-medium tracking-widest uppercase text-white flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 4h4v4H4zM16 4h4v4h-4zM4 16h4v4H4zM16 16h4v4h-4zM10 4h4v4h-4zM4 10h4v4H4zM16 10h4v4h-4zM10 16h4v4h-4zM10 10h4v4h-4z" /></svg>
                            Posts
                        </button>
                    </div>
                </div>

                {/* Posts Grid */}
                {userPosts.length === 0 ? (
                    <div className="text-center py-20 text-zinc-500 text-sm">No posts yet. Head to the home feed to share something.</div>
                ) : (
                    <div className="grid grid-cols-3 gap-1 sm:gap-4">
                        {userPosts.map((post) => (
                            <div 
                                key={post._id} 
                                onClick={() => setSelectedPost(post)}
                                className="relative aspect-square bg-zinc-900/40 border border-zinc-800/50 rounded-md sm:rounded-xl overflow-hidden flex items-center justify-center group hover:bg-zinc-800/60 transition-colors cursor-pointer"
                            >
                                {post.mediaType === 'image' ? (
                                    <img src={getImageUrl(post.mediaUrl)} alt="Post" className="w-full h-full object-cover" />
                                ) : post.mediaType === 'video' ? (
                                    <div className="w-full h-full relative">
                                        <video src={getImageUrl(post.mediaUrl)} className="w-full h-full object-cover opacity-80" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg className="w-8 h-8 text-white/70 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                ) : post.mediaType === 'document' ? (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <svg className="w-8 h-8 text-amber-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Document</span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full p-4 flex items-center justify-center text-center">
                                        <p className="text-zinc-300 text-[10px] sm:text-sm font-light line-clamp-4 leading-relaxed group-hover:text-white transition-colors">
                                            "{post.content}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* CONNECTIONS MODAL (Followers/Following) */}
            {connectionsModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setConnectionsModal({ isOpen: false, type: 'followers' })}>
                    <div className="w-full max-w-sm bg-[#0a0a0c] border border-zinc-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
                            <h3 className="text-white font-medium capitalize">{connectionsModal.type}</h3>
                            <button onClick={() => setConnectionsModal({ isOpen: false, type: 'followers' })} className="text-zinc-400 hover:text-white transition-colors p-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {connectionsData[connectionsModal.type].length === 0 ? (
                                <div className="py-12 text-center text-zinc-500 text-sm">No {connectionsModal.type} yet.</div>
                            ) : (
                                <div className="flex flex-col">
                                    {connectionsData[connectionsModal.type].map((connectionUser) => (
                                        <div key={connectionUser._id} onClick={() => handleUserClick(connectionUser._id)} className="flex items-center gap-3 p-4 border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors cursor-pointer">
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0">
                                                {connectionUser.profileImage ? (
                                                    <img src={getImageUrl(connectionUser.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm">{connectionUser.name?.[0]?.toUpperCase() || 'U'}</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-sm font-medium text-white">{connectionUser.name}</span>
                                                <span className="text-[11px] text-zinc-500 font-mono">@{connectionUser.userName}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* POST VIEW & INTERACTION MODAL */}
            {selectedPost && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-sm transition-opacity" onClick={() => setSelectedPost(null)}>
                    <div className="relative w-full max-w-4xl bg-[#0a0a0c] border border-zinc-800 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setSelectedPost(null)} className="absolute top-3 right-3 z-10 text-zinc-400 hover:text-white bg-black/50 rounded-full p-1.5 transition-colors md:hidden">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        {/* Media Section */}
                        {selectedPost.mediaUrl && (
                            <div className="flex-1 bg-black flex items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800 min-h-[300px] md:min-h-0">
                                {selectedPost.mediaType === 'image' && <img src={getImageUrl(selectedPost.mediaUrl)} alt="Post" className="w-full h-full object-contain max-h-[60vh] md:max-h-[85vh]" />}
                                {selectedPost.mediaType === 'video' && <video src={getImageUrl(selectedPost.mediaUrl)} controls autoPlay className="w-full h-full object-contain max-h-[60vh] md:max-h-[85vh]" />}
                                {selectedPost.mediaType === 'document' && (
                                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                                        <svg className="w-16 h-16 text-amber-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        <a href={getImageUrl(selectedPost.mediaUrl)} download target="_blank" rel="noopener noreferrer" className="px-5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg text-sm font-medium transition-colors border border-amber-500/20">Download Document</a>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Content & Action Section */}
                        <div className={`flex flex-col w-full ${selectedPost.mediaUrl ? 'md:w-[350px] lg:w-[400px]' : 'max-w-2xl mx-auto'} bg-[#0a0a0c]`}>
                             
                             {/* Header */}
                             <div className="flex items-center justify-between p-4 border-b border-zinc-800/60">
                                 <div className="flex items-center gap-3">
                                     <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                                         {user?.profileImage ? (
                                             <img src={getImageUrl(user.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                                         ) : (
                                             <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</div>
                                         )}
                                     </div>
                                     <div>
                                         <h4 className="text-sm font-semibold text-white">{user?.name || 'User'}</h4>
                                         <p className="text-[11px] text-zinc-500 font-mono">@{user?.userName || 'user'}</p>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                     <button onClick={() => handleDeletePost(selectedPost._id)} className="text-red-500/70 hover:text-red-500 transition-colors p-1" title="Delete Post">
                                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                     </button>
                                     <button onClick={() => setSelectedPost(null)} className="text-zinc-400 hover:text-white transition-colors hidden md:block">
                                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                     </button>
                                 </div>
                             </div>
                             
                             {/* Scrollable Text & Comments */}
                             <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700">
                                 {/* Post Text */}
                                 {selectedPost.content && (
                                     <div className="mb-6">
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                                                {user?.profileImage ? (
                                                    <img src={getImageUrl(user.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{user?.name?.[0]?.toUpperCase()}</div>
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-300 font-light leading-relaxed whitespace-pre-wrap flex-1 mt-1">
                                                <span className="font-semibold text-white mr-2">{user?.userName}</span>
                                                {selectedPost.content}
                                            </p>
                                        </div>
                                     </div>
                                 )}

                                 {/* Comments List */}
                                 <div className="space-y-4 pt-2 border-t border-zinc-800/40">
                                     {selectedPost.comments?.length === 0 ? (
                                         <p className="text-xs text-zinc-500 text-center py-4 italic">No comments yet.</p>
                                     ) : (
                                         selectedPost.comments?.map((comment, idx) => (
                                             <div key={comment._id || idx} className="flex gap-3">
                                                 <div onClick={() => navigate(`/user/${comment.author?._id}`)} className="w-8 h-8 rounded-full bg-zinc-800 shrink-0 overflow-hidden border border-zinc-700 cursor-pointer">
                                                     {comment.author?.profileImage ? (
                                                         <img src={getImageUrl(comment.author.profileImage)} alt="avatar" className="w-full h-full object-cover"/>
                                                     ) : (
                                                         <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{comment.author?.name?.[0]?.toUpperCase() || 'U'}</div>
                                                     )}
                                                 </div>
                                                 <div className="flex-1 mt-1">
                                                     <p className="text-sm text-zinc-300 font-light leading-relaxed whitespace-pre-wrap">
                                                         <span onClick={() => navigate(`/user/${comment.author?._id}`)} className="font-semibold text-white mr-2 cursor-pointer hover:underline">{comment.author?.userName || 'user'}</span>
                                                         {comment.text}
                                                     </p>
                                                 </div>
                                             </div>
                                         ))
                                     )}
                                 </div>
                             </div>
                             
                             {/* Action Bar & Input Footer */}
                             <div className="bg-[#0a0a0c] border-t border-zinc-800/60 p-4">
                                 {/* Icons */}
                                 <div className="flex items-center gap-4 mb-4">
                                     <button onClick={() => handleToggleLike(selectedPost._id, selectedPost.likes?.includes(user?._id))} className={`transition-transform hover:scale-110 ${selectedPost.likes?.includes(user?._id) ? 'text-red-500' : 'text-zinc-100 hover:text-zinc-400'}`}>
                                         {selectedPost.likes?.includes(user?._id) ? (
                                             <svg className="w-6 h-6 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                                         ) : (
                                             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                         )}
                                     </button>
                                     <div className="text-zinc-100">
                                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                     </div>
                                 </div>
                                 
                                 {/* Stats */}
                                 <div className="mb-3 text-xs font-semibold text-white">
                                     {selectedPost.likes?.length || 0} {(selectedPost.likes?.length === 1) ? 'like' : 'likes'}
                                 </div>

                                 {/* Input Box */}
                                 <div className="flex gap-3 items-center relative">
                                    <input
                                        type="text"
                                        placeholder="Add a comment..."
                                        value={commentTexts[selectedPost._id] || ''}
                                        onChange={(e) => setCommentTexts({...commentTexts, [selectedPost._id]: e.target.value})}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddComment(selectedPost._id);
                                            }
                                        }}
                                        className="flex-1 bg-transparent border-none text-zinc-100 text-sm outline-none placeholder:text-zinc-500 pr-10 py-1"
                                    />
                                    <button
                                        onClick={() => handleAddComment(selectedPost._id)}
                                        disabled={!commentTexts[selectedPost._id]?.trim()}
                                        className="text-emerald-500 font-semibold text-sm hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-emerald-500 transition-colors"
                                    >
                                        Post
                                    </button>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT PROFILE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-opacity">
                    <div className="w-full max-w-md bg-[#0a0a0c] border border-zinc-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
                            <h3 className="text-white font-medium">Edit Profile</h3>
                            <button type="button" onClick={closeEditModal} className="text-zinc-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
                            <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                                <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                                    {photoPreview || user?.profileImage ? (
                                        <img src={photoPreview || getImageUrl(user.profileImage)} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">{user?.name ? user.name[0].toUpperCase() : 'U'}</div>
                                    )}
                                </div>
                                <label className="text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors cursor-pointer text-center">
                                    Change photo
                                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                                </label>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-400">Name</label>
                                    <input type="text" name="name" value={editForm.name} onChange={handleEditChange} required className="w-full bg-black/50 border border-zinc-800 text-zinc-100 text-sm px-3.5 py-2.5 rounded-lg outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-400">Username</label>
                                    <input type="text" name="userName" value={editForm.userName} onChange={handleEditChange} required className="w-full bg-black/50 border border-zinc-800 text-zinc-100 text-sm px-3.5 py-2.5 rounded-lg outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 font-mono" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-400">Bio</label>
                                    <textarea name="bio" value={editForm.bio} onChange={handleEditChange} rows="3" className="w-full bg-black/50 border border-zinc-800 text-zinc-100 text-sm px-3.5 py-2.5 rounded-lg outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none"></textarea>
                                </div>
                            </div>
                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button type="button" onClick={closeEditModal} className="px-5 py-2 text-xs font-medium text-zinc-300 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded-lg transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2 shadow-md">
                                    {isLoading ? 'Saving...' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;