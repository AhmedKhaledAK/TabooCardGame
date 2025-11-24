import React from 'react';
import { motion } from 'framer-motion';
import Card from './Card';
import Controls from './Controls';
import Timer from './Timer';
import Scoreboard from './Scoreboard';

const GameRoom = ({ room, playerId, onJoinTeam, onStartGame, onAction, onConfirmStartTurn, onResetGame, onStartNextRound, countdown }) => {
    const player = room.players.find(p => p.id === playerId);
    const isHost = room.players[0].id === playerId; // Simple host check

    console.log('GameRoom Render:', {
        playerId,
        hostId: room.players[0].id,
        isHost,
        teamA: room.teams.A.length,
        teamB: room.teams.B.length
    });



    // Game Playing State
    const { currentTurn } = room;

    if (!currentTurn) {
        return <div className="text-white">Loading game state...</div>;
    }

    const isMyTurnTeam = player?.team === currentTurn.team;
    const role = player?.role; // describer, watcher, guesser, spectator

    return (
        <div className="flex flex-col items-center min-h-screen p-4 relative">
            {/* Reset Game Button (Host Only) */}
            {isHost && (
                <button
                    onClick={onResetGame}
                    className="absolute top-4 right-4 px-4 py-2 bg-red-500/20 text-red-500 border border-red-500/50 rounded hover:bg-red-500 hover:text-white transition-all text-sm font-bold z-50"
                >
                    RESET GAME
                </button>
            )}

            {/* Overlays */}
            {room.gameState === 'waiting_for_turn' && (
                <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    {role === 'describer' ? (
                        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                            <h2 className="text-4xl font-bold text-white">It's Your Turn!</h2>
                            <p className="text-xl text-gray-300">You are the Describer.</p>
                            <button
                                onClick={onConfirmStartTurn}
                                className="btn-primary text-2xl px-12 py-6 shadow-[0_0_30px_rgba(176,38,255,0.6)] hover:shadow-[0_0_50px_rgba(176,38,255,0.8)]"
                            >
                                START TURN
                            </button>
                        </div>
                    ) : (
                        <div className="text-center animate-pulse">
                            <h2 className="text-3xl font-bold text-white mb-2">Waiting for Turn to Start...</h2>
                            <p className="text-gray-400">
                                {room.players.find(p => p.id === room.currentTurn.describer)?.name} is getting ready.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {room.gameState === 'resuming' && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center">
                    <motion.div
                        key={countdown}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 1 }}
                        exit={{ scale: 2, opacity: 0 }}
                        className="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]"
                    >
                        {countdown}
                    </motion.div>
                </div>
            )}

            {/* Round End Overlay */}
            {room.gameState === 'round_ended' && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
                    <h2 className="text-5xl font-bold text-white mb-8 tracking-wider">
                        ROUND {room.stats?.currentRound - 1} COMPLETE!
                    </h2>

                    {/* Scores */}
                    <div className="flex items-center space-x-16 mb-12">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl text-neonPurple font-bold mb-2">TEAM A</span>
                            <span className="text-7xl font-black text-white">{room.scores.A}</span>
                        </div>
                        <div className="text-4xl text-gray-600 font-thin">vs</div>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl text-neonBlue font-bold mb-2">TEAM B</span>
                            <span className="text-7xl font-black text-white">{room.scores.B}</span>
                        </div>
                    </div>

                    {/* Next Round Button */}
                    {isHost && (
                        <button
                            onClick={onStartNextRound}
                            className="px-10 py-4 bg-neonPurple text-white font-bold text-xl rounded-xl hover:bg-neonPurple/80 hover:scale-105 transition-all shadow-[0_0_20px_rgba(176,38,255,0.4)]"
                        >
                            START ROUND {room.stats?.currentRound}
                        </button>
                    )}
                    {!isHost && (
                        <p className="text-gray-400 animate-pulse text-lg">
                            Waiting for host to start the next round...
                        </p>
                    )}
                </div>
            )}

            {/* Game Over Overlay */}
            {room.gameState === 'ended' && (
                <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
                    <h1 className="text-6xl font-black text-white mb-8 tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                        GAME OVER
                    </h1>

                    {/* Winner Display */}
                    <div className="mb-12 text-center">
                        {room.scores.A > room.scores.B ? (
                            <div className="text-5xl font-bold text-neonPurple animate-bounce">TEAM A WINS! 🏆</div>
                        ) : room.scores.B > room.scores.A ? (
                            <div className="text-5xl font-bold text-neonBlue animate-bounce">TEAM B WINS! 🏆</div>
                        ) : (
                            <div className="text-5xl font-bold text-gray-300">IT'S A DRAW! 🤝</div>
                        )}
                    </div>

                    {/* Final Scores */}
                    <div className="flex items-center space-x-16 mb-16">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl text-neonPurple font-bold mb-2">TEAM A</span>
                            <span className="text-8xl font-black text-white">{room.scores.A}</span>
                        </div>
                        <div className="text-6xl text-gray-600 font-thin">vs</div>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl text-neonBlue font-bold mb-2">TEAM B</span>
                            <span className="text-8xl font-black text-white">{room.scores.B}</span>
                        </div>
                    </div>

                    {/* Team Rosters */}
                    <div className="grid grid-cols-2 gap-16 w-full max-w-4xl mb-12">
                        <div className="text-center">
                            <h3 className="text-neonPurple font-bold mb-4 border-b border-neonPurple/30 pb-2">TEAM A ROSTER</h3>
                            <ul className="space-y-2">
                                {room.teams?.A?.map(id => (
                                    <li key={id} className="text-gray-300 text-lg">
                                        {room.players.find(p => p.id === id)?.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="text-center">
                            <h3 className="text-neonBlue font-bold mb-4 border-b border-neonBlue/30 pb-2">TEAM B ROSTER</h3>
                            <ul className="space-y-2">
                                {room.teams?.B?.map(id => (
                                    <li key={id} className="text-gray-300 text-lg">
                                        {room.players.find(p => p.id === id)?.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Reset Button */}
                    {isHost && (
                        <button
                            onClick={onResetGame}
                            className="px-12 py-4 bg-white text-black font-black text-xl rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                        >
                            PLAY AGAIN
                        </button>
                    )}
                    {!isHost && (
                        <p className="text-gray-500 animate-pulse">Waiting for host to reset...</p>
                    )}
                </div>
            )}

            <div className="w-full max-w-6xl flex justify-between items-start p-4">
                {/* Team A List */}
                <div className={`p-4 rounded-xl border ${currentTurn.team === 'A' ? 'border-neonPurple bg-neonPurple/10' : 'border-white/10 bg-black/30'}`}>
                    <h3 className="text-neonPurple font-bold mb-2">Team A</h3>
                    <ul className="space-y-1">
                        {room.teams?.A?.map(id => {
                            const p = room.players.find(pl => pl.id === id);
                            const isMe = p?.id === playerId;
                            const isDescriber = room.currentTurn.describer === id;
                            const isWatcher = room.currentTurn.watcher === id;
                            return (
                                <li key={id} className={`flex items-center space-x-2 ${isMe ? 'font-bold text-white' : 'text-gray-400'}`}>
                                    <span>{p?.name}</span>
                                    {isMe && <span className="text-xs bg-white/20 px-1 rounded">YOU</span>}
                                    {isDescriber && <span className="text-xs text-neonPurple border border-neonPurple px-1 rounded">DESCRIBER</span>}
                                    {isWatcher && <span className="text-xs text-neonBlue border border-neonBlue px-1 rounded">WATCHER</span>}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="flex flex-col items-center">
                    <div className="mb-4 px-6 py-2 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
                        <span className="text-lg font-bold text-white">
                            Round {room.stats?.currentRound || 1} of {room.settings?.rounds || 3}
                        </span>
                    </div>
                    <Scoreboard scores={room.scores} currentTeam={currentTurn.team} />
                    <Timer timeLeft={currentTurn.timeLeft} />
                </div>

                {/* Team B List */}
                <div className={`p-4 rounded-xl border ${currentTurn.team === 'B' ? 'border-neonBlue bg-neonBlue/10' : 'border-white/10 bg-black/30'}`}>
                    <h3 className="text-neonBlue font-bold mb-2">Team B</h3>
                    <ul className="space-y-1">
                        {room.teams?.B?.map(id => {
                            const p = room.players.find(pl => pl.id === id);
                            const isMe = p?.id === playerId;
                            const isDescriber = room.currentTurn.describer === id;
                            const isWatcher = room.currentTurn.watcher === id;
                            return (
                                <li key={id} className={`flex items-center space-x-2 ${isMe ? 'font-bold text-white' : 'text-gray-400'}`}>
                                    <span>{p?.name}</span>
                                    {isMe && <span className="text-xs bg-white/20 px-1 rounded">YOU</span>}
                                    {isDescriber && <span className="text-xs text-neonPurple border border-neonPurple px-1 rounded">DESCRIBER</span>}
                                    {isWatcher && <span className="text-xs text-neonBlue border border-neonBlue px-1 rounded">WATCHER</span>}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl">

                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {currentTurn.team === 'A' ? <span className="text-neonPurple">Team A's Turn</span> : <span className="text-neonBlue">Team B's Turn</span>}
                    </h2>
                    <p className="text-gray-400">
                        You are: <span className="font-bold text-white uppercase">{role}</span>
                    </p>
                </div>

                <div className="relative">
                    {/* Card Visibility Logic */}
                    {(role === 'describer' || role === 'watcher') ? (
                        <Card card={currentTurn.card} isFlipped={true} />
                    ) : (
                        <Card card={null} isFlipped={false} />
                    )}
                </div>

                <Controls role={role} onAction={onAction} />

                {role === 'guesser' && (
                    <div className="mt-8 text-xl text-gray-300 animate-pulse">
                        Guess the word!
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameRoom;
