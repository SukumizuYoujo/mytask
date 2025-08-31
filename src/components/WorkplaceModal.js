// src/components/WorkplaceModal.js
import { doc, addDoc, updateDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from '../firebase.js';
import { store } from '../store.js';

let modalContainer = null;
let currentWorkplaceId = null;
let view = 'list';
const colors = ["#ef4444", "#f97316", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef"];

function render() {
    if (view === 'list') renderListView();
    else renderFormView(currentWorkplaceId ? store.workplaces.find(w => w.id === currentWorkplaceId) : null);
}

function renderListView() {
    modalContainer = document.getElementById('modal-container');
    const workplacesListHTML = store.workplaces.map(wp => `
        <li class="flex items-center justify-between p-4 border-b hover:bg-gray-50">
            <div class="flex items-center gap-3">
                <div class="w-4 h-4 rounded-full" style="background-color: ${wp.color || '#34d399'}"></div>
                <div><p class="font-semibold text-gray-800">${wp.name}</p><p class="text-sm text-gray-500">時給: ${wp.baseWage}円</p></div>
            </div>
            <button data-id="${wp.id}" class="edit-wp-btn text-blue-600 hover:text-blue-800 font-semibold text-sm">編集</button>
        </li>
    `).join('');
    modalContainer.innerHTML = `
        <div id="workplace-modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <header class="p-4 border-b flex justify-between items-center"><h2 class="text-lg font-bold">勤務先管理</h2><button id="close-wp-list-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button></header>
                <main class="max-h-[60vh] overflow-y-auto"><ul>${workplacesListHTML}</ul></main>
                <footer class="p-4 bg-gray-50 flex justify-end"><button id="add-new-wp-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm">新規追加</button></footer>
            </div>
        </div>
    `;
    attachListViewEventListeners();
}

function renderFormView(workplace = null) {
    const allowanceHTML = (id, label, allowanceData) => {
        const type = allowanceData?.type || 'multiplier';
        const value = allowanceData?.value || (id.includes('latenight') ? 1.25 : 1.0);
        return `<div class="form-group"><label for="${id}-value" class="form-label">${label}</label><div class="flex gap-2"><input type="number" step="0.01" id="${id}-value" class="form-input w-2/3" value="${value}"><select id="${id}-type" class="form-input w-1/3"><option value="multiplier" ${type === 'multiplier' ? 'selected' : ''}>倍</option><option value="yen" ${type === 'yen' ? 'selected' : ''}>円</option></select></div></div>`;
    };

    const dayOptionsHTML = (currentValue) => {
        let options = '';
        for (let i = 1; i <= 30; i++) {
            const isSelected = String(currentValue) === String(i);
            options += `<option value="${i}" ${isSelected ? 'selected' : ''}>${i}日</option>`;
        }
        const isEomSelected = ['eom', '月末', '末日'].includes(currentValue);
        options += `<option value="eom" ${isEomSelected ? 'selected' : ''}>月末</option>`;
        return options;
    };

    modalContainer.innerHTML = `
        <div id="workplace-modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div id="workplace-modal-content" class="bg-gray-50 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <form id="workplace-form">
                    <header class="bg-white p-4 border-b flex justify-between items-center"><h2 class="text-lg font-bold">${workplace ? '勤務先の編集' : '勤務先の追加'}</h2><button type="button" id="back-to-list-btn" class="text-gray-600 hover:text-gray-900 text-sm font-semibold"><i class="fas fa-arrow-left mr-2"></i>一覧へ戻る</button></header>
                    <main class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        <fieldset class="p-4 border rounded-lg bg-white">
                            <legend class="px-2 font-semibold text-gray-700">基本情報</legend>
                            <div class="space-y-4">
                                <div class="form-group"><label for="wp-name" class="form-label">勤務先名</label><input type="text" id="wp-name" class="form-input" value="${workplace?.name || ''}" required></div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="form-group"><label for="wp-wage" class="form-label">基本時給 (円)</label><input type="number" id="wp-wage" class="form-input" value="${workplace?.baseWage || ''}" required></div>
                                    <div class="form-group"><label for="wp-transport-fee" class="form-label">交通費 (1勤務)</label><input type="number" id="wp-transport-fee" class="form-input" value="${workplace?.transportFee || 0}"></div>
                                </div>
                                <div class="form-group"><label class="form-label">カレンダーの色</label><div id="color-palette" class="flex flex-wrap gap-2">${colors.map(color => `<button type="button" class="color-swatch w-8 h-8 rounded-full transition transform hover:scale-110 flex items-center justify-center" data-color="${color}" style="background-color: ${color};">${(workplace?.color || colors[3]) === color ? '<i class="fas fa-check text-white"></i>' : ''}</button>`).join('')}</div><input type="hidden" id="wp-color" value="${workplace?.color || colors[3]}"></div>
                            </div>
                        </fieldset>
                        <fieldset class="p-4 border rounded-lg bg-white">
                            <legend class="px-2 font-semibold text-gray-700">給与設定</legend>
                             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="form-group"><label for="wp-closing-day" class="form-label">締め日</label><select id="wp-closing-day" class="form-input">${dayOptionsHTML(workplace?.closingDay)}</select></div>
                                <div class="form-group"><label for="wp-payday" class="form-label">給料日</label><select id="wp-payday" class="form-input">${dayOptionsHTML(workplace?.payday)}</select></div>
                            </div>
                            <div class="form-group mt-4"><label for="wp-payday-rule" class="form-label">祝日の場合</label><select id="wp-payday-rule" class="form-input"><option value="as-is" ${workplace?.paydayRule === 'as-is' ? 'selected' : ''}>そのまま</option><option value="before" ${workplace?.paydayRule === 'before' ? 'selected' : ''}>前の営業日</option><option value="after" ${workplace?.paydayRule === 'after' ? 'selected' : ''}>次の営業日</option></select></div>
                        </fieldset>
                        <fieldset class="p-4 border rounded-lg bg-white">
                            <legend class="px-2 font-semibold text-gray-700">各種手当</legend>
                             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${allowanceHTML('wp-latenight', '深夜 (22-5時)', workplace?.allowances?.lateNight)}${allowanceHTML('wp-holiday', '休日', workplace?.allowances?.holiday)}</div>
                        </fieldset>
                    </main>
                    <footer class="bg-white px-6 py-4 flex justify-between items-center border-t">
                        <div>${workplace ? `<button type="button" id="delete-workplace-btn" class="text-red-600 hover:text-red-800 font-semibold text-sm">この勤務先を削除</button>` : ''}</div>
                        <div class="flex gap-3"><button type="submit" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm">保存</button></div>
                    </footer>
                </form>
            </div>
        </div>
    `;
    attachFormViewEventListeners();
}

export function openWorkplaceModal() { view = 'list'; render(); }

function attachListViewEventListeners() {
    document.getElementById('close-wp-list-btn')?.addEventListener('click', closeModal);
    document.getElementById('add-new-wp-btn')?.addEventListener('click', () => { view = 'form'; currentWorkplaceId = null; render(); });
    document.querySelectorAll('.edit-wp-btn').forEach(btn => btn.addEventListener('click', (e) => { view = 'form'; currentWorkplaceId = e.target.dataset.id; render(); }));
}

function attachFormViewEventListeners() {
    document.getElementById('workplace-form')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('back-to-list-btn')?.addEventListener('click', () => { view = 'list'; render(); });
    document.getElementById('delete-workplace-btn')?.addEventListener('click', handleDelete);
    document.getElementById('color-palette')?.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (swatch) {
            document.getElementById('wp-color').value = swatch.dataset.color;
            document.querySelectorAll('.color-swatch').forEach(el => el.innerHTML = '');
            swatch.innerHTML = '<i class="fas fa-check text-white"></i>';
        }
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!store.user) return;
    const getAllowanceData = (id) => ({ value: Number(document.getElementById(`${id}-value`).value), type: document.getElementById(`${id}-type`).value });
    
    // 正規化ヘルパー関数
    const normalizeDay = (raw) => {
        if (raw === 'eom') return 'eom';
        const n = Number(raw);
        return Number.isFinite(n) ? n : 'eom';
    };

    const workplaceData = {
        name: document.getElementById('wp-name').value,
        baseWage: Number(document.getElementById('wp-wage').value),
        transportFee: Number(document.getElementById('wp-transport-fee').value),
        color: document.getElementById('wp-color').value,
        closingDay: normalizeDay(document.getElementById('wp-closing-day').value),
        payday: normalizeDay(document.getElementById('wp-payday').value),
        paydayRule: document.getElementById('wp-payday-rule').value,
        allowances: { lateNight: getAllowanceData('wp-latenight'), holiday: getAllowanceData('wp-holiday') }
    };

    try {
        if (currentWorkplaceId) {
            await updateDoc(doc(db, `users/${store.user.uid}/workplaces/${currentWorkplaceId}`), workplaceData);
        } else {
            await addDoc(collection(db, `users/${store.user.uid}/workplaces`), workplaceData);
        }
        view = 'list';
        setTimeout(render, 100);
    } catch (error) { console.error("Error:", error); alert("保存に失敗しました。"); }
}

async function handleDelete() {
    if (!store.user || !currentWorkplaceId || !confirm('この勤務先を削除しますか？')) return;
    try {
        await deleteDoc(doc(db, `users/${store.user.uid}/workplaces/${currentWorkplaceId}`));
        view = 'list';
        setTimeout(render, 100);
    } catch (error) { console.error("Error:", error); alert("削除に失敗しました。"); }
}

function closeModal() {
    const overlay = document.getElementById('workplace-modal-overlay');
    if (overlay) overlay.parentElement.removeChild(overlay);
    currentWorkplaceId = null;
    view = 'list';
}