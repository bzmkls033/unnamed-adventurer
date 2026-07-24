'use strict';
const { ITEMS, ASSETS, COLLECTIONS, BOSSES, EVENTS, WORLD_RULES, TITLES, TILE_TYPES } = require('./gameData');
const { generateMap } = require('./mapGenerator');

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

class GameEngine {
  constructor(roomCode, playerNames) {
    this.roomCode = roomCode;
    this.map = generateMap(playerNames.length);
    this.worldRule = pick(WORLD_RULES);
    this.worldEventCount = 0;
    this.maxWorldEvents = 13;
    this.gameOver = false;
    this.winner = null;
    this.log = [];
    this.startTime = Date.now();
    this.maxDuration = 30 * 60 * 1000;
    this.currentPlayerIndex = 0;
    this.turnPhase = 'start';
    this.itemsUsedThisTurn = 0;
    this.diceResult = null;
    this.pendingEvent = null;
    this.pendingTrade = null;
    this.frozenPlayers = {};
    this.bossStates = {};
    this.tradeId = 0;
    this.miniGame = null;

    // 初始化Boss状态
    for (const [key, boss] of Object.entries(BOSSES)) {
      let hp = boss.hp;
      if (this.worldRule.effect.bossHpMult) hp = Math.ceil(hp * this.worldRule.effect.bossHpMult);
      this.bossStates[key] = { hp, maxHp: hp, defeated: false };
    }

    // 初始化玩家
    const colors = ['#e94560','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e74c3c'];
    const startTile = this.map.find(t => t.branchId === null && t.position === 0);
    this.players = playerNames.map((name, i) => ({
      id: `p${i}`, name, color: colors[i % colors.length],
      hp: 5 + (this.worldRule.effect.startHp || 0), maxHp: 5,
      gold: 1000, position: startTile ? startTile.id : 0,
      items: [], assets: [], collections: {},
      titles: [], isAlive: true, isBankrupt: false, surrendered: false,
      gamblingProfit: 0, branchesExplored: 0, bossesDefeated: [],
      poisonTurns: 0, cursed: false, stunned: false,
    }));
  }

  addLog(msg) { this.log.push({ time: Date.now(), msg }); if (this.log.length > 200) this.log.shift(); }

  getCurrentPlayer() { return this.players[this.currentPlayerIndex]; }

  getState(forPlayerId) {
    return {
      map: this.map.map(t => ({ id: t.id, type: t.type, branchId: t.branchId, branchDepth: t.branchDepth, nextTileIds: t.nextTileIds, position: t.position, data: { ...t.data, bossState: t.type === 'boss' && t.data.bossId ? this.bossStates[t.data.bossId] : undefined } })),
      players: this.players.map(p => ({
        ...p,
        items: p.id === forPlayerId ? p.items : p.items.map(() => ({ hidden: true })),
        assets: p.assets,
      })),
      currentTurn: this.currentPlayerIndex,
      currentPlayerId: this.getCurrentPlayer()?.id,
      turnPhase: this.turnPhase,
      worldRule: this.worldRule,
      worldEventCount: this.worldEventCount,
      gameOver: this.gameOver,
      winner: this.winner,
      log: this.log.slice(-30),
      timeLeft: Math.max(0, this.maxDuration - (Date.now() - this.startTime)),
      pendingEvent: this.pendingEvent,
      pendingTrade: this.pendingTrade,
      miniGame: this.miniGame,
    };
  }

  // ── 回合开始 ──
  startTurn() {
    const p = this.getCurrentPlayer();
    if (!p || !p.isAlive || p.surrendered) { this.nextPlayer(); return; }
    this.turnPhase = 'beforeMove';
    this.itemsUsedThisTurn = 0;
    this.diceResult = null;
    this.pendingEvent = null;
    // 解除冻结
    if (this.frozenPlayers[p.id]) {
      if (this.frozenPlayers[p.id].freezeItems) { this.frozenPlayers[p.id].freezeItems--; }
      if (this.frozenPlayers[p.id].stunMove) { p.stunned = true; delete this.frozenPlayers[p.id].stunMove; }
      else { p.stunned = false; }
    }
    // 毒伤
    if (p.poisonTurns > 0) {
      p.hp -= 1; p.poisonTurns--;
      this.addLog(`${p.name} 受到毒伤，-1生命`);
      if (p.hp <= 0) { p.hp = 0; this.checkElimination(p); }
    }
    // 诅咒
    if (p.cursed) { p.cursed = false; }
    this.addLog(`--- ${p.name} 的回合开始 ---`);
  }

  // ── 使用道具 ──
  useItem(playerId, itemId, targetId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p || !p.isAlive) return { ok: false, msg: '玩家不存在或已淘汰' };
    if (this.itemsUsedThisTurn >= 2) return { ok: false, msg: '本回合已使用2次道具' };
    const itemIdx = p.items.findIndex(i => i.id === itemId);
    if (itemIdx === -1) return { ok: false, msg: '没有这个道具' };
    const itemDef = ITEMS[itemId];
    if (!itemDef) return { ok: false, msg: '道具不存在' };
    const item = p.items[itemIdx];
    const eff = itemDef.effect;
    const target = targetId ? this.players.find(x => x.id === targetId) : null;
    let msg = '';

    // 回复类
    if (eff.heal) {
      if (p.hp >= p.maxHp) return { ok: false, msg: '生命值已满，无需恢复' };
      p.hp = Math.min(p.maxHp, p.hp + eff.heal);
      msg = `${p.name} 使用${itemDef.name}，恢复${eff.heal}生命`;
    }
    else if (eff.revive) { if (p.hp > 0) return { ok: false, msg: '你没有濒死' }; p.hp = eff.revive; msg = `${p.name} 使用${itemDef.name}，复活了！`; }
    else if (eff.cure) { p.poisonTurns = 0; p.cursed = false; msg = `${p.name} 使用${itemDef.name}，解除了负面状态`; }
    else if (eff.healFull) { p.hp = p.maxHp; msg = `${p.name} 恢复了全部生命`; }
    // 防具类 (被动效果，装备后自动生效)
    else if (eff.block || eff.reduce || eff.reflect || eff.fatalBlock) {
      p.items[itemIdx].equipped = true;
      msg = `${p.name} 装备了${itemDef.name}`;
      this.itemsUsedThisTurn++;
      this.addLog(msg);
      return { ok: true, msg };
    }
    // 一次性道具
    else if (eff.reroll) { this.turnPhase = 'beforeMove'; msg = `${p.name} 使用重掷券，可以重新掷骰`; }
    else if (eff.doubleMove) { p.items[itemIdx].doubleMove = true; msg = `${p.name} 使用双倍骰，下次移动距离×2`; }
    else if (eff.teleport) { p.items[itemIdx].teleport = true; msg = `${p.name} 使用传送卷轴，可选择传送目标`; }
    else if (eff.upgradeChest) { p.items[itemIdx].upgradeChest = true; msg = `${p.name} 使用宝箱钥匙`; }
    // 世界道具
    else if (eff.extraTurn) { p.items[itemIdx].extraTurn = true; msg = `${p.name} 使用时间沙漏，将获得额外回合`; }
    else if (eff.freezeOthers) {
      this.players.forEach(op => { if (op.id !== p.id && op.isAlive) this.frozenPlayers[op.id] = { turns: 1 }; });
      msg = `${p.name} 使用世界冻结！其他玩家下一回合无法行动`;
    }
    else if (eff.swapAssets) {
      if (!target) return { ok: false, msg: '需要指定目标' };
      const temp = [...p.assets]; p.assets = [...target.assets]; target.assets = temp;
      msg = `${p.name} 与 ${target.name} 交换了全部资产！`;
    }
    else if (eff.chooseDice) { p.items[itemIdx].chooseDice = true; msg = `${p.name} 使用神之骰，可指定骰子点数`; }
    else if (eff.swapGold) {
      if (!target) return { ok: false, msg: '需要指定目标' };
      const temp = p.gold; p.gold = target.gold; target.gold = temp;
      msg = `${p.name} 与 ${target.name} 交换了金币！`;
    }
    // 整蛊类
    else if (eff.stunMove) {
      if (!target) return { ok: false, msg: '需要指定目标' };
      if (!this.frozenPlayers[target.id]) this.frozenPlayers[target.id] = {};
      this.frozenPlayers[target.id].stunMove = true;
      msg = `${p.name} 对 ${target.name} 使用香蕉皮！`;
      p.items.splice(itemIdx, 1);
      this.itemsUsedThisTurn++;
      this.addLog(msg);
      return { ok: true, msg };
    }
    else if (eff.damage && itemDef.type === '整蛊类') {
      if (!target) return { ok: false, msg: '需要指定目标' };
      this.dealDamageToPlayer(target, eff.damage);
      msg = `${p.name} 对 ${target.name} 使用${itemDef.name}！`;
      p.items.splice(itemIdx, 1);
      this.itemsUsedThisTurn++;
      this.addLog(msg);
      return { ok: true, msg };
    }
    else if (eff.freezeItems) {
      if (!target) return { ok: false, msg: '需要指定目标' };
      if (!this.frozenPlayers[target.id]) this.frozenPlayers[target.id] = {};
      this.frozenPlayers[target.id].freezeItems = 1;
      msg = `${p.name} 对 ${target.name} 使用冰冻卡！`;
      p.items.splice(itemIdx, 1);
      this.itemsUsedThisTurn++;
      this.addLog(msg);
      return { ok: true, msg };
    }
    else if (eff.steal) {
      if (!target) return { ok: false, msg: '需要指定目标' };
      const normalItems = target.items.filter(i => ITEMS[i.id] && ITEMS[i.id].rarity === '普通');
      if (normalItems.length === 0) return { ok: false, msg: '目标没有普通道具' };
      const stolen = pick(normalItems);
      target.items = target.items.filter((_, idx) => idx !== target.items.indexOf(stolen));
      p.items.push(stolen);
      msg = `${p.name} 偷取了 ${target.name} 的 ${ITEMS[stolen.id]?.name || '道具'}！`;
      p.items.splice(itemIdx, 1);
      this.itemsUsedThisTurn++;
      this.addLog(msg);
      return { ok: true, msg };
    }
    // 攻击类
    else if (eff.damage) {
      if (!target) return { ok: false, msg: '需要指定目标' };
      this.dealDamageToPlayer(target, eff.damage);
      msg = `${p.name} 对 ${target.name} 使用${itemDef.name}，造成${eff.damage}伤害！`;
    }
    else if (eff.poison) {
      if (!target) return { ok: false, msg: '需要指定目标' };
      target.poisonTurns += eff.poison;
      msg = `${p.name} 对 ${target.name} 使用毒药！持续掉血${eff.poison}回合`;
    }
    else { return { ok: false, msg: '未知道具效果' }; }

    p.items.splice(itemIdx, 1);
    this.itemsUsedThisTurn++;
    this.addLog(msg);
    return { ok: true, msg };
  }

  dealDamageToPlayer(target, amount) {
    // 检查防具
    const shield = target.items.find(i => i.equipped && ITEMS[i.id]?.effect?.block);
    if (shield) { target.items = target.items.filter(x => x !== shield); this.addLog(`${target.name} 的 ${ITEMS[shield.id].name} 抵挡了攻击`); return; }
    const magicShield = target.items.find(i => i.equipped && ITEMS[i.id]?.effect?.reduce);
    if (magicShield) { amount = Math.max(0, amount - ITEMS[magicShield.id].effect.reduce); target.items = target.items.filter(x => x !== magicShield); }
    const thorn = target.items.find(i => i.equipped && ITEMS[i.id]?.effect?.reflect);
    const attacker = this.getCurrentPlayer();
    target.hp -= amount;
    if (thorn && attacker) { attacker.hp -= ITEMS[thorn.id].effect.reflect; this.addLog(`${target.name} 的反伤甲反弹了${ITEMS[thorn.id].effect.reflect}伤害`); }
    if (target.hp <= 0) {
      const lucky = target.items.find(i => i.equipped && ITEMS[i.id]?.effect?.fatalBlock);
      if (lucky) { target.hp = 1; target.items = target.items.filter(x => x !== lucky); this.addLog(`${target.name} 的幸运护符抵挡了致命一击！`); }
      else { target.hp = 0; this.checkElimination(target); }
    }
  }

  // ── 掷骰子 ──
  rollDice(playerId, chosenValue) {
    const p = this.players.find(x => x.id === playerId);
    if (!p || p.id !== this.getCurrentPlayer()?.id) return { ok: false, msg: '不是你的回合' };
    if (this.turnPhase !== 'beforeMove') return { ok: false, msg: '现在不能掷骰子' };
    if (p.stunned) { p.stunned = false; this.addLog(`${p.name} 被眩晕，无法移动`); this.turnPhase = 'event'; return { ok: true, dice: 0, moved: false, stunned: true }; }

    let dice;
    const chooseDiceItem = p.items.find(i => i.chooseDice);
    if (chooseDiceItem && chosenValue) { dice = Math.min(6, Math.max(1, chosenValue)); p.items = p.items.filter(x => x !== chooseDiceItem); }
    else { dice = rand(1, 6); }
    if (p.cursed) dice = Math.max(1, dice - 1);

    const doubleItem = p.items.find(i => i.doubleMove);
    const moveSteps = doubleItem ? dice * 2 : dice;
    if (doubleItem) p.items = p.items.filter(x => x !== doubleItem);

    // 移动
    const currentTile = this.map.find(t => t.id === p.position);
    let targetTileId = p.position;
    let stepsLeft = moveSteps;
    let cur = currentTile;
    while (stepsLeft > 0 && cur) {
      if (cur.nextTileIds.length === 0) break;
      targetTileId = cur.nextTileIds[0]; // 默认走主路线
      cur = this.map.find(t => t.id === targetTileId);
      stepsLeft--;
    }
    p.position = targetTileId;

    // 检查分支探索
    const landed = this.map.find(t => t.id === targetTileId);
    if (landed && landed.branchId) { p.branchesExplored++; }

    this.diceResult = dice;
    this.turnPhase = 'event';
    this.addLog(`${p.name} 掷出 ${dice}，移动到 [${TILE_TYPES[landed?.type]?.name || '未知'}]`);

    // 自动触发格子事件
    const eventResult = this.triggerEvent(playerId);
    const needsInput = !!this.pendingEvent || !!this.miniGame || (eventResult.type === 'boss');

    if (!needsInput) {
      // 不需要玩家操作的事件，自动结束回合
      this.addLog(`${p.name} 的回合结束`);
      this.turnPhase = 'start';
      const extraItem = p.items.find(i => i.extraTurn);
      if (extraItem) {
        p.items = p.items.filter(x => x !== extraItem);
        this.addLog(`${p.name} 使用时间沙漏获得额外回合！`);
        this.startTurn();
        return { ok: true, dice, moveSteps, landedTile: landed, event: eventResult, extraTurn: true };
      }
      this.nextPlayer();
    }
    // 需要玩家操作时（mystery/boss/minigame），保持回合不结束

    return { ok: true, dice, moveSteps, landedTile: landed, event: eventResult, needsInput };
  }

  // ── 触发地图事件 ──
  triggerEvent(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p || p.id !== this.getCurrentPlayer()?.id) return { ok: false, msg: '不是你的回合' };
    if (this.turnPhase !== 'event') return { ok: false, msg: '现在不能触发事件' };
    const tile = this.map.find(t => t.id === p.position);
    if (!tile) return { ok: false, msg: '格子不存在' };

    let result = {};
    switch (tile.type) {
      case 'gold': {
        let amount = tile.data.amount || 100;
        if (this.worldRule.effect.goldBonus) amount = Math.floor(amount * this.worldRule.effect.goldBonus);
        p.gold += amount;
        result = { type: 'gold', msg: `${p.name} 获得 ${amount} 金币`, amount };
        break;
      }
      case 'item': {
        const itemId = tile.data.itemId;
        if (itemId && ITEMS[itemId]) {
          p.items.push({ id: itemId });
          result = { type: 'item', msg: `${p.name} 获得 ${ITEMS[itemId].name}`, item: ITEMS[itemId] };
        } else {
          // 随机道具
          const pool = Object.values(ITEMS).filter(i => i.price !== null);
          const item = pick(pool);
          p.items.push({ id: item.id });
          result = { type: 'item', msg: `${p.name} 获得 ${item.name}`, item };
        }
        break;
      }
      case 'heal': {
        const amount = tile.data.amount || 1;
        p.hp = Math.min(p.maxHp, p.hp + amount);
        result = { type: 'heal', msg: `${p.name} 恢复 ${amount} 生命`, amount };
        break;
      }
      case 'mystery': {
        const event = EVENTS.find(e => e.id === tile.data.eventId) || pick(EVENTS);
        this.pendingEvent = { event, playerId: p.id };
        result = { type: 'mystery', msg: `触发事件: ${event.name}`, event };
        break;
      }
      case 'shop': {
        result = { type: 'shop', msg: `${p.name} 到达商店`, shopType: tile.data.shopType };
        break;
      }
      case 'minigame': {
        this.startMiniGame(tile.data.gameId);
        result = { type: 'minigame', msg: `触发小游戏: ${tile.data.gameId}`, gameId: tile.data.gameId };
        break;
      }
      case 'boss': {
        const bossId = tile.data.bossId;
        const boss = BOSSES[bossId];
        const state = this.bossStates[bossId];
        if (state && !state.defeated) {
          result = { type: 'boss', msg: `遭遇Boss: ${boss.name}`, boss: { ...boss, ...state } };
        } else {
          result = { type: 'empty', msg: 'Boss已被击败' };
        }
        break;
      }
      case 'collection': {
        const { setId, pieceId } = tile.data;
        if (setId && pieceId) {
          if (!p.collections[setId]) p.collections[setId] = [];
          if (!p.collections[setId].includes(pieceId)) {
            p.collections[setId].push(pieceId);
            const col = COLLECTIONS[setId];
            const piece = col?.pieces.find(pp => pp.id === pieceId);
            result = { type: 'collection', msg: `${p.name} 获得藏品: ${piece?.name || pieceId}`, setId, pieceId };
          } else {
            p.gold += 200;
            result = { type: 'gold', msg: `${p.name} 已拥有此藏品，获得200金币` };
          }
        }
        break;
      }
      case 'asset': {
        const assetId = tile.data.assetId;
        if (assetId && ASSETS[assetId]) {
          p.assets.push({ id: assetId });
          result = { type: 'asset', msg: `${p.name} 获得资产: ${ASSETS[assetId].name}`, asset: ASSETS[assetId] };
        }
        break;
      }
      default:
        result = { type: 'empty', msg: '什么都没发生' };
    }

    if (result.msg) this.addLog(result.msg);
    // 检查称号
    this.checkTitles(p);
    return { ok: true, ...result };
  }

  // ── 事件选择 ──
  makeChoice(playerId, choiceId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p || !this.pendingEvent || this.pendingEvent.playerId !== playerId) return { ok: false, msg: '没有待处理事件' };
    const event = this.pendingEvent.event;
    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) return { ok: false, msg: '选项不存在' };

    // 检查道具需求
    if (choice.requires) {
      const hasKey = p.items.find(i => i.id === choice.requires);
      if (!hasKey) return { ok: false, msg: `需要道具: ${ITEMS[choice.requires]?.name}` };
      p.items = p.items.filter((item, idx) => { if (item.id === choice.requires && !item._used) { item._used = true; return false; } return true; });
    }

    // 随机结果
    const totalWeight = choice.outcomes.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * totalWeight;
    let outcome = choice.outcomes[0];
    for (const o of choice.outcomes) { r -= o.weight; if (r <= 0) { outcome = o; break; } }
    const res = outcome.result;

    let msg = res.msg || '事件结束';
    if (res.gold) { p.gold = Math.max(0, p.gold + res.gold); }
    if (res.hp) { p.hp = Math.max(0, Math.min(p.maxHp, p.hp + res.hp)); if (p.hp <= 0) this.checkElimination(p); }
    if (res.healFull) { p.hp = p.maxHp; }
    if (res.status === 'cursed') { p.cursed = true; }
    if (res.item) {
      if (res.item === 'random_normal') { const pool = Object.values(ITEMS).filter(i => i.rarity === '普通'); p.items.push({ id: pick(pool).id }); }
      else if (res.item === 'random_rare') { const pool = Object.values(ITEMS).filter(i => i.rarity === '稀有'); p.items.push({ id: pick(pool).id }); }
      else if (res.item === 'random_epic') { const pool = Object.values(ITEMS).filter(i => i.rarity === '史诗'); p.items.push({ id: pick(pool).id }); }
      else if (res.item === 'random_legendary') { const pool = Object.values(ITEMS).filter(i => i.rarity === '传奇'); p.items.push({ id: pick(pool).id }); }
      else { p.items.push({ id: res.item }); }
    }
    if (res.asset) { p.assets.push({ id: res.asset }); }
    if (res.collection === 'random_piece') {
      const sets = Object.values(COLLECTIONS);
      const s = pick(sets);
      const piece = pick(s.pieces);
      if (!p.collections[s.id]) p.collections[s.id] = [];
      if (!p.collections[s.id].includes(piece.id)) p.collections[s.id].push(piece.id);
    }

    this.pendingEvent = null;
    this.addLog(msg);
    this.checkTitles(p);
    return { ok: true, msg };
  }

  // ── 商店购买 ──
  buyItem(playerId, itemId, price) {
    const p = this.players.find(x => x.id === playerId);
    if (!p) return { ok: false, msg: '玩家不存在' };
    const itemDef = ITEMS[itemId];
    if (!itemDef) return { ok: false, msg: '道具不存在' };
    const cost = price || itemDef.price;
    if (!cost) return { ok: false, msg: '该道具不可购买' };
    if (p.gold < cost) return { ok: false, msg: '金币不足' };
    p.gold -= cost;
    p.items.push({ id: itemId });
    this.addLog(`${p.name} 购买了 ${itemDef.name}，花费${cost}金币`);
    return { ok: true, msg: `购买成功: ${itemDef.name}` };
  }

  // ── Boss战斗 ──
  attackBoss(playerId, bossId, itemIds) {
    const p = this.players.find(x => x.id === playerId);
    if (!p) return { ok: false, msg: '玩家不存在' };
    const boss = BOSSES[bossId];
    const state = this.bossStates[bossId];
    if (!boss || !state || state.defeated) return { ok: false, msg: 'Boss不存在或已被击败' };

    let totalDamage = 0;
    for (const itemId of itemIds) {
      const itemDef = ITEMS[itemId];
      if (itemDef && itemDef.effect.damage) {
        totalDamage += itemDef.effect.damage;
        const idx = p.items.findIndex(it => it.id === itemId);
        if (idx >= 0) p.items.splice(idx, 1);
      }
    }
    if (totalDamage === 0) return { ok: false, msg: '没有有效的攻击道具' };

    state.hp -= totalDamage;
    this.addLog(`${p.name} 对 ${boss.name} 造成 ${totalDamage} 伤害 (剩余${state.hp}/${state.maxHp})`);

    // Boss反击
    if (state.hp > 0) {
      this.dealDamageToPlayer(p, boss.attack);
      this.addLog(`${boss.name} 反击！${p.name} 受到 ${boss.attack} 伤害`);
    }

    // Boss被击败
    if (state.hp <= 0) {
      state.defeated = true;
      p.bossesDefeated.push(bossId);
      this.addLog(`${p.name} 击败了 ${boss.name}！`);
      // 发放奖励
      if (boss.rewards.assets) { boss.rewards.assets.forEach(aid => p.assets.push({ id: aid })); }
      if (boss.rewards.items) { const itemId = pick(boss.rewards.items); p.items.push({ id: itemId }); this.addLog(`${p.name} 获得 ${ITEMS[itemId]?.name}`); }
      if (boss.rewards.collectionPieces) {
        const sets = Object.values(COLLECTIONS);
        const s = pick(sets); const piece = pick(s.pieces);
        if (!p.collections[s.id]) p.collections[s.id] = [];
        if (!p.collections[s.id].includes(piece.id)) p.collections[s.id].push(piece.id);
        this.addLog(`${p.name} 获得藏品: ${piece.name}`);
      }
      this.checkTitles(p);
    }
    return { ok: true, msg: `攻击Boss: ${totalDamage}伤害`, bossHp: state.hp, bossDefeated: state.defeated };
  }

  // ── 交易系统 ──
  createTrade(fromId, toId, offer, request) {
    const from = this.players.find(x => x.id === fromId);
    const to = this.players.find(x => x.id === toId);
    if (!from || !to) return { ok: false, msg: '玩家不存在' };
    if (!this.worldRule.effect.freeTrade && from.gold < 50) return { ok: false, msg: '交易手续费不足(50金币)' };
    const tid = ++this.tradeId;
    this.pendingTrade = { id: tid, fromId, toId, offer, request, status: 'pending' };
    this.addLog(`${from.name} 向 ${to.name} 发起交易`);
    return { ok: true, tradeId: tid };
  }

  respondTrade(playerId, tradeId, accept) {
    if (!this.pendingTrade || this.pendingTrade.id !== tradeId) return { ok: false, msg: '交易不存在' };
    if (this.pendingTrade.toId !== playerId) return { ok: false, msg: '你不是交易对象' };
    if (!accept) { this.pendingTrade = null; return { ok: true, msg: '交易被拒绝' }; }

    const from = this.players.find(x => x.id === this.pendingTrade.fromId);
    const to = this.players.find(x => x.id === this.pendingTrade.toId);
    const { offer, request } = this.pendingTrade;

    // 交换金币
    if (offer.gold) { from.gold -= offer.gold; to.gold += offer.gold; }
    if (request.gold) { to.gold -= request.gold; from.gold += request.gold; }
    // 交换道具
    if (offer.items) { offer.items.forEach(itemId => { const idx = from.items.findIndex(i => i.id === itemId); if (idx >= 0) { to.items.push(from.items.splice(idx, 1)[0]); } }); }
    if (request.items) { request.items.forEach(itemId => { const idx = to.items.findIndex(i => i.id === itemId); if (idx >= 0) { from.items.push(to.items.splice(idx, 1)[0]); } }); }
    // 手续费
    if (!this.worldRule.effect.freeTrade) { from.gold -= 50; }
    this.pendingTrade = null;
    this.addLog(`${from.name} 和 ${to.name} 完成了交易`);
    return { ok: true, msg: '交易完成' };
  }

  // ── 小游戏 ──
  startMiniGame(gameId) {
    this.miniGame = { id: gameId, phase: 'betting', pot: 0, playerHands: {}, results: {} };
  }

  miniGameAction(playerId, action, data) {
    if (!this.miniGame) return { ok: false, msg: '没有进行中的小游戏' };
    const p = this.players.find(x => x.id === playerId);
    if (!p) return { ok: false, msg: '玩家不存在' };
    const mg = this.miniGame;
    const mult = this.worldRule.effect.miniGameMultiplier || 1;

    switch (mg.id) {
      case 'luckyWheel': {
        const prizes = [
          { type: 'gold', value: 500 * mult, msg: '获得500金币' },
          { type: 'gold', value: 1000 * mult, msg: '获得1000金币' },
          { type: 'item', rarity: 'rare', msg: '获得稀有道具' },
          { type: 'item', rarity: 'epic', msg: '获得史诗道具' },
          { type: 'hp', value: -1, msg: '损失1生命' },
          { type: 'gold', value: 200 * mult, msg: '获得200金币' },
        ];
        const prize = pick(prizes);
        if (prize.type === 'gold') { p.gold += prize.value; p.gamblingProfit += prize.value; }
        else if (prize.type === 'item') { const pool = Object.values(ITEMS).filter(i => i.rarity === (prize.rarity === 'rare' ? '稀有' : '史诗') && i.price); p.items.push({ id: pick(pool).id }); }
        else if (prize.type === 'hp') { p.hp = Math.max(0, p.hp + prize.value); if (p.hp <= 0) this.checkElimination(p); }
        this.addLog(`${p.name} 转动幸运轮盘: ${prize.msg}`);
        this.miniGame = null;
        return { ok: true, msg: prize.msg, prize };
      }
      case 'blackjack': {
        if (action === 'hit') {
          if (!mg.playerHands[playerId]) mg.playerHands[playerId] = { cards: [], total: 0 };
          const hand = mg.playerHands[playerId];
          const card = rand(1, 11);
          hand.cards.push(card);
          hand.total += card;
          if (hand.total > 21) {
            const loss = (data?.bet || 200) * mult;
            p.gold -= loss;
            this.addLog(`${p.name} 爆牌！损失${loss}金币`);
            this.miniGame = null;
            return { ok: true, msg: `爆牌！损失${loss}金币`, bust: true };
          }
          return { ok: true, msg: `抽到${card}，当前${hand.total}`, total: hand.total };
        } else if (action === 'stand') {
          const hand = mg.playerHands[playerId] || { total: 0 };
          const dealerTotal = rand(17, 23);
          const bet = (data?.bet || 200) * mult;
          if (dealerTotal > 21 || hand.total > dealerTotal) {
            p.gold += bet; p.gamblingProfit += bet;
            this.addLog(`${p.name} 二十一点获胜！+${bet}金币`);
            this.miniGame = null;
            return { ok: true, msg: `获胜！庄家${dealerTotal}，你${hand.total}，+${bet}金币` };
          } else {
            p.gold -= bet;
            this.addLog(`${p.name} 二十一点失败！-${bet}金币`);
            this.miniGame = null;
            return { ok: true, msg: `失败！庄家${dealerTotal}，你${hand.total}，-${bet}金币` };
          }
        }
        break;
      }
      default: {
        // 通用小游戏: 简单随机胜负
        const bet = (data?.bet || 200) * mult;
        if (p.gold < bet) return { ok: false, msg: '金币不足' };
        const win = Math.random() < 0.45;
        if (win) { p.gold += bet; p.gamblingProfit += bet; this.addLog(`${p.name} 小游戏获胜！+${bet}金币`); }
        else { p.gold -= bet; this.addLog(`${p.name} 小游戏失败！-${bet}金币`); }
        this.miniGame = null;
        return { ok: true, msg: win ? `获胜！+${bet}金币` : `失败！-${bet}金币`, win };
      }
    }
    return { ok: false, msg: '未知操作' };
  }

  // ── 投降 ──
  surrender(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p) return { ok: false };
    p.surrendered = true;
    this.addLog(`${p.name} 投降了`);
    this.checkVictory();
    return { ok: true };
  }

  // ── 回合结束 ──
  endTurn(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p || p.id !== this.getCurrentPlayer()?.id) return { ok: false };
    // 检查是否有未完成的事件/小游戏/交易
    if (this.pendingEvent && this.pendingEvent.playerId === playerId) return { ok: false, msg: '请先完成当前事件选择' };
    if (this.miniGame) return { ok: false, msg: '请先完成小游戏' };
    if (this.pendingTrade && (this.pendingTrade.fromId === playerId || this.pendingTrade.toId === playerId)) return { ok: false, msg: '请先回应交易请求' };
    this.addLog(`${p.name} 的回合结束`);
    this.turnPhase = 'start';
    // 额外回合检查
    const extraItem = p.items.find(i => i.extraTurn);
    if (extraItem) { p.items = p.items.filter(x => x !== extraItem); this.addLog(`${p.name} 使用时间沙漏获得额外回合！`); return { ok: true, extraTurn: true }; }
    this.nextPlayer();
    return { ok: true };
  }

  nextPlayer() {
    let attempts = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
      if (attempts > this.players.length) { this.checkVictory(); return; }
    } while (!this.getCurrentPlayer()?.isAlive || this.getCurrentPlayer()?.surrendered);

    const cp = this.getCurrentPlayer();
    if (cp && this.frozenPlayers[cp.id]) {
      // 处理冰冻卡（跳过回合）
      if (this.frozenPlayers[cp.id].turns > 0) {
        this.frozenPlayers[cp.id].turns--;
        if (this.frozenPlayers[cp.id].turns <= 0) delete this.frozenPlayers[cp.id];
        this.addLog(`${cp.name} 被冻结，跳过回合`);
        this.nextPlayer();
        return;
      }
      // stunMove 在 startTurn 中处理（设 stunned=true），这里清理过期状态
      if (this.frozenPlayers[cp.id].stunMove && !this.frozenPlayers[cp.id].turns) {
        // stunMove 会在 startTurn 中消费掉，回合开始后自动解除
      }
    }
    this.startTurn();
  }

  checkElimination(p) {
    p.isAlive = false;
    this.addLog(`${p.name} 被淘汰了！`);
    this.checkVictory();
  }

  checkVictory() {
    if (this.gameOver) return;
    const alive = this.players.filter(p => p.isAlive && !p.surrendered);
    if (alive.length <= 1) {
      this.gameOver = true;
      this.winner = alive[0] || null;
      this.addLog(this.winner ? `${this.winner.name} 获得胜利！` : '平局！');
      return;
    }
    // 时间结束
    if (Date.now() - this.startTime >= this.maxDuration) {
      this.gameOver = true;
      this.winner = alive.reduce((best, p) => (this.getPlayerWealth(p) > this.getPlayerWealth(best) ? p : best), alive[0]);
      this.addLog(`时间到！${this.winner.name} 以最高资产获胜！`);
    }
  }

  getPlayerWealth(p) {
    const assetValue = p.assets.reduce((s, a) => s + (ASSETS[a.id]?.value || 0), 0);
    const collectionValue = Object.entries(p.collections).reduce((s, [setId, pieces]) => {
      const col = COLLECTIONS[setId];
      return s + (col && pieces.length >= col.pieces.length ? col.bonus : 0);
    }, 0);
    return p.gold + assetValue + collectionValue;
  }

  checkTitles(p) {
    for (const title of TITLES) {
      if (p.titles.includes(title.id)) continue;
      let earned = false;
      if (title.condition.completeCollection) {
        earned = Object.entries(p.collections).some(([setId, pieces]) => COLLECTIONS[setId] && pieces.length >= COLLECTIONS[setId].pieces.length);
      }
      if (title.condition.gamblingProfit) earned = p.gamblingProfit >= title.condition.gamblingProfit;
      if (title.condition.branchesExplored) earned = p.branchesExplored >= title.condition.branchesExplored;
      if (title.condition.bossDefeated) earned = p.bossesDefeated.length > 0;
      if (earned) {
        p.titles.push(title.id);
        if (title.reward.asset) p.gold += title.reward.asset;
        this.addLog(`${p.name} 获得称号: ${title.name}！+${title.reward.asset || 0}金币`);
        // 收藏家特殊效果：再次集齐任意套装直接胜利
        if (title.id === 'collector') {
          const hasFullSet = Object.entries(p.collections).some(([setId, pieces]) => COLLECTIONS[setId] && pieces.length >= COLLECTIONS[setId].pieces.length);
          if (hasFullSet && p.titles.filter(t => t === 'collector').length >= 2) {
            this.gameOver = true;
            this.winner = p;
            this.addLog(`${p.name} 作为收藏家再次集齐套装，直接获胜！`);
          }
        }
      }
    }
  }

  // ── 定时器检查 ──
  tick() {
    if (!this.gameOver) this.checkVictory();
    return this.gameOver;
  }
}

module.exports = GameEngine;
