'use strict';
// ═══════════════════════════════════════════
// 不知名冒险家 - 客户端
// ═══════════════════════════════════════════

const socket = io();
let myPlayerId = null;
let currentRoomCode = null;
let gameState = null;
let isMyTurn = false;
let timerInterval = null;

const TILE_EMOJI = {
  gold:'💰', item:'🎁', heal:'❤️', empty:'⬜', mystery:'❓',
  shop:'🏪', minigame:'🎮', boss:'👹', collection:'💎', asset:'🪙'
};
const SHOP_ITEMS = [
  { id:'bandage', name:'绷带', desc:'恢复1生命', price:200 },
  { id:'medkit', name:'医疗箱', desc:'恢复3生命', price:800 },
  { id:'reroll', name:'重掷券', desc:'重新掷骰', price:200 },
  { id:'doubleDice', name:'双倍骰', desc:'移动×2', price:400 },
  { id:'ironShield', name:'铁盾', desc:'抵挡一次攻击', price:300 },
  { id:'magicShield', name:'魔法护盾', desc:'减少一次伤害', price:500 },
  { id:'knife', name:'飞刀', desc:'造成1伤害', price:150 },
  { id:'fireBomb', name:'火焰炸弹', desc:'造成2伤害', price:400 },
  { id:'antidote', name:'解毒剂', desc:'解除负面状态', price:150 },
  { id:'chestKey', name:'宝箱钥匙', desc:'提高宝箱品质', price:300 },
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
// 让 closeModal 全局可用
window.closeModal = closeModal;

// ══════════════════════════════════════
// 主页事件
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
    `<div class="player-card ${p.ready ? 'ready' : ''}" style="border-color:${p.ready ? '#2ecc71' : 'transparent'}">
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

// ══════════════════════════════════════
// 游戏状态同步
// ══════════════════════════════════════
socket.on('gameStarted', (state) => {
  showScreen('game');
  gameState = state;
  renderGame();
  startTimer(state.timeLeft);
});

socket.on('gameState', (state) => {
  gameState = state;
  renderGame();
});

socket.on('gameOver', (data) => {
  document.getElementById('gameover-winner').textContent = data.winner ? `${data.winner.name} 获得胜利！` : '平局！';
  openModal('modal-gameover');
});

// ── 定时器 ──
function startTimer(ms) {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameState) return;
    const left = Math.max(0, gameState.timeLeft - (Date.now() - (gameState._syncTime || Date.now())));
    const min = Math.floor(left / 60000);
    const sec = Math.floor((left % 60000) / 1000);
    document.getElementById('timer').textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }, 1000);
  gameState._syncTime = Date.now();
}

// ══════════════════════════════════════
// 渲染游戏
// ══════════════════════════════════════
function renderGame() {
  if (!gameState) return;
  const state = gameState;
  const me = state.players.find(p => p.id === myPlayerId || state.players.indexOf(p) === getPlayerIndex());
  const myIdx = getPlayerIndex();
  const currentP = state.players[state.currentTurn];
  isMyTurn = currentP && myIdx === state.currentTurn;

  // 世界规则
  document.getElementById('world-rule').textContent = `🌍 ${state.worldRule.name}: ${state.worldRule.desc}`;
  // 回合信息
  document.getElementById('turn-info').textContent = currentP ? `回合: ${currentP.name}` : '';
  const phaseNames = { beforeMove: '掷骰阶段', event: '事件阶段', start: '准备中' };
  document.getElementById('phase-info').textContent = phaseNames[state.turnPhase] || '';

  // 更新计时器
  if (state.timeLeft) gameState.timeLeft = state.timeLeft;

  // 渲染玩家面板
  renderPlayerPanel(state, myIdx);
  // 渲染地图
  renderBoard(state, myIdx);
  // 渲染日志
  renderLog(state);
  // 更新按钮状态
  updateButtons(state, myIdx);
  // 检查事件弹窗
  checkEventModal(state, myIdx);
}

function getPlayerIndex() {
  if (!gameState) return -1;
  // 通过socketId匹配
  const idx = gameState.players.findIndex((p, i) => {
    // 简单匹配：第一个是p0，第二个是p1...
    return p.id === myPlayerId;
  });
  return idx >= 0 ? idx : 0;
}

function renderPlayerPanel(state, myIdx) {
  const panel = document.getElementById('player-panel');
  panel.innerHTML = state.players.map((p, i) => {
    const isCurrent = i === state.currentTurn;
    const isDead = !p.isAlive || p.surrendered;
    const hpPct = Math.max(0, (p.hp / 5) * 100);
    const hpClass = hpPct <= 40 ? 'low' : '';
    const isMe = i === myIdx;
    const items = Array.isArray(p.items) ? p.items : [];
    return `<div class="player-panel-card ${isCurrent ? 'current' : ''} ${isDead ? 'dead' : ''}">
      <div class="pp-name" style="color:${p.color}">${isMe ? '👤 ' : ''}${esc(p.name)}${isDead ? ' 💀' : ''}</div>
      <div class="pp-stats">
        <span>❤️ ${p.hp}/${p.maxHp}</span>
        <span>💰 ${p.gold}</span>
      </div>
      <div class="hp-bar"><div class="hp-bar-fill ${hpClass}" style="width:${hpPct}%;background:${p.color}"></div></div>
      ${isMe ? `<div class="pp-stats" style="margin-top:4px"><span>🎁 ${items.length}道具</span><span>🪙 ${(p.assets||[]).length}资产</span></div>` : ''}
    </div>`;
  }).join('');
}

function renderBoard(state, myIdx) {
  const board = document.getElementById('game-board');
  // 简化渲染：只渲染主路线，分支用缩进表示
  const mainTiles = state.map.filter(t => !t.branchId).sort((a, b) => a.position - b.position);
  const branchTiles = state.map.filter(t => t.branchId);

  // 计算布局：螺旋形或网格
  const cols = Math.ceil(Math.sqrt(mainTiles.length));
  let html = '<div class="board-canvas" style="position:relative;min-height:' + (cols * 56 + 60) + 'px;min-width:' + (cols * 56 + 60) + 'px">';

  // 画主线格子（网格布局）
  mainTiles.forEach((tile, i) => {
    const row = Math.floor(i / cols);
    const col = row % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    const x = col * 56 + 10;
    const y = row * 56 + 10;
    const emoji = TILE_EMOJI[tile.type] || '⬜';
    const playersHere = state.players.filter((p, pi) => {
      const pos = typeof p.position === 'number' ? p.position : 0;
      return pos === tile.id;
    });
    const playerDots = playersHere.map(p => `<span style="color:${p.color};font-size:10px;position:absolute;bottom:-2px;right:-2px">●</span>`).join('');

    html += `<div class="tile type-${tile.type}" style="left:${x}px;top:${y}px" title="${tile.type} #${tile.id}" data-id="${tile.id}">
      ${emoji}${playerDots}
    </div>`;
  });

  // 画分支格子（缩进显示）
  const branchGroups = {};
  branchTiles.forEach(t => {
    if (!branchGroups[t.branchId]) branchGroups[t.branchId] = [];
    branchGroups[t.branchId].push(t);
  });
  Object.entries(branchGroups).forEach(([bid, tiles]) => {
    tiles.forEach((tile, i) => {
      // 找到分支入口在主线的位置
      const entryMain = mainTiles.find(mt => mt.nextTileIds?.includes(tile.id));
      if (!entryMain) return;
      const entryIdx = mainTiles.indexOf(entryMain);
      const row = Math.floor(entryIdx / cols);
      const col = row % 2 === 0 ? entryIdx % cols : cols - 1 - (entryIdx % cols);
      const x = col * 56 + 10 + (i + 1) * 50;
      const y = row * 56 + 10 + 30;
      const emoji = TILE_EMOJI[tile.type] || '⬜';
      const playersHere = state.players.filter(p => (typeof p.position === 'number' ? p.position : 0) === tile.id);
      const playerDots = playersHere.map(p => `<span style="color:${p.color};font-size:10px;position:absolute;bottom:-2px;right:-2px">●</span>`).join('');
      html += `<div class="tile type-${tile.type} branch" style="left:${x}px;top:${y}px" title="[分支] ${tile.type}" data-id="${tile.id}">
        ${emoji}${playerDots}
      </div>`;
    });
  });

  html += '</div>';
  board.innerHTML = html;
}

function renderLog(state) {
  const log = document.getElementById('game-log');
  log.innerHTML = (state.log || []).map(l => `<div class="log-entry">${esc(l.msg)}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

function updateButtons(state, myIdx) {
  const currentP = state.players[state.currentTurn];
  const myTurn = currentP && myIdx === state.currentTurn;
  const phase = state.turnPhase;
  const me = state.players[myIdx];
  const alive = me && me.isAlive && !me.surrendered;

  document.getElementById('btn-roll').disabled = !(myTurn && phase === 'beforeMove' && alive);
  document.getElementById('btn-use-item').disabled = !(myTurn && alive);
  document.getElementById('btn-trigger').disabled = !(myTurn && phase === 'event' && !state.pendingEvent && alive);
  document.getElementById('btn-end-turn').disabled = !(myTurn && phase === 'event' && !state.pendingEvent && alive);
  document.getElementById('btn-surrender').disabled = !alive;
}

// ── 事件弹窗 ──
function checkEventModal(state, myIdx) {
  if (state.pendingEvent && state.pendingEvent.playerId === state.players[myIdx]?.id) {
    const ev = state.pendingEvent.event;
    document.getElementById('event-title').textContent = ev.name;
    document.getElementById('event-desc').textContent = ev.desc;
    const choicesDiv = document.getElementById('event-choices');
    choicesDiv.innerHTML = ev.choices.map(c => {
      const requires = c.requires ? ` [需要: ${c.requires}]` : '';
      return `<button class="choice-btn" onclick="makeChoice('${c.id}')">${c.label}${requires}</button>`;
    }).join('');
    openModal('modal-event');
  } else {
    closeModal('modal-event');
  }
}

// ══════════════════════════════════════
// 操作
// ══════════════════════════════════════

// 掷骰子
document.getElementById('btn-roll').onclick = () => {
  socket.emit('rollDice', {}, (res) => {
    if (res.ok) {
      if (res.stunned) { toast('你被眩晕了，无法移动！'); return; }
      toast(`🎲 掷出 ${res.dice}！移动${res.moveSteps}格`, 'gold');
    } else toast(res.msg);
  });
};

// 使用道具 - 打开背包
document.getElementById('btn-use-item').onclick = () => {
  if (!gameState) return;
  const myIdx = getPlayerIndex();
  const me = gameState.players[myIdx];
  if (!me) return;
  const items = me.items || [];
  const invDiv = document.getElementById('inventory-items');
  if (items.length === 0) { invDiv.innerHTML = '<p style="color:#95a5a6">背包为空</p>'; }
  else {
    // 道具数据（从服务器返回的是id数组或对象数组）
    invDiv.innerHTML = items.map((item, idx) => {
      const itemId = typeof item === 'string' ? item : item.id;
      const names = { bandage:'绷带',medkit:'医疗箱',revive:'复活药',antidote:'解毒剂',ironShield:'铁盾',magicShield:'魔法护盾',thornArmor:'反伤甲',luckyCharm:'幸运护符',reroll:'重掷券',doubleDice:'双倍骰',teleport:'传送卷轴',chestKey:'宝箱钥匙',timeHourglass:'时间沙漏',worldFreeze:'世界冻结',fateSwap:'命运交换',godDice:'神之骰',wealthScale:'财富天平',banana:'香蕉皮',mine:'地雷',freezeCard:'冰冻卡',stealCard:'偷窃卡',knife:'飞刀',fireBomb:'火焰炸弹',poison:'毒药',dragonCannon:'巨龙炮' };
      const types = { bandage:'回复',medkit:'回复',revive:'回复',antidote:'回复',ironShield:'防具',magicShield:'防具',thornArmor:'防具',luckyCharm:'防具',rerill:'一次性',reroll:'一次性',doubleDice:'一次性',teleport:'一次性',chestKey:'一次性',timeHourglass:'世界道具',worldFreeze:'世界道具',fateSwap:'世界道具',godDice:'世界道具',wealthScale:'世界道具',banana:'整蛊',mine:'整蛊',freezeCard:'整蛊',stealCard:'整蛊',knife:'攻击',fireBomb:'攻击',poison:'攻击',dragonCannon:'攻击' };
      return `<div class="inv-item" onclick="useItemFromInv('${itemId}', ${idx})">
        <div class="ii-name">${names[itemId] || itemId}</div>
        <div class="ii-type">${types[itemId] || '道具'}</div>
      </div>`;
    }).join('');
  }
  openModal('modal-inventory');
};

window.useItemFromInv = (itemId, idx) => {
  // 需要目标的道具
  const needTarget = ['mine','banana','freezeCard','stealCard','knife','fireBomb','poison','dragonCannon','fateSwap','wealthScale'];
  if (needTarget.includes(itemId)) {
    // 让选择目标
    const players = gameState.players.filter((p, i) => i !== getPlayerIndex() && p.isAlive);
    if (players.length === 0) { toast('没有可选目标'); return; }
    const invDiv = document.getElementById('inventory-items');
    invDiv.innerHTML = '<p style="margin-bottom:8px">选择目标:</p>' + players.map(p =>
      `<div class="inv-item" onclick="useItemWithTarget('${itemId}','${p.id}')"><div class="ii-name">${esc(p.name)}</div></div>`
    ).join('') + `<div class="inv-item" onclick="closeModal('modal-inventory')"><div class="ii-name">取消</div></div>`;
    return;
  }
  socket.emit('useItem', { itemId }, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    if (res.ok) closeModal('modal-inventory');
  });
};

window.useItemWithTarget = (itemId, targetId) => {
  socket.emit('useItem', { itemId, targetId }, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
    closeModal('modal-inventory');
  });
};

// 触发事件
document.getElementById('btn-trigger').onclick = () => {
  socket.emit('triggerEvent', (res) => {
    if (res.ok) {
      if (res.type === 'boss') {
        showBossModal(res.boss);
      } else if (res.type === 'minigame') {
        showMiniGame(res.gameId);
      } else if (res.type === 'shop') {
        showShop(res.shopType);
      } else {
        toast(res.msg, 'success');
      }
    } else toast(res.msg);
  });
};

// 事件选择
window.makeChoice = (choiceId) => {
  socket.emit('makeChoice', choiceId, (res) => {
    if (res.ok) { toast(res.msg, 'success'); closeModal('modal-event'); }
    else toast(res.msg);
  });
};

// 结束回合
document.getElementById('btn-end-turn').onclick = () => {
  socket.emit('endTurn', (res) => {
    if (res.ok) { toast(res.extraTurn ? '额外回合！' : '回合结束'); }
  });
};

// 商店
document.getElementById('btn-shop').onclick = () => showShop('normal');

function showShop(type) {
  const shopDiv = document.getElementById('shop-items');
  const mult = type === 'blackmarket' ? 1.5 : 1;
  shopDiv.innerHTML = SHOP_ITEMS.map(item => {
    const price = Math.floor(item.price * mult);
    return `<div class="shop-item" onclick="buyFromShop('${item.id}', ${price})">
      <div class="si-name">${item.name}</div>
      <div class="si-desc">${item.desc}</div>
      <div class="si-price">💰 ${price}</div>
    </div>`;
  }).join('');
  openModal('modal-shop');
}

window.buyFromShop = (itemId, price) => {
  socket.emit('buyItem', { itemId, price }, (res) => {
    toast(res.msg, res.ok ? 'success' : '');
  });
};

// 交易
document.getElementById('btn-trade').onclick = () => {
  if (!gameState) return;
  const me = gameState.players[getPlayerIndex()];
  const others = gameState.players.filter((p, i) => i !== getPlayerIndex() && p.isAlive && !p.surrendered);
  const sel = document.getElementById('trade-target');
  sel.innerHTML = others.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  openModal('modal-trade');
};

document.getElementById('btn-confirm-trade').onclick = () => {
  const targetId = document.getElementById('trade-target').value;
  const offerGold = parseInt(document.getElementById('trade-offer-gold').value) || 0;
  const requestGold = parseInt(document.getElementById('trade-request-gold').value) || 0;
  // 通过socketId找到目标
  const target = gameState.players.find(p => p.id === targetId);
  if (!target) { toast('目标不存在'); return; }
  socket.emit('trade', { targetSocketId: targetId, offer: { gold: offerGold }, request: { gold: requestGold } }, (res) => {
    if (res.ok) { toast('交易已发送', 'success'); closeModal('modal-trade'); }
    else toast(res.msg);
  });
};

// Boss战斗
function showBossModal(boss) {
  document.getElementById('boss-name').textContent = `👹 ${boss.name}`;
  document.getElementById('boss-desc').textContent = boss.desc;
  const hpPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
  document.getElementById('boss-hp').innerHTML = `<div class="boss-hp-fill" style="width:${hpPct}%">${boss.hp}/${boss.maxHp}</div>`;
  const me = gameState.players[getPlayerIndex()];
  const attackItems = (me.items || []).filter(item => {
    const id = typeof item === 'string' ? item : item.id;
    return ['knife','fireBomb','poison','dragonCannon'].includes(id);
  });
  const actDiv = document.getElementById('boss-actions');
  if (attackItems.length === 0) {
    actDiv.innerHTML = '<p style="color:#95a5a6">没有攻击道具</p>';
  } else {
    actDiv.innerHTML = attackItems.map(item => {
      const id = typeof item === 'string' ? item : item.id;
      const names = { knife:'飞刀(1伤害)', fireBomb:'火焰炸弹(2伤害)', poison:'毒药(持续)', dragonCannon:'巨龙炮(5伤害)' };
      return `<button class="btn btn-action" onclick="attackBossAction('${boss.id}','${id}')">${names[id] || id}</button>`;
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
        // 更新血条
        const boss = gameState.map.find(t => t.data?.bossId === bossId)?.data;
        const maxHp = boss ? (boss.maxHp || 50) : 50;
        document.getElementById('boss-hp').innerHTML = `<div class="boss-hp-fill" style="width:${Math.max(0,(res.bossHp/maxHp)*100)}%">${res.bossHp}/${maxHp}</div>`;
      }
    } else toast(res.msg);
  });
};

// 小游戏
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

// 投降
document.getElementById('btn-surrender').onclick = () => {
  if (confirm('确定要投降吗？')) {
    socket.emit('surrender', (res) => { if (res.ok) toast('你已投降'); });
  }
};

// ── 工具 ──
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// 初始化
showScreen('home');
