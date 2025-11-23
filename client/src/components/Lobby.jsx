import React, { useState } from 'react';
import { motion } from 'framer-motion';

const Lobby = ({ onCreateRoom, onJoinRoom }) => {
    const [playerName, setPlayerName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [rounds, setRounds] = useState(3);
    const [timer, setTimer] = useState(60);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8">
            <motion.h1
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-neonPurple to-neonBlue drop-shadow-[0_0_10px_rgba(176,38,255,0.5)]"
            >
                TABOO
            </motion.h1>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md p-8 space-y-6 card-glass"
            >
                <div>
                    <label className="block mb-2 text-sm font-bold text-gray-300">Your Name</label>
                    <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="w-full px-4 py-3 text-white bg-black/50 border border-white/20 rounded-xl focus:outline-none focus:border-neonBlue focus:ring-1 focus:ring-neonBlue transition-all"
                        placeholder="Enter your name"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-300">Rounds</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={rounds}
                            onChange={(e) => setRounds(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-3 text-white bg-black/50 border border-white/20 rounded-xl focus:outline-none focus:border-neonBlue focus:ring-1 focus:ring-neonBlue transition-all"
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-300">Timer (s)</label>
                        <input
                            type="number"
                            min="10"
                            max="300"
                            step="10"
                            value={timer}
                            onChange={(e) => setTimer(parseInt(e.target.value) || 60)}
                            className="w-full px-4 py-3 text-white bg-black/50 border border-white/20 rounded-xl focus:outline-none focus:border-neonBlue focus:ring-1 focus:ring-neonBlue transition-all"
                        />
                    </div>
                </div>

                <div className="flex flex-col space-y-4">
                    <button
                        onClick={() => onCreateRoom(playerName, { rounds, timer })}
                        disabled={!playerName}
                        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Create Room
                    </button>

                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-full border-t border-white/10"></div>
                        <span className="relative px-4 text-sm text-gray-500 bg-[#121212]">OR</span>
                    </div>

                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            className="flex-1 px-4 py-3 text-white bg-black/50 border border-white/20 rounded-xl focus:outline-none focus:border-neonPurple focus:ring-1 focus:ring-neonPurple transition-all"
                            placeholder="Room Code"
                        />
                        <button
                            onClick={() => onJoinRoom(roomCode, playerName)}
                            disabled={!playerName || !roomCode}
                            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Join
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Lobby;
