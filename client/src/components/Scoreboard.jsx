import React from 'react';

const Scoreboard = ({ scores, currentTeam }) => {
    return (
        <div className="flex space-x-12 mb-8">
            <div className={`flex flex-col items-center p-4 rounded-xl transition-all ${currentTeam === 'A' ? 'bg-white/10 border border-neonPurple' : ''}`}>
                <span className="text-sm text-gray-400 uppercase tracking-wider">Team A</span>
                <span className="text-4xl font-black text-neonPurple">{scores?.A || 0}</span>
            </div>
            <div className={`flex flex-col items-center p-4 rounded-xl transition-all ${currentTeam === 'B' ? 'bg-white/10 border border-neonBlue' : ''}`}>
                <span className="text-sm text-gray-400 uppercase tracking-wider">Team B</span>
                <span className="text-4xl font-black text-neonBlue">{scores?.B || 0}</span>
            </div>
        </div>
    );
};

export default Scoreboard;
