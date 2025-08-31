// src/components/EventModal.js
import { doc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from '../firebase.js';
import { store } from '../store.js';

let modalContainer = null;
let flatpickrInstances = {};
let currentEventId = null;
const colors = ["#ef4444", "#f97316", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef"];

export function openEventModal(dateObj, event = null) {
    modalContainer = document.getElementById('modal-container');
    currentEventId = event ? event.id : null;
    const start = event ? event.start.toDate() : dateObj;
    const end = event ? event.end.toDate() : new Date(start.getTime() + 60 * 60 * 1000);

    modalContainer.innerHTML = `
        <div id="event-modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity duration-300 opacity-0">
            <div id="event-modal-content" class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-transform duration-300 scale-95">
                <form id="event-form">
                    <div class="p-6">
                        <input type="text" id="event-title" placeholder="タイトルを追加" class="w-full text-xl font-bold border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none pb-2 mb-6" value="${event?.title || ''}" required>
                        <div class="flex items-center space-x-4 mb-4">
                            <i class="far fa-clock text-gray-500 w-5 text-center"></i>
                            <div class="flex-grow"><input type="text" id="event-start-time" class="w-full border-none focus:outline-none p-0" placeholder="開始日時"><input type="text" id="event-end-time" class="w-full border-none focus:outline-none p-0" placeholder="終了日時"></div>
                        </div>
                        <div class="flex items-center space-x-4 mb-6">
                            <div class="w-5"></div>
                            <div class="flex items-center justify-between w-full">
                                <label for="event-all-day" class="text-sm text-gray-600">終日</label>
                                <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in"><input type="checkbox" id="event-all-day" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" ${event?.allDay ? 'checked' : ''}/><label for="event-all-day" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label></div>
                            </div>
                        </div>
                        <div class="flex items-start space-x-4 mb-4">
                            <i class="fas fa-palette text-gray-500 w-5 text-center mt-1"></i>
                            <div id="color-palette" class="flex flex-wrap gap-2">${colors.map(color => `<button type="button" class="color-swatch w-8 h-8 rounded-full transition transform hover:scale-110 flex items-center justify-center" data-color="${color}" style="background-color: ${color};">${(event?.color || colors[5]) === color ? '<i class="fas fa-check text-white"></i>' : ''}</button>`).join('')}</div>
                            <input type="hidden" id="event-color" value="${event?.color || colors[5]}">
                        </div>
                        <div class="flex items-start space-x-4 mb-4">
                            <i class="far fa-sticky-note text-gray-500 w-5 text-center mt-1"></i>
                            <textarea id="event-memo" class="form-input" rows="3" placeholder="メモを追加">${event?.memo || ''}</textarea>
                        </div>
                    </div>
                    <div class="bg-gray-50 px-6 py-4 flex justify-between items-center rounded-b-xl">
                         <div>${event ? `<button type="button" id="delete-event-btn" class="text-red-600 hover:text-red-800 font-semibold text-sm">削除</button>` : ''}</div>
                         <div class="flex gap-3"><button type="button" id="cancel-event-btn" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg text-sm transition">キャンセル</button><button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition">保存</button></div>
                    </div>
                </form>
            </div>
        </div>
    `;
    setTimeout(() => { document.getElementById('event-modal-overlay')?.classList.add('opacity-100'); document.getElementById('event-modal-content')?.classList.add('scale-100'); }, 10);
    initializeFlatpickr(start, end, event?.allDay || false);
    attachModalEventListeners();
}

function initializeFlatpickr(start, end, isAllDay) {
    const commonOptions = { locale: 'ja', time_24hr: true, minuteIncrement: 15 };
    flatpickrInstances.start = flatpickr("#event-start-time", { ...commonOptions, defaultDate: start, enableTime: !isAllDay, dateFormat: isAllDay ? "Y-m-d" : "Y-m-d H:i" });
    flatpickrInstances.end = flatpickr("#event-end-time", { ...commonOptions, defaultDate: end, enableTime: !isAllDay, dateFormat: isAllDay ? "Y-m-d" : "Y-m-d H:i" });
}

function attachModalEventListeners() {
    const overlay = document.getElementById('event-modal-overlay');
    const form = document.getElementById('event-form');
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    form?.addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-event-btn')?.addEventListener('click', closeModal);
    document.getElementById('delete-event-btn')?.addEventListener('click', handleDelete);
    document.getElementById('event-all-day')?.addEventListener('change', (e) => {
        const isAllDay = e.target.checked;
        const newOptions = { enableTime: !isAllDay, dateFormat: isAllDay ? "Y-m-d" : "Y-m-d H:i" };
        flatpickrInstances.start.set(newOptions);
        flatpickrInstances.end.set(newOptions);
    });
    document.getElementById('color-palette')?.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (swatch) {
            document.getElementById('event-color').value = swatch.dataset.color;
            document.querySelectorAll('.color-swatch').forEach(el => el.innerHTML = '');
            swatch.innerHTML = '<i class="fas fa-check text-white"></i>';
        }
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!store.user) return;
    const eventData = {
        title: document.getElementById('event-title').value,
        start: new Date(flatpickrInstances.start.selectedDates[0]),
        end: new Date(flatpickrInstances.end.selectedDates[0]),
        allDay: document.getElementById('event-all-day').checked,
        color: document.getElementById('event-color').value,
        memo: document.getElementById('event-memo').value,
        updatedAt: serverTimestamp(),
    };
    try {
        if (currentEventId) await updateDoc(doc(db, `users/${store.user.uid}/events/${currentEventId}`), eventData);
        else { eventData.createdAt = serverTimestamp(); await addDoc(collection(db, `users/${store.user.uid}/events`), eventData); }
    } catch (error) { console.error("Error saving event: ", error); alert("予定の保存に失敗しました。"); }
    finally { closeModal(); }
}

async function handleDelete() {
    if (!store.user || !currentEventId || !confirm('この予定を削除しますか？')) return;
    try { await deleteDoc(doc(db, `users/${store.user.uid}/events/${currentEventId}`)); }
    catch (error) { console.error("Error deleting event: ", error); alert("予定の削除に失敗しました。"); }
    finally { closeModal(); }
}

function closeModal() {
    const overlay = document.getElementById('event-modal-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-100');
        overlay.querySelector('#event-modal-content')?.classList.remove('scale-100');
        setTimeout(() => {
            if (modalContainer) modalContainer.innerHTML = '';
            currentEventId = null;
            Object.values(flatpickrInstances).forEach(fp => fp.destroy());
            flatpickrInstances = {};
        }, 300);
    }
}