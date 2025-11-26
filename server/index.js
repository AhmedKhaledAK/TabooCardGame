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

    createRoom(hostId, hostName, settings = {}) {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const defaultSettings = {
            rounds: 3,
            timer: 60
        };

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
                timeLeft: settings.timer || defaultSettings.timer,
                watcher: null,
                card: null,
                timeLeft: settings.timer || defaultSettings.timer,
                timer: null,
                skipsUsed: 0
            },
            settings: {
                rounds: settings.rounds || defaultSettings.rounds,
                turnDuration: settings.timer || defaultSettings.timer,
                winningScore: 30 // Legacy, maybe remove?
            },
            stats: {
                currentRound: 1,
                turnsPlayed: 0
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

        room.gameState = 'waiting_for_turn';
        room.scores = { A: 0, B: 0 };
        room.currentTurn.team = 'A'; // Team A starts

        // Calculate target turns per team
        // To ensure fairness, both teams play the same number of turns.
        // This number is based on the larger team size * rounds.
        const maxTeamSize = Math.max(room.teams.A.length, room.teams.B.length);

        room.stats.maxTeamSize = maxTeamSize; // Store for round calculation
        room.stats.targetTurnsPerTeam = maxTeamSize * room.settings.rounds;
        room.stats.turnsPlayedA = 0;
        room.stats.turnsPlayedB = 0;

        this.startTurn(roomId);
        return room;
    }

    startTurn(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // Check if game should end
        if (room.stats.turnsPlayedA >= room.stats.targetTurnsPerTeam &&
            room.stats.turnsPlayedB >= room.stats.targetTurnsPerTeam) {
            this.endGame(roomId);
            return;
        }

        const currentTeam = room.currentTurn.team;
        const opposingTeam = currentTeam === 'A' ? 'B' : 'A';

        // Select Describer (rotate through team)
        const teamPlayers = room.teams[currentTeam];
        const turnsPlayedByTeam = currentTeam === 'A' ? room.stats.turnsPlayedA : room.stats.turnsPlayedB;
        const describerId = teamPlayers[turnsPlayedByTeam % teamPlayers.length];

        // Select Watcher (from opposing team)
        const opposingPlayers = room.teams[opposingTeam];
        const turnsPlayedByOpposing = currentTeam === 'A' ? room.stats.turnsPlayedB : room.stats.turnsPlayedA;
        const watcherId = opposingPlayers[turnsPlayedByOpposing % opposingPlayers.length];

        // Pick a random card
        const card = cards[Math.floor(Math.random() * cards.length)];

        room.currentTurn.describer = describerId;
        room.currentTurn.watcher = watcherId;
        room.currentTurn.card = card;
        room.currentTurn.timeLeft = room.settings.turnDuration;
        room.currentTurn.skipsUsed = 0;

        // Set state to waiting_for_turn
        room.gameState = 'waiting_for_turn';

        // Update roles for all players
        room.players.forEach(p => {
            if (p.id === describerId) p.role = 'describer';
            else if (p.id === watcherId) p.role = 'watcher';
            else if (p.team === currentTeam) p.role = 'guesser';
            else p.role = 'spectator';
        });

        // Clear any existing timer
        if (room.currentTurn.timer) clearInterval(room.currentTurn.timer);

        this.emitRoomUpdate(roomId, room);
    }

    confirmStartTurn(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.gameState !== 'waiting_for_turn') return;

        room.gameState = 'resuming'; // Using 'resuming' for countdown state
        let countdown = 5;

        // Emit initial countdown
        io.to(roomId).emit('countdown_update', countdown);
        this.emitRoomUpdate(roomId, room);

        const countdownInterval = setInterval(() => {
            countdown--;
            io.to(roomId).emit('countdown_update', countdown);

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.startTurnTimer(roomId);
            }
        }, 1000);
    }

    startTurnTimer(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.gameState = 'playing';
        this.emitRoomUpdate(roomId, room);

        if (room.currentTurn.timer) clearInterval(room.currentTurn.timer);
        room.currentTurn.timer = setInterval(() => {
            room.currentTurn.timeLeft--;
            io.to(roomId).emit('timer_update', room.currentTurn.timeLeft);

            if (room.currentTurn.timeLeft <= 0) {
                this.endTurn(roomId);
            }
        }, 1000);
    }

    resetGame(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // Clear any existing timer immediately
        if (room.currentTurn.timer) {
            clearInterval(room.currentTurn.timer);
        }

        room.gameState = 'lobby';
        room.scores = { A: 0, B: 0 };
        room.stats = {
            currentRound: 1,
            turnsPlayedA: 0,
            turnsPlayedB: 0,
            targetTurnsPerTeam: 0
        };
        room.currentTurn = {
            team: 'A',
            describer: null,
            watcher: null,
            card: null,
            timeLeft: room.settings.turnDuration,
            timeLeft: room.settings.turnDuration,
            timer: null,
            skipsUsed: 0
        };

        // Reset roles
        room.players.forEach(p => p.role = 'spectator');

        this.emitRoomUpdate(roomId, room);
    }

    shuffleTeams(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.gameState !== 'lobby') return;

        // Get all players
        const allPlayers = [...room.players];

        // Fisher-Yates Shuffle
        for (let i = allPlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
        }

        // Split into two teams
        const mid = Math.ceil(allPlayers.length / 2);
        const teamA = allPlayers.slice(0, mid);
        const teamB = allPlayers.slice(mid);

        room.teams.A = teamA.map(p => p.id);
        room.teams.B = teamB.map(p => p.id);

        // Update player objects
        teamA.forEach(p => p.team = 'A');
        teamB.forEach(p => p.team = 'B');

        this.emitRoomUpdate(roomId, room);
    }

    updateSettings(roomId, settings) {
        const room = this.rooms.get(roomId);
        if (!room || room.gameState !== 'lobby') return;

        if (settings.rounds) {
            room.settings.rounds = parseInt(settings.rounds) || 3;
        }
        if (settings.timer) {
            room.settings.turnDuration = parseInt(settings.timer) || 60;
            room.currentTurn.timeLeft = room.settings.turnDuration;
        }

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

        // Increment stats for the team that just played
        if (room.currentTurn.team === 'A') {
            room.stats.turnsPlayedA++;
        } else {
            room.stats.turnsPlayedB++;
        }

        // Check for Round Completion
        // A round is complete when both teams have played 'maxTeamSize' turns.
        // We check if turnsPlayedA and turnsPlayedB are equal AND multiples of maxTeamSize.
        // AND we are not at the end of the game (which is checked in startTurn, but we can check here too to be safe/clear).

        const turnsA = room.stats.turnsPlayedA;
        const turnsB = room.stats.turnsPlayedB;
        const maxTeamSize = room.stats.maxTeamSize;
        const targetTurns = room.stats.targetTurnsPerTeam;

        // Update current round display
        const minTurns = Math.min(turnsA, turnsB);
        room.stats.currentRound = Math.floor(minTurns / maxTeamSize) + 1;

        // Check if Game Over first
        if (turnsA >= targetTurns && turnsB >= targetTurns) {
            this.endGame(roomId);
            return;
        }

        // Check if Round Ended
        // Condition: Both teams played equal turns, and that number is a multiple of team size.
        // And we are not at the very start (turns > 0).
        if (turnsA === turnsB && turnsA > 0 && turnsA % maxTeamSize === 0) {
            room.gameState = 'round_ended';
            room.currentTurn.card = null; // Hide card
            this.emitRoomUpdate(roomId, room);
            return;
        }

        // Switch teams
        room.currentTurn.team = room.currentTurn.team === 'A' ? 'B' : 'A';
        this.startTurn(roomId); // Start next turn immediately
    }

    startNextRound(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.gameState !== 'round_ended') return;

        // Switch teams for the new round?
        // Usually in Taboo, turns just alternate.
        // So we just continue. The team switch happens in endTurn normally.
        // But we returned early in endTurn, so we didn't switch teams yet.
        // Wait, if Team A played last to finish the round, we should switch to Team B.
        // Let's check who played last.
        // Actually, endTurn increments stats for the team that just played.
        // So room.currentTurn.team is still the team that just played.
        // So we need to switch it.

        room.currentTurn.team = room.currentTurn.team === 'A' ? 'B' : 'A';

        // Start the turn
        this.startTurn(roomId);
    }

    endGame(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (room.currentTurn.timer) {
            clearInterval(room.currentTurn.timer);
        }

        room.gameState = 'ended';
        room.currentTurn.card = null;
        room.currentTurn.describer = null;
        room.currentTurn.watcher = null;

        this.emitRoomUpdate(roomId, room);
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
            // Penalty: -1 point
            room.scores[room.currentTurn.team]--;
            const card = cards[Math.floor(Math.random() * cards.length)];
            room.currentTurn.card = card;
            this.emitRoomUpdate(roomId, room);
            io.to(roomId).emit('action_feedback', { type: 'buzz' });
        } else if (action === 'skip') {
            // First skip is free, subsequent skips cost -1
            if (room.currentTurn.skipsUsed > 0) {
                room.scores[room.currentTurn.team]--;
            }
            room.currentTurn.skipsUsed++;

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

    socket.on('create_room', ({ playerName, settings }) => {
        console.log(`Received create_room from ${socket.id} (${playerName}) with settings:`, settings);
        const roomId = roomManager.createRoom(socket.id, playerName, settings);
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

    socket.on('confirm_start_turn', ({ roomId }) => {
        roomManager.confirmStartTurn(roomId);
    });

    socket.on('reset_game', ({ roomId }) => {
        roomManager.resetGame(roomId);
    });

    socket.on('shuffle_teams', ({ roomId }) => {
        roomManager.shuffleTeams(roomId);
    });

    socket.on('update_settings', ({ roomId, settings }) => {
        roomManager.updateSettings(roomId, settings);
    });

    socket.on('start_next_round', ({ roomId }) => {
        roomManager.startNextRound(roomId);
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
