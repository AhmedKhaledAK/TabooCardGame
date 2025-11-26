import React, { useEffect, useRef } from 'react';

const GameLog = ({ logs }) => {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="fixed bottom-4 left-4 w-80 h-64 bg-black/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden flex flex-col z-30">
            <div className="p-2 bg-white/5 border-b border-white/10">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Game Log</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {logs.map((log) => (
                    <div key={log.id} className="text-sm animate-in fade-in slide-in-from-left-2 duration-200">
                        <span className="text-gray-500 text-xs mr-2">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`
                            ${log.type === 'success' ? 'text-green-400 font-bold' : ''}
                            ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                            ${log.type === 'warning' ? 'text-yellow-400' : ''}
                            ${log.type === 'info' ? 'text-blue-300' : ''}
                        `}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default GameLog;
