import React from 'react';
import { motion } from 'framer-motion';
import Card from './Card';
import Controls from './Controls';
import Timer from './Timer';
import Scoreboard from './Scoreboard';

const GameRoom = ({ room, playerId, onJoinTeam, onStartGame, onAction }) => {
    const player = room.players.find(p => p.id === playerId);
    const isHost = room.players[0].id === playerId; // Simple host check

    console.log('GameRoom Render:', {
        playerId,
        hostId: room.players[0].id,
        isHost,
        teamA: room.teams.A.length,
        teamB: room.teams.B.length
    });

    if (room.gameState === 'lobby') {
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
                    <button
                        onClick={onStartGame}
                        disabled={room.teams.A.length === 0 || room.teams.B.length === 0}
                        className="btn-primary text-xl px-12 py-4 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        START GAME
                    </button>
                )}
            </div>
        );
    }

    // Game Playing State
    const { currentTurn } = room;
    const isMyTurnTeam = player?.team === currentTurn.team;
    const role = player?.role; // describer, watcher, guesser, spectator

    return (
        <div className="flex flex-col items-center min-h-screen p-4">
            <div className="w-full max-w-6xl flex justify-between items-start p-4">
                {/* Team A List */}
                <div className={`p-4 rounded-xl border ${currentTurn.team === 'A' ? 'border-neonPurple bg-neonPurple/10' : 'border-white/10 bg-black/30'}`}>
                    <h3 className="text-neonPurple font-bold mb-2">Team A</h3>
                    <ul className="space-y-1">
                        {room.teams.A.map(id => {
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
                            Round {room.stats.currentRound} of {room.settings.rounds}
                        </span>
                    </div>
                    <Scoreboard scores={room.scores} currentTeam={currentTurn.team} />
                    <Timer timeLeft={currentTurn.timeLeft} />
                </div>

                {/* Team B List */}
                <div className={`p-4 rounded-xl border ${currentTurn.team === 'B' ? 'border-neonBlue bg-neonBlue/10' : 'border-white/10 bg-black/30'}`}>
                    <h3 className="text-neonBlue font-bold mb-2">Team B</h3>
                    <ul className="space-y-1">
                        {room.teams.B.map(id => {
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
