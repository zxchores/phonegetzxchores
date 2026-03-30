    // --- ИГРОВЫЕ ДАННЫЕ (СОХРАНЕНИЯ) ---
const SAVE_KEY = 'phoneGetSave';
const SAVE_VERSION = 7;

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function defaultGameData() {
    return {
        v: SAVE_VERSION,
        balance: 0,
        clickPower: 1, // legacy (раньше было за тап)
        // inventory legacy: [{ id: number, qty: number }]
        inventory: [],
        // items: per-phone instances (новая система)
        nextUid: 1,
        items: [],
        deliveries: [],
        repairs: [],
        parts: { screen: 0, battery: 0, misc: 0 },
        market: {
            seed: 1,
            brandTrends: {},
            scarcity: {},
            priceHistory: {} // { [modelId]: [{ts, price}] }
        },
        auction: null,
        farm: { temp: 26, lastTickTs: 0 },
        prestige: { xp: 0, points: 0, officeTier: 0 },
        settings: {
            device: 'mobile',
            leaves: true,
            accent: 'blue'
        },
        marketSentiment: { state: 'stable', multIncome: 1, multBuy: 1, nextChangeTs: 0 },
        lifetime: { earned: 0, phones: 0, questsDone: 0 },
        upgrades: {
            clickPowerLevel: 0,
            critLevel: 0,
            autoTapLevel: 0,
            courierLevel: 0,
            coolingLevel: 0
        },
        lastDailyClaimTs: 0,
        marketEvent: null,
        lastFindTs: 0,
        lastHackTs: 0,
        activeChat: null,
        quests: {
            seed: 1,
            claimed: []
        },
        stats: {
            casesOpened: 0,
            phonesFound: 0,
            phonesBought: 0,
            phonesSold: 0,
            bargainsWon: 0,
            hacksSuccess: 0,
            hacksFail: 0,
            repairsDone: 0,
            auctionsWon: 0
        }
    };
}

function migrateSave(save) {
    if (!save || typeof save !== 'object') return defaultGameData();

    // v1 -> v2: inventory раньше был массивом объектов телефонов, income хранился отдельно
    const v = Number(save.v || 1);
    if (v === 1) {
        const inv = Array.isArray(save.inventory) ? save.inventory : [];
        const inventory = [];
        for (const item of inv) {
            const id = Number(item?.id);
            if (!Number.isFinite(id)) continue;
            const existing = inventory.find(x => x.id === id);
            if (existing) existing.qty += 1;
            else inventory.push({ id, qty: 1 });
        }

        return {
            v: SAVE_VERSION,
            balance: Number(save.balance) || 0,
            clickPower: Number(save.clickPower) || 1,
            inventory
        };
    }

    // v2+ (нормализация + новые поля по умолчанию)
    const inventory = Array.isArray(save.inventory) ? save.inventory : [];
    const normalizedInv = [];
    for (const it of inventory) {
        const id = Number(it?.id);
        const qty = Math.max(1, Math.floor(Number(it?.qty) || 1));
        if (!Number.isFinite(id)) continue;
        const existing = normalizedInv.find(x => x.id === id);
        if (existing) existing.qty += qty;
        else normalizedInv.push({ id, qty });
    }

    const upgrades = (save.upgrades && typeof save.upgrades === 'object') ? save.upgrades : {};
    const normalizedUpgrades = {
        clickPowerLevel: Math.max(0, Math.floor(Number(upgrades.clickPowerLevel) || 0)),
        critLevel: Math.max(0, Math.floor(Number(upgrades.critLevel) || 0)),
        autoTapLevel: Math.max(0, Math.floor(Number(upgrades.autoTapLevel) || 0)),
        courierLevel: Math.max(0, Math.floor(Number(upgrades.courierLevel) || 0)),
        coolingLevel: Math.max(0, Math.floor(Number(upgrades.coolingLevel) || 0))
    };

    const lastDailyClaimTs = Number(save.lastDailyClaimTs) || 0;
    const marketEvent = save.marketEvent && typeof save.marketEvent === 'object' ? save.marketEvent : null;
    const stats = (save.stats && typeof save.stats === 'object') ? save.stats : {};
    const normalizedStats = {
        casesOpened: Math.max(0, Math.floor(Number(stats.casesOpened) || 0)),
        phonesFound: Math.max(0, Math.floor(Number(stats.phonesFound) || 0)),
        phonesBought: Math.max(0, Math.floor(Number(stats.phonesBought) || 0)),
        phonesSold: Math.max(0, Math.floor(Number(stats.phonesSold) || 0)),
        bargainsWon: Math.max(0, Math.floor(Number(stats.bargainsWon) || 0)),
        hacksSuccess: Math.max(0, Math.floor(Number(stats.hacksSuccess) || 0)),
        hacksFail: Math.max(0, Math.floor(Number(stats.hacksFail) || 0)),
        repairsDone: Math.max(0, Math.floor(Number(stats.repairsDone) || 0)),
        auctionsWon: Math.max(0, Math.floor(Number(stats.auctionsWon) || 0))
    };

    const base = {
        v: SAVE_VERSION,
        balance: Number(save.balance) || 0,
        clickPower: Number(save.clickPower) || 1,
        inventory: normalizedInv,
        upgrades: normalizedUpgrades,
        lastDailyClaimTs,
        marketEvent,
        lastFindTs: Number(save.lastFindTs) || 0,
        lastHackTs: Number(save.lastHackTs) || 0,
        activeChat: save.activeChat && typeof save.activeChat === 'object' ? save.activeChat : null,
        quests: save.quests && typeof save.quests === 'object'
            ? { seed: Math.max(1, Math.floor(Number(save.quests.seed) || 1)), claimed: Array.isArray(save.quests.claimed) ? save.quests.claimed.slice(0, 200) : [] }
            : { seed: 1, claimed: [] },
        stats: normalizedStats
    };

    // новая система items/delivery/market/auction/farm/prestige/parts/repairs
    base.nextUid = Math.max(1, Math.floor(Number(save.nextUid) || 1));
    base.items = Array.isArray(save.items) ? save.items : [];
    base.deliveries = Array.isArray(save.deliveries) ? save.deliveries : [];
    base.repairs = Array.isArray(save.repairs) ? save.repairs : [];
    base.parts = (save.parts && typeof save.parts === 'object')
        ? {
            screen: Math.max(0, Math.floor(Number(save.parts.screen) || 0)),
            battery: Math.max(0, Math.floor(Number(save.parts.battery) || 0)),
            misc: Math.max(0, Math.floor(Number(save.parts.misc) || 0))
        }
        : { screen: 0, battery: 0, misc: 0 };
    base.market = (save.market && typeof save.market === 'object')
        ? {
            seed: Math.max(1, Math.floor(Number(save.market.seed) || 1)),
            brandTrends: (save.market.brandTrends && typeof save.market.brandTrends === 'object') ? save.market.brandTrends : {},
            scarcity: (save.market.scarcity && typeof save.market.scarcity === 'object') ? save.market.scarcity : {},
            priceHistory: (save.market.priceHistory && typeof save.market.priceHistory === 'object') ? save.market.priceHistory : {}
        }
        : { seed: 1, brandTrends: {}, scarcity: {}, priceHistory: {} };
    base.auction = (save.auction && typeof save.auction === 'object') ? save.auction : null;
    base.farm = (save.farm && typeof save.farm === 'object')
        ? { temp: clamp(Number(save.farm.temp) || 26, 10, 120), lastTickTs: Number(save.farm.lastTickTs) || 0 }
        : { temp: 26, lastTickTs: 0 };
    base.prestige = (save.prestige && typeof save.prestige === 'object')
        ? {
            xp: Math.max(0, Math.floor(Number(save.prestige.xp) || 0)),
            points: Math.max(0, Math.floor(Number(save.prestige.points) || 0)),
            officeTier: Math.max(0, Math.floor(Number(save.prestige.officeTier) || 0))
        }
        : { xp: 0, points: 0, officeTier: 0 };

    base.settings = (save.settings && typeof save.settings === 'object')
        ? {
            device: (save.settings.device === 'pc') ? 'pc' : 'mobile',
            leaves: save.settings.leaves !== false,
            accent: ['blue', 'neon', 'pink'].includes(save.settings.accent) ? save.settings.accent : 'blue'
        }
        : { device: 'mobile', leaves: true, accent: 'blue' };

    base.marketSentiment = (save.marketSentiment && typeof save.marketSentiment === 'object')
        ? {
            state: String(save.marketSentiment.state || 'stable'),
            multIncome: clamp(Number(save.marketSentiment.multIncome) || 1, 0.7, 1.35),
            multBuy: clamp(Number(save.marketSentiment.multBuy) || 1, 0.75, 1.5),
            nextChangeTs: Number(save.marketSentiment.nextChangeTs) || 0
        }
        : { state: 'stable', multIncome: 1, multBuy: 1, nextChangeTs: 0 };

    base.lifetime = (save.lifetime && typeof save.lifetime === 'object')
        ? {
            earned: Math.max(0, Math.floor(Number(save.lifetime.earned) || 0)),
            phones: Math.max(0, Math.floor(Number(save.lifetime.phones) || 0)),
            questsDone: Math.max(0, Math.floor(Number(save.lifetime.questsDone) || 0))
        }
        : { earned: 0, phones: 0, questsDone: 0 };

    // миграция: если items пустые, а inventory legacy есть — конвертируем
    if ((!Array.isArray(base.items) || base.items.length === 0) && Array.isArray(base.inventory) && base.inventory.length) {
        base.items = [];
        for (const it of base.inventory) {
            const id = Number(it?.id);
            const qty = Math.max(1, Math.floor(Number(it?.qty) || 1));
            if (!Number.isFinite(id)) continue;
            for (let i = 0; i < qty; i++) {
                const uid = base.nextUid++;
                base.items.push({
                    uid,
                    modelId: id,
                    condition: 70 + Math.floor(Math.random() * 31), // 70-100
                    defects: {},
                    mods: { sticker: 0, engraving: 0 },
                    acquiredTs: Date.now()
                });
            }
        }
    }

    return base;
}

let gameData = migrateSave(loadGame()) || defaultGameData();

// База данных всех телефонов (можно расширять до бесконечности)
const phonesDB = [
    {
        id: 1,
        name: "Nokia 3310",
        price: 60,
        income: 1,
        rarity: "common",
        icon: "🧱",
        img: "https://upload.wikimedia.org/wikipedia/commons/1/15/Nokia_3310_mobile_phone.jpg"
    },
    {
        id: 2,
        name: "iPhone 4S",
        price: 350,
        income: 6,
        rarity: "common",
        icon: "📱",
        img: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Black_iPhone_4s.jpg"
    },
    {
        id: 3,
        name: "Samsung S10",
        price: 1800,
        income: 28,
        rarity: "rare",
        icon: "🌌",
        img: "https://upload.wikimedia.org/wikipedia/commons/7/71/Samsung_Galaxy_S10.png"
    },
    {
        id: 4,
        name: "iPhone 15 Pro",
        price: 6500,
        income: 110,
        rarity: "rare",
        icon: "🍎",
        img: "https://upload.wikimedia.org/wikipedia/commons/c/ca/IPhone_15_Pro_%26_iPhone_15_Pro_Max.jpg"
    },
    {
        id: 5,
        name: "Золотой Vertu",
        price: 30000,
        income: 650,
        rarity: "legendary",
        icon: "💎",
        img: "https://upload.wikimedia.org/wikipedia/commons/8/88/Vertu_mobile.jpg"
    },
    {
        id: 6,
        name: "Xiaomi Redmi Note 8",
        price: 900,
        income: 14,
        rarity: "common",
        icon: "🧰",
        img: ""
    },
    {
        id: 7,
        name: "Huawei P30",
        price: 2200,
        income: 34,
        rarity: "common",
        icon: "📷",
        img: ""
    },
    {
        id: 8,
        name: "iPhone 8",
        price: 2500,
        income: 38,
        rarity: "common",
        icon: "🍏",
        img: ""
    },
    {
        id: 9,
        name: "Samsung A54",
        price: 4200,
        income: 72,
        rarity: "rare",
        icon: "✨",
        img: ""
    },
    {
        id: 10,
        name: "Google Pixel 7",
        price: 5200,
        income: 92,
        rarity: "rare",
        icon: "📸",
        img: ""
    },
    {
        id: 11,
        name: "iPhone 13",
        price: 8200,
        income: 140,
        rarity: "rare",
        icon: "🍎",
        img: ""
    },
    {
        id: 12,
        name: "Samsung S24 Ultra",
        price: 14000,
        income: 260,
        rarity: "legendary",
        icon: "🛰️",
        img: ""
    },
    {
        id: 13,
        name: "iPhone 16 Pro Max",
        price: 18000,
        income: 340,
        rarity: "legendary",
        icon: "👑",
        img: ""
    },
    {
        id: 14,
        name: "Игровой ROG Phone",
        price: 12000,
        income: 210,
        rarity: "rare",
        icon: "🎮",
        img: ""
    },
    {
        id: 15,
        name: "Складной Fold",
        price: 16000,
        income: 290,
        rarity: "legendary",
        icon: "📖",
        img: ""
    }
];

// --- ИНТЕРФЕЙС И ТАБЫ ---
const balanceEl = document.getElementById('balance');
const incomeEl = document.getElementById('income');
const dailyBtn = document.getElementById('daily-btn');
const dailyHintEl = document.getElementById('daily-hint');
const upgradesListEl = document.getElementById('upgrades-list');
const openCaseBtn = document.getElementById('open-case-btn');
const caseCostHintEl = document.getElementById('case-cost-hint');
const caseResultEl = document.getElementById('case-result');
const rouletteEl = document.getElementById('roulette');
const rouletteTrackEl = document.getElementById('roulette-track');
const casesHintEl = document.getElementById('cases-hint');
const casesListEl = document.getElementById('cases-list');

const getPhoneBtn = document.getElementById('get-phone-btn');
const getPhoneHintEl = document.getElementById('get-phone-hint');
const getPhoneBarEl = document.getElementById('get-phone-bar');
const getPhoneLabelEl = document.getElementById('get-phone-label');

const hackBtn = document.getElementById('hack-btn');
const hackHintEl = document.getElementById('hack-hint');

const questsListEl = document.getElementById('quests-list');

const chatEmptyEl = document.getElementById('chat-empty');
const chatThreadEl = document.getElementById('chat-thread');
const chatActionsEl = document.getElementById('chat-actions');
const chatHintEl = document.getElementById('chat-hint');

const bgParticlesEl = document.getElementById('bg-particles');

// Top UI
const deviceMobileBtn = document.getElementById('device-mobile');
const devicePcBtn = document.getElementById('device-pc');
const marketStateLabelEl = document.getElementById('market-state-label');
const settingsBtn = document.getElementById('settings-btn');
const settingsBackdropEl = document.getElementById('settings-backdrop');
const settingsCloseBtn = document.getElementById('settings-close');
const settingLeavesEl = document.getElementById('setting-leaves');
const settingAccentEl = document.getElementById('setting-accent');
const statsTextEl = document.getElementById('stats-text');

// Новые экраны
const partsHintEl = document.getElementById('parts-hint');
const buyPartsBtn = document.getElementById('buy-parts-btn');
const workshopListEl = document.getElementById('workshop-list');
const deliveryListEl = document.getElementById('delivery-list');

const auctionBoxEl = document.getElementById('auction-box');
const auctionHintEl = document.getElementById('auction-hint');
const auctionBid1Btn = document.getElementById('auction-bid-1');
const auctionBid5Btn = document.getElementById('auction-bid-5');
const auctionBidMaxBtn = document.getElementById('auction-bid-max');

const prestigeHintEl = document.getElementById('prestige-hint');
const prestigeBtn = document.getElementById('prestige-btn');
const collectionsListEl = document.getElementById('collections-list');

const moneyFmt = new Intl.NumberFormat('ru-RU');
function formatMoney(n) {
    return moneyFmt.format(Math.floor(Number(n) || 0));
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function createPhoneMedia(phone) {
    if (phone?.img) {
        const img = document.createElement('img');
        img.className = 'phone-img';
        img.src = phone.img;
        img.alt = phone?.name ? `${phone.name}` : 'Телефон';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => {
            const fallback = document.createElement('span');
            fallback.className = 'phone-emoji';
            fallback.textContent = phone?.icon || '📱';
            img.replaceWith(fallback);
        }, { once: true });
        return img;
    }

    const fallback = document.createElement('span');
    fallback.className = 'phone-emoji';
    fallback.textContent = phone?.icon || '📱';
    return fallback;
}

function getUpgradeLevel(key) {
    const u = gameData.upgrades || {};
    return Math.max(0, Math.floor(Number(u[key]) || 0));
}

function setUpgradeLevel(key, value) {
    if (!gameData.upgrades || typeof gameData.upgrades !== 'object') gameData.upgrades = {};
    gameData.upgrades[key] = Math.max(0, Math.floor(Number(value) || 0));
}

function getClickPower() {
    const base = Math.max(1, Math.floor(Number(gameData.clickPower) || 1));
    const lvl = getUpgradeLevel('clickPowerLevel');
    return base + lvl;
}

function getCritChance() {
    const lvl = getUpgradeLevel('critLevel');
    // 2% base at level 0? keep it simple: 0% -> up to 20%
    return clamp(lvl * 0.02, 0, 0.2);
}

function getCritMultiplier() {
    return 5;
}

function getAutoTapPerSecond() {
    const lvl = getUpgradeLevel('autoTapLevel');
    // теперь это авто-поиск телефонов (шт/сек)
    return clamp(lvl / 35, 0, 0.75);
}

function getIncomePerSecond() {
    ensureItems();
    const temp = clamp(Number(gameData?.farm?.temp) || 26, 10, 140);
    const coolingLvl = getUpgradeLevel('coolingLevel');
    const overheat = Math.max(0, temp - (52 + coolingLvl * 2.5));
    const thermalK = clamp(1 - overheat * 0.012, 0.25, 1);

    let income = 0;
    for (const it of ensureArray(gameData.items)) {
        const phone = phonesDB.find(p => p.id === it.modelId);
        if (!phone) continue;
        const condK = clamp(0.35 + (clampInt(it.condition, 0, 100) / 100) * 0.75, 0.2, 1.1);
        income += phone.income * condK * thermalK;
    }

    // бонус коллекций + престиж
    const sentimentK = getMarketSentimentIncomeMultiplier();
    const colK = 1 + getCollectionsBonus();
    const prestigeK = 1 + (Math.max(0, Math.floor(Number(gameData?.prestige?.points) || 0)) * 0.015);
    return Math.floor(income * sentimentK * colK * prestigeK);
}

const upgradesDB = [
    {
        id: 'clickPower',
        title: 'Поиск телефонов',
        desc: 'Шанс получить x2 телефона за нажатие растёт с уровнем.',
        key: 'clickPowerLevel',
        baseCost: 200,
        costMult: 1.6,
        maxLevel: 200
    },
    {
        id: 'crit',
        title: 'Удача',
        desc: 'Чаще попадаются редкие и легендарные телефоны.',
        key: 'critLevel',
        baseCost: 500,
        costMult: 1.7,
        maxLevel: 10
    },
    {
        id: 'autoTap',
        title: 'Авто-поиск',
        desc: 'Снижает кулдаун на добычу телефона и добавляет авто-добычу.',
        key: 'autoTapLevel',
        baseCost: 800,
        costMult: 1.8,
        maxLevel: 20
    },
    {
        id: 'courier',
        title: 'Курьер',
        desc: 'Ускоряет доставку купленных лотов.',
        key: 'courierLevel',
        baseCost: 900,
        costMult: 1.75,
        maxLevel: 20
    },
    {
        id: 'cooling',
        title: 'Охлаждение фермы',
        desc: 'Снижает перегрев и риск поломки, увеличивает стабильный доход.',
        key: 'coolingLevel',
        baseCost: 1200,
        costMult: 1.85,
        maxLevel: 25
    }
];

function getUpgradeCost(u) {
    const lvl = getUpgradeLevel(u.key);
    return Math.floor(u.baseCost * Math.pow(u.costMult, lvl));
}

function buyUpgrade(upgradeId) {
    const u = upgradesDB.find(x => x.id === upgradeId);
    if (!u) return;

    const lvl = getUpgradeLevel(u.key);
    if (lvl >= u.maxLevel) return;

    const cost = getUpgradeCost(u);
    if (gameData.balance < cost) return;

    gameData.balance -= cost;
    setUpgradeLevel(u.key, lvl + 1);
    updateUI();
    renderUpgrades();
    renderMarket();
}

function renderUpgrades() {
    if (!upgradesListEl) return;
    upgradesListEl.innerHTML = '';

    for (const u of upgradesDB) {
        const lvl = getUpgradeLevel(u.key);
        const cost = getUpgradeCost(u);
        const isMax = lvl >= u.maxLevel;

        const row = document.createElement('div');
        row.className = 'upgrade-card';

        const info = document.createElement('div');
        info.className = 'upgrade-info';

        const h = document.createElement('h3');
        h.textContent = `${u.title} `;
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = `ур. ${lvl}${isMax ? ' (MAX)' : ''}`;
        h.appendChild(pill);

        const p = document.createElement('p');
        p.textContent = u.desc;

        info.appendChild(h);
        info.appendChild(p);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'buy-btn';
        btn.dataset.upgradeId = u.id;
        btn.disabled = isMax || gameData.balance < cost;
        btn.textContent = isMax ? 'Куплено' : `${formatMoney(cost)} ₽`;

        row.appendChild(info);
        row.appendChild(btn);
        upgradesListEl.appendChild(row);
    }
}

if (upgradesListEl) {
    upgradesListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button.buy-btn');
        if (!btn) return;
        const id = btn.dataset.upgradeId;
        if (!id) return;
        buyUpgrade(id);
    });
}

function updateUI() {
    // lifetime earned (gross)
    if (!gameData.lifetime || typeof gameData.lifetime !== 'object') gameData.lifetime = { earned: 0, phones: 0, questsDone: 0 };
    const prevBal = Math.max(0, Math.floor(Number(gameData._lastBal) || 0));
    const curBal = Math.max(0, Math.floor(Number(gameData.balance) || 0));
    if (curBal > prevBal) gameData.lifetime.earned += (curBal - prevBal);
    gameData._lastBal = curBal;

    balanceEl.innerText = formatMoney(gameData.balance);
    incomeEl.innerText = formatMoney(getIncomePerSecond());
    scheduleSave();
    updateDailyUI();
    updateFindUI();
    updateHackUI();
    updatePrestigeUI();
    updateMarketSentimentUI();
    updateSettingsUI();
}

function saveGameNow() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameData));
    } catch {
        // no-op
    }
}

let saveTimer = null;
function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveGameNow();
    }, 800);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGameNow();
});

// --- ЕЖЕДНЕВНЫЙ БОНУС ---
const DAY_MS = 24 * 60 * 60 * 1000;

function getDailyBonusAmount() {
    // бонус масштабируется от дохода, но не слишком резко
    const income = getIncomePerSecond();
    const scaled = income * 120; // 2 минуты дохода
    return Math.max(200, Math.floor(scaled));
}

function getDailyRemainingMs() {
    const last = Number(gameData.lastDailyClaimTs) || 0;
    const next = last + DAY_MS;
    const now = Date.now();
    return Math.max(0, next - now);
}

function canClaimDaily() {
    return getDailyRemainingMs() === 0;
}

function claimDaily() {
    if (!canClaimDaily()) return;
    const amt = getDailyBonusAmount();
    gameData.balance += amt;
    gameData.lastDailyClaimTs = Date.now();
    updateUI();
    renderMarket();
}

function formatTime(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}ч ${m}м`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
}

function updateDailyUI() {
    if (!dailyBtn || !dailyHintEl) return;
    const rem = getDailyRemainingMs();
    if (rem === 0) {
        dailyBtn.disabled = false;
        dailyHintEl.textContent = `Доступно: +${formatMoney(getDailyBonusAmount())} ₽`;
    } else {
        dailyBtn.disabled = true;
        dailyHintEl.textContent = `Можно через ${formatTime(rem)}`;
    }
}

// --- КВЕСТЫ ---
function getQuestsSeed() {
    if (!gameData.quests || typeof gameData.quests !== 'object') gameData.quests = { seed: 1, claimed: [] };
    gameData.quests.seed = Math.max(1, Math.floor(Number(gameData.quests.seed) || 1));
    return gameData.quests.seed;
}

function getClaimedQuestIds() {
    if (!gameData.quests || typeof gameData.quests !== 'object') gameData.quests = { seed: 1, claimed: [] };
    if (!Array.isArray(gameData.quests.claimed)) gameData.quests.claimed = [];
    return gameData.quests.claimed;
}

function isQuestClaimed(id) {
    return getClaimedQuestIds().includes(id);
}

function claimQuest(id, reward) {
    if (isQuestClaimed(id)) return;
    getClaimedQuestIds().push(id);
    gameData.balance += Math.max(0, Math.floor(Number(reward) || 0));
    if (!gameData.lifetime || typeof gameData.lifetime !== 'object') gameData.lifetime = { earned: 0, phones: 0, questsDone: 0 };
    gameData.lifetime.questsDone = Math.max(0, Math.floor(Number(gameData.lifetime.questsDone) || 0)) + 1;

    // прогрессивные квесты — повышаем следующую цель
    if (!gameData.quests || typeof gameData.quests !== 'object') gameData.quests = { seed: 1, claimed: [] };
    if (!gameData.quests.progress || typeof gameData.quests.progress !== 'object') {
        gameData.quests.progress = { buyGoal: 3, sellGoal: 2, findGoal: 5 };
    }
    if (String(id).startsWith('pq-buy-')) gameData.quests.progress.buyGoal = Math.min(999, Math.floor((Number(gameData.quests.progress.buyGoal) || 3) * 2));
    if (String(id).startsWith('pq-sell-')) gameData.quests.progress.sellGoal = Math.min(999, Math.floor((Number(gameData.quests.progress.sellGoal) || 2) * 2));
    if (String(id).startsWith('pq-find-')) gameData.quests.progress.findGoal = Math.min(999, Math.floor((Number(gameData.quests.progress.findGoal) || 5) * 2));

    updateUI();
    renderQuests();
}

function getQuests() {
    const s = getQuestsSeed();
    const st = gameData.stats || {};
    const income = getIncomePerSecond();

    if (!gameData.quests || typeof gameData.quests !== 'object') gameData.quests = { seed: 1, claimed: [] };
    if (!gameData.quests.progress || typeof gameData.quests.progress !== 'object') {
        gameData.quests.progress = { buyGoal: 3, sellGoal: 2, findGoal: 5 };
    }

    const buyGoal = Math.max(3, Math.floor(Number(gameData.quests.progress.buyGoal) || 3));
    const sellGoal = Math.max(2, Math.floor(Number(gameData.quests.progress.sellGoal) || 2));
    const findGoal = Math.max(5, Math.floor(Number(gameData.quests.progress.findGoal) || 5));

    const progressive = [
        {
            id: `pq-buy-${buyGoal}`,
            title: 'Покупатель',
            desc: `Купи ${buyGoal} телефона(ов) на Авито.`,
            progress: Math.min(buyGoal, Math.max(0, Math.floor(Number(st.phonesBought) || 0))),
            goal: buyGoal,
            reward: Math.max(520, Math.floor(income * (28 + buyGoal * 6)))
        },
        {
            id: `pq-sell-${sellGoal}`,
            title: 'Перепродажа',
            desc: `Продай ${sellGoal} телефона(ов) со склада.`,
            progress: Math.min(sellGoal, Math.max(0, Math.floor(Number(st.phonesSold) || 0))),
            goal: sellGoal,
            reward: Math.max(480, Math.floor(income * (24 + sellGoal * 7)))
        },
        {
            id: `pq-find-${findGoal}`,
            title: 'Добытчик',
            desc: `Получи ${findGoal} телефонов кнопкой добычи.`,
            progress: Math.min(findGoal, Math.max(0, Math.floor(Number(st.phonesFound) || 0))),
            goal: findGoal,
            reward: Math.max(420, Math.floor(income * (20 + findGoal * 5)))
        }
    ];

    const achievements = [
        {
            id: `ach-${s}-bargain1`,
            title: 'Торгаш',
            desc: 'Выиграй торг в чате (получи скидку и купи).',
            progress: Math.min(1, Math.max(0, Math.floor(Number(st.bargainsWon) || 0))),
            goal: 1,
            reward: Math.max(500, Math.floor(income * 55))
        },
        {
            id: `ach-${s}-hack1`,
            title: 'Хакер',
            desc: 'Успешно взломай ферму 1 раз.',
            progress: Math.min(1, Math.max(0, Math.floor(Number(st.hacksSuccess) || 0))),
            goal: 1,
            reward: Math.max(600, Math.floor(income * 65))
        }
    ];

    return [...progressive, ...achievements];
}

function renderQuests() {
    if (!questsListEl) return;
    questsListEl.innerHTML = '';

    const list = getQuests();
    for (const q of list) {
        const row = document.createElement('div');
        row.className = 'upgrade-card';

        const info = document.createElement('div');
        info.className = 'upgrade-info';

        const h = document.createElement('h3');
        h.textContent = `${q.title} `;
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = `${q.progress}/${q.goal}`;
        h.appendChild(pill);

        const p = document.createElement('p');
        p.textContent = `${q.desc} • Награда: ${formatMoney(q.reward)} ₽`;

        info.appendChild(h);
        info.appendChild(p);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'buy-btn';
        btn.dataset.questId = q.id;
        const done = q.progress >= q.goal;
        const claimed = isQuestClaimed(q.id);
        btn.disabled = !done || claimed;
        btn.textContent = claimed ? 'Получено' : done ? 'Забрать' : 'В процессе';

        row.appendChild(info);
        row.appendChild(btn);
        questsListEl.appendChild(row);
    }
}

if (questsListEl) {
    questsListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button.buy-btn');
        if (!btn) return;
        const id = btn.dataset.questId;
        if (!id) return;
        const q = getQuests().find(x => x.id === id);
        if (!q) return;
        if (q.progress < q.goal) return;
        claimQuest(id, q.reward);
    });
}

if (dailyBtn) {
    dailyBtn.addEventListener('click', () => {
        if (!canClaimDaily()) return;
        claimDaily();
    });
}

// Переключение вкладок
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Убираем активный класс у всех
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        
        // Включаем нужный
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.tab).classList.remove('hidden');
        
        if(e.target.dataset.tab === 'inventory') renderInventory();
        if(e.target.dataset.tab === 'avito') renderMarket();
        if(e.target.dataset.tab === 'quests') renderQuests();
        if(e.target.dataset.tab === 'workshop') renderWorkshop();
        if(e.target.dataset.tab === 'delivery') renderDelivery();
        if(e.target.dataset.tab === 'auctions') renderAuction();
        if(e.target.dataset.tab === 'office') { updatePrestigeUI(); renderCollections(); }
    });
});

// Mobile tabbar navigation
document.querySelectorAll('.tabbar button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (!tab) return;
        // mimic tabs logic
        document.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        e.currentTarget.classList.add('active');
        document.getElementById(tab)?.classList.remove('hidden');

        if (tab === 'inventory') renderInventory();
        if (tab === 'avito') renderMarket();
        if (tab === 'quests') renderQuests();
        if (tab === 'workshop') renderWorkshop();
        if (tab === 'delivery') renderDelivery();
        if (tab === 'auctions') renderAuction();
        if (tab === 'office') { updatePrestigeUI(); renderCollections(); }
    });
});

// --- ДОБЫЧА ТЕЛЕФОНОВ (вместо тапов) ---
const clicker = document.getElementById('clicker');

function nowMs() {
    return Date.now();
}

function getFindCooldownMs() {
    // Требование: 60 секунд кулдаун на кнопку
    return 60_000;
}

function getFindRemainingMs() {
    const last = Number(gameData.lastFindTs) || 0;
    const next = last + getFindCooldownMs();
    return Math.max(0, next - nowMs());
}

function getLuckBonus() {
    // critLevel теперь "удача" (влияет на шанс редкости)
    const lvl = getUpgradeLevel('critLevel');
    return clamp(lvl * 0.012, 0, 0.12);
}

function pickRarityForFind() {
    // базовые шансы + удача немного двигает в сторону rare/legendary
    const luck = getLuckBonus();
    const common = clamp(78 - (luck * 100), 55, 88);
    const rare = clamp(20 + (luck * 70), 10, 38);
    const legendary = clamp(2 + (luck * 30), 1, 10);
    const total = common + rare + legendary;
    const r = Math.random() * total;
    if (r < common) return 'common';
    if (r < common + rare) return 'rare';
    return 'legendary';
}

function pickFoundPhone() {
    const rarity = pickRarityForFind();
    const phone = pickPhoneByRarity(rarity) || pickAnyFrom(phonesDB);
    return { phone, rarity };
}

function getFindQty() {
    // clickPowerLevel теперь "поиск" (даёт шанс получить +1 телефон)
    const lvl = getUpgradeLevel('clickPowerLevel');
    const bonusChance = clamp(0.06 + (lvl * 0.004), 0.06, 0.55);
    const qty = (Math.random() < bonusChance) ? 2 : 1;
    return qty;
}

function spawnFloatingText(text) {
    if (!clicker) return;
    const floatTxt = document.createElement('div');
    floatTxt.classList.add('floating-text');
    floatTxt.innerText = text;
    const rect = clicker.getBoundingClientRect();
    const x = rect.width / 2 + (Math.random() * 120 - 60);
    const y = rect.height / 2 + (Math.random() * 60 - 30);
    floatTxt.style.left = `${x}px`;
    floatTxt.style.top = `${y}px`;
    clicker.appendChild(floatTxt);
    setTimeout(() => floatTxt.remove(), 1000);
}

function grantFoundPhone() {
    const rem = getFindRemainingMs();
    if (rem > 0) return;

    const { phone, rarity } = pickFoundPhone();
    if (!phone) return;
    const qty = getFindQty();

    addToInventory(phone.id, qty, 'find');
    gameData.lastFindTs = nowMs();
    if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = {};
    gameData.stats.phonesFound = Math.max(0, Math.floor(Number(gameData.stats.phonesFound) || 0)) + qty;
    if (!gameData.lifetime || typeof gameData.lifetime !== 'object') gameData.lifetime = { earned: 0, phones: 0, questsDone: 0 };
    gameData.lifetime.phones = Math.max(0, Math.floor(Number(gameData.lifetime.phones) || 0)) + qty;

    updateUI();
    renderInventory();
    renderMarket();
    renderQuests();

    const rarityLabel = rarity === 'common' ? 'обычный' : rarity === 'rare' ? 'редкий' : 'легендарный';
    spawnFloatingText(`+${qty} 📱 (${rarityLabel})`);
}

function updateFindUI() {
    if (!getPhoneBtn || !getPhoneHintEl) return;
    const rem = getFindRemainingMs();
    if (rem === 0) {
        getPhoneBtn.disabled = false;
        if (getPhoneBarEl) getPhoneBarEl.style.transform = 'translate3d(-100%,0,0)';
        if (getPhoneLabelEl) getPhoneLabelEl.textContent = '📦 Получить телефон';
        getPhoneHintEl.textContent = `Доступно • шанс x2: ${Math.round((clamp(0.06 + (getUpgradeLevel('clickPowerLevel') * 0.004), 0.06, 0.55)) * 100)}% • удача: +${Math.round(getLuckBonus() * 100)}%`;
    } else {
        getPhoneBtn.disabled = true;
        const cd = getFindCooldownMs();
        const p = clamp(1 - (rem / Math.max(1, cd)), 0, 1);
        if (getPhoneBarEl) getPhoneBarEl.style.transform = `translate3d(${(-100 + (p * 100))}%,0,0)`;
        if (getPhoneLabelEl) getPhoneLabelEl.textContent = `⏳ ${formatTime(rem)}`;
        getPhoneHintEl.textContent = `Кулдаун: ${formatTime(rem)}`;
    }
}

if (getPhoneBtn) {
    getPhoneBtn.addEventListener('click', () => {
        grantFoundPhone();
        updateFindUI();
    });
}

// --- ВЗЛОМ ФЕРМЫ (доп. заработок) ---
function getHackCooldownMs() {
    return 60_000;
}

function getHackRemainingMs() {
    const last = Number(gameData.lastHackTs) || 0;
    const next = last + getHackCooldownMs();
    return Math.max(0, next - nowMs());
}

function getHackSuccessChance() {
    // немного зависит от "удачи"
    const luckLvl = getUpgradeLevel('critLevel');
    return clamp(0.42 + (luckLvl * 0.03), 0.42, 0.72);
}

function getHackReward() {
    const income = getIncomePerSecond();
    const base = 350;
    const scaled = Math.floor(income * (18 + Math.random() * 10));
    return Math.max(base, scaled);
}

function updateHackUI() {
    if (!hackBtn || !hackHintEl) return;
    const rem = getHackRemainingMs();
    if (rem === 0) {
        hackBtn.disabled = false;
        hackHintEl.textContent = `Шанс: ${Math.round(getHackSuccessChance() * 100)}% • Награда ~${formatMoney(getHackReward())} ₽`;
    } else {
        hackBtn.disabled = true;
        hackHintEl.textContent = `Кулдаун: ${formatTime(rem)}`;
    }
}

function doHack() {
    const rem = getHackRemainingMs();
    if (rem > 0) return;

    gameData.lastHackTs = nowMs();
    const ok = Math.random() < getHackSuccessChance();
    if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = {};

    if (ok) {
        const reward = getHackReward();
        gameData.balance += reward;
        gameData.stats.hacksSuccess = Math.max(0, Math.floor(Number(gameData.stats.hacksSuccess) || 0)) + 1;
        spawnFloatingText(`+${formatMoney(reward)} ₽`);
    } else {
        const penalty = Math.max(80, Math.floor(getHackReward() * 0.18));
        gameData.balance = Math.max(0, gameData.balance - penalty);
        gameData.stats.hacksFail = Math.max(0, Math.floor(Number(gameData.stats.hacksFail) || 0)) + 1;
        spawnFloatingText(`-${formatMoney(penalty)} ₽`);
    }

    updateUI();
    renderMarket();
    renderQuests();
    updateHackUI();
}

if (hackBtn) {
    hackBtn.addEventListener('click', () => {
        doHack();
    });
}

// --- МЕХАНИКА АВИТО (Генератор рынка) ---
const rarityWeights = {
    common: 70,
    rare: 25,
    legendary: 5
};

// --- GACHA / КЕЙСЫ ---
const casesDB = [
    {
        id: 'cheap',
        title: 'Дешёвый кейс',
        desc: 'Для старта. Почти без легендарок.',
        cost: 350,
        weights: { common: 88, rare: 11, legendary: 1 }
    },
    {
        id: 'classic',
        title: 'Обычный кейс',
        desc: 'Баланс по шансам.',
        cost: 650,
        weights: { common: 72, rare: 24, legendary: 4 }
    },
    {
        id: 'pro',
        title: 'PRO кейс',
        desc: 'Шанс редких заметно выше.',
        cost: 1400,
        weights: { common: 55, rare: 38, legendary: 7 }
    },
    {
        id: 'legend',
        title: 'ЛЕГЕНДА',
        desc: 'Дорого, но шанс легендарки приятный.',
        cost: 4000,
        weights: { common: 35, rare: 50, legendary: 15 }
    }
];

function pickRarityByWeights(weights) {
    const w = weights || rarityWeights;
    const common = Math.max(0, Number(w.common) || 0);
    const rare = Math.max(0, Number(w.rare) || 0);
    const legendary = Math.max(0, Number(w.legendary) || 0);
    const total = common + rare + legendary;
    if (total <= 0) return 'common';
    const r = Math.random() * total;
    if (r < common) return 'common';
    if (r < common + rare) return 'rare';
    return 'legendary';
}

function pickPhoneByRarity(rarity) {
    const pool = phonesDB.filter(p => p.rarity === rarity);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function ensureArray(v) {
    return Array.isArray(v) ? v : [];
}

function ensureItems() {
    if (!Array.isArray(gameData.items)) gameData.items = [];
    if (!Number.isFinite(Number(gameData.nextUid))) gameData.nextUid = 1;
}

function getBrand(phone) {
    const name = String(phone?.name || '').toLowerCase();
    if (name.includes('iphone')) return 'Apple';
    if (name.includes('samsung')) return 'Samsung';
    if (name.includes('xiaomi') || name.includes('redmi')) return 'Xiaomi';
    if (name.includes('huawei')) return 'Huawei';
    if (name.includes('pixel') || name.includes('google')) return 'Google';
    if (name.includes('vertu')) return 'Vertu';
    if (name.includes('rog')) return 'ASUS';
    if (name.includes('fold')) return 'Samsung';
    if (name.includes('nokia')) return 'Nokia';
    return 'Other';
}

function clampInt(n, min, max) {
    return Math.floor(clamp(Number(n) || 0, min, max));
}

function genConditionForRarity(rarity) {
    if (rarity === 'legendary') return clampInt(78 + Math.random() * 22, 40, 100);
    if (rarity === 'rare') return clampInt(70 + Math.random() * 30, 30, 100);
    return clampInt(62 + Math.random() * 38, 20, 100);
}

function genDefects(condition) {
    const c = clampInt(condition, 0, 100);
    return {
        crackedScreen: c < 65 ? Math.random() < 0.55 : Math.random() < 0.08,
        badBattery: c < 70 ? Math.random() < 0.45 : Math.random() < 0.10
    };
}

function conditionPriceFactor(condition, defects) {
    const c = clampInt(condition, 0, 100);
    let k = 0.25 + (c / 100) * 0.85; // 0.25..1.10
    if (defects?.crackedScreen) k *= 0.78;
    if (defects?.badBattery) k *= 0.86;
    return clamp(k, 0.12, 1.25);
}

function modsMarkupFactor(mods) {
    const s = clampInt(mods?.sticker || 0, 0, 5);
    const e = clampInt(mods?.engraving || 0, 0, 3);
    const k = 1 + s * 0.03 + e * 0.05;
    return clamp(k, 1, 1.35);
}

function createItem(modelId, source = 'unknown', condition = null) {
    ensureItems();
    const phone = phonesDB.find(p => p.id === modelId);
    const rarity = phone?.rarity || 'common';
    const cond = (condition == null) ? genConditionForRarity(rarity) : clampInt(condition, 0, 100);
    const item = {
        uid: gameData.nextUid++,
        modelId,
        condition: cond,
        defects: genDefects(cond),
        mods: { sticker: 0, engraving: 0 },
        source,
        acquiredTs: nowMs()
    };
    return item;
}

function addToInventory(phoneId, qty = 1, source = 'grant') {
    ensureItems();
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    for (let i = 0; i < q; i++) {
        gameData.items.push(createItem(phoneId, source));
    }
}

function renderCaseResult(phone, rarity) {
    if (!caseResultEl) return;
    caseResultEl.innerHTML = '';

    if (!phone) {
        const empty = document.createElement('div');
        empty.className = 'case-empty';
        empty.textContent = 'Не удалось открыть кейс. Попробуй ещё раз.';
        caseResultEl.appendChild(empty);
        return;
    }

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = `case-win-title rarity-${rarity}`;
    title.textContent = `Выпало: ${phone.name}`;

    const sub = document.createElement('div');
    sub.className = 'hint';
    sub.textContent = `Редкость: ${rarity === 'common' ? 'обычный' : rarity === 'rare' ? 'редкий' : 'легендарный'} • +${formatMoney(phone.income)} ₽/сек`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    caseResultEl.appendChild(createPhoneMedia(phone));
    caseResultEl.appendChild(titleWrap);
}

function renderCases() {
    if (!casesListEl) return;
    casesListEl.innerHTML = '';

    if (casesHintEl) {
        casesHintEl.textContent = 'Выбери кейс. Чем дороже — тем выше шанс редких/легендарных.';
    }

    for (const c of casesDB) {
        const row = document.createElement('div');
        row.className = 'upgrade-card';

        const info = document.createElement('div');
        info.className = 'upgrade-info';
        const h = document.createElement('h3');
        h.textContent = c.title;
        const p = document.createElement('p');
        p.textContent = `${c.desc} • Шансы: ${c.weights.common}%/${c.weights.rare}%/${c.weights.legendary}%`;
        info.appendChild(h);
        info.appendChild(p);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'buy-btn';
        btn.dataset.caseId = c.id;
        btn.disabled = isRouletteSpinning || gameData.balance < c.cost;
        btn.textContent = `${formatMoney(c.cost)} ₽`;

        row.appendChild(info);
        row.appendChild(btn);
        casesListEl.appendChild(row);
    }

    if (caseResultEl && caseResultEl.childNodes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'case-empty';
        empty.textContent = 'Нажми на цену кейса, чтобы открыть.';
        caseResultEl.appendChild(empty);
    }
}

let isRouletteSpinning = false;

function buildRouletteItem(phone) {
    const el = document.createElement('div');
    el.className = `roulette-item ${phone.rarity}`;
    el.appendChild(createPhoneMedia(phone));
    return el;
}

function getRoulettePoolsByRarity() {
    const pools = {
        common: phonesDB.filter(p => p.rarity === 'common'),
        rare: phonesDB.filter(p => p.rarity === 'rare'),
        legendary: phonesDB.filter(p => p.rarity === 'legendary')
    };
    return pools;
}

function pickAnyFrom(pool) {
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function spinRouletteAndGrant(winPhone, winRarity) {
    if (!rouletteEl || !rouletteTrackEl) {
        // fallback: если UI не найден — просто выдать приз
        addToInventory(winPhone.id, 1);
        updateUI();
        renderInventory();
        renderMarket();
        renderCaseResult(winPhone, winRarity);
        return;
    }

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        addToInventory(winPhone.id, 1);
        updateUI();
        renderInventory();
        renderMarket();
        renderCaseResult(winPhone, winRarity);
        return;
    }

    isRouletteSpinning = true;
    updateCasesUI();

    rouletteEl.classList.remove('roulette-spinning');
    rouletteTrackEl.style.transition = 'none';
    rouletteTrackEl.style.transform = 'translate3d(0,0,0)';
    rouletteTrackEl.innerHTML = '';

    const pools = getRoulettePoolsByRarity();
    const length = 42;
    const winIndex = 34; // ближе к концу, чтобы было ощущение "докрутки"

    const sequence = [];
    for (let i = 0; i < length; i++) {
        if (i === winIndex) {
            sequence.push(winPhone);
            continue;
        }
        const rarity = pickRarityByWeights(rarityWeights);
        const phone = pickAnyFrom(pools[rarity]) || pickAnyFrom(phonesDB);
        if (phone) sequence.push(phone);
    }

    // Рендер элементов
    for (const p of sequence) rouletteTrackEl.appendChild(buildRouletteItem(p));

    // Даем браузеру применить layout
    const firstItem = rouletteTrackEl.querySelector('.roulette-item');
    const itemW = firstItem ? firstItem.getBoundingClientRect().width : 86;
    const gap = 10;
    const containerW = rouletteEl.getBoundingClientRect().width;
    const windowCenter = containerW / 2;

    const targetCenterX = (winIndex * (itemW + gap)) + (itemW / 2) + 10; // +padding-left
    const jitter = (Math.random() * 18) - 9; // небольшая "человечность"
    const translateX = -(targetCenterX - windowCenter) + jitter;

    requestAnimationFrame(() => {
        rouletteEl.classList.add('roulette-spinning');
        rouletteTrackEl.style.transition = '';
        rouletteTrackEl.style.transform = `translate3d(${translateX}px, 0, 0)`;
    });

    const spinMs = 3200;
    setTimeout(() => {
        // Выдача приза по окончании анимации
        addToInventory(winPhone.id, 1);
        updateUI();
        renderInventory();
        renderMarket();
        renderCaseResult(winPhone, winRarity);

        isRouletteSpinning = false;
        updateCasesUI();
    }, spinMs + 60);
}

function openCase(caseId) {
    if (isRouletteSpinning) return;
    const c = casesDB.find(x => x.id === caseId) || casesDB[0];
    if (!c) return;
    const cost = Math.max(0, Math.floor(Number(c.cost) || 0));
    if (gameData.balance < cost) return;

    const rarity = pickRarityByWeights(c.weights);
    const phone = pickPhoneByRarity(rarity);
    if (!phone) return;

    gameData.balance -= cost;
    if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = { casesOpened: 0 };
    gameData.stats.casesOpened = Math.max(0, Math.floor(Number(gameData.stats.casesOpened) || 0)) + 1;

    // Рулетка выдаст приз по окончании спина
    spinRouletteAndGrant(phone, rarity);
}

if (casesListEl) {
    casesListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button.buy-btn');
        if (!btn) return;
        const id = btn.dataset.caseId;
        if (!id) return;
        openCase(id);
        updateUI();
        renderCases();
    });
}

function pickWeightedPhone() {
    const weighted = [];
    for (const p of phonesDB) {
        const w = rarityWeights[p.rarity] ?? 1;
        weighted.push({ p, w: Math.max(0, w) });
    }
    const total = weighted.reduce((s, x) => s + x.w, 0);
    if (total <= 0) return phonesDB[Math.floor(Math.random() * phonesDB.length)];
    let r = Math.random() * total;
    for (const x of weighted) {
        r -= x.w;
        if (r <= 0) return x.p;
    }
    return weighted[weighted.length - 1].p;
}

let currentMarket = [];

function buildMarketLots(count = 3) {
    ensureMarketState();
    tickMarketTrends();

    const lots = [];
    const used = new Set();
    while (lots.length < count && used.size < phonesDB.length) {
        const phone = pickWeightedPhone();
        if (!phone) break;
        if (used.has(phone.id)) continue;
        used.add(phone.id);
        lots.push(makeMarketLot(phone));
    }
    return lots;
}

const sellerBots = [
    'Илья_Смарт',
    'Серый_Торг',
    'Катя_Маркет',
    'ДядяВаня',
    'ProSeller_77',
    'Юзер_без_торга',
    'Марк_скидка',
    'Лена_б/у',
    'Скупщик_телефонов',
    'Саша_быстро'
];

function pickSellerNameForPhone(phone) {
    const seed = getQuestsSeed();
    const id = Number(phone?.id) || 0;
    const idx = Math.abs((id * 17 + seed * 31) % sellerBots.length);
    return sellerBots[idx] || 'Продавец';
}

function ensureMarketState() {
    if (!gameData.market || typeof gameData.market !== 'object') gameData.market = { seed: 1, brandTrends: {}, scarcity: {}, priceHistory: {} };
    if (!gameData.market.brandTrends || typeof gameData.market.brandTrends !== 'object') gameData.market.brandTrends = {};
    if (!gameData.market.scarcity || typeof gameData.market.scarcity !== 'object') gameData.market.scarcity = {};
    if (!gameData.market.priceHistory || typeof gameData.market.priceHistory !== 'object') gameData.market.priceHistory = {};
    gameData.market.seed = Math.max(1, Math.floor(Number(gameData.market.seed) || 1));
}

function tickMarketTrends() {
    // обновление трендов не чаще раза в минуту
    const key = '_lastMarketTickTs';
    const last = Number(gameData[key]) || 0;
    const now = nowMs();
    if (now - last < 60_000) return;
    gameData[key] = now;

    const brands = ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Google', 'Nokia', 'Vertu', 'ASUS', 'Other'];
    for (const b of brands) {
        const prev = Number(gameData.market.brandTrends[b]) || 1;
        const drift = (Math.random() * 0.08) - 0.04; // -4%..+4%
        const shock = Math.random() < 0.08 ? ((Math.random() * 0.26) - 0.13) : 0; // иногда сильнее
        gameData.market.brandTrends[b] = clamp(prev * (1 + drift + shock), 0.75, 1.35);
    }

    // дефицит: немного перетасовываем для моделей
    for (const p of phonesDB) {
        const id = String(p.id);
        const prev = Number(gameData.market.scarcity[id]) || 1;
        const drift = (Math.random() * 0.10) - 0.05;
        gameData.market.scarcity[id] = clamp(prev * (1 + drift), 0.75, 1.6);
    }
    scheduleSave();
}

// --- MARKET SENTIMENT (Gemini-style addition) ---
function ensureMarketSentiment() {
    if (!gameData.marketSentiment || typeof gameData.marketSentiment !== 'object') {
        gameData.marketSentiment = { state: 'stable', multIncome: 1, multBuy: 1, nextChangeTs: 0 };
    }
    if (!Number(gameData.marketSentiment.nextChangeTs)) gameData.marketSentiment.nextChangeTs = 0;
}

function pickMarketSentiment() {
    // стабильный чаще, бум/кризис реже
    const r = Math.random() * 100;
    if (r < 65) return { state: 'stable', multIncome: 1.0, multBuy: 1.0, label: 'Стабильно' };
    if (r < 83) return { state: 'boom', multIncome: 1.18, multBuy: 1.10, label: 'Бум' };
    return { state: 'crisis', multIncome: 0.82, multBuy: 0.90, label: 'Кризис' };
}

function tickMarketSentiment() {
    ensureMarketSentiment();
    const now = nowMs();
    const next = Number(gameData.marketSentiment.nextChangeTs) || 0;
    if (next && now < next) return;
    const pick = pickMarketSentiment();
    gameData.marketSentiment.state = pick.state;
    gameData.marketSentiment.multIncome = pick.multIncome;
    gameData.marketSentiment.multBuy = pick.multBuy;
    gameData.marketSentiment.nextChangeTs = now + 5 * 60_000;
    scheduleSave();
}

function getMarketSentimentIncomeMultiplier() {
    ensureMarketSentiment();
    return clamp(Number(gameData.marketSentiment.multIncome) || 1, 0.7, 1.35);
}

function getMarketSentimentBuyMultiplier() {
    ensureMarketSentiment();
    return clamp(Number(gameData.marketSentiment.multBuy) || 1, 0.75, 1.5);
}

function getMarketSentimentLabel() {
    ensureMarketSentiment();
    const s = String(gameData.marketSentiment.state || 'stable');
    if (s === 'boom') return 'Бум';
    if (s === 'crisis') return 'Кризис';
    return 'Стабильно';
}

function updateMarketSentimentUI() {
    if (marketStateLabelEl) marketStateLabelEl.textContent = getMarketSentimentLabel();
}

function getBrandTrendMultiplier(phone) {
    ensureMarketState();
    const brand = getBrand(phone);
    return clamp(Number(gameData.market.brandTrends[brand]) || 1, 0.75, 1.35);
}

function getScarcityMultiplier(phone) {
    ensureMarketState();
    const id = String(Number(phone?.id) || 0);
    return clamp(Number(gameData.market.scarcity[id]) || 1, 0.75, 1.6);
}

function recordPrice(modelId, price) {
    ensureMarketState();
    const id = String(Number(modelId) || 0);
    if (!gameData.market.priceHistory[id]) gameData.market.priceHistory[id] = [];
    const arr = gameData.market.priceHistory[id];
    arr.push({ ts: nowMs(), price: Math.max(1, Math.floor(Number(price) || 1)) });
    if (arr.length > 80) arr.splice(0, arr.length - 80);
}

function getDynamicBasePrice(phone) {
    // базовая цена с трендом/дефицитом + бонус от офиса
    const base = Math.max(1, Math.floor(Number(phone?.price) || 1));
    const trend = getBrandTrendMultiplier(phone);
    const scarcity = getScarcityMultiplier(phone);
    const officeTier = Math.max(0, Math.floor(Number(gameData?.prestige?.officeTier) || 0));
    const officeK = 1 + officeTier * 0.03;
    const sentimentBuyK = getMarketSentimentBuyMultiplier();
    return Math.max(1, Math.floor(base * trend * scarcity * officeK * sentimentBuyK));
}

function makeMarketLot(phone) {
    const cond = genConditionForRarity(phone.rarity);
    const defects = genDefects(cond);
    const base = getDynamicBasePrice(phone);
    const condK = conditionPriceFactor(cond, defects);
    const sellerMood = 0.98 + Math.random() * 0.16; // "жадность"
    const ask = Math.max(1, Math.floor(base * condK * sellerMood));
    recordPrice(phone.id, ask);
    return {
        lotId: `${phone.id}-${nowMs()}-${Math.floor(Math.random() * 10000)}`,
        phoneId: phone.id,
        condition: cond,
        defects,
        askPrice: ask,
        seller: pickSellerNameForPhone(phone)
    };
}

function resetChatUI() {
    if (chatEmptyEl) chatEmptyEl.classList.remove('hidden');
    if (chatActionsEl) chatActionsEl.classList.add('hidden');
    if (chatHintEl) chatHintEl.textContent = '';
    if (chatThreadEl) chatThreadEl.innerHTML = '';
}

function appendChatMsg(text, who = 'bot') {
    if (!chatThreadEl) return;
    const msg = document.createElement('div');
    msg.className = `chat-msg ${who === 'me' ? 'me' : 'bot'}`;
    msg.textContent = String(text || '');
    chatThreadEl.appendChild(msg);
    chatThreadEl.scrollTop = chatThreadEl.scrollHeight;
}

function ensureChatState() {
    if (!gameData.activeChat || typeof gameData.activeChat !== 'object') return null;
    const id = Number(gameData.activeChat.phoneId);
    if (!Number.isFinite(id)) return null;
    const phone = phonesDB.find(p => p.id === id);
    if (!phone) return null;
    return { phone, chat: gameData.activeChat };
}

function renderChat() {
    const st = ensureChatState();
    if (!st) {
        resetChatUI();
        return;
    }

    if (chatEmptyEl) chatEmptyEl.classList.add('hidden');
    if (chatActionsEl) chatActionsEl.classList.remove('hidden');

    if (chatThreadEl && chatThreadEl.childNodes.length === 0) {
        appendChatMsg(`Привет! Продаю «${st.phone.name}». Цена ${formatMoney(st.chat.currentPrice)} ₽. Торгуемся?`, 'bot');
    }

    const canBuy = gameData.balance >= st.chat.currentPrice;
    const buyBtn = chatActionsEl ? chatActionsEl.querySelector('[data-chat-action="accept"]') : null;
    if (buyBtn) buyBtn.disabled = !canBuy;

    if (chatHintEl) {
        chatHintEl.textContent = canBuy ? 'Можно купить прямо сейчас.' : 'Не хватает денег — заработай и возвращайся в чат.';
    }
}

function openChatForLot(lotId) {
    const lot = ensureArray(currentMarket).find(x => String(x.lotId) === String(lotId));
    if (!lot) return;
    const phone = phonesDB.find(p => p.id === lot.phoneId);
    if (!phone) return;
    const basePrice = Math.max(1, Math.floor(Number(lot.askPrice) || 1));
    const seller = String(lot.seller || pickSellerNameForPhone(phone));

    // минимальная цена: продавец "сдаётся" до 85–95% от базовой, зависит от удачи игрока
    const luck = getLuckBonus();
    const minK = clamp(0.93 - (luck * 0.35), 0.82, 0.93);
    const minPrice = Math.max(1, Math.floor(basePrice * minK));

    gameData.activeChat = {
        lotId: String(lot.lotId),
        phoneId: phone.id,
        seller,
        basePrice,
        currentPrice: basePrice,
        minPrice,
        discountWon: false,
        condition: clampInt(lot.condition, 0, 100),
        defects: lot.defects || {},
        style: 'neutral',
        attempts: 0
    };

    if (chatThreadEl) chatThreadEl.innerHTML = '';
    appendChatMsg(`${seller}: Привет!`, 'bot');
    const defectsTxt = `${lot.defects?.crackedScreen ? 'битый экран' : 'экран ок'}, ${lot.defects?.badBattery ? 'плохая АКБ' : 'АКБ ок'}`;
    appendChatMsg(`Лот: «${phone.name}» • износ ${clampInt(lot.condition, 0, 100)}% • ${defectsTxt}`, 'bot');
    appendChatMsg(`Цена: ${formatMoney(basePrice)} ₽. Торгуемся?`, 'bot');
    renderChat();
    scheduleSave();
}

function botReplyToOffer(offerPrice) {
    const st = ensureChatState();
    if (!st) return;
    const { chat } = st;

    const offer = Math.max(1, Math.floor(Number(offerPrice) || 0));
    appendChatMsg(`Я: Предлагаю ${formatMoney(offer)} ₽`, 'me');
    chat.attempts = Math.max(0, Math.floor(Number(chat.attempts) || 0)) + 1;

    // шанс провала сделки (продавец психанёт)
    const style = String(chat.style || 'neutral');
    const hardPenalty = style === 'hard' ? 0.09 : 0;
    const friendlyBonus = style === 'friendly' ? -0.03 : 0;
    const failChance = clamp(0.04 + hardPenalty + friendlyBonus + (chat.attempts - 1) * 0.02, 0.03, 0.22);
    if (Math.random() < failChance) {
        appendChatMsg(`${chat.seller}: Всё, надоело. Не продаю.`, 'bot');
        leaveChat();
        return;
    }

    if (offer >= chat.currentPrice) {
        appendChatMsg(`${chat.seller}: Ок, договорились. Жми «Купить».`, 'bot');
        chat.currentPrice = offer;
        chat.discountWon = offer < chat.basePrice;
        renderChat();
        scheduleSave();
        return;
    }

    if (offer >= chat.minPrice) {
        // шанс согласия зависит от того, насколько близко к minPrice
        const t = (offer - chat.minPrice) / Math.max(1, (chat.currentPrice - chat.minPrice));
        const agreeChance = clamp(0.35 + t * 0.55, 0.35, 0.9);
        if (Math.random() < agreeChance) {
            chat.currentPrice = offer;
            chat.discountWon = offer < chat.basePrice;
            appendChatMsg(`${chat.seller}: Ладно, забирай за ${formatMoney(offer)} ₽.`, 'bot');
            renderChat();
            scheduleSave();
            return;
        }
    }

    // контр-оффер: опускаемся немного, но не ниже minPrice
    const drop = Math.max(1, Math.floor((chat.currentPrice - Math.max(chat.minPrice, offer)) * (0.35 + Math.random() * 0.25)));
    const next = Math.max(chat.minPrice, chat.currentPrice - drop);
    chat.currentPrice = next;
    appendChatMsg(`${chat.seller}: Не, мало. Давай ${formatMoney(next)} ₽.`, 'bot');
    renderChat();
    scheduleSave();
}

function acceptChatDeal() {
    const st = ensureChatState();
    if (!st) return;
    const { phone, chat } = st;
    const price = Math.max(1, Math.floor(Number(chat.currentPrice) || 0));
    if (gameData.balance < price) return;

    gameData.balance -= price;
    // покупка уходит в доставку
    const item = createItem(phone.id, 'market', chat.condition);
    item.defects = chat.defects || item.defects;
    createDelivery(item);

    if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = {};
    gameData.stats.phonesBought = Math.max(0, Math.floor(Number(gameData.stats.phonesBought) || 0)) + 1;
    if (chat.discountWon) {
        gameData.stats.bargainsWon = Math.max(0, Math.floor(Number(gameData.stats.bargainsWon) || 0)) + 1;
    }

    // закрываем чат и обновляем рынок (лот пропадает)
    gameData.activeChat = null;
    updateUI();
    renderInventory();
    generateMarket();
    renderQuests();
    resetChatUI();
    renderDelivery();
}

function leaveChat() {
    gameData.activeChat = null;
    resetChatUI();
    scheduleSave();
}

if (chatActionsEl) {
    chatActionsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const style = btn.dataset.chatStyle;
        if (style) {
            if (gameData.activeChat && typeof gameData.activeChat === 'object') {
                gameData.activeChat.style = style;
                appendChatMsg(`Я (${style === 'friendly' ? 'дружелюбно' : style === 'hard' ? 'жёстко' : 'норм'}): давай обсудим цену.`, 'me');
                scheduleSave();
            }
            return;
        }
        const act = btn.dataset.chatAction;
        if (!act) return;

        const st = ensureChatState();
        if (!st && act !== 'leave') return;

        if (act === 'offer-5') {
            const price = Math.floor(st.chat.currentPrice * 0.95);
            botReplyToOffer(price);
        } else if (act === 'offer-10') {
            const price = Math.floor(st.chat.currentPrice * 0.90);
            botReplyToOffer(price);
        } else if (act === 'offer-15') {
            const price = Math.floor(st.chat.currentPrice * 0.85);
            botReplyToOffer(price);
        } else if (act === 'accept') {
            acceptChatDeal();
        } else if (act === 'leave') {
            leaveChat();
        }
    });
}

// --- ФОН (падающие листья) ---
function initParticles() {
    if (!bgParticlesEl) return;
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    if (gameData?.settings && gameData.settings.leaves === false) return;

    const symbols = ['🍂', '🍁', '🌿'];
    const maxOnScreen = 26;

    function spawn() {
        if (!bgParticlesEl) return;
        if (bgParticlesEl.childNodes.length > maxOnScreen) return;

        const el = document.createElement('div');
        el.className = 'particle';
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];

        const x = Math.random() * window.innerWidth;
        const dx = (Math.random() * 120 - 60);
        const dur = 5200 + Math.random() * 5200;
        const rot = (Math.random() * 520 - 260);

        el.style.left = `${x}px`;
        el.style.setProperty('--x', '0px');
        el.style.setProperty('--dx', `${dx}px`);
        el.style.setProperty('--rot', `${rot}deg`);
        el.style.animationDuration = `${dur}ms`;

        bgParticlesEl.appendChild(el);
        setTimeout(() => el.remove(), dur + 120);
    }

    // чуть-чуть сразу
    for (let i = 0; i < 8; i++) setTimeout(spawn, i * 220);
    setInterval(spawn, 320);
}

// --- SETTINGS / DEVICE / THEME ---
function ensureSettings() {
    if (!gameData.settings || typeof gameData.settings !== 'object') gameData.settings = { device: 'mobile', leaves: true, accent: 'blue' };
    gameData.settings.device = (gameData.settings.device === 'pc') ? 'pc' : 'mobile';
    gameData.settings.leaves = gameData.settings.leaves !== false;
    gameData.settings.accent = ['blue', 'neon', 'pink'].includes(gameData.settings.accent) ? gameData.settings.accent : 'blue';
}

function applyAccent(accent) {
    const root = document.documentElement;
    if (accent === 'neon') root.style.setProperty('--tg-blue', '#00e5ff');
    else if (accent === 'pink') root.style.setProperty('--tg-blue', '#ff2d55');
    else root.style.setProperty('--tg-blue', '#007acc');
}

function applyDevice(device) {
    const d = (device === 'pc') ? 'pc' : 'mobile';
    document.body.dataset.device = d;
    if (deviceMobileBtn) deviceMobileBtn.classList.toggle('active', d === 'mobile');
    if (devicePcBtn) devicePcBtn.classList.toggle('active', d === 'pc');
}

function openSettings() {
    if (!settingsBackdropEl) return;
    settingsBackdropEl.classList.add('open');
}

function closeSettings() {
    if (!settingsBackdropEl) return;
    settingsBackdropEl.classList.remove('open');
}

function updateSettingsUI() {
    ensureSettings();
    applyAccent(gameData.settings.accent);
    applyDevice(gameData.settings.device);

    if (settingLeavesEl) settingLeavesEl.value = gameData.settings.leaves ? 'on' : 'off';
    if (settingAccentEl) settingAccentEl.value = gameData.settings.accent;

    if (statsTextEl) {
        const s = gameData.stats || {};
        const l = gameData.lifetime || { earned: 0, phones: 0, questsDone: 0 };
        statsTextEl.textContent = `Всего заработано: ${formatMoney(l.earned)} ₽ • Телефонов получено: ${formatMoney(l.phones)} • Квестов выполнено: ${formatMoney(l.questsDone)} • Кейсов открыто: ${formatMoney(s.casesOpened || 0)}`;
    }
}

if (settingsBtn) settingsBtn.addEventListener('click', () => openSettings());
if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', () => closeSettings());
if (settingsBackdropEl) {
    settingsBackdropEl.addEventListener('click', (e) => {
        if (e.target === settingsBackdropEl) closeSettings();
    });
}

if (settingLeavesEl) {
    settingLeavesEl.addEventListener('change', () => {
        ensureSettings();
        gameData.settings.leaves = settingLeavesEl.value !== 'off';
        if (!gameData.settings.leaves && bgParticlesEl) bgParticlesEl.innerHTML = '';
        if (gameData.settings.leaves) initParticles();
        scheduleSave();
        updateSettingsUI();
    });
}

if (settingAccentEl) {
    settingAccentEl.addEventListener('change', () => {
        ensureSettings();
        gameData.settings.accent = settingAccentEl.value;
        scheduleSave();
        updateSettingsUI();
    });
}

if (deviceMobileBtn) deviceMobileBtn.addEventListener('click', () => {
    ensureSettings();
    gameData.settings.device = 'mobile';
    scheduleSave();
    updateSettingsUI();
});

if (devicePcBtn) devicePcBtn.addEventListener('click', () => {
    ensureSettings();
    gameData.settings.device = 'pc';
    scheduleSave();
    updateSettingsUI();
});

// --- ДОСТАВКА (Courier Delivery) ---
function getCourierSpeedK() {
    const lvl = getUpgradeLevel('courierLevel');
    const prestigePts = Math.max(0, Math.floor(Number(gameData?.prestige?.points) || 0));
    return clamp(1 + lvl * 0.06 + prestigePts * 0.01, 1, 3.2);
}

function getDeliveryDurationMs() {
    const base = 55_000 + Math.random() * 45_000; // 55-100с
    return Math.floor(base / getCourierSpeedK());
}

function createDelivery(item) {
    if (!item) return;
    if (!Array.isArray(gameData.deliveries)) gameData.deliveries = [];
    const dur = getDeliveryDurationMs();
    const delivery = {
        deliveryId: `d-${nowMs()}-${Math.floor(Math.random() * 10000)}`,
        item,
        createdTs: nowMs(),
        etaTs: nowMs() + dur
    };
    gameData.deliveries.push(delivery);
    scheduleSave();
}

function tickDeliveries() {
    if (!Array.isArray(gameData.deliveries) || gameData.deliveries.length === 0) return;
    ensureItems();
    const now = nowMs();
    const keep = [];
    for (const d of gameData.deliveries) {
        const eta = Number(d?.etaTs) || 0;
        if (eta && now >= eta && d?.item) {
            gameData.items.push(d.item);
            continue;
        }
        keep.push(d);
    }
    gameData.deliveries = keep;
}

function renderDelivery() {
    if (!deliveryListEl) return;
    deliveryListEl.innerHTML = '';
    const list = ensureArray(gameData.deliveries);
    if (list.length === 0) {
        deliveryListEl.innerHTML = '<p style="text-align:center; color:gray;">Доставок нет.</p>';
        return;
    }

    const now = nowMs();
    for (const d of list) {
        const item = d.item;
        const phone = phonesDB.find(p => p.id === item?.modelId);
        if (!phone) continue;
        const rem = Math.max(0, (Number(d.etaTs) || 0) - now);

        const card = document.createElement('div');
        card.className = `card ${phone.rarity}`;
        const info = document.createElement('div');
        info.className = 'card-info';
        const h = document.createElement('h3');
        h.appendChild(createPhoneMedia(phone));
        h.appendChild(document.createTextNode(` ${phone.name}`));
        const p = document.createElement('p');
        p.textContent = `Приедет через: ${formatTime(rem)} • Износ: ${clampInt(item.condition, 0, 100)}%`;
        info.appendChild(h);
        info.appendChild(p);
        card.appendChild(info);
        deliveryListEl.appendChild(card);
    }
}

// --- ФЕРМА: ТЕРМАЛЫ (Farm Thermals) ---
function tickFarmThermals() {
    if (!gameData.farm || typeof gameData.farm !== 'object') gameData.farm = { temp: 26, lastTickTs: 0 };
    const now = nowMs();
    const last = Number(gameData.farm.lastTickTs) || now;
    const dt = clamp((now - last) / 1000, 0, 2);
    gameData.farm.lastTickTs = now;

    ensureItems();
    const n = ensureArray(gameData.items).length;
    const coolingLvl = getUpgradeLevel('coolingLevel');
    const ambient = 26;

    // нагрев от количества телефонов, охлаждение от апгрейда
    const heatIn = (n * 0.55) * dt;
    const coolOut = (0.9 + coolingLvl * 0.22) * dt;
    const towardAmbient = (gameData.farm.temp - ambient) * 0.06 * dt;
    gameData.farm.temp = clamp((Number(gameData.farm.temp) || ambient) + heatIn - coolOut - towardAmbient, 18, 140);

    // риск поломки при перегреве: ухудшаем состояние случайному телефону
    const temp = gameData.farm.temp;
    const over = Math.max(0, temp - (62 + coolingLvl * 2.0));
    if (over > 0 && n > 0) {
        const breakChance = clamp(over * 0.0025 * dt, 0, 0.12);
        if (Math.random() < breakChance) {
            const idx = Math.floor(Math.random() * n);
            const it = gameData.items[idx];
            if (it) {
                it.condition = clampInt((Number(it.condition) || 100) - (6 + Math.random() * 10), 0, 100);
                it.defects = { ...(it.defects || {}), ...genDefects(it.condition) };
            }
        }
    }
}

// --- СЕРВИС: ЗАПЧАСТИ + РЕМОНТ (Repair Workshop) ---
function partsToText() {
    const p = gameData.parts || {};
    return `Запчасти: экран x${Math.max(0, p.screen | 0)} • АКБ x${Math.max(0, p.battery | 0)} • мелочь x${Math.max(0, p.misc | 0)}`;
}

function updatePartsUI() {
    if (!partsHintEl) return;
    partsHintEl.textContent = partsToText();
}

function buyPartsPack() {
    if (!gameData.parts || typeof gameData.parts !== 'object') gameData.parts = { screen: 0, battery: 0, misc: 0 };
    const cost = 900;
    if (gameData.balance < cost) return;
    gameData.balance -= cost;
    gameData.parts.screen += 1;
    gameData.parts.battery += 1;
    gameData.parts.misc += 2;
    spawnFloatingText('-900 ₽');
    updateUI();
    updatePartsUI();
    renderWorkshop();
}

function isInRepair(uid) {
    return ensureArray(gameData.repairs).some(r => Number(r.uid) === Number(uid));
}

function startRepair(uid) {
    ensureItems();
    if (!Array.isArray(gameData.repairs)) gameData.repairs = [];
    if (!gameData.parts || typeof gameData.parts !== 'object') gameData.parts = { screen: 0, battery: 0, misc: 0 };

    const item = ensureArray(gameData.items).find(x => Number(x.uid) === Number(uid));
    if (!item) return;
    if (isInRepair(uid)) return;

    const needScreen = item.defects?.crackedScreen ? 1 : 0;
    const needBattery = item.defects?.badBattery ? 1 : 0;
    const needMisc = 1;
    if (gameData.parts.screen < needScreen) return;
    if (gameData.parts.battery < needBattery) return;
    if (gameData.parts.misc < needMisc) return;

    gameData.parts.screen -= needScreen;
    gameData.parts.battery -= needBattery;
    gameData.parts.misc -= needMisc;

    const dmg = Math.max(0, 100 - clampInt(item.condition, 0, 100));
    const duration = 15_000 + dmg * 400; // 15с + за износ
    gameData.repairs.push({
        jobId: `r-${nowMs()}-${Math.floor(Math.random() * 10000)}`,
        uid: item.uid,
        endTs: nowMs() + duration
    });
    scheduleSave();
    updatePartsUI();
    renderWorkshop();
}

function tickRepairs() {
    if (!Array.isArray(gameData.repairs) || gameData.repairs.length === 0) return;
    ensureItems();
    const now = nowMs();
    const keep = [];
    for (const r of gameData.repairs) {
        const end = Number(r?.endTs) || 0;
        if (end && now >= end) {
            const item = ensureArray(gameData.items).find(x => Number(x.uid) === Number(r.uid));
            if (item) {
                item.condition = 100;
                item.defects = { crackedScreen: false, badBattery: false };
                if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = {};
                gameData.stats.repairsDone = Math.max(0, Math.floor(Number(gameData.stats.repairsDone) || 0)) + 1;
            }
            continue;
        }
        keep.push(r);
    }
    gameData.repairs = keep;
}

function renderWorkshop() {
    updatePartsUI();
    if (!workshopListEl) return;
    workshopListEl.innerHTML = '';
    ensureItems();
    const damaged = ensureArray(gameData.items).filter(it => clampInt(it.condition, 0, 100) < 100);
    if (damaged.length === 0) {
        workshopListEl.innerHTML = '<p style="text-align:center; color:gray;">Все телефоны в идеале. Ремонт не нужен.</p>';
        return;
    }

    for (const it of damaged.slice(0, 25)) {
        const phone = phonesDB.find(p => p.id === it.modelId);
        if (!phone) continue;
        const card = document.createElement('div');
        card.className = `card ${phone.rarity}`;

        const info = document.createElement('div');
        info.className = 'card-info';
        const h = document.createElement('h3');
        h.appendChild(createPhoneMedia(phone));
        h.appendChild(document.createTextNode(` ${phone.name}`));
        const p = document.createElement('p');
        const defectsTxt = `${it.defects?.crackedScreen ? 'битый экран' : 'экран ок'} • ${it.defects?.badBattery ? 'плохая АКБ' : 'АКБ ок'}`;
        p.textContent = `Износ: ${clampInt(it.condition, 0, 100)}% • ${defectsTxt}`;
        info.appendChild(h);
        info.appendChild(p);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-btn';
        btn.dataset.repairUid = String(it.uid);
        btn.disabled = isInRepair(it.uid);
        btn.textContent = isInRepair(it.uid) ? 'В ремонте…' : 'Починить';

        card.appendChild(info);
        card.appendChild(btn);
        workshopListEl.appendChild(card);
    }
}

if (buyPartsBtn) {
    buyPartsBtn.addEventListener('click', () => buyPartsPack());
}

if (workshopListEl) {
    workshopListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const uid = Number(btn.dataset.repairUid);
        if (!Number.isFinite(uid)) return;
        startRepair(uid);
    });
}

function renderMarket() {
    const marketList = document.getElementById('market-list');
    marketList.innerHTML = '';

    for (const lot of ensureArray(currentMarket)) {
        const phone = phonesDB.find(p => p.id === lot.phoneId);
        if (!phone) continue;

        const card = document.createElement('div');
        card.className = `card ${phone.rarity}`;

        const info = document.createElement('div');
        info.className = 'card-info';
        const title = document.createElement('h3');
        title.appendChild(createPhoneMedia(phone));
        title.appendChild(document.createTextNode(` ${phone.name}`));

        const p1 = document.createElement('p');
        p1.textContent = `Доход: +${formatMoney(phone.income)} ₽/сек`;

        const p2 = document.createElement('p');
        const defectsTxt = `${lot.defects?.crackedScreen ? 'битый экран' : 'экран ок'} • ${lot.defects?.badBattery ? 'плохая АКБ' : 'АКБ ок'}`;
        p2.textContent = `Продавец: ${lot.seller} • Износ: ${clampInt(lot.condition, 0, 100)}% • ${defectsTxt}`;

        info.appendChild(title);
        info.appendChild(p1);
        info.appendChild(p2);

        const price = Math.max(1, Math.floor(Number(lot.askPrice) || 1));

        const btn = document.createElement('button');
        btn.className = 'buy-btn';
        btn.dataset.chatLotId = String(lot.lotId);
        const priceEl = document.createElement('span');
        priceEl.textContent = `${formatMoney(price)} ₽`;
        const last = Number(btn.dataset.lastPrice) || null;
        btn.dataset.lastPrice = String(price);
        btn.innerHTML = '';
        btn.appendChild(document.createTextNode('Чат • '));
        btn.appendChild(priceEl);
        btn.disabled = false;

        // мигание изменения цены (если цена сильно отличается от прошлой отрисовки)
        const key = `_mp_${lot.phoneId}`;
        const prev = Number(gameData[key]);
        if (Number.isFinite(prev) && prev !== price) {
            priceEl.classList.add(price > prev ? 'price-flash-up' : 'price-flash-down');
        }
        gameData[key] = price;

        card.appendChild(info);
        card.appendChild(btn);
        marketList.appendChild(card);
    }
}

function generateMarket() {
    currentMarket = buildMarketLots(3);
    renderMarket();
}

document.getElementById('market-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button.buy-btn');
    if (!btn) return;
    const lotId = btn.dataset.chatLotId;
    if (!lotId) return;
    openChatForLot(lotId);
});

// legacy buyPhone удалён (теперь покупки идут через чат + доставку)

// --- ИНВЕНТАРЬ ---
function renderInventory() {
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    
    ensureItems();
    if (ensureArray(gameData.items).length === 0) {
        invList.innerHTML = '<p style="text-align:center; color:gray;">У вас пока нет телефонов. Добывай, покупай, открывай кейсы.</p>';
        return;
    }

    const list = ensureArray(gameData.items)
        .slice()
        .sort((a, b) => {
            const pa = phonesDB.find(p => p.id === a.modelId);
            const pb = phonesDB.find(p => p.id === b.modelId);
            const ia = Number(pa?.income) || 0;
            const ib = Number(pb?.income) || 0;
            return (ib - ia) || (Number(b.condition) - Number(a.condition)) || (Number(a.uid) - Number(b.uid));
        });

    for (const it of list.slice(0, 60)) {
        const phone = phonesDB.find(p => p.id === it.modelId);
        if (!phone) continue;
        const card = document.createElement('div');
        card.className = `card ${phone.rarity}`;
        const info = document.createElement('div');
        info.className = 'card-info';

        const title = document.createElement('h3');
        title.appendChild(createPhoneMedia(phone));
        title.appendChild(document.createTextNode(` ${phone.name} `));
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = `#${it.uid} • ${clampInt(it.condition, 0, 100)}%`;
        title.appendChild(pill);

        const p = document.createElement('p');
        const defectsTxt = `${it.defects?.crackedScreen ? 'битый экран' : 'экран ок'} • ${it.defects?.badBattery ? 'плохая АКБ' : 'АКБ ок'}`;
        p.textContent = `Доход: +${formatMoney(phone.income)} ₽/сек • ${defectsTxt}`;

        info.appendChild(title);
        info.appendChild(p);

        const badge = document.createElement('div');
        badge.className = 'inv-actions';

        const sellBtn = document.createElement('button');
        sellBtn.type = 'button';
        sellBtn.className = 'sell-btn';
        sellBtn.dataset.sellUid = String(it.uid);
        sellBtn.textContent = `Продать (${formatMoney(getResalePrice(it))} ₽)`;

        const tuneBtn = document.createElement('button');
        tuneBtn.type = 'button';
        tuneBtn.className = 'action-btn';
        tuneBtn.dataset.tuneUid = String(it.uid);
        tuneBtn.dataset.tuneType = 'sticker';
        tuneBtn.textContent = '🎨 Стикер';

        const engrBtn = document.createElement('button');
        engrBtn.type = 'button';
        engrBtn.className = 'action-btn';
        engrBtn.dataset.tuneUid = String(it.uid);
        engrBtn.dataset.tuneType = 'engraving';
        engrBtn.textContent = '✍️ Гравировка';

        badge.appendChild(sellBtn);
        badge.appendChild(tuneBtn);
        badge.appendChild(engrBtn);

        card.appendChild(info);
        card.appendChild(badge);
        invList.appendChild(card);
    }
}

function getResalePrice(item) {
    const phone = phonesDB.find(p => p.id === item?.modelId);
    if (!phone) return 1;
    const base = getDynamicBasePrice(phone);
    const condK = conditionPriceFactor(item.condition, item.defects);
    const modsK = modsMarkupFactor(item.mods);
    const resaleK = 0.62;
    const colK = 1 + getCollectionsBonus();
    const prestigeK = 1 + (Math.max(0, Math.floor(Number(gameData?.prestige?.points) || 0)) * 0.01);
    return Math.max(1, Math.floor(base * condK * modsK * resaleK * colK * prestigeK));
}

function addXp(xp) {
    if (!gameData.prestige || typeof gameData.prestige !== 'object') gameData.prestige = { xp: 0, points: 0, officeTier: 0 };
    gameData.prestige.xp = Math.max(0, Math.floor(Number(gameData.prestige.xp) || 0)) + Math.max(0, Math.floor(Number(xp) || 0));
    gameData.prestige.officeTier = getOfficeTier();
}

function getLevel() {
    const xp = Math.max(0, Math.floor(Number(gameData?.prestige?.xp) || 0));
    return Math.max(1, Math.floor(Math.sqrt(xp / 1200)) + 1);
}

function getOfficeTier() {
    const lvl = getLevel();
    if (lvl >= 30) return 4;
    if (lvl >= 20) return 3;
    if (lvl >= 12) return 2;
    if (lvl >= 6) return 1;
    return 0;
}

// --- ТЮНИНГ (Customization) ---
function getTuningCost(type, current) {
    const lvl = Math.max(0, Math.floor(Number(current) || 0));
    if (type === 'sticker') return Math.floor(180 * Math.pow(1.55, lvl));
    if (type === 'engraving') return Math.floor(420 * Math.pow(1.7, lvl));
    return 999999;
}

function applyTuning(uid, type) {
    ensureItems();
    const it = ensureArray(gameData.items).find(x => Number(x.uid) === Number(uid));
    if (!it) return;
    if (!it.mods || typeof it.mods !== 'object') it.mods = { sticker: 0, engraving: 0 };

    if (type === 'sticker') {
        const cur = clampInt(it.mods.sticker, 0, 5);
        if (cur >= 5) return;
        const cost = getTuningCost('sticker', cur);
        if (gameData.balance < cost) return;
        gameData.balance -= cost;
        it.mods.sticker = cur + 1;
        addXp(Math.floor(cost * 0.12));
        spawnFloatingText('🎨 +стикер');
    } else if (type === 'engraving') {
        const cur = clampInt(it.mods.engraving, 0, 3);
        if (cur >= 3) return;
        const cost = getTuningCost('engraving', cur);
        if (gameData.balance < cost) return;
        gameData.balance -= cost;
        it.mods.engraving = cur + 1;
        addXp(Math.floor(cost * 0.12));
        spawnFloatingText('✍️ +гравировка');
    } else {
        return;
    }

    updateUI();
    renderInventory();
}

// --- КОЛЛЕКЦИИ (Collection Sets) ---
const collectionSets = [
    { id: 'iphone_line', title: 'Линейка iPhone', models: [2, 8, 11, 4, 13] , bonus: 0.06 }, // 4S, 8, 13, 15 Pro, 16 Pro Max
    { id: 'samsung_line', title: 'Линейка Samsung', models: [3, 9, 12], bonus: 0.05 },
    { id: 'retro', title: 'Ретро-коллекция', models: [1, 2], bonus: 0.04 }
];

function getOwnedModelIds() {
    ensureItems();
    const set = new Set();
    for (const it of ensureArray(gameData.items)) set.add(Number(it.modelId));
    return set;
}

function getCollectionsBonus() {
    const owned = getOwnedModelIds();
    let bonus = 0;
    for (const s of collectionSets) {
        const ok = s.models.every(id => owned.has(id));
        if (ok) bonus += Number(s.bonus) || 0;
    }
    return clamp(bonus, 0, 0.25);
}

function renderCollections() {
    if (!collectionsListEl) return;
    collectionsListEl.innerHTML = '';
    const owned = getOwnedModelIds();
    for (const s of collectionSets) {
        const done = s.models.every(id => owned.has(id));
        const row = document.createElement('div');
        row.className = 'upgrade-card';
        const info = document.createElement('div');
        info.className = 'upgrade-info';
        const h = document.createElement('h3');
        h.textContent = `${s.title} `;
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = done ? 'готово' : `${s.models.filter(id => owned.has(id)).length}/${s.models.length}`;
        h.appendChild(pill);
        const p = document.createElement('p');
        p.textContent = `Бонус: +${Math.round((Number(s.bonus) || 0) * 100)}% к доходу/продаже`;
        info.appendChild(h);
        info.appendChild(p);
        row.appendChild(info);
        collectionsListEl.appendChild(row);
    }
}

// --- ПРЕСТИЖ + ОФИС (Prestige & Offices) ---
function updatePrestigeUI() {
    if (!prestigeHintEl) return;
    const lvl = getLevel();
    const pts = Math.max(0, Math.floor(Number(gameData?.prestige?.points) || 0));
    const tier = getOfficeTier();
    const farmTemp = clamp(Number(gameData?.farm?.temp) || 26, 10, 140);
    const officeNames = ['Гараж', 'Комната', 'Студия', 'Офис', 'Небоскрёб'];
    prestigeHintEl.textContent = `LVL ${lvl} • Престиж: ${pts} • Офис: ${officeNames[tier] || 'Офис'} • Температура фермы: ${Math.round(farmTemp)}°C`;

    if (prestigeBtn) {
        const need = getPrestigeRequirement();
        prestigeBtn.disabled = gameData.balance < need;
        prestigeBtn.textContent = `✨ Престиж (${formatMoney(need)} ₽)`;
    }
}

function getPrestigeRequirement() {
    const pts = Math.max(0, Math.floor(Number(gameData?.prestige?.points) || 0));
    return Math.floor(80_000 * Math.pow(1.45, Math.min(pts, 12)));
}

function doPrestige() {
    const need = getPrestigeRequirement();
    if (gameData.balance < need) return;
    if (!gameData.prestige || typeof gameData.prestige !== 'object') gameData.prestige = { xp: 0, points: 0, officeTier: 0 };

    gameData.prestige.points = Math.max(0, Math.floor(Number(gameData.prestige.points) || 0)) + 1;
    gameData.prestige.xp = Math.max(0, Math.floor(Number(gameData.prestige.xp) || 0));
    gameData.prestige.officeTier = getOfficeTier();

    // мягкий ресет экономики (оставляем престиж, историю цен, квесты)
    gameData.balance = 0;
    gameData.items = [];
    gameData.deliveries = [];
    gameData.repairs = [];
    gameData.parts = { screen: 0, battery: 0, misc: 0 };
    gameData.upgrades = { ...(gameData.upgrades || {}), clickPowerLevel: 0, critLevel: 0, autoTapLevel: 0, courierLevel: 0, coolingLevel: 0 };
    gameData.farm = { temp: 26, lastTickTs: nowMs() };
    gameData.activeChat = null;
    gameData.lastFindTs = 0;
    gameData.lastHackTs = 0;

    spawnFloatingText('✨ ПРЕСТИЖ');
    updateUI();
    renderUpgrades();
    generateMarket();
    renderInventory();
    renderDelivery();
    renderWorkshop();
    renderCollections();
    updatePrestigeUI();
    scheduleSave();
}

if (prestigeBtn) {
    prestigeBtn.addEventListener('click', () => doPrestige());
}

// --- АУКЦИОНЫ (Black Market Auctions) ---
function ensureAuction() {
    if (gameData.auction && typeof gameData.auction === 'object') return;
    gameData.auction = null;
}

function genAuctionLot() {
    // редкий/легендарный лот, иногда "золотой"
    const rarity = Math.random() < 0.22 ? 'legendary' : 'rare';
    const pool = phonesDB.filter(p => p.rarity === rarity);
    const phone = pool.length ? pool[Math.floor(Math.random() * pool.length)] : pickAnyFrom(phonesDB);
    const golden = Math.random() < 0.12;
    const cond = golden ? 96 : genConditionForRarity(rarity);
    const defects = golden ? { crackedScreen: false, badBattery: false } : genDefects(cond);
    const base = getDynamicBasePrice(phone) * (golden ? 1.8 : 1.25);
    const start = Math.max(1, Math.floor(base * conditionPriceFactor(cond, defects) * 0.75));
    return {
        lotId: `a-${phone.id}-${nowMs()}-${Math.floor(Math.random() * 10000)}`,
        phoneId: phone.id,
        condition: cond,
        defects,
        golden,
        currentBid: start,
        leader: 'bot',
        endTs: nowMs() + (75_000 + Math.random() * 45_000)
    };
}

function tickAuction() {
    const now = nowMs();
    if (!gameData.auction || typeof gameData.auction !== 'object') {
        if (Math.random() < 0.12) gameData.auction = genAuctionLot();
        return;
    }

    // боты иногда перебивают
    if (now < gameData.auction.endTs) {
        const botChance = clamp(0.10 + (Math.random() * 0.08), 0.08, 0.22);
        if (Math.random() < botChance) {
            const bump = Math.max(1, Math.floor(gameData.auction.currentBid * (0.01 + Math.random() * 0.04)));
            gameData.auction.currentBid += bump;
            gameData.auction.leader = 'bot';
        }
        return;
    }

    // завершение
    if (gameData.auction.leader === 'me') {
        const phone = phonesDB.find(p => p.id === gameData.auction.phoneId);
        if (phone) {
            const item = createItem(phone.id, 'auction', gameData.auction.condition);
            item.defects = gameData.auction.defects || item.defects;
            if (gameData.auction.golden) item.mods = { sticker: 2, engraving: 1 };
            createDelivery(item);
            if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = {};
            gameData.stats.auctionsWon = Math.max(0, Math.floor(Number(gameData.stats.auctionsWon) || 0)) + 1;
        }
    }
    gameData.auction = null;
}

function renderAuction() {
    if (!auctionBoxEl) return;
    ensureAuction();
    if (!gameData.auction) {
        auctionBoxEl.innerHTML = '<p class="hint">Пока тихо… жди редкий лот.</p>';
        if (auctionHintEl) auctionHintEl.textContent = '';
        return;
    }
    const a = gameData.auction;
    const phone = phonesDB.find(p => p.id === a.phoneId);
    if (!phone) return;
    const rem = Math.max(0, (Number(a.endTs) || 0) - nowMs());
    const defectsTxt = `${a.defects?.crackedScreen ? 'битый экран' : 'экран ок'} • ${a.defects?.badBattery ? 'плохая АКБ' : 'АКБ ок'}`;
    auctionBoxEl.innerHTML = '';

    const row = document.createElement('div');
    row.className = `card ${phone.rarity}`;
    const info = document.createElement('div');
    info.className = 'card-info';
    const h = document.createElement('h3');
    h.appendChild(createPhoneMedia(phone));
    h.appendChild(document.createTextNode(` ${phone.name}${a.golden ? ' (Gold)' : ''}`));
    const p = document.createElement('p');
    p.textContent = `Ставка: ${formatMoney(a.currentBid)} ₽ • Лидер: ${a.leader === 'me' ? 'Вы' : 'Бот'} • До конца: ${formatTime(rem)} • Износ: ${clampInt(a.condition, 0, 100)}% • ${defectsTxt}`;
    info.appendChild(h);
    info.appendChild(p);
    row.appendChild(info);
    auctionBoxEl.appendChild(row);

    const canBid = gameData.balance > a.currentBid;
    if (auctionHintEl) auctionHintEl.textContent = canBid ? 'Ставь и забирай лот (придёт доставкой).' : 'Нужны деньги для ставки.';
}

function bidAuction(mult) {
    if (!gameData.auction) return;
    const a = gameData.auction;
    const cur = Math.max(1, Math.floor(Number(a.currentBid) || 1));
    let next = cur + Math.max(1, Math.floor(cur * mult));
    next = Math.max(next, cur + 1);
    if (next > gameData.balance) return;
    a.currentBid = next;
    a.leader = 'me';
    scheduleSave();
    renderAuction();
}

function bidAuctionMax() {
    if (!gameData.auction) return;
    const a = gameData.auction;
    const next = Math.max(a.currentBid + 1, Math.floor(gameData.balance));
    if (next <= a.currentBid) return;
    a.currentBid = next;
    a.leader = 'me';
    scheduleSave();
    renderAuction();
}

if (auctionBid1Btn) auctionBid1Btn.addEventListener('click', () => bidAuction(0.01));
if (auctionBid5Btn) auctionBid5Btn.addEventListener('click', () => bidAuction(0.05));
if (auctionBidMaxBtn) auctionBidMaxBtn.addEventListener('click', () => bidAuctionMax());

function sellItem(uid) {
    ensureItems();
    const id = Number(uid);
    if (!Number.isFinite(id)) return;
    const idx = ensureArray(gameData.items).findIndex(x => Number(x.uid) === id);
    if (idx < 0) return;
    const it = gameData.items[idx];
    const price = getResalePrice(it);

    // продаём
    gameData.items.splice(idx, 1);
    gameData.balance += price;
    if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = {};
    gameData.stats.phonesSold = Math.max(0, Math.floor(Number(gameData.stats.phonesSold) || 0)) + 1;
    addXp(Math.floor(price * 0.18));
    updateUI();
    renderInventory();
    renderMarket();
    renderQuests();
    renderWorkshop();
    renderCollections();
}

document.getElementById('inventory-list').addEventListener('click', (e) => {
    const sellBtn = e.target.closest('button.sell-btn');
    if (sellBtn) {
        const uid = Number(sellBtn.dataset.sellUid);
        if (!Number.isFinite(uid)) return;
        sellItem(uid);
        return;
    }
    const tuneBtn = e.target.closest('button.action-btn');
    if (!tuneBtn) return;
    const uid = Number(tuneBtn.dataset.tuneUid);
    const type = tuneBtn.dataset.tuneType;
    if (!Number.isFinite(uid) || !type) return;
    applyTuning(uid, type);
});

// --- СОБЫТИЕ РЫНКА: СКИДКА НА 1 ЛОТ ---
function getActiveMarketEvent() {
    // событие больше не используется (рынок стал динамическим по трендам/дефициту)
    return null;
}

function maybeStartMarketEvent() {
    // no-op
}

function getMarketPrice(phone) {
    // legacy
    return getDynamicBasePrice(phone);
}

// --- ИГРОВОЙ ЦИКЛ (Пассивный доход) ---
let autoFindAcc = 0;
setInterval(() => {
    tickMarketSentiment();
    tickFarmThermals();
    tickRepairs();
    tickDeliveries();
    tickAuction();

    gameData.balance += getIncomePerSecond();
    const autoRate = getAutoTapPerSecond();
    if (autoRate > 0) {
        autoFindAcc += autoRate;
        const give = Math.floor(autoFindAcc);
        if (give > 0) {
            autoFindAcc -= give;
            for (let i = 0; i < give; i++) {
                const { phone } = pickFoundPhone();
                if (phone) addToInventory(phone.id, 1);
            }
            if (!gameData.stats || typeof gameData.stats !== 'object') gameData.stats = {};
            gameData.stats.phonesFound = Math.max(0, Math.floor(Number(gameData.stats.phonesFound) || 0)) + give;
            renderInventory();
            renderQuests();
        }
    }
    updateUI();
    renderUpgrades();
    renderMarket(); // обновляем disabled на кнопках
    renderCases();
    renderDelivery();
    renderWorkshop();
    renderAuction();
}, 1000);

// Обновляем рынок каждые 15 секунд
setInterval(generateMarket, 15000);

// Инициализация при запуске
updateUI();
renderUpgrades();
generateMarket();
renderCases();
renderQuests();
renderChat();
tickMarketSentiment();
updateSettingsUI();
initParticles();
renderDelivery();
renderWorkshop();
renderAuction();
renderCollections();
updatePrestigeUI();