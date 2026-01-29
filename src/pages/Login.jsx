import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Login() {
    const { login, currentUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (currentUser) {
            navigate('/');
        }
    }, [currentUser, navigate]);

    const handleGoogleLogin = async () => {
        try {
            await login();
            navigate('/');
        } catch (error) {
            alert("Login failed: " + error.message);
        }
    };

    return (
        <div className="login-container w-full h-screen flex items-center justify-center relative">
            {/* 3D Animated Background Shapes */}
            <div className="shape-blob-3d"></div>
            <div className="shape-blob-3d shape-2"></div>

            {/* Particles */}
            <div className="particle p-1"></div>
            <div className="particle p-2"></div>
            <div className="particle p-3"></div>

            {/* Glass Card */}
            <div className="glass-card z-10 p-10 md:p-14 rounded-[2rem] w-full max-w-lg mx-4 flex flex-col items-center text-center border border-white/10 shadow-2xl relative overflow-hidden">

                {/* Logo Area */}
                <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full"></div>
                    <div className="relative flex flex-col items-center gap-4">
                        {/* Logo Icon */}
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white drop-shadow-sm">
                            ConnectHub
                        </h1>
                    </div>
                </div>

                <div className="space-y-3 mb-12">
                    <p className="text-gray-200 text-lg max-w-xs mx-auto leading-relaxed font-light">
                        Where every conversation builds a stronger connection
                    </p>
                </div>

                {/* Login Button */}
                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white hover:bg-gray-50 text-black font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-4 shadow-xl shadow-black/10 group mb-8"
                >
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    <span className="text-lg">Login with Google</span>
                </button>

                {/* Footer Links */}
                <div className="flex flex-col items-center gap-3 text-sm text-gray-400">
                    <p>Don't have an account? <button className="text-primary-light hover:text-white font-medium transition-colors ml-1">Sign Up</button></p>
                    <button className="text-gray-500 hover:text-gray-300 transition-colors text-xs">Forgot password?</button>
                </div>
            </div>

        </div>
    );
}
