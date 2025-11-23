import React from 'react';
import { motion } from 'framer-motion';

const Controls = ({ role, onAction }) => {
    if (role === 'describer') {
        return (
            <div className="flex space-x-4 mt-8">
                <button
                    onClick={() => onAction('skip')}
                    className="px-8 py-4 rounded-xl font-bold text-white bg-gray-600 hover:bg-gray-500 transition-all shadow-lg"
                >
                    SKIP
                </button>
                <button
                    onClick={() => onAction('success')}
                    className="px-8 py-4 rounded-xl font-bold text-white bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                >
                    SUCCESS (+1)
                </button>
            </div>
        );
    }

    if (role === 'watcher') {
        return (
            <div className="mt-8">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onAction('buzz')}
                    className="w-48 h-48 rounded-full bg-red-600 border-8 border-red-800 shadow-[0_0_50px_rgba(220,38,38,0.6)] flex items-center justify-center active:bg-red-700 transition-colors"
                >
                    <span className="text-4xl font-black text-white tracking-widest">BUZZ</span>
                </motion.button>
            </div>
        );
    }

    return null;
};

export default Controls;
