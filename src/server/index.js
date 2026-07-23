'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const GameEngine = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 静态文件
app.use(express.static(path.join(__dirname, '..', 'client')));

// 房间管理
const rooms = new Map();

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? genRoomCode() : code;
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerId = null;

  // 创建房间
  socket.on('createRoom', (playerName, cb) => {
    const code = genRoomCode();
    const room = {
      code, hostId: socket.id, players: [], game: null,
      started: false, timer: null,
    };
    const player = { id: socket.id, name: playerName || '玩家1', ready: true };
    room.players.push(player);
    rooms.set(code, room);
    socket.join(code);
    currentRoom = code;
    playerId = socket.id;
    cb && cb({ ok: true, roomCode: code, playerId: socket.id });
    io.to(code).emit('roomUpdate', getRoomInfo(room));
  });

  // 加入房间
  socket.on('joinRoom', (roomCode, playerName, cb) => {
    const room = rooms.get(roomCode);
    if (!room) { cb && cb({ ok: false, msg: '房间不存在' }); return; }
    if (room.started) { cb && cb({ ok: false, msg: '游戏已开始' }); return; }
    if (room.players.length >= 8) { cb && cb({ ok: false, msg: '房间已满' }); return; }
    const player = { id: socket.id, name: playerName || `玩家${room.players.length + 1}`, ready: false };
    room.players.push(player);
    socket.join(roomCode);
    currentRoom = roomCode;
    playerId = socket.id;
    cb && cb({ ok: true, playerId: socket.id });
    io.to(roomCode).emit('roomUpdate', getRoomInfo(room));
  });

  // 准备
  socket.on('toggleReady', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const p = room.players.find(x => x.id === socket.id);
    if (p) { p.ready = !p.ready; io.to(currentRoom).emit('roomUpdate', getRoomInfo(room)); }
  });

  // 开始游戏
  socket.on('startGame', (cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) { cb && cb({ ok: false, msg: '只有房主可以开始' }); return; }
    if (room.players.length < 2) { cb && cb({ ok: false, msg: '至少需要2名玩家' }); return; }
    room.started = true;
    room.game = new GameEngine(currentRoom, room.players.map(p => p.name));
    // 设置玩家ID映射
    room.game.players.forEach((gp, i) => { gp.socketId = room.players[i].id; });
    // 30分钟自动结束
    room.timer = setInterval(() => {
      if (room.game.tick()) {
        clearInterval(room.timer);
        io.to(currentRoom).emit('gameOver', { winner: room.game.winner });
      }
    }, 5000);
    // 开始第一个回合
    room.game.startTurn();
    cb && cb({ ok: true });
    io.to(currentRoom).emit('gameStarted', room.game.getState(null));
    broadcastState(room);
  });

  // 获取游戏状态
  socket.on('getState', (cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    cb && cb(room.game.getState(gp?.id));
  });

  // 掷骰子
  socket.on('rollDice', (data, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.rollDice(gp.id, data?.chosenValue);
    cb && cb(result);
    broadcastState(room);
  });

  // 使用道具
  socket.on('useItem', (data, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.useItem(gp.id, data.itemId, data.targetId);
    cb && cb(result);
    broadcastState(room);
  });

  // 触发事件
  socket.on('triggerEvent', (cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.triggerEvent(gp.id);
    cb && cb(result);
    broadcastState(room);
  });

  // 事件选择
  socket.on('makeChoice', (choiceId, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.makeChoice(gp.id, choiceId);
    cb && cb(result);
    broadcastState(room);
  });

  // 购买道具
  socket.on('buyItem', (data, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.buyItem(gp.id, data.itemId, data.price);
    cb && cb(result);
    broadcastState(room);
  });

  // 攻击Boss
  socket.on('attackBoss', (data, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.attackBoss(gp.id, data.bossId, data.itemIds);
    cb && cb(result);
    broadcastState(room);
  });

  // 发起交易
  socket.on('trade', (data, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const targetGp = room.game.players.find(p => p.socketId === data.targetSocketId);
    if (!targetGp) { cb && cb({ ok: false, msg: '目标不存在' }); return; }
    const result = room.game.createTrade(gp.id, targetGp.id, data.offer || {}, data.request || {});
    cb && cb(result);
    broadcastState(room);
  });

  // 回应交易
  socket.on('respondTrade', (data, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.respondTrade(gp.id, data.tradeId, data.accept);
    cb && cb(result);
    broadcastState(room);
  });

  // 小游戏
  socket.on('miniGameAction', (data, cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.miniGameAction(gp.id, data.action, data);
    cb && cb(result);
    broadcastState(room);
  });

  // 回合结束
  socket.on('endTurn', (cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.endTurn(gp.id);
    cb && cb(result);
    broadcastState(room);
  });

  // 投降
  socket.on('surrender', (cb) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;
    const gp = room.game.players.find(p => p.socketId === socket.id);
    if (!gp) return;
    const result = room.game.surrender(gp.id);
    cb && cb(result);
    broadcastState(room);
  });

  // 断开连接
  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      if (room.timer) clearInterval(room.timer);
      rooms.delete(currentRoom);
    } else {
      // 如果房主离开，转移房主
      if (room.hostId === socket.id) room.hostId = room.players[0].id;
      io.to(currentRoom).emit('roomUpdate', getRoomInfo(room));
      // 游戏中：玩家掉线视为投降
      if (room.game) {
        const gp = room.game.players.find(p => p.socketId === socket.id);
        if (gp && gp.isAlive) { room.game.surrender(gp.id); broadcastState(room); }
      }
    }
  });
});

function getRoomInfo(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
    started: room.started,
  };
}

function broadcastState(room) {
  if (!room.game) return;
  for (const p of room.players) {
    const gp = room.game.players.find(x => x.socketId === p.id);
    io.to(p.id).emit('gameState', room.game.getState(gp?.id));
  }
  if (room.game.gameOver) {
    io.to(room.code).emit('gameOver', { winner: room.game.winner });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎲 不知名冒险家 服务器运行中: http://localhost:${PORT}`);
});
