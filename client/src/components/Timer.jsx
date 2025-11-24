import React from 'react';
import { motion } from 'framer-motion';

const Timer = ({ timeLeft }) => {
    const isLow = timeLeft <= 10;

    return (
        <div className="relative flex items-center justify-center w-24 h-24">
            <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-700"
                />
                <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className={isLow ? "text-red-500" : "text-neonBlue"}
                    initial={{ pathLength: 1 }}
                    animate={{ pathLength: (timeLeft || 60) / 60 }}
                    transition={{ duration: 1, ease: "linear" }}
                />
            </svg>
            <span className={`text-2xl font-bold ${isLow ? "text-red-500" : "text-white"}`}>
                {timeLeft || 0}
            </span>
        </div>
    );
};

export default Timer;
