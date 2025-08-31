// src/store.js
// Global state management object
export const store = {
    user: null,         
    currentDate: new Date(), 
    selectedDate: new Date(),
    currentView: 'personal', // 'personal' or 'work'
    showWorkShiftsOnPersonal: false,
    isSalaryReportVisible: true,
    isSalaryDetailVisible: false,
    events: [],         
    shifts: [],         
    workplaces: [],     
    todos: [],          
};