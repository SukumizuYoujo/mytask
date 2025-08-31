// src/components/ShiftModal.js
import { doc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from '../firebase.js';
import { store } from '../store.js';

let modalContainer = null;
let flatpickrInstances = {};
let currentShiftId = null;

function getShiftHistory() {
    const history = [];
    const uniqueKeys = new Set();
    const sortedShifts = [...store.shifts]
        .filter(s => s.createdAt) 
        .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    for (const shift of sortedShifts) {
        const start = shift.start.toDate();
        const end = shift.end.toDate();
        const duration = (end.getTime() - start.getTime()) / 60000 - (shift.breakMinutes || 0);
        const key = `${shift.workplaceId}-${duration}-${shift.breakMinutes}`;
        if (!uniqueKeys.has(key) && history.length < 5) {
            uniqueKeys.add(key);
            history.push(shift);
        }
    }
    return history;
}

export function openShiftModal(dateObj, shift = null) {
    modalContainer = document.getElementById('modal-container');
    currentShiftId = shift ? shift.id : null;
    
    const start = shift ? shift.start.toDate() : dateObj;
    const end = shift ? shift.end.toDate() : new Date(start.getTime() + 4 * 60 * 60 * 1000);

    const workplaceOptions = store.workplaces.map(wp => `<option value="${wp.id}" ${shift?.workplaceId === wp.id ? 'selected' : ''}>${wp.name}</option>`).join('');
    
    const historyItemsHTML = getShiftHistory().map(hist => {
        const workplace = store.workplaces.find(w => w.id === hist.workplaceId) || { name: '単発バイト' };
        const start = hist.start.toDate();
        const end = hist.end.toDate();
        const time = `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')} - ${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`;
        return `<button type="button" class="history-item text-left w-full p-2 mb-1 rounded-md hover:bg-gray-100 transition" data-history-id="${hist.id}"><p class="font-semibold text-sm text-gray-800">${workplace.name}</p><p class="text-xs text-gray-500">${time} (休憩: ${hist.breakMinutes || 0}分)</p></button>`;
    }).join('');

    modalContainer.innerHTML = `
        <div id="shift-modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity duration-300 opacity-0">
            <div id="shift-modal-content" class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-transform duration-300 scale-95">
                <form id="shift-form">
                    <header class="p-4 border-b"><h2 class="text-lg font-bold text-gray-800">${shift ? 'シフトの編集' : 'シフトの追加'}</h2></header>
                    <main class="p-6 space-y-6">
                        <div class="flex items-center gap-4">
                            <i class="fas fa-store text-gray-500 w-5 text-center"></i>
                            <select id="shift-workplace" class="form-input flex-grow">
                                <option value="one-off" ${shift?.workplaceId === 'one-off' ? 'selected' : ''}>単発バイト</option>
                                ${workplaceOptions}
                            </select>
                        </div>
                        <div id="one-off-fields" class="pl-9 space-y-4 ${shift?.workplaceId === 'one-off' || (!shift && store.workplaces.length === 0) ? '' : 'hidden'}">
                            <div class="form-group"><label for="one-off-wage" class="form-label text-sm">時給 (円)</label><input type="number" id="one-off-wage" class="form-input" value="${shift?.manualWage || ''}"></div>
                        </div>
                        <div class="flex items-center gap-4"><i class="far fa-clock text-gray-500 w-5 text-center"></i><div class="flex-grow"><input type="text" id="shift-start-time" class="form-input mb-2" placeholder="開始日時"><input type="text" id="shift-end-time" class="form-input" placeholder="終了日時"></div></div>
                        <div class="flex items-center gap-4"><i class="fas fa-mug-hot text-gray-500 w-5 text-center"></i><div class="flex-grow"><label for="shift-break" class="form-label">休憩時間 (分)</label><input type="number" id="shift-break" class="form-input" value="${shift?.breakMinutes || 0}"></div></div>
                        <div class="flex items-start gap-4"><i class="far fa-sticky-note text-gray-500 w-5 text-center mt-2"></i><textarea id="shift-memo" class="form-input" rows="3" placeholder="メモ">${shift?.memo || ''}</textarea></div>
                        ${historyItemsHTML ? `<div class="border-t pt-4"><h4 class="text-sm font-bold text-gray-600 mb-2">履歴からワンクリック登録</h4><div id="history-list">${historyItemsHTML}</div></div>` : ''}
                    </main>
                    <footer class="bg-gray-50 px-6 py-4 flex justify-between items-center rounded-b-xl">
                        <div>${shift ? `<button type="button" id="delete-shift-btn" class="text-red-600 hover:text-red-800 font-semibold text-sm">削除</button>` : ''}</div>
                        <div class="flex gap-3"><button type="button" id="cancel-shift-btn" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg">キャンセル</button><button type="submit" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">保存</button></div>
                    </footer>
                </form>
            </div>
        </div>
    `;
    
    setTimeout(() => { document.getElementById('shift-modal-overlay')?.classList.add('opacity-100'); document.getElementById('shift-modal-content')?.classList.add('scale-100'); }, 10);
    initializeFlatpickr(start, end);
    attachEventListeners();
}

function initializeFlatpickr(start, end) {
    const options = { locale: 'ja', enableTime: true, dateFormat: "Y-m-d H:i", time_24hr: true, minuteIncrement: 15 };
    flatpickrInstances.start = flatpickr("#shift-start-time", { ...options, defaultDate: start });
    flatpickrInstances.end = flatpickr("#shift-end-time", { ...options, defaultDate: end });
}

function toggleOneOffFields() {
    const workplaceSelect = document.getElementById('shift-workplace');
    const oneOffFields = document.getElementById('one-off-fields');
    if (workplaceSelect.value === 'one-off') oneOffFields.classList.remove('hidden'); else oneOffFields.classList.add('hidden');
}

async function createShiftFromHistory(historyId) {
    const historyShift = store.shifts.find(s => s.id === historyId);
    if (!historyShift) return;
    const historyStart = historyShift.start.toDate();
    const historyEnd = historyShift.end.toDate();
    const newStart = new Date(store.selectedDate);
    newStart.setHours(historyStart.getHours(), historyStart.getMinutes(), 0, 0);
    const newEnd = new Date(store.selectedDate);
    newEnd.setHours(historyEnd.getHours(), historyEnd.getMinutes(), 0, 0);
    if (newEnd < newStart) newEnd.setDate(newEnd.getDate() + 1);
    const shiftData = {
        workplaceId: historyShift.workplaceId,
        start: newStart, end: newEnd,
        breakMinutes: historyShift.breakMinutes || 0,
        memo: historyShift.memo || '',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    if (shiftData.workplaceId === 'one-off') {
        shiftData.manualWage = historyShift.manualWage;
        shiftData.workplace = { closingDay: newStart.getDate(), payday: newStart.getDate(), paydayRule: 'as-is' };
    }
    try {
        await addDoc(collection(db, `users/${store.user.uid}/shifts`), shiftData);
        closeModal();
    } catch (error) { console.error("Error creating shift:", error); alert("履歴からの登録に失敗しました。"); }
}

function attachEventListeners() {
    document.getElementById('shift-form')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-shift-btn')?.addEventListener('click', closeModal);
    document.getElementById('delete-shift-btn')?.addEventListener('click', handleDelete);
    document.getElementById('shift-modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'shift-modal-overlay') closeModal(); });
    document.getElementById('shift-workplace')?.addEventListener('change', toggleOneOffFields);
    document.getElementById('history-list')?.addEventListener('click', (e) => {
        const button = e.target.closest('.history-item');
        if (button) createShiftFromHistory(button.dataset.historyId);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!store.user) return;
    const workplaceId = document.getElementById('shift-workplace').value;
    const start = new Date(flatpickrInstances.start.selectedDates[0]);
    const shiftData = {
        workplaceId, start,
        end: new Date(flatpickrInstances.end.selectedDates[0]),
        breakMinutes: Number(document.getElementById('shift-break').value),
        memo: document.getElementById('shift-memo').value,
        updatedAt: serverTimestamp(),
    };
    if (workplaceId === 'one-off') {
        shiftData.manualWage = Number(document.getElementById('one-off-wage').value);
        // 単発バイトの給料日を当日に設定するためのダミー情報
        shiftData.workplace = {
            closingDay: start.getDate(),
            payday: start.getDate(),
            paydayRule: 'as-is'
        };
    }
    try {
        if (currentShiftId) {
            await updateDoc(doc(db, `users/${store.user.uid}/shifts/${currentShiftId}`), shiftData);
        } else {
            shiftData.createdAt = serverTimestamp();
            await addDoc(collection(db, `users/${store.user.uid}/shifts`), shiftData);
        }
    } catch (error) { console.error("Error:", error); alert("保存に失敗しました。"); }
    finally { closeModal(); }
}

async function handleDelete() {
    if (!store.user || !currentShiftId || !confirm('このシフトを削除しますか？')) return;
    try {
        await deleteDoc(doc(db, `users/${store.user.uid}/shifts/${currentShiftId}`));
    } catch (error) { console.error("Error:", error); alert("削除に失敗しました。"); }
    finally { closeModal(); }
}

function closeModal() {
    const overlay = document.getElementById('shift-modal-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-100');
        overlay.querySelector('#shift-modal-content')?.classList.remove('scale-100');
        setTimeout(() => {
            if (modalContainer) modalContainer.innerHTML = '';
            currentShiftId = null;
            Object.values(flatpickrInstances).forEach(fp => fp.destroy());
            flatpickrInstances = {};
        }, 300);
    }
}