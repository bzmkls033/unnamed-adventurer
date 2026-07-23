'use strict';
// ═══════════════════════════════════════════
// 不知名冒险家 - 客户端 (修复版)
// ═══════════════════════════════════════════

const socket = io();
let myPlayerId = null;
let currentRoomCode = null;
let gameState = null;
let isMyTurn = false;
let timerInterval = null;
let myPlayerIndex = -1;

const TILE_EMOJI = {
  gold:'💰', item:'🎁', heal:'❤️', empty:'⬜', mystery:'❓',
  shop:'🏪', minigame:'🎮', boss:'👹', collection:'💎', asset:'🪙'
};

const ITEM_INFO = {
  bandage:      { name:'绷带',       desc:'恢复1生命',     type:'回复', rarity:'普通' },
  medkit:       { name:'医疗箱',     desc:'恢复3生命',     type:'回复', rarity:'稀有' },
  revive:       { name:'复活药',     desc:'濒死恢复2生命', type:'回复', rarity:'史诗' },
  antidote:     { name:'解毒剂',     desc:'解除负面状态',  type:'回复', rarity:'普通' },
  ironShield:   { name:'铁盾',       desc:'抵挡一次攻击',  type:'防具', rarity:'普通' },
  magicShield:  { name:'魔法护盾',   desc:'减少一次伤害',  type:'防具', rarity:'稀有' },
  thornArmor:   { name:'反伤甲',     desc:'反弹1伤害',     type:'防具', rarity:'稀有' },
  luckyCharm:   { name:'幸运护符',   desc:'抵挡致命效果',  type:'防具', rarity:'史诗' },
  reroll:       { name:'重掷券',     desc:'重新掷骰',      type:'一次性', rarity:'普通' },
  doubleDice:   { name:'双倍骰',     desc:'移动距离×2',    type:'一次性', rarity:'稀有' },
  teleport:     { name:'传送卷轴',   desc:'传送到指定位置', type:'一次性', rarity:'史诗' },
  chestKey:     { name:'宝箱钥匙',   desc:'提高宝箱品质',  type:'一次性', rarity:'稀有' },
  timeHourglass:{ name:'时间沙漏',   desc:'额外回合',      type:'世界道具', rarity:'传奇' },
  worldFreeze:  { name:'世界冻结',   desc:'冻结其他玩家',  type:'世界道具', rarity:'传奇' },
  fateSwap:     { name:'命运交换',   desc:'交换全部资产',  type:'世界道具', rarity:'传奇' },
  godDice:      { name:'神之骰',     desc:'指定骰子点数',  type:'世界道具', rarity:'传奇' },
  wealthScale:  { name:'财富天平',   desc:'交换金币',      type:'世界道具', rarity:'传奇' },
  banana:       { name:'香蕉皮',     desc:'目标移动失败',  type:'整蛊', rarity:'普通' },
  mine:         { name:'地雷',       desc:'目标扣1生命',   type:'整蛊', rarity:'稀有' },
  freezeCard:   { name:'冰冻卡',     desc:'目标无法用道具', type:'整蛊', rarity:'稀有' },
  stealCard:    { name:'偷窃卡',     desc:'偷取目标道具',  type:'整蛊', rarity:'稀有' },
  knife:        { name:'飞刀',       desc:'造成1伤害',     type:'攻击', rarity:'普通' },
  fireBomb:     { name:'火焰炸弹',   desc:'造成2伤害',     type:'攻击', rarity:'稀有' },
  poison:       { name:'毒药',       desc:'持续掉血',      type:'攻击', rarity:'稀有' },
  dragonCannon: { name:'巨龙炮',     desc:'造成5伤害',     type:'攻击', rarity:'传奇' },
};

const SHOP_ITEMS = [
  { id:'bandage', price:200 },
  { id:'medkit', price:800 },
  { id:'reroll', price:200 },
  { id:'doubleDice', price:400 },
  { id:'ironShield', price:300 },
  { id:'magicShield', price:500 },
  { id:'knife', price:150 },
  { id:'fireBomb', price:400 },
  { id:'antidote', price:150 },
  { id:'chestKey', price:300 },
];

// ── 屏幕管理 ──
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// ── Toast ──
function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── 弹窗 ──
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
window.closeModal = closeModal;

// ── 工具 ──
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function getItemName(id) { return ITEM_INFO[id]?.name || id; }
function getItemInfo(id) { return ITEM_INFO[id] || { name:id, desc:'', type:'道具', rarity:'普通' }; }

// ══════════════════════════════════════
// 主页
// ══════════════════════════════════════
document.getElementById('btn-create').onclick = () => {
  const name = document.getElementById('playerName').value.trim() || '冒险家';
  socket.emit('createRoom', name, (res) => {
    if (res.ok) { myPlayerId = res.playerId; currentRoomCode = res.roomCode; showScreen('lobby'); }
    else toast(res.msg || '创建失败');
  });
};

document.getElementById('btn-join').onclick = () => {
  const name = document.getElementById('playerName').value.trim() || '冒险家';
  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (!code) { toast('请输入房间号'); return; }
  socket.emit('joinRoom', code, name, (res) => {
    if (res.ok) { myPlayerId = res.playerId; currentRoomCode = code; showScreen('lobby'); }
    else toast(res.msg || '加入失败');
  });
};

// ══════════════════════════════════════
// 大厅
// ══════════════════════════════════════
socket.on('roomUpdate', (room) => {
  document.getElementById('lobby-code').textContent = room.code;
  const container = document.getElementById('lobby-players');
  container.innerHTML = room.players.map(p =>
    `<div class="player-card ${p.ready ? 'ready' : ''}">
      <div class="name">${esc(p.name)}</div>
      <div class="status">${p.ready ? '✅ 已准备' : '⏳ 等待中'}</div>
    </div>`
  ).join('');
  const startBtn = document.getElementById('btn-start');
  startBtn.style.display = room.hostId === myPlayerId ? 'block' : 'none';
  startBtn.disabled = room.players.length < 2;
});

document.getElementById('btn-ready').onclick = () => socket.emit('toggleReady');
document.getElementById('btn-start').onclick = () => {
  socket.emit('startGame', (res) => {
    if (!res.ok) toast(res.msg);
  });
};

// 离开房间
document.getElementById('btn-leave').onclick = () => {
  socket.disconnect();
  socket.connect();
  myPlayerId = null;
  currentRoomCode = null;
  gameState = null;
  showScreen('home');
};

// ══════════════════════════════════════
// 游戏状态同步
// ══════════════════════════════════════
socket.on('gameStarted', (state) => {
  showScreen('game');
  gameState = state;
  findMyIndex();
  renderGame();
  startTimer(state.timeLeft);
});

socket.on('gameState', (state) => {
  gameState = state;
  findMyIndex();
  renderGame();
});

socket.on('gameOver', (data) => {
  document.getElementById('gameover-winner').textContent = data.winner ? `${data.winner.name} 获得胜利！` : '平局！';
  openModal('modal-gameover');
});

function findMyIndex() {
  if (!gameState) return;
  // 通过socketId匹配
  myPlayerIndex = gameState.players.findIndex(p => p.id === myPlayerId || p.socketId === myPlayerId);
  if (myPlayerIndex < 0) myPlayerIndex = 0;
}

// ── 定时器 ──
function startTimer(ms) {
  if (timerInterval) clearInterval(timerInterval);
  const startTime = Date.now();
  const totalMs = ms || 30 * 60 * 1000;
  timerInterval = setInterval(() => {
    const left = Math.max(0, totalMs - (Date.now() - startTime));
    const min = Math.floor(left / 60000);
    const sec = Math.floor((left % 60000) / 1000);
    document.getElementById('timer').textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }, 1000);
}

// ══════════════════════════════════════
// 渲染游戏
// ══════════════════════════════════════
function renderGame() {
  if (!gameState) return;
  const state = gameState;
  const me = state.players[myPlayerIndex];
  const currentP = state.players[state.currentTurn];
  isMyTurn = currentP && myPlayerIndex === state.currentTurn;

  // 世界规则
  document.getElementById('world-rule').textContent = `🌍 ${state.worldRule.name}: ${state.worldRule.desc}`;
  // 回合信息
  document.getElementById('turn-info').textContent = currentP ? `回合: ${currentP.name}` : '';
  const phaseNames = { beforeMove: '掷骰阶段', event: '事件阶段', start: '准备中' };
  document.getElementById('phase-info').textContent = isMyTurn ? `【${phaseNames[state.turnPhase] || ''}】` : '';

  // 渲染玩家面板
  renderPlayerPanel(state);
  // 渲染地图
  renderBoard(state);
  // 渲染日志
  renderLog(state);
  // 更新按钮状态
  updateButtons(state);
  // 检查事件弹窗
  checkEventModal(state);
}

function renderPlayerPanel(state) {
  const panel = document.getElementById('player-panel');
  panel.innerHTML = state.players.map((p, i) => {
    const isCurrent = i === state.currentTurn;
    const isDead = !p.isAlive || p.surrendered;
    const hpPct = Math.max(0, (p.hp / (p.maxHp || 5)) * 100);
    const hpClass = hpPct <= 40 ? 'low' : '';
    const isMe = i === myPlayerIndex;
    const items = Array.isArray(p.items) ? p.items : [];
    const assets = Array.isArray(p.assets) ? p.assets : [];
    return `<div class="player-panel-card ${isCurrent ? 'current' : ''} ${isDead ? 'dead' : ''}">
      <div class="pp-name" style="color:${p.color}">${isMe ? '👤 ' : ''}${esc(p.name)}${isDead ? ' 💀' : ''}</div>
      <div class="pp-stats">
        <span>❤️ ${p.hp}/${p.maxHp||5}</span>
        <span>💰 ${p.gold}</span>
      </div>
      <div class="hp-bar"><div class="hp-bar-fill ${hpClass}" style="width:${hpPct}%;background:${p.color}"></div></div>
      ${isMe ? `<div class="pp-stats" style="margin-top:4px"><span>🎁${items.length}道具</span><span>🪙${assets.length}资产</span><span>📍格子${p.position}</span></div>` : ''}
    </div>`;
  }).join('');
}

// ── 地图渲染：螺旋形路线 ──
function renderBoard(state) {
  const board = document.getElementById('game-board');
  const mainTiles = state.map.filter(t => !t.branchId).sort((a, b) => a.position - b.position);
  const branchTiles = state.map.filter(t => t.branchId);

  const total = mainTiles.length;
  // 螺旋布局参数
  const tileSize = 48;
  const gap = 6;
  const step = tileSize + gap;
  const centerX = 500;
  const centerY = 500;

  // 计算螺旋坐标
  const positions = [];
  let angle = 0;
  let radius = 120;
  const angleStep = (2 * Math.PI) / Math.min(total, 16);
  const radiusStep = (total > 16) ? 22 : 0;

  for (let i = 0; i < total; i++) {
    if (i > 0 && i % 16 === 0) {
      angle += angleStep * 0.5; // 间隙
    }
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    positions.push({ x, y });
    angle += angleStep;
    radius += radiusStep;
  }

  const boardWidth = 1000;
  const boardHeight = 1000;

  let html = `<div class="board-canvas" style="position:relative;width:${boardWidth}px;height:${boardHeight}px">`;

  // 画连接线
  for (let i = 0; i < mainTiles.length - 1; i++) {
    const from = positions[i];
    const to = positions[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    html += `<div class="board-line" style="left:${from.x + tileSize/2}px;top:${from.y + tileSize/2}px;width:${len}px;transform:rotate(${angleDeg}deg)"></div>`;
  }
  // 闭合：最后连回第一个
  {
    const from = positions[total - 1];
    const to = positions[0];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    html += `<div class="board-line" style="left:${from.x + tileSize/2}px;top:${from.y + tileSize/2}px;width:${len}px;transform:rotate(${angleDeg}deg);opacity:0.5"></div>`;
  }

  // 画主线格子
  mainTiles.forEach((tile, i) => {
    const pos = positions[i];
    const emoji = TILE_EMOJI[tile.type] || '⬜';
    const playersHere = state.players.filter((p) => p.position === tile.id);
    const isCurrentTile = playersHere.some(p => state.players.indexOf(p) === state.currentTurn);

    let playerDots = playersHere.map(p => {
      const isMe = state.players.indexOf(p) === myPlayerIndex;
      return `<span style="position:absolute;width:14px;height:14px;border-radius:50%;background:${p.color};border:2px solid #fff;bottom:-4px;right:${isMe ? '-4px' : '8px'};z-index:25;box-shadow:0 0 6px ${p.color}"></span>`;
    }).join('');

    html += `<div class="tile type-${tile.type} ${isCurrentTile ? 'tile-current' : ''}" style="left:${pos.x}px;top:${pos.y}px" title="[${tile.type}] 格子#${tile.id}">
      ${emoji}${playerDots}
    </div>`;
  });

  // 画分支格子
  const branchGroups = {};
  branchTiles.forEach(t => {
    if (!branchGroups[t.branchId]) branchGroups[t.branchId] = [];
    branchGroups[t.branchId].push(t);
  });

  Object.entries(branchGroups).forEach(([bid, tiles]) => {
    tiles.sort((a, b) => a.position - b.position);
    // 找到分支入口
    const firstBranchTile = tiles[0];
    const entryMain = mainTiles.find(mt => mt.nextTileIds?.includes(firstBranchTile.id));
    if (!entryMain) return;
    const entryIdx = mainTiles.indexOf(entryMain);
    const basePos = positions[entryIdx];

    tiles.forEach((tile, i) => {
      const bx = basePos.x + (i + 1) * 50 + 20;
      const by = basePos.y + 40;
      const emoji = TILE_EMOJI[tile.type] || '⬜';
      const playersHere = state.players.filter(p => p.position === tile.id);
      const playerDots = playersHere.map(p =>
        `<span style="position:absolute;width:12px;height:12px;border-radius:50%;background:${p.color};border:2px solid #fff;bottom:-3px;right:-3px;z-index:25"></span>`
      ).join('');

      html += `<div class="tile type-${tile.type} branch" style="left:${bx}px;top:${by}px;width:40px;height:40px;font-size:16px" title="[分支] ${tile.type}">
        ${emoji}${playerDots}
      </div>`;
    });

    // 分支连线
    const from = { x: basePos.x + tileSize / 2, y: basePos.y + tileSize / 2 };
    const to = { x: basePos.x + 50 + 20 + 20, y: basePos.y + 40 + 20 };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    html += `<div class="board-line" style="left:${from.x}px;top:${from.y}px;width:${len}px;transform:rotate(${angleDeg}deg);background:rgba(255,215,0,0.3)"></div>`;
  });

  html += '</div>';
  board.innerHTML = html;

  // 滚动到当前玩家位置
  const me = state.players[myPlayerIndex];
  if (me) {
    const currentTileIdx = mainTiles.findIndex(t => t.id === me.position);
    if (currentTileIdx >= 0 && positions[currentTileIdx]) {
      const pos = positions[currentTileIdx];
      board.scrollLeft = pos.x - board.clientWidth / 2;
      board.scrollTop = pos.y - board.clientHeight / 2;
    }
  }
}

function renderLog(state) {
  const log = document.getElementById('game-log');
  log.innerHTML = (state.log || []).map(l => `<div class="log-entry">${esc(l.msg)}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

function updateButtons(state) {
  const me = state.players[myPlayerIndex];
  const myTurn = myPlayerIndex === state.currentTurn;
  const phase = state.turnPhase;
  const alive = me && me.isAlive && !me.surrendered;

  document.getElementById('btn-roll').disabled = !(myTurn && phase === 'beforeMove' && alive);
  document.getElementById('btn-use-item').disabled = !(alive);
  document.getElementById('btn-trigger').disabled = !(myTurn && phase === 'event' && !state.pendingEvent && alive);
  document.getElementById('btn-end-turn').disabled = !(myTurn && phase === 'event' && !state.pendingEvent && alive);
  document.getElementById('btn-surrender').disabled = !alive;
  document.getElementById('btn-shop').disabled = !alive;
  document.getElementById('btn-trade').disabled = !alive;
}

// ── 事件弹窗 ──
function checkEventModal(state) {
  const me = state.players[myPlayerIndex];
  if (state.pendingEvent && me && state.pendingEvent.playerId === me.id) {
    const ev = state.pendingEvent.event;
    document.getElementById('event-title').textContent = ev.name;
    document.getElementById('event-desc').textContent = ev.desc;
    const choicesDiv = document.getElementById('event-choices');
    choicesDiv.innerHTML = ev.choices.map(c => {
      const requires = c.requires ? ` [需要: ${getItemName(c.requires)}]` : '';
      return `<button class="choice-btn" onclick="makeChoice('${c.id}')">${c.label}${requires}</button>`;
    }).join('');
    openModal('modal-event');
  } else if (!state.pendingEvent) {
    closeModal('modal-event');
  }
}

// ══════════════════════════════════════
// 掷骰子
// ══════════════════════════════════════
document.getElementById('btn-roll').onclick = () => {
  socket.emit('rollDice', {}, (res) => {
    if (res.ok) {
      if (res.stunned) { toast('你被眩晕了，无法移动！'); return; }
      toast(`🎲 掷出 ${res.dice}！移动${res.moveSteps}格`, 'gold');
    } else toast(res.msg);
  });
};

// ══════════════════════════════════════
// 背包 - 使用道具
// ══════════════════════════════════════
document.getElementById('btn-use-item').onclick = () => {
  if (!gameState) return;
  const me = gameState.players[myPlayerIndex];
  if (!me) return;
  renderInventory(me);
  openModal('modal-inventory');
};

function renderInventory(player) {
  const items = player.items || [];
  const invDiv = document.getElementById('inventory-items');
  if (items.length === 0) {
    invDiv.innerHTML = '<p style="color:#95a5a6;text-align:center;padding:20px">背包为空</p>';
    return;
  }
  invDiv.innerHTML = items.map((item, idx) => {
    const itemId = typeof item === 'string' ? item : item.id;
    const info = getItemInfo(itemId);
    const rarityClass = 'rarity-' + info.rarity;
    const needTarget = ['mine','banana','freezeCard','stealCard','knife','fireBomb','poison','dragonCannon','fateSwap','wealthScale'].includes(itemId);
    return `<div class="inv-item" onclick="useItemFromInv('${itemId}', ${needTarget})">
      <div class="ii-name">${esc(info.name)}</div>
      <div class="ii-type">${info.type}</div>
      <div class="ii-desc">${esc(info.desc)}</div>
      <div class="ii-rarity ${rarityClass}">${info.rarity}</div>
    </div>`;
  }).join('');
}

window.useItemFromInv = (itemId, needTarget) => {
  if (needTarget) {
    const players = gameState.players.filter((p, i) => i !== myPlayerIndex && p.isAlive && !p.surrendered);
    if (players.length === 0) { toast('没有可选目标'); return; }
    const invDiv = document.getElementById('inventory-items');
    invDiv.innerHTML = '<p style="margin-bottom:8px;color:var(--gold)">选择目标玩家:</p>' + players.map(p =>
      `<div class="inv-item" onclick="useItemWithTarget('${itemId}','${p.id}')"><div class="ii-name">${esc(p.name)}</div></div>`
    ).join('') + `<div class="inv-item" onclick="closeModal('modal-inventory')"><div class="ii-name" style="color:var(--text2)">取消</div></div>`;
    return;
  }
  socket.emit('useItem', { itemId }, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    if (res.ok) {
      closeModal('modal-inventory');
      // 刷新背包
      socket.emit('getState', (state) => { if (state) gameState = state; });
    }
  });
};

window.useItemWithTarget = (itemId, targetId) => {
  socket.emit('useItem', { itemId, targetId }, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    closeModal('modal-inventory');
    socket.emit('getState', (state) => { if (state) gameState = state; });
  });
};

// ══════════════════════════════════════
// 触发事件
// ══════════════════════════════════════
document.getElementById('btn-trigger').onclick = () => {
  socket.emit('triggerEvent', (res) => {
    if (res.ok) {
      if (res.type === 'boss') showBossModal(res.boss);
      else if (res.type === 'minigame') showMiniGame(res.gameId);
      else if (res.type === 'shop') showShop(res.shopType);
      else toast(res.msg, 'success');
    } else toast(res.msg);
  });
};

window.makeChoice = (choiceId) => {
  socket.emit('makeChoice', choiceId, (res) => {
    if (res.ok) { toast(res.msg, 'success'); closeModal('modal-event'); }
    else toast(res.msg);
  });
};

// ══════════════════════════════════════
// 结束回合
// ══════════════════════════════════════
document.getElementById('btn-end-turn').onclick = () => {
  socket.emit('endTurn', (res) => {
    if (res.ok) {
      toast(res.extraTurn ? '⏳ 额外回合！' : '⏭ 回合结束');
    } else toast(res.msg || '无法结束回合');
  });
};

// ══════════════════════════════════════
// 商店
// ══════════════════════════════════════
document.getElementById('btn-shop').onclick = () => showShop('normal');

function showShop(type) {
  const shopDiv = document.getElementById('shop-items');
  const mult = type === 'blackmarket' ? 1.5 : 1;
  shopDiv.innerHTML = SHOP_ITEMS.map(item => {
    const info = getItemInfo(item.id);
    const price = Math.floor(item.price * mult);
    return `<div class="shop-item" onclick="buyFromShop('${item.id}', ${price})">
      <div class="si-name">${esc(info.name)}</div>
      <div class="si-desc">${esc(info.desc)}</div>
      <div class="si-price">💰 ${price}</div>
    </div>`;
  }).join('');
  openModal('modal-shop');
}

window.buyFromShop = (itemId, price) => {
  socket.emit('buyItem', { itemId, price }, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    if (res.ok) socket.emit('getState', (state) => { if (state) gameState = state; });
  });
};

// ══════════════════════════════════════
// 交易
// ══════════════════════════════════════
document.getElementById('btn-trade').onclick = () => {
  if (!gameState) return;
  const others = gameState.players.filter((p, i) => i !== myPlayerIndex && p.isAlive && !p.surrendered);
  if (others.length === 0) { toast('没有可交易的玩家'); return; }
  const sel = document.getElementById('trade-target');
  sel.innerHTML = others.map(p => `<option value="${gameState.players.indexOf(p)}">${esc(p.name)} (💰${p.gold})</option>`).join('');
  document.getElementById('trade-offer-gold').value = '';
  document.getElementById('trade-request-gold').value = '';
  openModal('modal-trade');
};

document.getElementById('btn-confirm-trade').onclick = () => {
  const targetIdx = parseInt(document.getElementById('trade-target').value);
  const target = gameState.players[targetIdx];
  if (!target) { toast('请选择交易对象'); return; }
  const offerGold = parseInt(document.getElementById('trade-offer-gold').value) || 0;
  const requestGold = parseInt(document.getElementById('trade-request-gold').value) || 0;
  if (offerGold === 0 && requestGold === 0) { toast('请输入交易内容'); return; }
  socket.emit('trade', { targetSocketId: target.id, offer: { gold: offerGold }, request: { gold: requestGold } }, (res) => {
    if (res.ok) { toast('交易已发送！等待对方确认', 'success'); closeModal('modal-trade'); }
    else toast(res.msg);
  });
};

// ══════════════════════════════════════
// Boss战斗
// ══════════════════════════════════════
function showBossModal(boss) {
  document.getElementById('boss-name').textContent = `👹 ${boss.name}`;
  document.getElementById('boss-desc').textContent = boss.desc;
  const hpPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
  document.getElementById('boss-hp').innerHTML = `<div class="boss-hp-fill" style="width:${hpPct}%">${boss.hp}/${boss.maxHp}</div>`;
  const me = gameState.players[myPlayerIndex];
  const attackItemIds = ['knife','fireBomb','poison','dragonCannon'];
  const attackItems = (me.items || []).filter(item => {
    const id = typeof item === 'string' ? item : item.id;
    return attackItemIds.includes(id);
  });
  const actDiv = document.getElementById('boss-actions');
  if (attackItems.length === 0) {
    actDiv.innerHTML = '<p style="color:#95a5a6">没有攻击道具</p>';
  } else {
    actDiv.innerHTML = attackItems.map(item => {
      const id = typeof item === 'string' ? item : item.id;
      const info = getItemInfo(id);
      return `<button class="btn btn-action" onclick="attackBossAction('${boss.id}','${id}')">${info.name} (${info.desc})</button>`;
    }).join('');
  }
  openModal('modal-boss');
}

window.attackBossAction = (bossId, itemId) => {
  socket.emit('attackBoss', { bossId, itemIds: [itemId] }, (res) => {
    if (res.ok) {
      toast(res.msg, 'success');
      if (res.bossDefeated) { toast('🎉 Boss被击败了！', 'gold'); closeModal('modal-boss'); }
      else if (res.bossHp !== undefined) {
        const boss = gameState.map.find(t => t.data?.bossId === bossId);
        const maxHp = boss?.data?.maxHp || 50;
        document.getElementById('boss-hp').innerHTML = `<div class="boss-hp-fill" style="width:${Math.max(0,(res.bossHp/maxHp)*100)}%">${res.bossHp}/${maxHp}</div>`;
      }
    } else toast(res.msg);
  });
};

// ══════════════════════════════════════
// 小游戏
// ══════════════════════════════════════
function showMiniGame(gameId) {
  const names = { texasHoldem:'德州扑克', zhaJinHua:'炸金花', blackjack:'二十一点', luckyWheel:'幸运轮盘', auction:'拍卖会' };
  document.getElementById('minigame-name').textContent = `🎮 ${names[gameId] || gameId}`;
  const content = document.getElementById('minigame-content');

  if (gameId === 'luckyWheel') {
    content.innerHTML = `<p>转动轮盘获取随机奖励！</p>
      <button class="btn btn-primary" onclick="playMiniGame('spin', 0)" style="margin-top:12px">🎯 转动轮盘</button>`;
  } else if (gameId === 'blackjack') {
    content.innerHTML = `<p>下注后抽牌，尽可能接近21点！</p>
      <input type="number" id="bj-bet" value="200" min="100" step="100" style="margin:8px 0;width:100%">
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="playMiniGame('hit', parseInt(document.getElementById('bj-bet').value))">🃏 要牌</button>
        <button class="btn btn-secondary" onclick="playMiniGame('stand', parseInt(document.getElementById('bj-bet').value))">✋ 停牌</button>
      </div>`;
  } else {
    content.innerHTML = `<p>参与小游戏，下注金币！</p>
      <input type="number" id="mg-bet" value="200" min="100" step="100" style="margin:8px 0;width:100%">
      <button class="btn btn-primary" onclick="playMiniGame('play', parseInt(document.getElementById('mg-bet').value))" style="margin-top:8px">🎮 参与</button>`;
  }
  openModal('modal-minigame');
}

window.playMiniGame = (action, bet) => {
  socket.emit('miniGameAction', { action, bet }, (res) => {
    if (res.ok) {
      toast(res.msg, res.win !== false ? 'gold' : '');
      if (res.bust || res.win !== undefined || res.prize) closeModal('modal-minigame');
    } else toast(res.msg);
  });
};

// ══════════════════════════════════════
// 投降
// ══════════════════════════════════════
document.getElementById('btn-surrender').onclick = () => {
  if (!confirm('确定要投降吗？投降后将退出游戏。')) return;
  socket.emit('surrender', (res) => {
    if (res && res.ok) {
      toast('你已投降');
      document.getElementById('btn-surrender').disabled = true;
    } else {
      toast(res?.msg || '投降失败');
    }
  });
};

// 初始化
showScreen('home');
