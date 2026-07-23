'use strict';

const { TILE_TYPES, BOSSES, COLLECTIONS, ITEMS, ASSETS, EVENTS } = require('./gameData');

// ── 工具函数 ──
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── 地图生成器 ──
function generateMap(playerCount) {
  const mainSize = rand(80, 120);
  const tiles = [];
  let tileId = 0;

  // 创建主路线格子
  for (let i = 0; i < mainSize; i++) {
    tiles.push({
      id: tileId++,
      type: 'empty',
      branchId: null,
      branchDepth: 0,
      nextTileIds: [],
      position: i,
      data: {},
    });
  }

  // 闭合环路：最后一个格子连回第一个
  for (let i = 0; i < mainSize - 1; i++) {
    tiles[i].nextTileIds = [tiles[i + 1].id];
  }
  tiles[mainSize - 1].nextTileIds = [tiles[0].id];

  // 放置Boss (25%, 50%, 75%)
  const bossPositions = [
    Math.floor(mainSize * 0.25),
    Math.floor(mainSize * 0.50),
    Math.floor(mainSize * 0.75),
  ];
  const bossKeys = Object.keys(BOSSES);
  bossPositions.forEach((pos, i) => {
    tiles[pos].type = 'boss';
    tiles[pos].data = { bossId: bossKeys[i] };
  });

  // 确保商业格间隔 >= 10
  const shopPositions = [];
  function canPlaceShop(pos) {
    return shopPositions.every(s => Math.abs(s - pos) >= 10);
  }

  // 按概率分配其他格子类型
  const typeDistribution = [
    { type: 'gold',       weight: 15 },
    { type: 'item',       weight: 12 },
    { type: 'heal',       weight: 8 },
    { type: 'empty',      weight: 20 },
    { type: 'mystery',    weight: 15 },
    { type: 'shop',       weight: 8 },
    { type: 'minigame',   weight: 7 },
    { type: 'collection', weight: 5 },
    { type: 'asset',      weight: 7 },
  ];

  function pickType() {
    const total = typeDistribution.reduce((s, d) => s + d.weight, 0);
    let r = Math.random() * total;
    for (const d of typeDistribution) {
      r -= d.weight;
      if (r <= 0) return d.type;
    }
    return 'empty';
  }

  for (const tile of tiles) {
    if (tile.type === 'boss') continue; // Boss已放置
    let t = pickType();
    // 商店间隔检查
    if (t === 'shop') {
      if (!canPlaceShop(tile.position)) {
        t = 'gold'; // 降级为金币格
      } else {
        shopPositions.push(tile.position);
      }
    }
    tile.type = t;
    tile.data = generateTileData(t);
  }

  // 生成分支路线 (2-3条)
  const branchCount = rand(2, 3);
  for (let b = 0; b < branchCount; b++) {
    const branchLength = rand(5, 10);
    const startPos = rand(10, mainSize - 15);
    const branchId = `branch_${b}`;

    // 分支入口
    const entryTile = tiles[startPos];
    const branchTiles = [];

    for (let i = 0; i < branchLength; i++) {
      const bt = {
        id: tileId++,
        type: 'empty',
        branchId,
        branchDepth: 1,
        nextTileIds: [],
        position: startPos + 0.1 * (i + 1), // 虚拟位置
        data: {},
      };
      branchTiles.push(bt);
    }

    // 分支内部连接
    for (let i = 0; i < branchLength - 1; i++) {
      branchTiles[i].nextTileIds = [branchTiles[i + 1].id];
    }
    // 分支末尾连回主路线
    const rejoinPos = (startPos + branchLength + rand(2, 5)) % mainSize;
    branchTiles[branchLength - 1].nextTileIds = [tiles[rejoinPos].id];

    // 分支入口指向分支第一个格子
    entryTile.nextTileIds.push(branchTiles[0].id);

    // 分支线分配格子类型（高风险高收益）
    const branchTypes = ['mystery', 'asset', 'collection', 'gold', 'item', 'mystery', 'boss'];
    for (let i = 0; i < branchLength; i++) {
      const bt = branchTiles[i];
      if (i === Math.floor(branchLength / 2)) {
        // 分支中间放高价值奖励
        bt.type = pick(['collection', 'asset']);
        bt.data = generateTileData(bt.type);
      } else {
        bt.type = pick(branchTypes);
        bt.data = generateTileData(bt.type);
      }
    }

    // 分支线放置第二个层级分支（最多2层）
    if (branchLength >= 7) {
      const subBranchStart = rand(2, 4);
      const subLength = rand(3, 5);
      const subTiles = [];
      for (let i = 0; i < subLength; i++) {
        subTiles.push({
          id: tileId++,
          type: 'empty',
          branchId: `${branchId}_sub`,
          branchDepth: 2,
          nextTileIds: [],
          position: branchTiles[subBranchStart].position + 0.01 * (i + 1),
          data: {},
        });
      }
      for (let i = 0; i < subLength - 1; i++) {
        subTiles[i].nextTileIds = [subTiles[i + 1].id];
      }
      subTiles[subLength - 1].nextTileIds = [branchTiles[subBranchStart + 1].id];
      branchTiles[subBranchStart].nextTileIds.push(subTiles[0].id);

      const subRewardPos = Math.floor(subLength / 2);
      for (let i = 0; i < subLength; i++) {
        if (i === subRewardPos) {
          subTiles[i].type = pick(['collection', 'asset', 'item']);
          subTiles[i].data = { item: 'random_epic' };
        } else {
          subTiles[i].type = pick(['mystery', 'gold', 'item', 'empty']);
          subTiles[i].data = generateTileData(subTiles[i].type);
        }
      }
      tiles.push(...subTiles);
    }

    tiles.push(...branchTiles);
  }

  return tiles;
}

function generateTileData(type) {
  switch (type) {
    case 'gold':
      return { amount: pick([100, 200, 300, 500]) };
    case 'item': {
      const pool = Object.values(require('./gameData').ITEMS);
      const normalItems = pool.filter(i => i.rarity === '普通');
      const rareItems = pool.filter(i => i.rarity === '稀有');
      const epicItems = pool.filter(i => i.rarity === '史诗');
      const legendaryItems = pool.filter(i => i.rarity === '传奇');
      const r = Math.random();
      if (r < 0.50) return { itemId: pick(normalItems).id };
      if (r < 0.80) return { itemId: pick(rareItems).id };
      if (r < 0.95) return { itemId: pick(epicItems).id };
      return { itemId: pick(legendaryItems).id };
    }
    case 'heal':
      return { amount: pick([1, 2]) };
    case 'mystery':
      return { eventId: pick(EVENTS).id };
    case 'shop':
      return { shopType: pick(['mystery', 'blackmarket', 'pawnshop']) };
    case 'minigame':
      return { gameId: pick(['texasHoldem', 'zhaJinHua', 'blackjack', 'luckyWheel', 'auction']) };
    case 'collection': {
      const sets = Object.values(COLLECTIONS);
      const s = pick(sets);
      const p = pick(s.pieces);
      return { setId: s.id, pieceId: p.id };
    }
    case 'asset': {
      const assetPool = Object.values(ASSETS);
      const r = Math.random();
      if (r < 0.50) return { assetId: pick(assetPool.filter(a => a.rarity === '普通')).id };
      if (r < 0.85) return { assetId: pick(assetPool.filter(a => a.rarity === '稀有')).id };
      return { assetId: pick(assetPool.filter(a => a.rarity === '传奇')).id };
    }
    case 'boss':
      return {}; // boss data已在generateMap中设置
    default:
      return {};
  }
}

module.exports = { generateMap };
