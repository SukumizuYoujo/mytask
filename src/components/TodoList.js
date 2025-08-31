// src/components/TodoList.js
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from '../firebase.js';
import { store } from '../store.js';

let containerEl = null;
let sortable = null;
let unsubscribe = null; // Firestoreリスナーを管理するための変数

function openRecurrenceModal(todo) {
    const modalContainer = document.getElementById('modal-container');
    const weekdays = [ {id: 'SU', name: '日'}, {id: 'MO', name: '月'}, {id: 'TU', name: '火'}, {id: 'WE', name: '水'}, {id: 'TH', name: '木'}, {id: 'FR', name: '金'}, {id: 'SA', name: '土'} ];
    const currentRecurrence = todo.recurrence || { type: 'none' };
    const initialDays = new Set(currentRecurrence.days || []);
    const weekdaysHTML = weekdays.map(day => `<button type="button" data-day="${day.id}" class="weekday-btn w-9 h-9 flex items-center justify-center text-sm rounded-full border cursor-pointer ${initialDays.has(day.id) ? 'bg-blue-600 text-white' : ''}">${day.name}</button>`).join('');
    modalContainer.innerHTML = `
        <div id="recurrence-modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                <header class="p-4 border-b"><h3 class="font-bold">繰り返し設定: ${todo.text}</h3></header>
                <main class="p-4 space-y-4">
                    <div><label class="font-semibold">種類</label><select id="recurrence-type" class="form-input mt-1"><option value="none" ${currentRecurrence.type === 'none' ? 'selected' : ''}>なし</option><option value="daily" ${currentRecurrence.type === 'daily' ? 'selected' : ''}>毎日</option><option value="weekly" ${currentRecurrence.type === 'weekly' ? 'selected' : ''}>曜日指定</option></select></div>
                    <div id="weekly-options" class="${currentRecurrence.type === 'weekly' ? '' : 'hidden'}"><label class="font-semibold">曜日</label><div class="flex justify-center gap-2 mt-1">${weekdaysHTML}</div></div>
                </main>
                <footer class="p-4 bg-gray-50 flex justify-end gap-3"><button id="cancel-recurrence" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg text-sm">キャンセル</button><button id="save-recurrence" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">保存</button></footer>
            </div>
        </div>
    `;
    const typeSelect = document.getElementById('recurrence-type');
    const weeklyOptions = document.getElementById('weekly-options');
    typeSelect.addEventListener('change', () => { if (typeSelect.value === 'weekly') weeklyOptions.classList.remove('hidden'); else weeklyOptions.classList.add('hidden'); });
    weeklyOptions.addEventListener('click', (e) => { const button = e.target.closest('.weekday-btn'); if (button) { button.classList.toggle('bg-blue-600'); button.classList.toggle('text-white'); } });
    document.getElementById('cancel-recurrence').addEventListener('click', () => modalContainer.innerHTML = '');
    document.getElementById('recurrence-modal-overlay').addEventListener('click', (e) => { if(e.target.id === 'recurrence-modal-overlay') modalContainer.innerHTML = ''; });
    document.getElementById('save-recurrence').addEventListener('click', async () => {
        const type = typeSelect.value; let newRecurrence = { type };
        if (type === 'weekly') newRecurrence.days = Array.from(document.querySelectorAll('.weekday-btn.bg-blue-600')).map(btn => btn.dataset.day);
        await updateDoc(doc(db, `users/${store.user.uid}/todos/${todo.id}`), { recurrence: newRecurrence });
        modalContainer.innerHTML = '';
    });
}

const getTodayString = () => new Date().toLocaleDateString('sv-SE');

export function renderTodoList(container) {
    if (container) containerEl = container;
    if (!containerEl) return;
    if (store.user && !unsubscribe) setupTodoListener(); // リスナーがなければ設定
    if (!store.user && unsubscribe) { unsubscribe(); unsubscribe = null; } // ログアウト時にリスナーを解除

    const today = getTodayString();
    const todayDay = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date().getDay()];

    store.todos.forEach(todo => {
        if (!todo.recurrence) return;
        const needsReset = (todo.recurrence.type === 'daily') || (todo.recurrence.type === 'weekly' && todo.recurrence.days?.includes(todayDay));
        if (needsReset && todo.completed && todo.completedDate !== today) {
            updateDoc(doc(db, `users/${store.user.uid}/todos/${todo.id}`), { completed: false });
        }
    });

    const sortedTodos = [...store.todos].sort((a, b) => (a.completed - b.completed) || (a.order - b.order));
    const listItemsHTML = sortedTodos.map(todo => {
        let recurrenceText = '';
        if (todo.recurrence?.type === 'daily') recurrenceText = '毎日';
        if (todo.recurrence?.type === 'weekly' && todo.recurrence.days?.length) {
            const dayOrder = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
            const sortedDays = todo.recurrence.days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
            recurrenceText = `毎週 ${sortedDays.join(', ')}`;
        }
        return `<li class="flex items-center p-3 border-b border-gray-200 group transition-all duration-200 ${todo.completed ? 'bg-gray-50' : 'hover:bg-gray-50'}" data-id="${todo.id}"><input type="checkbox" class="h-5 w-5 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" ${todo.completed ? 'checked' : ''}><div class="ml-3 flex-grow"><span class="text-sm ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-700'}">${todo.text}</span>${recurrenceText ? `<p class="text-xs text-blue-500">${recurrenceText}</p>` : ''}</div><button class="settings-todo-btn text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-sm"><i class="fas fa-cog"></i></button><button class="delete-todo-btn text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-lg"><i class="fas fa-trash-alt"></i></button></li>`;
    }).join('');
    containerEl.innerHTML = `<div class="bg-white rounded-xl shadow-lg"><div class="p-4 border-b border-gray-200"><h2 class="text-lg font-bold text-gray-800">ToDoリスト</h2></div><ul id="todo-list" class="divide-y divide-gray-200">${listItemsHTML}</ul><div class="p-4 bg-gray-50 rounded-b-xl"><form id="add-todo-form" class="flex gap-2"><input type="text" id="new-todo-input" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="新しいタスクを追加..." required><button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition text-sm">追加</button></form></div></div>`;
    attachTodoListEventListeners();
    initializeSortable();
}

function setupTodoListener() {
    if (!store.user) return;
    const todosQuery = query(collection(db, `users/${store.user.uid}/todos`), orderBy("order", "asc"));
    unsubscribe = onSnapshot(todosQuery, snapshot => {
        store.todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTodoList();
    });
}

function attachTodoListEventListeners() {
    document.getElementById('add-todo-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const input = document.getElementById('new-todo-input'); const text = input.value.trim(); if (text) { await addTodo(text); input.value = ''; } });
    document.getElementById('todo-list')?.addEventListener('click', (e) => {
        const li = e.target.closest('li'); if (!li) return;
        const id = li.dataset.id;
        if (e.target.matches('input[type="checkbox"]')) toggleTodo(id, e.target.checked);
        else if (e.target.matches('.delete-todo-btn, .delete-todo-btn *')) { if (confirm('このタスクを削除しますか？')) deleteTodo(id); }
        else if (e.target.matches('.settings-todo-btn, .settings-todo-btn *')) { const todo = store.todos.find(t => t.id === id); if(todo) openRecurrenceModal(todo); }
    });
}

function initializeSortable() {
    const todoListEl = document.getElementById('todo-list');
    if (todoListEl) {
        sortable = new Sortable(todoListEl, {
            animation: 150, handle: 'li',
            onEnd: async (evt) => {
                const updatedOrder = sortable.toArray(); const batch = writeBatch(db);
                updatedOrder.forEach((id, index) => batch.update(doc(db, `users/${store.user.uid}/todos/${id}`), { order: index }));
                await batch.commit();
            }
        });
    }
}

async function addTodo(text) {
    if (!store.user) return;
    const newOrder = store.todos.filter(t => !t.completed).length;
    await addDoc(collection(db, `users/${store.user.uid}/todos`), { text, completed: false, createdAt: serverTimestamp(), order: newOrder, recurrence: { type: 'none' } });
}

async function toggleTodo(id, completed) {
    if (!store.user) return;
    const updateData = { completed };
    if (completed) updateData.completedDate = getTodayString();
    await updateDoc(doc(db, `users/${store.user.uid}/todos/${id}`), updateData);
}

async function deleteTodo(id) {
    if (!store.user) return;
    await deleteDoc(doc(db, `users/${store.user.uid}/todos/${id}`));
}