// --- ДАННЫЕ ---
let money = 2000; 
let warehouse = [];
let miningFarm = [];
let miningSlots = 10;
let totalMiningRate = 0;
let statsTotalBuilt = 0;
let isProducing = false;

let upgrades = {
    speedLevel: 0,
    slotsLevel: 0
};

const phonesDB = [
//Самые популярные модели Samsung
{ name: "Samsung S26 Ultra", cost: 160000, time: 10, mine: 10000 },
{ name: "Samsung S25 Ultra", cost: 150000, time: 10, mine: 9000 },
{ name: "Samsung S24 Ultra", cost: 140000, time: 10, mine: 8000 },
{ name: "Samsung S23 Ultra", cost: 130000, time: 10, mine: 7000 },
{ name: "Samsung S22 Ultra", cost: 120000, time: 10, mine: 6000 },
{ name: "Samsung S21 Ultra", cost: 110000, time: 10, mine: 5000 },
//Самые популярные модели iPhone
{ name: "Iphone 17 Pro Max", cost: 160000, time: 10, mine: 10000 },
{ name: "Iphone 16 Pro Max", cost: 150000, time: 10, mine: 9000},
{ name: "iPhone 15 Pro Max", cost: 140000, time: 10, mine: 8000 },
{ name: "Iphone 14 Pro Max", cost: 130000, time: 10, mine: 7000 },
{ name: "Iphone 13 Pro Max", cost: 120000, time: 10, mine: 6000 },
{ name: "Iphone 12 Pro Max", cost: 110000, time: 10, mine: 5000 },
{ name: "Iphone 11 Pro Max", cost: 100000, time: 10, mine: 4000 },
//Самые популярные модели Xiaomi
{ name: "Xiaomi 15T", cost: 160000, time: 10, mine: 10000 },
{ name: "Xiaomi 14T", cost: 150000, time: 10, mine: 9000 },
{ name: "Xiaomi 13T", cost: 140000, time: 10, mine: 8000 },
{ name: "Xiaomi 12T", cost: 130000, time: 10, mine: 7000 },
{ name: "Xiaomi 11T", cost: 120000, time: 10, mine: 6000},
//Самые популярные модели Google
{ name: "Google Pixel 9 Pro XL", cost: 160000, time: 10, mine: 10000 },
{ name: "Google Pixel 9 Pro", cost: 150000, time: 10, mine: 9000 },
{ name: "Google Pixel 9", cost: 140000, time: 10, mine: 8000 },
{ name: "Google Pixel Fold 2", cost: 130000, time: 10, mine: 7000 },
{ name: "Google Pixel 8 Pro", cost: 120000, time: 10, mine: 6000 },
{ name: "Google Pixel 8", cost: 110000, time: 10, mine: 5000 },
{ name: "Google Pixel 8a", cost: 100000, time: 10, mine: 4000 },
{ name: "Google Pixel Tablet Pro", cost: 90000, time: 10, mine: 3000 },
//Самые популярные модели OnePlus
{ name: "OnePlus 12", cost: 160000, time: 10, mine: 10000 },
{ name: "OnePlus Open", cost: 150000, time: 10, mine: 9000 },
{ name: "OnePlus 12R", cost: 140000, time: 10, mine: 8000 },
{ name: "OnePlus Nord 4", cost: 130000, time: 10, mine: 7000 },
{ name: "OnePlus 11 Pro", cost: 120000, time: 10, mine: 6000 },
{ name: "OnePlus Nord CE 4", cost: 110000, time: 10, mine: 5000 },
{ name: "OnePlus Ace 3 Pro", cost: 100000, time: 10, mine: 4000 },
{ name: "OnePlus 10T", cost: 90000, time: 10, mine: 3000 },
//Самые популярные модели Sony
{ name: "Sony Xperia 1 VI", cost: 160000, time: 10, mine: 10000 },
{ name: "Sony Xperia 5 V", cost: 150000, time: 10, mine: 9000 },
{ name: "Sony Xperia 10 VI", cost: 140000, time: 10, mine: 8000 },
{ name: "Sony Xperia Pro-I II", cost: 130000, time: 10, mine: 7000 },
{ name: "Sony Xperia 1 V", cost: 120000, time: 10, mine: 6000 },
{ name: "Sony Xperia 5 IV", cost: 110000, time: 10, mine: 5000 },
{ name: "Sony Xperia Ace III", cost: 100000, time: 10, mine: 4000 },
{ name: "Sony Xperia 10 V", cost: 90000, time: 10, mine: 3000 },
//Самые популярные модели Huawei
{ name: "Huawei Pura 70 Ultra", cost: 160000, time: 10, mine: 10000 },
{ name: "Huawei Mate 60 Pro+", cost: 150000, time: 10, mine: 9000 },
{ name: "Huawei Mate X5 Fold", cost: 130000, time: 10, mine: 8000 },
{ name: "Huawei Pura 70 Pro", cost: 120000, time: 10, mine: 7000 },
{ name: "Huawei Nova 12 Ultra", cost: 110000, time: 10, mine: 6000 },
{ name: "Huawei Mate 60 RS", cost: 100000, time: 10, mine: 5000 },
{ name: "Huawei P60 Pro", cost: 90000, time: 10, mine: 4000 },
{ name: "Huawei Pocket 2", cost: 80000, time: 10, mine: 3000 }
];

// --- ИНИЦИАЛИЗАЦИЯ ---
window.onload = function() {
    loadGame();
    updateUI();
    renderUpgrades();
    autoProductionLoop();
    setInterval(miningTick, 1000);
    setInterval(saveGame, 5000);
};

function updateUI() {
    document.getElementById('balance').innerText = `$${Math.floor(money).toLocaleString()}`;
    document.getElementById('mining-rate').innerText = `+$${totalMiningRate.toLocaleString()}`;
    document.getElementById('stats-total-built').innerText = statsTotalBuilt;
    document.getElementById('slots-count').innerText = `${miningFarm.length} / ${miningSlots}`;
    document.getElementById('speed-bonus').innerText = `${Math.round(Math.pow(0.9, upgrades.speedLevel) * 100)}%`;
}

// --- РАНДОМНАЯ СБОРКА ---
async function autoProductionLoop() {
    while (true) {
        const isAuto = document.getElementById('auto-toggle').checked;
        if (isAuto && !isProducing) {
            // ВЫБОР СЛУЧАЙНОГО ТЕЛЕФОНА
            const randomIndex = Math.floor(Math.random() * phonesDB.length);
            const randomPhone = phonesDB[randomIndex];
            
            await startBuild(randomPhone);
        }
        // Небольшая задержка между проверками, чтобы не нагружать процессор
        await new Promise(r => setTimeout(r, 1000));
    }
}

function startBuild(phone) {
    return new Promise((resolve) => {
        isProducing = true;
        updateUI();

        const actualTime = phone.time * Math.pow(0.9, upgrades.speedLevel);
        document.getElementById('current-phone-name').innerText = phone.name;
        document.getElementById('current-phone-stats').innerText = `Сборка случайной модели...`;

        let progress = 0;
        const startTime = Date.now();
        const duration = actualTime * 1000;

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            progress = (elapsed / duration) * 100;
            
            document.getElementById('auto-progress-fill').style.width = Math.min(progress, 100) + '%';
            document.getElementById('progress-percent').innerText = Math.floor(progress) + '%';
            document.getElementById('time-left').innerText = Math.max(0, (duration - elapsed) / 1000).toFixed(1) + 's';

            if (elapsed >= duration) {
                clearInterval(interval);
                warehouse.push({...phone, uid: Date.now()});
                statsTotalBuilt++;
                isProducing = false;
                showToast(`🎁 Выпал: ${phone.name}`);
                updateUI();
                resolve();
            }
        }, 50);
    });
}

// --- СКЛАД И МАЙНИНГ ---
function renderWarehouse() {
    const grid = document.getElementById('market-sell');
    if(!grid) return;
    grid.innerHTML = warehouse.map((p, i) => `
        <div class="item-card">
            <b>${p.name}</b><br><small>Выгода: $${p.mine}/с</small>
            <button class="btn-action" onclick="moveToMining(${i})">В майнинг</button>
            <button class="btn-secondary" onclick="sellPhone(${i})">Удалить</button>
        </div>
    `).join('');
}

function renderMining() {
    const grid = document.getElementById('mining-grid');
    if(!grid) return;
    grid.innerHTML = miningFarm.map((p, i) => `
        <div class="item-card" style="border-color: var(--accent)">
            <b>${p.name}</b><br><span style="color: var(--accent)">+$${p.mine}/с</span>
            <button class="btn-secondary" onclick="removeFromMining(${i})">На склад</button>
        </div>
    `).join('');
}

function moveToMining(idx) {
    if (miningFarm.length < miningSlots) {
        miningFarm.push(warehouse.splice(idx, 1)[0]);
        calculateRates();
        renderWarehouse();
        updateUI();
    } else {
        showToast("⚠️ Нет места на ферме!");
    }
}

function removeFromMining(idx) {
    warehouse.push(miningFarm.splice(idx, 1)[0]);
    calculateRates();
    renderMining();
    updateUI();
}

function sellPhone(idx) {
    warehouse.splice(idx, 1);
    renderWarehouse();
}

// --- МАГАЗИН ---
function renderUpgrades() {
    const speedCost = Math.floor(5000 * Math.pow(1.6, upgrades.speedLevel));
    const slotsCost = Math.floor(10000 * Math.pow(1.9, upgrades.slotsLevel));
    const container = document.getElementById('upgrades-list');
    if(!container) return;
    
    container.innerHTML = `
        <div class="item-card">
            <b>Ускорение (Lvl ${upgrades.speedLevel})</b>
            <p>Уменьшает время сборки на 10%.</p>
            <button class="btn-action" onclick="buyUpgrade('speed', ${speedCost})">Купить: $${speedCost.toLocaleString()}</button>
        </div>
        <div class="item-card">
            <b>Слоты фермы (Lvl ${upgrades.slotsLevel})</b>
            <p>Добавляет +2 места для майнинга.</p>
            <button class="btn-action" onclick="buyUpgrade('slots', ${slotsCost})">Купить: $${slotsCost.toLocaleString()}</button>
        </div>
    `;
}

function buyUpgrade(type, cost) {
    if (money >= cost) {
        money -= cost;
        if (type === 'speed') upgrades.speedLevel++;
        if (type === 'slots') { upgrades.slotsLevel++; miningSlots += 2; }
        showToast("✨ Система улучшена!");
        updateUI();
        renderUpgrades();
    } else {
        showToast("❌ Недостаточно средств!");
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ---
function calculateRates() {
    totalMiningRate = miningFarm.reduce((sum, item) => sum + item.mine, 0);
}

function miningTick() {
    money += totalMiningRate;
    updateUI();
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('btn-' + tabId).classList.add('active');
    if(tabId === 'warehouse') renderWarehouse();
    if(tabId === 'mining') renderMining();
    if(tabId === 'shop') renderUpgrades();
}

function toggleTheme() {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

function showToast(text) {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast'; t.innerText = text;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function saveGame() {
    const data = { money, warehouse, miningFarm, upgrades, miningSlots, statsTotalBuilt };
    localStorage.setItem('pme_random_save', JSON.stringify(data));
}

function loadGame() {
    const saved = localStorage.getItem('pme_random_save');
    if (saved) {
        const d = JSON.parse(saved);
        money = d.money; warehouse = d.warehouse; miningFarm = d.miningFarm;
        upgrades = d.upgrades; miningSlots = d.miningSlots; statsTotalBuilt = d.statsTotalBuilt;
        calculateRates();
    }
}
