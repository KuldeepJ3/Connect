import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '../Context/UserContext';

function UserProfile() {
    const { id: targetUserId } = useParams(); 
    const { user: currentUser } = useContext(UserContext);
    const navigate = useNavigate();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const [profileData, setProfileData] = useState(null);
    const [userPosts, setUserPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Interaction States
    const [commentTexts, setCommentTexts] = useState({});

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

    // Fetch Target User Data & Posts
    useEffect(() => {
        const fetchPublicProfile = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('Token');
                
                // Fetch Profile Info
                const profileRes = await axios.get(`${API_URL}/user/${targetUserId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (profileRes.data.success) {
                    setProfileData(profileRes.data.profile);
                    setIsFollowing(profileRes.data.profile.followers.includes(currentUser._id));
                }

                // Fetch Posts
                const postsRes = await axios.get(`${API_URL}/user   -posts/${targetUserId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (postsRes.data.success) {
                    setUserPosts(postsRes.data.posts);
                }
            } catch (error) {
                console.error("Error fetching public profile:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (targetUserId === currentUser._id) {
            navigate('/profile');
        } else {
            fetchPublicProfile();
        }
    }, [targetUserId, currentUser._id, navigate, API_URL]);

    // OPTIMISTIC FOLLOW TOGGLE
    const handleToggleFollow = async () => {
        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        
        setProfileData(prev => ({
            ...prev,
            followers: wasFollowing 
                ? prev.followers.filter(id => id !== currentUser._id) 
                : [...prev.followers, currentUser._id] 
        }));

        try {
            const token = localStorage.getItem('Token');
            const endpoint = wasFollowing ? `/unfollow/${targetUserId}` : `/follow/${targetUserId}`;
            await axios.post(`${API_URL}${endpoint}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Follow toggle failed:", error);
            setIsFollowing(wasFollowing);
            setProfileData(prev => ({
                ...prev,
                followers: wasFollowing 
                    ? [...prev.followers, currentUser._id] 
                    : prev.followers.filter(id => id !== currentUser._id)
            }));
        }
    };

    // OPTIMISTIC LIKE MECHANICS
    const handleToggleLike = async (postId, hasLiked) => {
        const updateLikes = (p) => ({
            ...p,
            likes: hasLiked ? p.likes.filter(id => id !== currentUser._id) : [...(p.likes || []), currentUser._id]
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
            author: currentUser,
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

    if (isLoading) {
        return (
            <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!profileData) {
        return (
            <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center gap-4">
                <h2 className="text-zinc-400 font-mono">User not found</h2>
                <button onClick={() => navigate('/')} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm">Return Home</button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex flex-col min-h-screen w-full bg-[#050505] text-zinc-100 font-sans selection:bg-white selection:text-black relative overflow-x-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 fixed" style={{ background: `radial-gradient(1000px circle at var(--mouse-x, 50vw) var(--mouse-y, 50vh), rgba(255,255,255,0.05), transparent 40%)` }}></div>

            <header className="relative z-10 w-full border-b border-zinc-800/60 bg-black/40 backdrop-blur-xl px-4 sm:px-6 lg:px-12 py-3 sm:py-4 flex items-center justify-between">
                <div onClick={() => navigate('/')} className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white text-black flex items-center justify-center font-bold text-base sm:text-lg rounded-md shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform shrink-0">C</div>
                    <span className="hidden min-[360px]:block text-base sm:text-lg font-semibold tracking-tight text-white group-hover:text-zinc-300 transition-colors">Connect</span>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 md:p-12 flex flex-col justify-start">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-12 mb-12 sm:mb-16">
                    <div className="w-24 h-24 sm:w-36 sm:h-36 shrink-0 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center text-white font-semibold text-2xl shadow-xl">
                        {profileData?.profileImage ? (
                            <img src={getImageUrl(profileData.profileImage)} alt="Profile" onError={(e) => { e.target.onerror = null; e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"; }} className="w-full h-full object-cover" />
                        ) : (
                            <span>{profileData?.name ? profileData.name[0].toUpperCase() : 'U'}</span>
                        )}
                    </div>

                    <div className="flex flex-col items-center sm:items-start w-full">
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-4 sm:mb-5">
                            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-white font-mono">
                                {profileData?.userName || profileData?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}
                            </h1>
                            <button 
                                onClick={handleToggleFollow}
                                className={`px-6 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm border ${
                                    isFollowing ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-red-500/50 hover:bg-red-500/10' : 'bg-white border-transparent text-black hover:bg-zinc-200'
                                }`}
                            >
                                {isFollowing ? 'Following' : 'Follow'}
                            </button>
                        </div>

                        <div className="flex items-center gap-6 sm:gap-8 mb-5 text-sm sm:text-base">
                            <div className="flex gap-1.5"><span className="font-bold text-white">{userPosts.length}</span> <span className="text-zinc-400 font-light">posts</span></div>
                            <div className="flex gap-1.5"><span className="font-bold text-white">{profileData.followers?.length || 0}</span> <span className="text-zinc-400 font-light">followers</span></div>
                            <div className="flex gap-1.5"><span className="font-bold text-white">{profileData.following?.length || 0}</span> <span className="text-zinc-400 font-light">following</span></div>
                        </div>

                        <div className="text-center sm:text-left text-sm max-w-md space-y-1">
                            <p className="font-semibold text-zinc-100">{profileData?.name || 'User'}</p>
                            <p className="text-zinc-400 font-light leading-relaxed whitespace-pre-wrap">{profileData?.bio || 'No bio yet.'}</p>
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
                    <div className="text-center py-20 text-zinc-500 text-sm">No posts yet.</div>
                ) : (
                    <div className="grid grid-cols-3 gap-1 sm:gap-4">
                        {userPosts.map((post) => (
                            <div key={post._id} onClick={() => setSelectedPost(post)} className="relative aspect-square bg-zinc-900/40 border border-zinc-800/50 rounded-md sm:rounded-xl overflow-hidden flex items-center justify-center group hover:bg-zinc-800/60 transition-colors cursor-pointer">
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
                                        <p className="text-zinc-300 text-[10px] sm:text-sm font-light line-clamp-4 leading-relaxed group-hover:text-white transition-colors">"{post.content}"</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

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
                                         {profileData?.profileImage ? (
                                             <img src={getImageUrl(profileData.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                                         ) : (
                                             <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{profileData?.name?.[0]?.toUpperCase()}</div>
                                         )}
                                     </div>
                                     <div>
                                         <h4 className="text-sm font-semibold text-white">{profileData?.name || 'User'}</h4>
                                         <p className="text-[11px] text-zinc-500 font-mono">@{profileData?.userName || 'user'}</p>
                                     </div>
                                 </div>
                                 <button onClick={() => setSelectedPost(null)} className="text-zinc-400 hover:text-white transition-colors hidden md:block p-1">
                                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                             </div>
                             
                             {/* Scrollable Text & Comments */}
                             <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700">
                                 {/* Post Text */}
                                 {selectedPost.content && (
                                     <div className="mb-6">
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                                                {profileData?.profileImage ? (
                                                    <img src={getImageUrl(profileData.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{profileData?.name?.[0]?.toUpperCase()}</div>
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-300 font-light leading-relaxed whitespace-pre-wrap flex-1 mt-1">
                                                <span className="font-semibold text-white mr-2">{profileData?.userName}</span>
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
                                                 <div onClick={() => { setSelectedPost(null); navigate(`/user/${comment.author?._id}`); }} className="w-8 h-8 rounded-full bg-zinc-800 shrink-0 overflow-hidden border border-zinc-700 cursor-pointer">
                                                     {comment.author?.profileImage ? (
                                                         <img src={getImageUrl(comment.author.profileImage)} alt="avatar" className="w-full h-full object-cover"/>
                                                     ) : (
                                                         <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{comment.author?.name?.[0]?.toUpperCase() || 'U'}</div>
                                                     )}
                                                 </div>
                                                 <div className="flex-1 mt-1">
                                                     <p className="text-sm text-zinc-300 font-light leading-relaxed whitespace-pre-wrap">
                                                         <span onClick={() => { setSelectedPost(null); navigate(`/user/${comment.author?._id}`); }} className="font-semibold text-white mr-2 cursor-pointer hover:underline">{comment.author?.userName || 'user'}</span>
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
                                     <button onClick={() => handleToggleLike(selectedPost._id, selectedPost.likes?.includes(currentUser?._id))} className={`transition-transform hover:scale-110 ${selectedPost.likes?.includes(currentUser?._id) ? 'text-red-500' : 'text-zinc-100 hover:text-zinc-400'}`}>
                                         {selectedPost.likes?.includes(currentUser?._id) ? (
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
        </div>
    );
}

export default UserProfile;