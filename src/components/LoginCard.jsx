import React from 'react';

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-1.19-2.58z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
);

const LoginCard = ({ onLogin }) => {
    return (
        <div className="relative w-full max-w-[360px] md:max-w-[480px] min-h-[380px] md:min-h-[450px] h-auto md:h-[65vh] flex items-center justify-center mx-auto my-8 md:my-0">
            {/* 
        Mobile Background: Standard rounded glass card
      */}
            <div
                className="absolute inset-0 bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl md:hidden"
            />

            {/* 
        Desktop Background: The Card Container with custom clip-path.
        The image shows the card expanding OUT towards the globe (left).
      */}
            <div
                className="absolute inset-0 bg-white/5 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-0 hidden md:block"
                style={{
                    clipPath: `path('M 480 0 L 480 800 L 100 800 C -50 600 -50 200 100 0 Z')`,
                    borderRadius: '0 0 0 0'
                }}
            />

            {/* Highlight Edge for the curve (Desktop) */}
            <div
                className="absolute inset-0 pointer-events-none z-0 hidden md:block"
                style={{
                    clipPath: `path('M 480 0 L 480 800 L 100 800 C -50 600 -50 200 100 0 Z')`,
                    boxShadow: 'inset 2px 0 10px rgba(255,255,255,0.1)'
                }}
            />

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-6 md:p-8 text-white">

                {/* Middle Content */}
                <div className="flex flex-col items-center justify-center w-full my-auto">

                    <h2 className="text-3xl font-semibold mb-10 text-center text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                        Welcome Back
                    </h2>

                    {/* Glowing Glow Behind Button */}
                    <div className="relative group w-full max-w-xs">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                        <button
                            onClick={onLogin}
                            className="relative w-full px-8 py-4 bg-white rounded-full text-gray-900 font-semibold text-lg flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-98"
                        >
                            <GoogleIcon />
                            Login with Google
                        </button>
                    </div>

                </div>

                {/* Footer info or decorative elements */}
                <div className="w-full flex justify-center mt-10 opacity-30">
                    <div className="w-16 h-1 bg-gradient-to-r from-transparent via-white to-transparent rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

export default LoginCard;
