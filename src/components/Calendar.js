// src/components/Calendar.js
import { collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from '../firebase.js';
import { store } from '../store.js';
import { timestampToYYYYMMDD } from '../utils.js';
import { openEventModal } from './EventModal.js';
import { openWorkplaceModal } from './WorkplaceModal.js';
import { openShiftModal } from './ShiftModal.js';
import { getPaydayForClosingMonth } from "../utils/salaryCalculator.js";
import { renderSalaryReport } from "./SalaryReport.js";

let containerEl = null;
let unsubscribes = [];
let isWheeling = false;

// スワイプ関連の変数
let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD_X = 50; // 水平スワイプの閾値（ピクセル）

export function renderCalendar(container) {
    if (container) containerEl = container;
    if (!containerEl || !store.user) return;
    
    // ログイン時やビュー切替時にリスナーを初期化
    unsubscribes.forEach(unsub => unsub());
    unsubscribes = [];
    setupFirestoreListeners(); // データ監視を開始
}

// Firestoreのデータ監視を開始する
function setupFirestoreListeners() {
    if (!store.user) return;
    const uid = store.user.uid;
    const collections = ["events", "shifts", "workplaces"];
    
    let initialLoads = collections.length;
    let loadedCount = 0;
    let isInitialRender = true;

    collections.forEach(col => {
        unsubscribes.push(onSnapshot(query(collection(db, `users/${uid}/${col}`)), snap => {
            store[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loadedCount++;
            // 初回は全てのデータが揃ってから描画、以降は都度更新
            if (isInitialRender && loadedCount >= initialLoads) {
                updateUI();
                isInitialRender = false;
            } else if (!isInitialRender) {
                updateUI();
            }
        }));
    });
}

// UIの全ての動的な部分を再描画する、シンプルで堅牢なメイン関数
function updateUI() {
    if (!containerEl) return;

    // --- ヘッダー部分のHTMLを生成 ---
    let headerLeftHTML = '<div></div>';
    if (store.currentView === 'work') {
        headerLeftHTML = `<button id="manage-workplaces-btn" class="text-sm bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-3 rounded-lg transition whitespace-nowrap"><i class="fas fa-store mr-2"></i>勤務先管理</button>`;
    } else if (store.currentView === 'personal') {
        headerLeftHTML = `<div class="flex items-center gap-2"><label for="show-work-toggle" class="text-sm font-semibold text-gray-600 whitespace-nowrap">バイト表示</label><div class="relative inline-block w-10 align-middle select-none transition duration-200 ease-in"><input type="checkbox" id="show-work-toggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" ${store.showWorkShiftsOnPersonal ? 'checked' : ''}/><label for="show-work-toggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label></div></div>`;
    }

    // --- カレンダーグリッドのHTMLを生成 ---
    const year = store.currentDate.getFullYear();
    const month = store.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let gridHTML = '';
    for (let i = 0; i < firstDay; i++) gridHTML += `<div class="h-14 sm:h-20 bg-gray-50 rounded"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = new Date().toDateString() === new Date(dateStr).toDateString();
        const isSelected = new Date(store.selectedDate).toDateString() === new Date(dateStr).toDateString();
        
        let itemsHTML = '';
        const eventDots = store.events.filter(e => timestampToYYYYMMDD(e.start) === dateStr).map(e => `<div class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style="background-color:${e.color}"></div>`).join('');
        const shiftDots = store.shifts.filter(s => timestampToYYYYMMDD(s.start) === dateStr).map(s => {
            const workplace = store.workplaces.find(w => w.id === s.workplaceId);
            return `<div class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style="background-color:${workplace?.color || '#34d399'}"></div>`;
        }).join('');
        
        let paydayMark = '';
        store.workplaces.forEach(wp => {
            const prevMonthPayday = getPaydayForClosingMonth(year, month - 1, wp);
            const currentMonthPayday = getPaydayForClosingMonth(year, month, wp);
            if ((prevMonthPayday.getFullYear() === year && prevMonthPayday.getMonth() === month && prevMonthPayday.getDate() === day) ||
                (currentMonthPayday.getFullYear() === year && currentMonthPayday.getMonth() === month && currentMonthPayday.getDate() === day)) {
                paydayMark = '<span class="text-xs">💰</span>';
            }
        });
        if (store.currentView === 'personal') {
            itemsHTML = eventDots;
            if (store.showWorkShiftsOnPersonal) itemsHTML += shiftDots;
        } else { itemsHTML = shiftDots; }
        
        gridHTML += `<div class="h-14 sm:h-20 border rounded p-1 sm:p-1.5 flex flex-col cursor-pointer transition ${isSelected ? 'bg-blue-100 border-blue-400' : 'border-gray-100 hover:bg-blue-50'}" data-date-str="${dateStr}"><div class="flex justify-between items-start"><span class="day-number text-xs sm:text-sm font-medium ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-700'}">${day}</span>${paydayMark}</div><div class="mt-1 flex-grow flex items-end justify-center gap-1">${itemsHTML}</div></div>`;
    }

    // --- 全体のHTMLを構築して描画 ---
    containerEl.innerHTML = `
        <div id="calendar-module-container">
            <div id="calendar-module" class="bg-white p-4 sm:p-6 rounded-xl shadow-lg relative">
                <header class="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-2 sm:gap-4">
                    <div id="month-navigation" class="flex items-center justify-between w-full lg:w-auto order-1 lg:order-2">
                        <button id="prev-month-btn" class="p-2 rounded-full hover:bg-gray-200 transition"><i class="fas fa-chevron-left"></i></button>
                        <h2 id="month-year-display" class="text-xl font-bold text-gray-800 text-center">${store.currentDate.getFullYear()}年 ${store.currentDate.getMonth() + 1}月</h2>
                        <button id="next-month-btn" class="p-2 rounded-full hover:bg-gray-200 transition"><i class="fas fa-chevron-right"></i></button>
                    </div>
                    <div id="calendar-controls" class="flex items-center justify-between w-full lg:w-auto gap-4 order-2 lg:order-1">
                        <div id="header-left" class="flex-grow">${headerLeftHTML}</div>
                        <div id="view-toggle" class="p-1 bg-gray-200 rounded-lg flex flex-shrink-0">
                            <button id="toggle-personal-btn" class="px-3 sm:px-4 py-1 text-sm font-semibold rounded-md ${store.currentView === 'personal' ? 'bg-white shadow' : ''}">個人</button>
                            <button id="toggle-work-btn" class="px-3 sm:px-4 py-1 text-sm font-semibold rounded-md ${store.currentView === 'work' ? 'bg-white shadow' : ''}">バイト</button>
                        </div>
                    </div>
                </header>
                <div id="day-names" class="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">${['日', '月', '火', '水', '木', '金', '土'].map(d => `<div>${d}</div>`).join('')}</div>
                <div id="calendar-grid" class="grid grid-cols-7 gap-1 min-h-[360px] sm:min-h-[480px]">${gridHTML}</div>
                <div id="fab-container">
                    <button id="fab-add-btn" class="absolute bottom-4 right-4 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-2xl z-40 ${store.currentView === 'personal' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}">+</button>
                </div>
            </div>
            <div id="daily-schedule-view" class="mt-6"></div>
        </div>
    `;

    // --- 関連モジュールの描画 ---
    if (store.currentView === 'personal') renderDailySchedule(); else renderDailyShifts();
    renderSalaryReport(document.getElementById('salary-report-module'));

    // --- イベントリスナーを再設定 ---
    attachEventListeners();
}

// 予定一覧（個人）を再描画
function renderDailySchedule() {
    const dailyView = document.getElementById('daily-schedule-view');
    if (!dailyView) return;

    if (store.currentView !== 'personal') {
        dailyView.innerHTML = '';
        return;
    }

    const dateStr = timestampToYYYYMMDD({ toDate: () => store.selectedDate });
    const dayEvents = store.events.filter(e => timestampToYYYYMMDD(e.start) === dateStr);
    let allItems = dayEvents.map(e => ({ item: e, type: 'event' }));
    if (store.showWorkShiftsOnPersonal) {
        const dayShifts = store.shifts.filter(s => timestampToYYYYMMDD(s.start) === dateStr);
        allItems.push(...dayShifts.map(s => ({ item: s, type: 'shift' })));
    }
    allItems.sort((a,b) => a.item.start.toDate() - b.item.start.toDate());
    const itemsHTML = allItems.map(({item, type}) => {
        const start = item.start.toDate(); const end = item.end.toDate();
        let time, title, memoHTML, color, clickableClass;
        if(type === 'event') {
            time = item.allDay ? '終日' : `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')} - ${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`;
            title = item.title;
            memoHTML = item.memo ? `<p class="text-sm text-gray-600 mt-1 whitespace-pre-wrap">${item.memo}</p>` : '';
            color = item.color;
            clickableClass = 'hover:bg-gray-50 cursor-pointer';
        } else {
            const workplace = store.workplaces.find(w => w.id === item.workplaceId);
            time = `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')} - ${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`;
            title = workplace?.name || '単発バイト';
            memoHTML = item.memo ? `<p class="text-sm text-gray-600 mt-1 whitespace-pre-wrap">${item.memo}</p>` : '';
            color = workplace?.color || '#34d399';
            clickableClass = 'hover:bg-gray-100 cursor-pointer bg-gray-50';
        }
        return `<li class="flex items-stretch gap-4 p-4 rounded-lg ${clickableClass}" data-item-id="${item.id}" data-type="${type}"><div class="w-1.5 rounded-full flex-shrink-0" style="background-color:${color}"></div><div class="flex-grow py-1"><p class="font-semibold text-gray-800">${title}</p><p class="text-sm text-gray-500">${time}</p>${memoHTML}</div></li>`;
    }).join('');
    dailyView.innerHTML = `<h3 class="text-lg font-bold mb-2 px-4">${store.selectedDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</h3><ul>${itemsHTML || `<li class="text-center text-gray-500 p-8">この日の予定はありません。</li>`}</ul>`;
}

// 予定一覧（バイト）を再描画
function renderDailyShifts() {
    const dailyView = document.getElementById('daily-schedule-view');
    if (!dailyView) return;
    
    if (store.currentView !== 'work') {
        dailyView.innerHTML = '';
        return;
    }
    
    const dateStr = timestampToYYYYMMDD({ toDate: () => store.selectedDate });
    const dayShifts = store.shifts.filter(s => timestampToYYYYMMDD(s.start) === dateStr).sort((a,b) => a.start.toDate() - b.start.toDate());
    const shiftsHTML = dayShifts.map(s => {
        const workplace = store.workplaces.find(w => w.id === s.workplaceId);
        const color = workplace?.color || '#34d399';
        const start = s.start.toDate(); const end = s.end.toDate();
        const time = `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')} - ${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`;
        const memoHTML = s.memo ? `<p class="text-sm text-gray-600 mt-1 whitespace-pre-wrap">${s.memo}</p>` : '';
        return `<li class="flex items-stretch gap-4 p-4 hover:bg-gray-50 cursor-pointer rounded-lg" data-item-id="${s.id}" data-type="shift"><div class="w-1.5 rounded-full" style="background-color:${color}"></div><div class="flex-grow py-1"><p class="font-semibold text-gray-800">${workplace?.name || '単発バイト'}</p><p class="text-sm text-gray-500">${time}</p>${memoHTML}</div></li>`;
    }).join('');
    dailyView.innerHTML = `<h3 class="text-lg font-bold mb-2 px-4">${store.selectedDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</h3><ul>${shiftsHTML || `<li class="text-center text-gray-500 p-8">この日のシフトはありません。</li>`}</ul>`;
}

// 日単位で移動する（ホイール・スワイプ用）
function navigateDay(direction) {
    if (isWheeling) return;
    isWheeling = true;
    store.selectedDate.setDate(store.selectedDate.getDate() + direction);
    updateUI(); // 状態が変わったのでUI全体を更新
    setTimeout(() => { isWheeling = false; }, 100);
}

// 月単位で移動する（ボタン・ホイール・スワイプ用）
function navigateMonth(direction) {
    store.currentDate.setMonth(store.currentDate.getMonth() + direction);
    store.selectedDate = new Date(store.currentDate);
    updateUI(); // 状態が変わったのでUI全体を更新
}

// すべてのイベントリスナーをまとめて設定する
function attachEventListeners() {
    const handler = (id, action, event = 'click') => document.getElementById(id)?.addEventListener(event, action);

    // 月・日・ビューの切替
    handler('prev-month-btn', () => navigateMonth(-1));
    handler('next-month-btn', () => navigateMonth(1));
    handler('toggle-personal-btn', () => { store.currentView = 'personal'; updateUI(); });
    handler('toggle-work-btn', () => { store.currentView = 'work'; updateUI(); });
    handler('show-work-toggle', (e) => { store.showWorkShiftsOnPersonal = e.target.checked; updateUI(); }, 'change');

    // クリックイベント
    handler('fab-add-btn', () => {
        const dateToAdd = new Date(store.selectedDate);
        if (store.currentView === 'personal') { dateToAdd.setHours(9, 0, 0, 0); openEventModal(dateToAdd); }
        else { dateToAdd.setHours(18, 30, 0, 0); openShiftModal(dateToAdd); }
    });
    handler('manage-workplaces-btn', openWorkplaceModal);
    handler('calendar-grid', (e) => {
        const dayCell = e.target.closest('[data-date-str]');
        if (dayCell) {
            store.selectedDate = new Date(dayCell.dataset.dateStr + 'T00:00:00');
            updateUI();
        }
    });
    handler('daily-schedule-view', (e) => {
        const item = e.target.closest('[data-item-id]');
        if (item) {
            if (item.dataset.type === 'event') openEventModal(null, store.events.find(i => i.id === item.dataset.itemId));
            if (item.dataset.type === 'shift') openShiftModal(null, store.shifts.find(i => i.id === item.dataset.itemId));
        }
    });

    // ホイールイベント
    document.getElementById('calendar-grid')?.addEventListener('wheel', (e) => {
        e.preventDefault();
        if(isWheeling) return; isWheeling = true;
        navigateMonth(e.deltaY > 0 ? 1 : -1);
        setTimeout(() => isWheeling = false, 200);
    }, { passive: false });
    document.getElementById('daily-schedule-view')?.addEventListener('wheel', (e) => {
        e.preventDefault();
        navigateDay(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // スワイプイベント
    const calendarContainer = document.getElementById('calendar-module-container');
    calendarContainer?.addEventListener('touchstart', handleTouchStart, { passive: true });
    calendarContainer?.addEventListener('touchend', handleTouchEnd);
}

function handleTouchStart(e) { 
    if (e.touches[0]) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
}

function handleTouchEnd(e) {
    if (!touchStartX || !touchStartY || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    const targetIsDailyView = e.target.closest('#daily-schedule-view');

    if (Math.abs(diffX) > SWIPE_THRESHOLD_X && Math.abs(diffX) > Math.abs(diffY)) {
        if (targetIsDailyView) {
            if (diffX > 0) navigateDay(-1); else navigateDay(1);
        } else {
            if (diffX > 0) navigateMonth(-1); else navigateMonth(1);
        }
    }
    touchStartX = 0; touchStartY = 0;
}
