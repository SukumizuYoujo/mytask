// src/components/SalaryReport.js
import { store } from '../store.js';
import { calculateSalaryForPaydaysInMonth } from '../utils/salaryCalculator.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from '../firebase.js';

let containerEl = null;

export function renderSalaryReport(container) {
    if (container) containerEl = container;
    if (!containerEl || !store.user) return;
    
    if (!store.isSalaryReportVisible) {
        containerEl.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-4 flex justify-between items-center">
                <h2 class="text-lg font-bold text-gray-800">給料見込み</h2>
                <button id="toggle-salary-report" class="text-gray-500 hover:text-gray-800"><i class="far fa-eye-slash"></i></button>
            </div>
        `;
        attachEventListeners();
        return;
    }

    const salaryData = calculateSalaryForPaydaysInMonth(store.currentDate, store.shifts, store.workplaces);
    
    const detailsHTML = salaryData.details.map(detail => {
        const hours = Math.floor(detail.minutes / 60);
        const minutes = detail.minutes % 60;
        return `
            <div class="py-2 px-4 border-b last:border-b-0">
                <p class="font-semibold text-gray-700">${detail.workplaceName}</p>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500">${detail.periodStr}</span>
                    <span class="font-bold">¥ ${detail.salary.toLocaleString()}</span>
                </div>
                <div class="text-right text-xs text-gray-500">${hours}時間 ${String(minutes).padStart(2, '0')}分</div>
            </div>
        `;
    }).join('');

    containerEl.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg">
            <div class="p-4 sm:p-6">
                <div class="flex justify-between items-center mb-4">
                     <h2 class="text-lg font-bold text-gray-800">${store.currentDate.getMonth() + 1}月支払いの給料</h2>
                     <button id="toggle-salary-report" class="text-gray-500 hover:text-gray-800"><i class="far fa-eye"></i></button>
                </div>
                <div class="text-center my-6">
                    <p class="text-4xl font-bold text-green-600">¥ ${salaryData.totalSalary.toLocaleString()}</p>
                </div>
            </div>
            <div class="border-t">
                <button id="toggle-salary-detail" class="w-full text-left p-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 flex justify-between items-center">
                    <span>詳細</span>
                    <i class="fas fa-chevron-down transition-transform ${store.isSalaryDetailVisible ? 'rotate-180' : ''}"></i>
                </button>
                <div id="salary-detail-content" class="${store.isSalaryDetailVisible ? '' : 'hidden'}">
                    ${detailsHTML || '<p class="text-center text-sm text-gray-500 p-4">対象の給与はありません。</p>'}
                </div>
            </div>
        </div>
    `;
    attachEventListeners();
}

function attachEventListeners() {
    document.getElementById('toggle-salary-report')?.addEventListener('click', () => {
        store.isSalaryReportVisible = !store.isSalaryReportVisible;
        localStorage.setItem('isSalaryReportVisible', store.isSalaryReportVisible);
        renderSalaryReport();
    });
    document.getElementById('toggle-salary-detail')?.addEventListener('click', () => {
        store.isSalaryDetailVisible = !store.isSalaryDetailVisible;
        renderSalaryReport();
    });
}