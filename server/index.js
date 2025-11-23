const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"]
    }
});

// Load cards
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf8'));

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(hostId, hostName) {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.rooms.set(roomId, {
            id: roomId,
            players: [{ id: hostId, name: hostName, team: null, role: 'spectator' }],
            gameState: 'lobby', // lobby, playing, ended
            teams: { A: [], B: [] },
            scores: { A: 0, B: 0 },
            currentTurn: {
                team: 'A', // A or B
                describer: null,
                watcher: null,
                card: null,
                timeLeft: 60,
                timer: null
            },
            settings: {
                turnDuration: 60,
                winningScore: 30
            }
        });
        return roomId;
    }

    joinRoom(roomId, playerId, playerName) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        // Check if player already exists (reconnect)
        const existingPlayer = room.players.find(p => p.id === playerId);
        if (existingPlayer) {
            existingPlayer.name = playerName; // Update name
            return room;
        }

        room.players.push({ id: playerId, name: playerName, team: null, role: 'spectator' });
        return room;
    }

    joinTeam(roomId, playerId, team) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const player = room.players.find(p => p.id === playerId);
        if (player) {
            // Remove from old team
            if (player.team) {
                room.teams[player.team] = room.teams[player.team].filter(id => id !== playerId);
            }
            // Add to new team
            player.team = team;
            room.teams[team].push(playerId);
        }
        return room;
    }

    startGame(roomId) {
        console.log(`Attempting to start game for room ${roomId}`);
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log('Room not found');
            return null;
        }

        console.log('Team A count:', room.teams.A.length);
        console.log('Team B count:', room.teams.B.length);

        if (room.teams.A.length < 1 || room.teams.B.length < 1) {
            console.log('Not enough players on teams');
            return null;
        }

        room.gameState = 'playing';
        room.scores = { A: 0, B: 0 };
        room.currentTurn.team = 'A'; // Team A starts
        this.startTurn(roomId);
        return room;
    }

    startTurn(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const currentTeam = room.currentTurn.team;
        const opposingTeam = currentTeam === 'A' ? 'B' : 'A';

        // Select Describer (rotate through team)
        // For simplicity, pick random for now, or sequential if we tracked it.
        // Let's just pick random from the current team.
        const teamPlayers = room.teams[currentTeam];
        const describerId = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];

        // Select Watcher (from opposing team)
        const opposingPlayers = room.teams[opposingTeam];
        const watcherId = opposingPlayers[Math.floor(Math.random() * opposingPlayers.length)];

        // Pick a random card
        const card = cards[Math.floor(Math.random() * cards.length)];

        room.currentTurn.describer = describerId;
        room.currentTurn.watcher = watcherId;
        room.currentTurn.card = card;
        room.currentTurn.timeLeft = room.settings.turnDuration;

        // Update roles for all players
        room.players.forEach(p => {
            if (p.id === describerId) p.role = 'describer';
            else if (p.id === watcherId) p.role = 'watcher';
            else if (p.team === currentTeam) p.role = 'guesser';
            else p.role = 'spectator';
        });

        // Start Timer
        if (room.currentTurn.timer) clearInterval(room.currentTurn.timer);
        room.currentTurn.timer = setInterval(() => {
            room.currentTurn.timeLeft--;
            io.to(roomId).emit('timer_update', room.currentTurn.timeLeft);

            if (room.currentTurn.timeLeft <= 0) {
                this.endTurn(roomId);
            }
        }, 1000);

        this.emitRoomUpdate(roomId, room);
    }

    emitRoomUpdate(roomId, room) {
        // Create a copy without the timer object to avoid circular references
        const roomToSend = {
            ...room,
            currentTurn: {
                ...room.currentTurn,
                timer: null // Do not send the timer object
            }
        };
        io.to(roomId).emit('room_update', roomToSend);
    }

    endTurn(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (room.currentTurn.timer) clearInterval(room.currentTurn.timer);

        // Switch teams
        room.currentTurn.team = room.currentTurn.team === 'A' ? 'B' : 'A';
        this.startTurn(roomId); // Start next turn immediately
    }

    handleAction(roomId, action) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (action === 'success') {
            room.scores[room.currentTurn.team]++;
            // New card? Or end turn? Usually new card in same turn until time runs out.
            // Taboo rules: as many cards as possible in 60s.
            // So we pick a new card.
            const card = cards[Math.floor(Math.random() * cards.length)];
            room.currentTurn.card = card;
            this.emitRoomUpdate(roomId, room);
            io.to(roomId).emit('action_feedback', { type: 'success' });
        } else if (action === 'buzz') {
            // Penalty? Or just stop?
            // Usually skip or -1. Let's do -1 and new card.
            // Or just stop the card.
            // User said: "Stops the card, subtracts a point (or awards none)"
            // Let's subtract 1 point and get new card.
            room.scores[room.currentTurn.team] = Math.max(0, room.scores[room.currentTurn.team] - 1);
            const card = cards[Math.floor(Math.random() * cards.length)];
            room.currentTurn.card = card;
            this.emitRoomUpdate(roomId, room);
            io.to(roomId).emit('action_feedback', { type: 'buzz' });
        } else if (action === 'skip') {
            // 0 points, new card
            const card = cards[Math.floor(Math.random() * cards.length)];
            room.currentTurn.card = card;
            this.emitRoomUpdate(roomId, room);
        }
    }

    disconnect(socketId) {
        // Handle disconnect if needed (remove player, etc)
        // For now, we keep them in the room in case of reconnect
    }
}

const roomManager = new RoomManager();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ playerName }) => {
        console.log(`Received create_room from ${socket.id} (${playerName})`);
        const roomId = roomManager.createRoom(socket.id, playerName);
        socket.join(roomId);
        socket.emit('room_created', roomId);
        roomManager.emitRoomUpdate(roomId, roomManager.rooms.get(roomId));
    });

    socket.on('join_room', ({ roomId, playerName }) => {
        console.log(`Received join_room request from ${socket.id} for room ${roomId}`);
        const room = roomManager.joinRoom(roomId, socket.id, playerName);
        if (room) {
            socket.join(roomId);
            const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
            console.log(`Socket ${socket.id} joined room ${roomId}. Total sockets in room: ${roomSize}`);

            roomManager.emitRoomUpdate(roomId, room);
            console.log(`Emitted room_update to room ${roomId}`);
        } else {
            console.log(`Room ${roomId} not found for join request`);
            socket.emit('error', 'Room not found');
        }
    });

    socket.on('join_team', ({ roomId, team }) => {
        const room = roomManager.joinTeam(roomId, socket.id, team);
        if (room) {
            roomManager.emitRoomUpdate(roomId, room);
        }
    });

    socket.on('start_game', ({ roomId }) => {
        console.log(`Received start_game event for room ${roomId} from ${socket.id}`);
        const room = roomManager.startGame(roomId);
        if (room) {
            // startGame calls startTurn which calls emitRoomUpdate, so we might not need this, 
            // but startGame returns room, and we might want to emit it.
            // However, startTurn already emits it.
            // Let's check startGame implementation.
            // startGame calls startTurn. startTurn calls emitRoomUpdate.
            // So we don't need to emit here again, OR we should use the safe emit.
            // Let's use safe emit to be sure.
            roomManager.emitRoomUpdate(roomId, room);
        } else {
            console.log('Failed to start game');
            socket.emit('error', 'Failed to start game: Room not found or not enough players');
        }
    });

    socket.on('game_action', ({ roomId, action }) => {
        roomManager.handleAction(roomId, action);
    });

    socket.on('debug_ack', (data) => {
        console.log(`ACK from ${socket.id}:`, data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        roomManager.disconnect(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
