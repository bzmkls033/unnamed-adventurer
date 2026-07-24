'use strict';
// ═══════════════════════════════════════════
// 不知名冒险家 - 客户端 v2
// ═══════════════════════════════════════════

const socket = io();
let myPlayerId = null;
let currentRoomCode = null;
let gameState = null;
let timerInterval = null;
let myPlayerIndex = -1;

const TILE_EMOJI = {
  gold:'💰', item:'🎁', heal:'❤️', empty:'⬜', mystery:'❓',
  shop:'🏪', minigame:'🎮', boss:'👹', collection:'💎', asset:'🪙'
};
const TILE_COLORS = {
  gold:'#f39c12', item:'#9b59b6', heal:'#e74c3c', empty:'#555',
  mystery:'#3498db', shop:'#2ecc71', minigame:'#e67e22',
  boss:'#c0392b', collection:'#1abc9c', asset:'#f1c40f'
};

const ITEM_INFO = {
  bandage:{name:'绷带',desc:'恢复1生命',type:'回复',rarity:'普通'},
  medkit:{name:'医疗箱',desc:'恢复3生命',type:'回复',rarity:'稀有'},
  revive:{name:'复活药',desc:'濒死恢复2生命',type:'回复',rarity:'史诗'},
  antidote:{name:'解毒剂',desc:'解除负面状态',type:'回复',rarity:'普通'},
  ironShield:{name:'铁盾',desc:'抵挡一次攻击',type:'防具',rarity:'普通'},
  magicShield:{name:'魔法护盾',desc:'减少一次伤害',type:'防具',rarity:'稀有'},
  thornArmor:{name:'反伤甲',desc:'反弹1伤害',type:'防具',rarity:'稀有'},
  luckyCharm:{name:'幸运护符',desc:'抵挡致命效果',type:'防具',rarity:'史诗'},
  reroll:{name:'重掷券',desc:'重新掷骰',type:'一次性',rarity:'普通'},
  doubleDice:{name:'双倍骰',desc:'移动距离×2',type:'一次性',rarity:'稀有'},
  teleport:{name:'传送卷轴',desc:'传送到指定位置',type:'一次性',rarity:'史诗'},
  chestKey:{name:'宝箱钥匙',desc:'提高宝箱品质',type:'一次性',rarity:'稀有'},
  timeHourglass:{name:'时间沙漏',desc:'额外回合',type:'世界道具',rarity:'传奇'},
  worldFreeze:{name:'世界冻结',desc:'冻结其他玩家',type:'世界道具',rarity:'传奇'},
  fateSwap:{name:'命运交换',desc:'交换全部资产',type:'世界道具',rarity:'传奇'},
  godDice:{name:'神之骰',desc:'指定骰子点数',type:'世界道具',rarity:'传奇'},
  wealthScale:{name:'财富天平',desc:'交换金币',type:'世界道具',rarity:'传奇'},
  banana:{name:'香蕉皮',desc:'目标移动失败',type:'整蛊',rarity:'普通'},
  mine:{name:'地雷',desc:'目标扣1生命',type:'整蛊',rarity:'稀有'},
  freezeCard:{name:'冰冻卡',desc:'目标无法用道具',type:'整蛊',rarity:'稀有'},
  stealCard:{name:'偷窃卡',desc:'偷取目标道具',type:'整蛊',rarity:'稀有'},
  knife:{name:'飞刀',desc:'造成1伤害',type:'攻击',rarity:'普通'},
  fireBomb:{name:'火焰炸弹',desc:'造成2伤害',type:'攻击',rarity:'稀有'},
  poison:{name:'毒药',desc:'持续掉血',type:'攻击',rarity:'稀有'},
  dragonCannon:{name:'巨龙炮',desc:'造成5伤害',type:'攻击',rarity:'传奇'},
};

const SHOP_ITEMS = [
  {id:'bandage',price:200},{id:'medkit',price:800},{id:'reroll',price:200},
  {id:'doubleDice',price:400},{id:'ironShield',price:300},{id:'magicShield',price:500},
  {id:'knife',price:150},{id:'fireBomb',price:400},{id:'antidote',price:150},{id:'chestKey',price:300},
];

// ── 工具 ──
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}
function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
window.closeModal = closeModal;
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function getItemName(id) { return ITEM_INFO[id]?.name || id; }
function getItemInfo(id) { return ITEM_INFO[id] || {name:id,desc:'',type:'道具',rarity:'普通'}; }

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
  socket.emit('startGame', (res) => { if (!res.ok) toast(res.msg); });
};
document.getElementById('btn-leave').onclick = () => {
  socket.disconnect();
  socket.connect();
  myPlayerId = null; currentRoomCode = null; gameState = null;
  showScreen('home');
};

// ══════════════════════════════════════
// 游戏状态
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
  myPlayerIndex = gameState.players.findIndex(p => p.id === myPlayerId || p.socketId === myPlayerId);
  if (myPlayerIndex < 0) myPlayerIndex = 0;
}

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
// 渲染
// ══════════════════════════════════════
function renderGame() {
  if (!gameState) return;
  const state = gameState;
  const currentP = state.players[state.currentTurn];
  const isMyTurn = myPlayerIndex === state.currentTurn;

  document.getElementById('world-rule').textContent = `🌍 ${state.worldRule.name}: ${state.worldRule.desc}`;
  document.getElementById('turn-info').textContent = currentP ? `回合: ${currentP.name}` : '';
  const phaseNames = { beforeMove: '掷骰阶段', event: '事件阶段', start: '准备中' };
  document.getElementById('phase-info').textContent = isMyTurn ? `【${phaseNames[state.turnPhase] || ''}】` : '';

  renderPlayerPanel(state);
  renderBoard(state);
  renderLog(state);
  updateButtons(state);
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
      ${isMe ? `<div class="pp-stats" style="margin-top:4px"><span>🎁${items.length}道具</span><span>🪙${assets.length}资产</span></div>` : ''}
    </div>`;
  }).join('');
}

// ── 大富翁式方形地图 ──
function renderBoard(state) {
  const board = document.getElementById('game-board');
  const mainTiles = state.map.filter(t => !t.branchId).sort((a, b) => a.position - b.position);
  const total = mainTiles.length;

  // 计算方形布局：每边分配格子数
  // 大富翁风格：四边围成一圈
  const sideLen = Math.ceil(total / 4);
  const topCount = sideLen;
  const rightCount = sideLen;
  const bottomCount = sideLen;
  const leftCount = total - topCount - rightCount - bottomCount;

  const tileSize = 56;
  const gap = 2;
  const step = tileSize + gap;
  const padding = 20;

  // 计算画布大小
  const boardW = (topCount + 2) * step + padding * 2;
  const boardH = (rightCount + 2) * step + padding * 2;

  // 为每个格子计算坐标 (顺时针: 上→右→下→左)
  const coords = [];
  let idx = 0;

  // 上边：从左到右
  for (let i = 0; i < topCount && idx < total; i++, idx++) {
    coords.push({ x: padding + (topCount - i) * step, y: padding });
  }
  // 右边：从上到下
  for (let i = 0; i < rightCount && idx < total; i++, idx++) {
    coords.push({ x: padding, y: padding + (i + 1) * step });
  }
  // 下边：从右到左
  for (let i = 0; i < bottomCount && idx < total; i++, idx++) {
    coords.push({ x: padding + (i + 1) * step, y: padding + (rightCount + 1) * step });
  }
  // 左边：从下到上
  for (let i = 0; i < leftCount && idx < total; i++, idx++) {
    coords.push({ x: padding + (topCount + 1) * step, y: padding + (rightCount - i) * step });
  }

  let html = `<div class="board-canvas" style="position:relative;width:${boardW}px;height:${boardH}px">`;

  // 画背景网格线
  html += `<div style="position:absolute;left:${padding}px;top:${padding}px;right:${padding}px;bottom:${padding}px;border:2px solid rgba(255,255,255,0.08);border-radius:4px"></div>`;

  // 画格子
  mainTiles.forEach((tile, i) => {
    if (i >= coords.length) return;
    const pos = coords[i];
    const emoji = TILE_EMOJI[tile.type] || '⬜';
    const bgColor = TILE_COLORS[tile.type] || '#555';
    const playersHere = state.players.filter(p => p.position === tile.id);
    const isCurrentTile = playersHere.some((_, pi) => state.players[pi] === state.players[state.currentTurn]);

    // 玩家标记
    let playerDots = '';
    if (playersHere.length > 0) {
      playerDots = '<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);display:flex;gap:2px">';
      playersHere.forEach(p => {
        playerDots += `<span style="width:12px;height:12px;border-radius:50%;background:${p.color};border:1.5px solid #fff;display:inline-block;box-shadow:0 0 4px ${p.color}"></span>`;
      });
      playerDots += '</div>';
    }

    const currentStyle = isCurrentTile ? 'box-shadow:0 0 12px var(--gold),0 0 24px rgba(255,215,0,0.4);border-color:var(--gold);' : '';

    html += `<div class="tile-square" style="
      position:absolute;
      left:${pos.x}px;
      top:${pos.y}px;
      width:${tileSize}px;
      height:${tileSize}px;
      background:${bgColor}22;
      border:2px solid ${isCurrentTile ? 'var(--gold)' : bgColor + '66'};
      border-radius:6px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      font-size:22px;
      cursor:pointer;
      transition:all 0.2s;
      ${currentStyle}
    " title="[${tile.type}] 格子#${tile.id}">
      <span style="font-size:10px;color:${bgColor};position:absolute;top:2px;right:4px;font-weight:700">${i}</span>
      ${emoji}
      ${playerDots}
    </div>`;
  });

  // 画分支格子
  const branchTiles = state.map.filter(t => t.branchId);
  const branchGroups = {};
  branchTiles.forEach(t => {
    if (!branchGroups[t.branchId]) branchGroups[t.branchId] = [];
    branchGroups[t.branchId].push(t);
  });

  Object.entries(branchGroups).forEach(([bid, tiles]) => {
    tiles.sort((a, b) => a.position - b.position);
    const firstTile = tiles[0];
    const entryMain = mainTiles.find(mt => mt.nextTileIds?.includes(firstTile.id));
    if (!entryMain) return;
    const entryIdx = mainTiles.indexOf(entryMain);
    if (entryIdx >= coords.length) return;
    const basePos = coords[entryIdx];

    tiles.forEach((tile, i) => {
      const bx = basePos.x + (i + 1) * (tileSize + 4) + 10;
      const by = basePos.y + tileSize + 10;
      const emoji = TILE_EMOJI[tile.type] || '⬜';
      const bgColor = TILE_COLORS[tile.type] || '#555';
      const playersHere = state.players.filter(p => p.position === tile.id);
      let dots = '';
      if (playersHere.length > 0) {
        dots = '<div style="position:absolute;bottom:1px;left:50%;transform:translateX(-50%);display:flex;gap:1px">';
        playersHere.forEach(p => { dots += `<span style="width:10px;height:10px;border-radius:50%;background:${p.color};border:1px solid #fff;display:inline-block"></span>`; });
        dots += '</div>';
      }
      html += `<div style="
        position:absolute;left:${bx}px;top:${by}px;width:44px;height:44px;
        background:${bgColor}22;border:2px dashed ${bgColor}66;border-radius:6px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:18px;
      ">${emoji}${dots}</div>`;
    });
  });

  html += '</div>';
  board.innerHTML = html;

  // 滚动到当前玩家
  const me = state.players[myPlayerIndex];
  if (me) {
    const curIdx = mainTiles.findIndex(t => t.id === me.position);
    if (curIdx >= 0 && curIdx < coords.length) {
      const pos = coords[curIdx];
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
  const hasPending = !!state.pendingEvent || !!state.miniGame;
  document.getElementById('btn-roll').disabled = !(myTurn && phase === 'beforeMove' && alive);
  document.getElementById('btn-use-item').disabled = !alive;
  // 触发事件按钮已废弃（事件自动触发），保持禁用
  document.getElementById('btn-trigger').disabled = true;
  // 有待处理事件/小游戏时不能结束回合
  document.getElementById('btn-end-turn').disabled = !(myTurn && phase === 'event' && !hasPending && alive);
  document.getElementById('btn-surrender').disabled = !alive;
  document.getElementById('btn-shop').disabled = !alive;
  document.getElementById('btn-trade').disabled = !alive;
}

function checkEventModal(state) {
  const me = state.players[myPlayerIndex];
  if (state.pendingEvent && me && state.pendingEvent.playerId === me.id) {
    const ev = state.pendingEvent.event;
    document.getElementById('event-title').textContent = ev.name;
    document.getElementById('event-desc').textContent = ev.desc;
    document.getElementById('event-choices').innerHTML = ev.choices.map(c => {
      const req = c.requires ? ` [需要: ${getItemName(c.requires)}]` : '';
      return `<button class="choice-btn" onclick="makeChoice('${c.id}')">${c.label}${req}</button>`;
    }).join('');
    openModal('modal-event');
  } else if (!state.pendingEvent) {
    closeModal('modal-event');
  }
}

// ══════════════════════════════════════
// 操作
// ══════════════════════════════════════
document.getElementById('btn-roll').onclick = () => {
  socket.emit('rollDice', {}, (res) => {
    if (res.ok) {
      if (res.stunned) { toast('你被眩晕了！'); return; }
      toast(`🎲 掷出 ${res.dice}！移动${res.moveSteps}格`, 'gold');
      // 自动触发的事件结果
      if (res.event) {
        toast(res.event.msg, 'success');
        // 需要玩家操作的事件：显示对应弹窗
        if (res.event.type === 'boss' && res.event.boss) {
          showBossModal(res.event.boss);
        } else if (res.event.type === 'minigame' && res.event.gameId) {
          showMiniGame(res.event.gameId);
        }
        // mystery 事件由 checkEventModal 根据 pendingEvent 自动弹出
      }
    } else toast(res.msg);
  });
};

// 背包
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
  const needTargetIds = ['mine','banana','freezeCard','stealCard','knife','fireBomb','poison','dragonCannon','fateSwap','wealthScale'];
  invDiv.innerHTML = items.map((item, idx) => {
    const itemId = typeof item === 'string' ? item : item.id;
    const info = getItemInfo(itemId);
    const nt = needTargetIds.includes(itemId);
    return `<div class="inv-item" onclick="useItemFromInv('${itemId}',${nt})">
      <div class="ii-name">${esc(info.name)}</div>
      <div class="ii-type">${info.type} · <span class="rarity-${info.rarity}">${info.rarity}</span></div>
      <div class="ii-desc">${esc(info.desc)}</div>
    </div>`;
  }).join('');
}

window.useItemFromInv = (itemId, needTarget) => {
  if (needTarget) {
    const players = gameState.players.filter((p, i) => i !== myPlayerIndex && p.isAlive && !p.surrendered);
    if (players.length === 0) { toast('没有可选目标'); return; }
    document.getElementById('inventory-items').innerHTML =
      '<p style="margin-bottom:8px;color:var(--gold)">选择目标玩家:</p>' +
      players.map(p => `<div class="inv-item" onclick="useItemWithTarget('${itemId}','${p.id}')"><div class="ii-name">${esc(p.name)}</div></div>`).join('') +
      `<div class="inv-item" onclick="closeModal('modal-inventory')"><div class="ii-name" style="color:var(--text2)">取消</div></div>`;
    return;
  }
  socket.emit('useItem', {itemId}, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    if (res.ok) { closeModal('modal-inventory'); socket.emit('getState', (s) => { if (s) gameState = s; }); }
  });
};

window.useItemWithTarget = (itemId, targetId) => {
  socket.emit('useItem', {itemId, targetId}, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    closeModal('modal-inventory');
    socket.emit('getState', (s) => { if (s) gameState = s; });
  });
};

// 触发事件（已废弃：事件在掷骰时自动触发）
document.getElementById('btn-trigger').onclick = () => {
  toast('事件已自动触发');
};

window.makeChoice = (choiceId) => {
  socket.emit('makeChoice', choiceId, (res) => {
    if (res.ok) {
      toast(res.msg, 'success');
      closeModal('modal-event');
      // 选择完成后自动结束回合
      socket.emit('endTurn', (endRes) => {
        if (endRes.ok) toast(endRes.extraTurn ? '⏳ 额外回合！' : '⏭ 回合结束');
      });
    } else toast(res.msg);
  });
};

// 结束回合
document.getElementById('btn-end-turn').onclick = () => {
  socket.emit('endTurn', (res) => {
    if (res.ok) toast(res.extraTurn ? '⏳ 额外回合！' : '⏭ 回合结束');
    else toast(res.msg || '无法结束回合');
  });
};

// 商店
document.getElementById('btn-shop').onclick = () => showShop('normal');

function showShop(type) {
  const shopDiv = document.getElementById('shop-items');
  const mult = type === 'blackmarket' ? 1.5 : 1;
  shopDiv.innerHTML = SHOP_ITEMS.map(item => {
    const info = getItemInfo(item.id);
    const price = Math.floor(item.price * mult);
    return `<div class="shop-item">
      <div class="si-name">${esc(info.name)}</div>
      <div class="si-desc">${esc(info.desc)}</div>
      <div class="si-rarity"><span class="rarity-${info.rarity}">${info.rarity}</span></div>
      <div class="si-bottom">
        <span class="si-price">💰 ${price}</span>
        <button class="btn btn-buy" onclick="buyFromShop('${item.id}',${price})">购买</button>
      </div>
    </div>`;
  }).join('');
  openModal('modal-shop');
}

window.buyFromShop = (itemId, price) => {
  socket.emit('buyItem', {itemId, price}, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    if (res.ok) socket.emit('getState', (s) => { if (s) gameState = s; });
  });
};

// 交易
document.getElementById('btn-trade').onclick = () => {
  if (!gameState) return;
  const others = gameState.players.filter((p, i) => i !== myPlayerIndex && p.isAlive && !p.surrendered);
  if (others.length === 0) { toast('没有可交易的玩家'); return; }
  document.getElementById('trade-target').innerHTML = others.map(p =>
    `<option value="${gameState.players.indexOf(p)}">${esc(p.name)} (💰${p.gold})</option>`
  ).join('');
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
  socket.emit('trade', {targetSocketId: target.id, offer: {gold: offerGold}, request: {gold: requestGold}}, (res) => {
    if (res.ok) { toast('交易已发送！', 'success'); closeModal('modal-trade'); }
    else toast(res.msg);
  });
};

// Boss
function showBossModal(boss) {
  document.getElementById('boss-name').textContent = `👹 ${boss.name}`;
  document.getElementById('boss-desc').textContent = boss.desc;
  const hpPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
  document.getElementById('boss-hp').innerHTML = `<div class="boss-hp-fill" style="width:${hpPct}%">${boss.hp}/${boss.maxHp}</div>`;
  const me = gameState.players[myPlayerIndex];
  const attackIds = ['knife','fireBomb','poison','dragonCannon'];
  const attackItems = (me.items || []).filter(item => attackIds.includes(typeof item === 'string' ? item : item.id));
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
  socket.emit('attackBoss', {bossId, itemIds: [itemId]}, (res) => {
    if (res.ok) {
      toast(res.msg, 'success');
      if (res.bossDefeated) {
        toast('🎉 Boss被击败了！', 'gold');
        closeModal('modal-boss');
        // Boss被击败后自动结束回合
        socket.emit('endTurn', (endRes) => {
          if (endRes.ok) toast(endRes.extraTurn ? '⏳ 额外回合！' : '⏭ 回合结束');
        });
      } else if (res.bossHp !== undefined) {
        const maxHp = 50;
        document.getElementById('boss-hp').innerHTML = `<div class="boss-hp-fill" style="width:${Math.max(0,(res.bossHp/maxHp)*100)}%">${res.bossHp}/${maxHp}</div>`;
      }
    } else toast(res.msg);
  });
};

// Boss弹窗关闭时自动结束回合
window.closeBossModal = () => {
  closeModal('modal-boss');
  socket.emit('endTurn', (res) => {
    if (res.ok) toast(res.extraTurn ? '⏳ 额外回合！' : '⏭ 回合结束');
  });
};

// 小游戏
function showMiniGame(gameId) {
  const names = {texasHoldem:'德州扑克',zhaJinHua:'炸金花',blackjack:'二十一点',luckyWheel:'幸运轮盘',auction:'拍卖会'};
  document.getElementById('minigame-name').textContent = `🎮 ${names[gameId] || gameId}`;
  const content = document.getElementById('minigame-content');
  if (gameId === 'luckyWheel') {
    content.innerHTML = `<p>转动轮盘获取随机奖励！</p><button class="btn btn-primary" onclick="playMiniGame('spin',0)" style="margin-top:12px">🎯 转动轮盘</button>`;
  } else if (gameId === 'blackjack') {
    content.innerHTML = `<p>下注后抽牌，尽可能接近21点！</p><input type="number" id="bj-bet" value="200" min="100" step="100" style="margin:8px 0;width:100%"><div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="playMiniGame('hit',parseInt(document.getElementById('bj-bet').value))">🃏 要牌</button><button class="btn btn-secondary" onclick="playMiniGame('stand',parseInt(document.getElementById('bj-bet').value))">✋ 停牌</button></div>`;
  } else {
    content.innerHTML = `<p>参与小游戏，下注金币！</p><input type="number" id="mg-bet" value="200" min="100" step="100" style="margin:8px 0;width:100%"><button class="btn btn-primary" onclick="playMiniGame('play',parseInt(document.getElementById('mg-bet').value))" style="margin-top:8px">🎮 参与</button>`;
  }
  openModal('modal-minigame');
}

window.playMiniGame = (action, bet) => {
  socket.emit('miniGameAction', {action, bet}, (res) => {
    if (res.ok) {
      toast(res.msg, res.win !== false ? 'gold' : '');
      if (res.bust || res.win !== undefined || res.prize) {
        closeModal('modal-minigame');
        // 小游戏结束后自动结束回合
        socket.emit('endTurn', (endRes) => {
          if (endRes.ok) toast(endRes.extraTurn ? '⏳ 额外回合！' : '⏭ 回合结束');
        });
      }
    } else toast(res.msg);
  });
};

// 投降
document.getElementById('btn-surrender').onclick = () => {
  if (!confirm('确定要投降吗？')) return;
  socket.emit('surrender', (res) => {
    if (res && res.ok) { toast('你已投降'); document.getElementById('btn-surrender').disabled = true; }
    else toast(res?.msg || '投降失败');
  });
};

showScreen('home');
