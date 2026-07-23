'use strict';

// ═══════════════════════════════════════════
// 不知名冒险家 - 游戏数据配置
// ═══════════════════════════════════════════

// ── 道具系统 ──
const ITEMS = {
  // 回复类
  bandage:       { id:'bandage',       name:'绷带',       desc:'恢复1生命',           type:'回复类',  rarity:'普通', price:100,  effect:{heal:1} },
  medkit:        { id:'medkit',        name:'医疗箱',     desc:'恢复3生命',           type:'回复类',  rarity:'稀有', price:400,  effect:{heal:3} },
  revive:        { id:'revive',        name:'复活药',     desc:'濒死状态立即恢复2生命', type:'回复类',  rarity:'史诗', price:800,  effect:{revive:2} },
  antidote:      { id:'antidote',      name:'解毒剂',     desc:'解除负面状态',         type:'回复类',  rarity:'普通', price:150,  effect:{cure:true} },

  // 防具类
  ironShield:    { id:'ironShield',    name:'铁盾',       desc:'抵挡一次攻击',         type:'防具类',  rarity:'普通', price:300,  effect:{block:1} },
  magicShield:   { id:'magicShield',   name:'魔法护盾',   desc:'减少一次伤害',         type:'防具类',  rarity:'稀有', price:500,  effect:{reduce:1} },
  thornArmor:    { id:'thornArmor',    name:'反伤甲',     desc:'受到攻击时反弹1伤害',   type:'防具类',  rarity:'稀有', price:600,  effect:{reflect:1} },
  luckyCharm:    { id:'luckyCharm',    name:'幸运护符',   desc:'抵挡一次致命效果',     type:'防具类',  rarity:'史诗', price:1000, effect:{fatalBlock:true} },

  // 一次性道具
  reroll:        { id:'reroll',        name:'重掷券',     desc:'重新投掷一次骰子',     type:'一次性',  rarity:'普通', price:200,  effect:{reroll:true} },
  doubleDice:    { id:'doubleDice',    name:'双倍骰',     desc:'移动距离×2',           type:'一次性',  rarity:'稀有', price:400,  effect:{doubleMove:true} },
  teleport:      { id:'teleport',      name:'传送卷轴',   desc:'传送到指定位置',       type:'一次性',  rarity:'史诗', price:800,  effect:{teleport:true} },
  chestKey:      { id:'chestKey',      name:'宝箱钥匙',   desc:'提高宝箱奖励品质',     type:'一次性',  rarity:'稀有', price:300,  effect:{upgradeChest:true} },

  // 世界道具 (极稀有，不可购买)
  timeHourglass: { id:'timeHourglass', name:'时间沙漏',   desc:'立即获得一次额外回合', type:'世界道具',rarity:'传奇', price:null, effect:{extraTurn:true} },
  worldFreeze:   { id:'worldFreeze',   name:'世界冻结',   desc:'其他玩家下一回合无法行动', type:'世界道具',rarity:'传奇', price:null, effect:{freezeOthers:true} },
  fateSwap:      { id:'fateSwap',      name:'命运交换',   desc:'与指定玩家交换全部资产', type:'世界道具',rarity:'传奇', price:null, effect:{swapAssets:true} },
  godDice:       { id:'godDice',       name:'神之骰',     desc:'指定任意骰子点数',     type:'世界道具',rarity:'传奇', price:null, effect:{chooseDice:true} },
  wealthScale:   { id:'wealthScale',   name:'财富天平',   desc:'与一名玩家交换金币',   type:'世界道具',rarity:'传奇', price:null, effect:{swapGold:true} },

  // 整蛊类
  banana:        { id:'banana',        name:'香蕉皮',     desc:'目标下一次移动失败',   type:'整蛊类',  rarity:'普通', price:200,  effect:{stunMove:true} },
  mine:          { id:'mine',          name:'地雷',       desc:'目标踩中扣1生命',     type:'整蛊类',  rarity:'稀有', price:400,  effect:{damage:1} },
  freezeCard:    { id:'freezeCard',    name:'冰冻卡',     desc:'目标下一回合无法使用道具', type:'整蛊类', rarity:'稀有', price:350, effect:{freezeItems:true} },
  stealCard:     { id:'stealCard',     name:'偷窃卡',     desc:'随机偷取目标一个普通道具', type:'整蛊类', rarity:'稀有', price:500, effect:{steal:true} },

  // 攻击类
  knife:         { id:'knife',         name:'飞刀',       desc:'造成1伤害',           type:'攻击类',  rarity:'普通', price:150,  effect:{damage:1} },
  fireBomb:      { id:'fireBomb',      name:'火焰炸弹',   desc:'造成2伤害',           type:'攻击类',  rarity:'稀有', price:400,  effect:{damage:2} },
  poison:        { id:'poison',        name:'毒药',       desc:'目标持续掉血2回合',   type:'攻击类',  rarity:'稀有', price:500,  effect:{poison:2} },
  dragonCannon:  { id:'dragonCannon',  name:'巨龙炮',     desc:'世界级攻击，造成5伤害', type:'攻击类',  rarity:'传奇', price:null, effect:{damage:5} },
};

// ── 世界商店 ──
const SHOP_ITEMS = [
  { itemId:'bandage',     price:200 },
  { itemId:'medkit',      price:800 },
  { itemId:'reroll',      price:200 },
  { itemId:'doubleDice',  price:400 },
  { itemId:'ironShield',  price:300 },
  { itemId:'magicShield', price:500 },
  { itemId:'knife',       price:150 },
  { itemId:'fireBomb',    price:400 },
  { itemId:'antidote',    price:150 },
  { itemId:'chestKey',    price:300 },
];

// ── 资产系统 ──
const ASSETS = {
  copper:      { id:'copper',      name:'铜币',       value:50,   rarity:'普通' },
  silver:      { id:'silver',      name:'银锭',       value:100,  rarity:'普通' },
  gold:        { id:'gold',        name:'黄金',       value:500,  rarity:'稀有' },
  diamond:     { id:'diamond',     name:'钻石',       value:1000, rarity:'稀有' },
  africaStar:  { id:'africaStar',  name:'非洲之星',   value:3000, rarity:'传奇' },
  goldCrown:   { id:'goldCrown',   name:'黄金皇冠',   value:5000, rarity:'传奇' },
};

// ── 藏品系统 ──
const COLLECTIONS = {
  royal: {
    id:'royal', name:'皇室遗产', bonus:5000,
    pieces: [
      { id:'crown',    name:'王冠' },
      { id:'scepter',  name:'权杖' },
      { id:'seal',     name:'王印' },
    ]
  },
  pirate: {
    id:'pirate', name:'海盗宝藏', bonus:5000,
    pieces: [
      { id:'treasureMap',  name:'藏宝图' },
      { id:'goldCompass',  name:'黄金罗盘' },
      { id:'blackPearl',   name:'黑珍珠' },
    ]
  },
  ancient: {
    id:'ancient', name:'远古文明', bonus:8000,
    pieces: [
      { id:'holyGrail',    name:'圣杯' },
      { id:'philosopherStone', name:'贤者之石' },
      { id:'dragonHeart',  name:'龙之心' },
    ]
  },
};

// ── Boss系统 ──
const BOSSES = {
  stoneGuardian: {
    id:'stoneGuardian', name:'石像守护者', hp:20,
    attack:1, desc:'沉睡千年的石像，守护着古老的宝藏',
    rewards: { assets:['gold','gold'], items:['ironShield','magicShield'] }
  },
  abyssBeast: {
    id:'abyssBeast', name:'深渊巨兽', hp:30,
    attack:2, desc:'来自深渊的恐怖巨兽，力量惊人',
    rewards: { items:['timeHourglass','worldFreeze','fateSwap','godDice','wealthScale'] }
  },
  dragonKing: {
    id:'dragonKing', name:'古代龙王', hp:50,
    attack:3, desc:'远古龙族之王，拥有毁灭一切的力量',
    rewards: { assets:['africaStar','goldCrown'], collectionPieces:true }
  },
};

// ── 神秘事件 ──
const EVENTS = [
  {
    id:'merchantBox', name:'遗忘商人的箱子',
    desc:'一个失落商人的箱子出现在道路旁，你不知道里面有什么。',
    choices:[
      { id:'open', label:'打开', outcomes:[
        { weight:40, result:{ gold:500, msg:'你找到了500金币！' }},
        { weight:25, result:{ item:'random_normal', msg:'你获得了一个普通道具！' }},
        { weight:15, result:{ item:'random_rare', msg:'你获得了一个稀有道具！' }},
        { weight:10, result:{ collection:'random_piece', msg:'你发现了一件藏品！' }},
        { weight:10, result:{ hp:-1, msg:'箱子里有陷阱！你损失了1生命。' }},
      ]},
      { id:'leave', label:'离开', outcomes:[{ weight:100, result:{ msg:'你安全地离开了。' }}]}
    ]
  },
  {
    id:'darkAltar', name:'黑暗祭坛',
    desc:'一座散发诡异光芒的祭坛出现在面前。你可以献祭生命换取力量。',
    choices:[
      { id:'sacrifice', label:'献祭1生命', outcomes:[
        { weight:50, result:{ hp:-1, item:'random_rare', msg:'祭坛回应了你的献祭，获得稀有道具！' }},
        { weight:30, result:{ hp:-1, gold:1000, msg:'祭坛赐予你1000金币！' }},
        { weight:20, result:{ hp:-1, msg:'什么都没发生...你白白损失了生命。' }},
      ]},
      { id:'leave', label:'离开', outcomes:[{ weight:100, result:{ msg:'你无视了祭坛的诱惑。' }}]}
    ]
  },
  {
    id:'treasureChest', name:'神秘宝箱',
    desc:'一个闪闪发光的宝箱，但似乎需要钥匙才能打开。',
    choices:[
      { id:'open_with_key', label:'使用钥匙打开', requires:'chestKey', outcomes:[
        { weight:40, result:{ item:'random_epic', msg:'你获得了史诗道具！' }},
        { weight:30, result:{ asset:'diamond', msg:'你获得了钻石！' }},
        { weight:20, result:{ collection:'random_piece', msg:'你发现了藏品碎片！' }},
        { weight:10, result:{ item:'random_legendary', msg:'你获得了传奇道具！' }},
      ]},
      { id:'force_open', label:'强行打开', outcomes:[
        { weight:30, result:{ gold:300, msg:'你撬开了宝箱，获得300金币。' }},
        { weight:40, result:{ hp:-1, gold:200, msg:'宝箱爆炸了！你受伤了，但获得了200金币。' }},
        { weight:30, result:{ hp:-2, msg:'宝箱有强力陷阱！你损失了2生命。' }},
      ]},
      { id:'leave', label:'离开', outcomes:[{ weight:100, result:{ msg:'你放弃了宝箱。' }}]}
    ]
  },
  {
    id:'wanderingMerchant', name:'流浪商人',
    desc:'一位神秘的流浪商人愿意以低价出售一件商品。',
    choices:[
      { id:'buy', label:'花费500金币购买', outcomes:[
        { weight:40, result:{ gold:-500, item:'random_rare', msg:'你购买了一件稀有道具！' }},
        { weight:30, result:{ gold:-500, asset:'gold', msg:'你购买了一块黄金！' }},
        { weight:20, result:{ gold:-500, item:'random_epic', msg:'你购买了一件史诗道具！' }},
        { weight:10, result:{ gold:-500, msg:'买到假货了...什么用都没有。' }},
      ]},
      { id:'decline', label:'婉拒', outcomes:[{ weight:100, result:{ msg:'商人失望地离开了。' }}]}
    ]
  },
  {
    id:'cursedGem', name:'诅咒宝石',
    desc:'一颗散发黑暗气息的宝石。触碰它可能会带来灾难...或者财富。',
    choices:[
      { id:'touch', label:'触碰宝石', outcomes:[
        { weight:30, result:{ gold:2000, msg:'宝石化为2000金币！' }},
        { weight:25, result:{ status:'cursed', msg:'你被诅咒了！下次掷骰-1。' }},
        { weight:25, result:{ hp:-2, msg:'宝石爆炸！你损失了2生命。' }},
        { weight:20, result:{ item:'random_legendary', msg:'宝石化为一件传奇道具！' }},
      ]},
      { id:'leave', label:'不要碰', outcomes:[{ weight:100, result:{ msg:'你明智地绕开了宝石。' }}]}
    ]
  },
  {
    id:'ancientScroll', name:'古老卷轴',
    desc:'一卷泛黄的卷轴上写着难以辨认的文字。似乎是一张藏宝图的碎片。',
    choices:[
      { id:'read', label:'仔细阅读', outcomes:[
        { weight:40, result:{ collection:'random_piece', msg:'你解读了卷轴，发现了藏品线索！' }},
        { weight:30, result:{ gold:800, msg:'卷轴上标注了一个宝箱的位置，你获得了800金币。' }},
        { weight:30, result:{ msg:'卷轴上的文字已经模糊到无法辨认。' }},
      ]},
      { id:'burn', label:'烧掉', outcomes:[
        { weight:100, result:{ gold:100, msg:'卷轴燃烧时散发出温暖的光芒，你获得了100金币。' }}
      ]}
    ]
  },
  {
    id:'spiritFountain', name:'精灵之泉',
    desc:'清澈的泉水散发着治愈的气息。',
    choices:[
      { id:'drink', label:'饮用泉水', outcomes:[
        { weight:60, result:{ healFull:true, msg:'泉水治愈了你所有的伤痛！' }},
        { weight:40, result:{ hp:2, msg:'泉水恢复了你2点生命。' }},
      ]},
      { id:'bottle', label:'装瓶带走', outcomes:[
        { weight:100, result:{ item:'medkit', msg:'你获得了一瓶医疗箱！' }}
      ]}
    ]
  },
  {
    id:'gamblingGoblin', name:'赌博哥布林',
    desc:'一只哥布林向你发起赌局："猜硬币正反面，赢了双倍金币！"',
    choices:[
      { id:'play', label:'赌一把（500金币）', outcomes:[
        { weight:50, result:{ gold:500, msg:'你赢了！获得500金币！' }},
        { weight:50, result:{ gold:-500, msg:'你输了！损失500金币。' }},
      ]},
      { id:'decline', label:'不赌了', outcomes:[{ weight:100, result:{ msg:'哥布林嘲笑你是胆小鬼。' }}]}
    ]
  },
];

// ── 世界规则 ──
const WORLD_RULES = [
  { id:'goldenAge',     name:'黄金时代',   desc:'金币收益+50%',         effect:{ goldBonus:1.5 }},
  { id:'tradeProsper',  name:'商业繁荣',   desc:'交易免费',             effect:{ freeTrade:true }},
  { id:'blackMarket',   name:'黑市狂欢',   desc:'黑市刷新概率提升',     effect:{ blackMarketBoost:true }},
  { id:'relicRace',     name:'遗物争夺',   desc:'藏品概率提高，Boss增强', effect:{ collectionBoost:true, bossHpMult:1.5 }},
  { id:'catastrophe',   name:'灾厄降临',   desc:'所有玩家初始生命-1',   effect:{ startHp:-1 }},
  { id:'gamblingNight', name:'赌神之夜',   desc:'小游戏奖励翻倍，损失翻倍', effect:{ miniGameMultiplier:2 }},
];

// ── 称号系统 ──
const TITLES = [
  { id:'collector',  name:'收藏家', desc:'集齐一套藏品',       condition:{ completeCollection:true }, reward:{ asset:1000 }, special:'再次集齐任意套装直接胜利' },
  { id:'gambler',    name:'赌神',   desc:'赌场累计盈利5000金币', condition:{ gamblingProfit:5000 }, reward:{ asset:500 }},
  { id:'explorer',   name:'探险家', desc:'探索5条分支',         condition:{ branchesExplored:5 },   reward:{ asset:500 }},
  { id:'dragonSlayer',name:'屠龙者',desc:'击败Boss',           condition:{ bossDefeated:true },    reward:{ asset:1000 }},
];

// ── 小游戏 ──
const MINI_GAMES = [
  { id:'texasHoldem', name:'德州扑克', desc:'玩家下注金币，赢家获得奖金池', type:'poker' },
  { id:'zhaJinHua',   name:'炸金花',   desc:'跟注、加注或弃牌',           type:'poker' },
  { id:'blackjack',   name:'二十一点',  desc:'接近21点但不能超过',          type:'cards' },
  { id:'luckyWheel',  name:'幸运轮盘',  desc:'转动轮盘获取随机奖励',       type:'wheel' },
  { id:'auction',     name:'拍卖会',    desc:'竞拍世界道具、藏品、传奇资产', type:'auction' },
];

// ── 地图格子类型 ──
const TILE_TYPES = {
  gold:      { id:'gold',      name:'金币格',     emoji:'💰', color:'#ffd700' },
  item:      { id:'item',      name:'道具格',     emoji:'🎁', color:'#9b59b6' },
  heal:      { id:'heal',      name:'回复格',     emoji:'❤️',  color:'#e74c3c' },
  empty:     { id:'empty',     name:'空白格',     emoji:'⬜', color:'#95a5a6' },
  mystery:   { id:'mystery',   name:'神秘事件格', emoji:'❓', color:'#3498db' },
  shop:      { id:'shop',      name:'商业格',     emoji:'🏪', color:'#2ecc71' },
  minigame:  { id:'minigame',  name:'小游戏格',   emoji:'🎮', color:'#e67e22' },
  boss:      { id:'boss',      name:'Boss格',     emoji:'👹', color:'#c0392b' },
  collection:{ id:'collection',name:'藏品格',     emoji:'💎', color:'#1abc9c' },
  asset:     { id:'asset',     name:'资产格',     emoji:'🪙', color:'#f39c12' },
};

// ── 封装导出 ──
module.exports = {
  ITEMS,
  SHOP_ITEMS,
  ASSETS,
  COLLECTIONS,
  BOSSES,
  EVENTS,
  WORLD_RULES,
  TITLES,
  MINI_GAMES,
  TILE_TYPES,
};
