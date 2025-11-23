import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

// Connect to backend
const socket = io('http://localhost:3001');

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [playerId, setPlayerId] = useState(socket.id);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setPlayerId(socket.id);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomCreated(id) {
      setRoomId(id);
    }

    function onRoomUpdate(room) {
      console.log('Received room_update:', room);
      socket.emit('debug_ack', { type: 'room_update', roomId: room.id });
      setRoomData(room);
      // If we just joined via code, set roomId
      if (room.id !== roomId) setRoomId(room.id);
    }

    function onTimerUpdate(timeLeft) {
      setRoomData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentTurn: {
            ...prev.currentTurn,
            timeLeft: timeLeft
          }
        };
      });
    }

    function onError(msg) {
      alert(msg);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_created', onRoomCreated);
    socket.on('room_update', onRoomUpdate);
    socket.on('timer_update', onTimerUpdate);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_created', onRoomCreated);
      socket.off('room_update', onRoomUpdate);
      socket.off('timer_update', onTimerUpdate);
      socket.off('error', onError);
    };
  }, [roomId]);

  const handleCreateRoom = (playerName, settings) => {
    console.log('Creating room for:', playerName, 'with settings:', settings);
    if (!socket.connected) {
      console.error('Socket not connected!');
      alert('Cannot create room: Server not connected');
      return;
    }
    socket.emit('create_room', { playerName, settings });
  };

  const handleJoinRoom = (code, playerName) => {
    socket.emit('join_room', { roomId: code, playerName });
  };

  const handleJoinTeam = (team) => {
    socket.emit('join_team', { roomId, team });
  };

  const handleStartGame = () => {
    socket.emit('start_game', { roomId });
  };

  const handleGameAction = (action) => {
    socket.emit('game_action', { roomId, action });
  };

  if (!roomData) {
    return <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  return (
    <GameRoom
      room={roomData}
      playerId={playerId || socket.id}
      onJoinTeam={handleJoinTeam}
      onStartGame={handleStartGame}
      onAction={handleGameAction}
    />
  );
}

export default App;
