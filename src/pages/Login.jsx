import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import EarthGlobe from "../components/EarthGlobe";
import LoginCard from "../components/LoginCard";

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
        <div className="relative w-full min-h-screen md:h-screen bg-[#020617] text-white overflow-x-hidden overflow-y-auto md:overflow-hidden selection:bg-purple-500 selection:text-white">
            {/* Background Gradient Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81] opacity-80 z-[-20] fixed" />

            {/* 3D Earth Component */}
            <div className="absolute inset-0 z-0 fixed">
                <EarthGlobe />
            </div>

            {/* Main Content Layout - Added pointer-events-none to let mouse pass to canvas */}
            <div className="relative z-10 w-full min-h-screen flex flex-col md:flex-row items-center justify-between px-6 md:px-16 lg:px-24 max-w-[1600px] mx-auto pointer-events-none pb-12 md:pb-0">

                {/* Left Side: Branding Text - Re-enable pointer events for text selection */}
                <div className="flex flex-col items-center md:items-start justify-center max-w-lg space-y-6 pt-12 md:pt-0 pointer-events-auto text-center md:text-left">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                        <span className="text-white">Connect</span>
                        <span className="text-purple-400">Hub</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 font-light leading-relaxed">
                        Where every conversation builds a stronger connection
                    </p>

                    {/* Decorative decorative lines/dots for 'tech' feel */}
                    <div className="flex gap-2 mt-4 justify-center md:justify-start">
                        <div className="w-12 h-1 bg-purple-500 rounded-full opacity-50"></div>
                        <div className="w-2 h-1 bg-purple-400 rounded-full opacity-50"></div>
                        <div className="w-1 h-1 bg-purple-300 rounded-full opacity-50"></div>
                    </div>
                </div>

                {/* Right Side: Login Card - Re-enable pointer events for interaction */}
                <div className="flex items-center justify-center mt-8 md:mt-0 w-full md:w-auto pointer-events-auto">
                    <LoginCard onLogin={handleGoogleLogin} />
                </div>
            </div>
        </div>
    );
}
