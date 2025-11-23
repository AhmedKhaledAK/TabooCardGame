import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ card, isFlipped }) => {
    return (
        <div className="relative w-80 h-96 perspective-1000">
            <motion.div
                className="w-full h-full relative preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Front (Back of card) */}
                <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-neonPurple to-neonBlue rounded-2xl shadow-[0_0_30px_rgba(176,38,255,0.3)] flex items-center justify-center border border-white/20">
                    <div className="text-4xl font-bold text-white tracking-widest opacity-80">TABOO</div>
                </div>

                {/* Back (Face of card) */}
                <div
                    className="absolute w-full h-full backface-hidden bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
                    style={{ transform: 'rotateY(180deg)' }}
                >
                    <div className="bg-neonPurple p-6 text-center">
                        <h2 className="text-3xl font-black text-white uppercase tracking-wider">{card?.word}</h2>
                    </div>
                    <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-4 bg-white">
                        {card?.taboo.map((word, index) => (
                            <div key={index} className="text-xl font-bold text-gray-800 uppercase tracking-wide border-b-2 border-gray-100 w-full text-center pb-1">
                                {word}
                            </div>
                        ))}
                    </div>
                    <div className="h-4 bg-neonBlue"></div>
                </div>
            </motion.div>
        </div>
    );
};

export default Card;
