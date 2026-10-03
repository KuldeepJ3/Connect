import { useState, useEffect, useRef, useContext } from 'react'; // Added useContext
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // Added missing jwtDecode import
import { UserContext } from '../Context/UserContext'; // Make sure path matches your folder structure

function Login() {
    const navigate = useNavigate();
    const { setUser } = useContext(UserContext); // Extract setUser from context
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Main container ref to track mouse across the entire window
    const containerRef = useRef(null);

    // Interactive spotlight that follows the mouse globally
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

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await axios.post(`${baseUrl}/login`, {
                email: formData.email,
                password: formData.password
            });

            console.log("Response Data: ", response.data);

            localStorage.setItem("Token", response.data.token);

            const decodedUserData = jwtDecode(response.data.token);
            setUser(decodedUserData);

            alert(response.data.message || "Login Successful");
            navigate('/');

        } catch (err) {
            if (err.response) {
                if (err.response.status === 404 || err.response.status === 401) {
                    setError(err.response.data.message);
                } else {
                    setError("Something went wrong. Please try again.");
                }   
            } else {
                console.error("Login failed:", err);
                setError("Network error. Is the backend running?");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div 
            ref={containerRef}
            className="flex min-h-screen w-full bg-[#050505] text-zinc-100 font-sans selection:bg-white selection:text-black relative overflow-hidden"
        >
            
            {/* ================= FULL-SCREEN INTERACTIVE SPOTLIGHT ================= */}
            <div 
                className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
                style={{
                    background: `radial-gradient(1000px circle at var(--mouse-x, 50vw) var(--mouse-y, 50vh), rgba(255,255,255,0.06), transparent 40%)`
                }}
            ></div>

            {/* ================= LEFT PANEL: BRANDING ================= */}
            <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 overflow-hidden pointer-events-none">
                
                {/* Top Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-lg rounded-md shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        C
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-white">Connect</span>
                </div>

                {/* Center Mission Statement */}
                <div className="max-w-md pointer-events-auto">
                    <h1 className="text-4xl font-medium tracking-tight text-white mb-6 leading-[1.1]">
                        The new standard for creative networking.
                    </h1>
                    <p className="text-zinc-400 text-sm leading-relaxed font-light">
                        Experience a beautifully engineered platform designed for professionals. Connect strips away the noise, leaving only what matters: your content, your network, and your vision.
                    </p>
                </div>

                {/* Bottom Credits */}
                <div className="flex items-center text-[11px] text-zinc-500 font-medium tracking-widest uppercase">
                    <span>© 2026 Connect Inc.</span>
                </div>
            </div>

            {/* ================= RIGHT PANEL: ULTRA-CLEAN AUTH FORM ================= */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-20 relative z-10">
                
                {/* Mobile-only Logo */}
                <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
                    <div className="w-6 h-6 bg-white text-black flex items-center justify-center font-bold text-xs rounded-sm">
                        C
                    </div>
                    <span className="text-sm font-semibold tracking-tight text-white">Connect</span>
                </div>

                <div className="absolute bottom-8 right-8 lg:bottom-12 lg:right-12 hidden sm:flex items-center gap-2 text-[11px] text-zinc-500 font-medium tracking-widest uppercase pointer-events-none">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    By Kuldeep Joshi
                </div>

                <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
                            Welcome back
                        </h2>
                        <p className="text-sm text-zinc-400 font-light">
                            Enter your credentials to access your account.
                        </p>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-sm text-red-400">
                            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="leading-tight">{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-300">Email</label>
                            <input 
                                type="email"
                                name="email"
                                required
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-black/60 border border-zinc-800 text-zinc-100 text-sm px-3.5 py-2.5 rounded-lg outline-none transition-all placeholder:text-zinc-600 hover:border-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 shadow-inner backdrop-blur-md"
                            />
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-zinc-300">Password</label>
                                <a href="#forgot" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                                    Forgot password?
                                </a>
                            </div>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    required
                                    placeholder="••••••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-black/60 border border-zinc-800 text-zinc-100 text-sm px-3.5 py-2.5 pr-10 rounded-lg outline-none transition-all placeholder:text-zinc-600 hover:border-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 shadow-inner backdrop-blur-md"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 py-2.5 bg-white hover:bg-zinc-200 text-black text-sm font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Authenticating...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-sm text-zinc-500 font-light">
                            Don't have an account?{' '}
                            <Link to="/signup" className="text-white hover:text-zinc-300 font-medium transition-colors">
                                Sign up
                            </Link>
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Login;