import React, { useState } from 'react';
import { motion } from 'framer-motion';

const Lobby = ({ room, playerId, onJoinTeam, onStartGame, onShuffleTeams, onJoinRoom, onCreateRoom }) => {
    const [playerName, setPlayerName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [rounds, setRounds] = useState(3);
    const [timer, setTimer] = useState(60);

    // Landing Page (No Room)
    if (!room) {
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
                </motion.div>
            </div>
        );
    }

    // Room Lobby (Team Selection)
    const isHost = room.players[0]?.id === playerId;

    return (
        <div className="flex flex-col items-center min-h-screen p-8 space-y-8">
            <h1 className="text-4xl font-bold text-white">Room: {room.id}</h1>

            <div className="flex w-full max-w-4xl space-x-8">
                {/* Team A */}
                <div className="flex-1 p-6 bg-black/30 rounded-2xl border border-neonPurple/30">
                    <h2 className="text-2xl font-bold text-neonPurple mb-4">Team A</h2>
                    <button
                        onClick={() => onJoinTeam('A')}
                        className="w-full py-2 mb-4 rounded-lg border border-neonPurple text-neonPurple hover:bg-neonPurple hover:text-white transition-all"
                    >
                        Join Team A
                    </button>
                    <ul className="space-y-2">
                        {room.teams.A.map(id => {
                            const p = room.players.find(pl => pl.id === id);
                            return <li key={id} className="text-white">{p?.name}</li>
                        })}
                    </ul>
                </div>

                {/* Team B */}
                <div className="flex-1 p-6 bg-black/30 rounded-2xl border border-neonBlue/30">
                    <h2 className="text-2xl font-bold text-neonBlue mb-4">Team B</h2>
                    <button
                        onClick={() => onJoinTeam('B')}
                        className="w-full py-2 mb-4 rounded-lg border border-neonBlue text-neonBlue hover:bg-neonBlue hover:text-white transition-all"
                    >
                        Join Team B
                    </button>
                    <ul className="space-y-2">
                        {room.teams.B.map(id => {
                            const p = room.players.find(pl => pl.id === id);
                            return <li key={id} className="text-white">{p?.name}</li>
                        })}
                    </ul>
                </div>
            </div>

            <div className="mt-8">
                <h3 className="text-xl text-gray-400 mb-4">Spectators / Unassigned</h3>
                <div className="flex flex-wrap gap-4 justify-center">
                    {room.players.filter(p => !p.team).map(p => (
                        <span key={p.id} className="px-4 py-2 bg-white/5 rounded-full text-gray-300">{p.name}</span>
                    ))}
                </div>
            </div>

            {isHost && (
                <div className="flex space-x-4 mt-8">
                    <button
                        onClick={onShuffleTeams}
                        className="px-8 py-4 rounded-lg border border-neonBlue text-neonBlue hover:bg-neonBlue hover:text-white transition-all font-bold"
                    >
                        SHUFFLE TEAMS
                    </button>
                    <button
                        onClick={() => onStartGame(rounds, timer)}
                        disabled={room.teams.A.length === 0 || room.teams.B.length === 0}
                        className="btn-primary text-xl px-12 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        START GAME
                    </button>
                </div>
            )}
        </div>
    );
};

export default Lobby;
