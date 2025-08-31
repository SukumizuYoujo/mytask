// src/utils/salaryCalculator.js
// This file uses the global 'JapaneseHolidays' object loaded from index.html.

export function calculateSalaryForPaydaysInMonth(displayDate, shifts, workplaces) {
    if (workplaces.length === 0) {
        return { totalSalary: 0, details: [] };
    }
    const displayYear = displayDate.getFullYear();
    const displayMonth = displayDate.getMonth();
    let totalSalary = 0;
    const details = [];
    const processedPeriods = new Set(); 

    workplaces.forEach(wp => {
        // 2つの期間をチェックし、その給料日が「今月」に該当するかどうかを判定
        [-1, 0].forEach(monthOffset => {
            const closingMonthDate = new Date(displayYear, displayMonth + monthOffset, 1);
            const payday = getPaydayForClosingMonth(closingMonthDate.getFullYear(), closingMonthDate.getMonth(), wp);
            
            if (payday.getFullYear() === displayYear && payday.getMonth() === displayMonth) {
                const periodData = calculateSalaryForPeriod(closingMonthDate.getFullYear(), closingMonthDate.getMonth(), wp, shifts);
                const periodKey = `${wp.id}-${periodData.periodStr}`;
                if(periodData.salary > 0 && !processedPeriods.has(periodKey)) {
                    totalSalary += periodData.salary;
                    details.push(periodData);
                    processedPeriods.add(periodKey);
                }
            }
        });
    });
    return { totalSalary, details };
}

function calculateSalaryForPeriod(year, month, workplace, allShifts) {
    const closingDate = new Date(year, month, 1);
    const closingYear = closingDate.getFullYear();
    const closingMonth = closingDate.getMonth();
    const closingDay = getDayNum(workplace.closingDay, closingYear, closingMonth);

    // 期間の終了日 (例: 8月15日)
    const periodEnd = new Date(closingYear, closingMonth, closingDay, 23, 59, 59);
    // 期間の開始日 (例: 7月16日)
    const periodStart = new Date(closingYear, closingMonth - 1, closingDay + 1, 0, 0, 0);
    
    const periodShifts = allShifts.filter(s => {
        if (!s.start || !s.workplaceId) return false;
        const shiftDate = s.start.toDate();
        return s.workplaceId === workplace.id && shiftDate >= periodStart && shiftDate <= periodEnd;
    });

    let periodSalary = 0;
    let periodMinutes = 0;
    periodShifts.forEach(shift => {
        const result = calculateShiftSalary(shift, workplace);
        periodSalary += result.salary;
        periodMinutes += result.workMinutes;
    });

    return {
        workplaceName: workplace.name,
        salary: periodSalary,
        minutes: periodMinutes,
        periodStr: `${periodStart.getMonth() + 1}月${periodStart.getDate()}日〜${periodEnd.getMonth() + 1}月${periodEnd.getDate()}日`
    };
}


function calculateShiftSalary(shift, workplace) {
    if (typeof JapaneseHolidays === 'undefined' || !workplace) return { salary: 0, workMinutes: 0 };
    const start = shift.start.toDate();
    const end = shift.end.toDate();
    const breakMinutes = shift.breakMinutes || 0;
    let workMinutes = (end - start) / 60000;
    if (workMinutes <= 0) return { salary: 0, workMinutes: 0 };
    const baseWage = shift.workplaceId === 'one-off' ? (shift.manualWage || 0) : (workplace.baseWage || 0);
    const transportFee = (shift.workplaceId !== 'one-off' && workplace.transportFee) ? workplace.transportFee : 0;
    let totalSalary = 0;
    let effectiveWorkMinutes = 0;
    let currentTime = new Date(start);

    while(currentTime < end) {
        let effectiveHourlyWage = baseWage;
        const isHoli = JapaneseHolidays.isWeekend(currentTime) || JapaneseHolidays.isHoliday(currentTime) === true;
        if (isHoli && workplace.allowances?.holiday?.type === 'yen') {
            effectiveHourlyWage = workplace.allowances.holiday.value;
        } else if (isHoli && workplace.allowances?.holiday?.type === 'multiplier') {
            effectiveHourlyWage *= workplace.allowances.holiday.value;
        }
        const hour = currentTime.getHours();
        if (hour >= 22 || hour < 5) {
             if (workplace.allowances?.lateNight?.type === 'multiplier') {
                effectiveHourlyWage *= workplace.allowances.lateNight.value;
             } else if (workplace.allowances?.lateNight?.type === 'yen') {
                effectiveHourlyWage += workplace.allowances.lateNight.value;
             }
        }
        totalSalary += effectiveHourlyWage / 60;
        currentTime.setMinutes(currentTime.getMinutes() + 1);
        effectiveWorkMinutes++;
    }
    
    const isShiftOnHoliday = JapaneseHolidays.isWeekend(start) || JapaneseHolidays.isHoliday(start) === true;
    let deductionWage = baseWage;
    if (isShiftOnHoliday && workplace.allowances?.holiday?.type === 'yen') {
        deductionWage = workplace.allowances.holiday.value;
    } else if (isShiftOnHoliday && workplace.allowances?.holiday?.type === 'multiplier') {
        deductionWage *= workplace.allowances.holiday.value;
    }
    totalSalary -= (deductionWage / 60) * breakMinutes;

    return { 
        salary: Math.round(Math.max(0, totalSalary) + transportFee), 
        workMinutes: effectiveWorkMinutes - breakMinutes 
    };
}

const getDayNum = (dayStr, y, m) => {
    if (dayStr === 'eom') return new Date(y, m + 1, 0).getDate();
    return Number(dayStr);
};

export function getPaydayForClosingMonth(year, month, workplace) {
    if (typeof JapaneseHolidays === 'undefined') return new Date(9999, 0, 1);
    if (!workplace || !workplace.closingDay || !workplace.payday) return new Date(9999, 0, 1);
    
    const closingDate = new Date(year, month, 1);
    const closingYear = closingDate.getFullYear();
    const closingMonth = closingDate.getMonth();
    const closingDayNum = getDayNum(workplace.closingDay, closingYear, closingMonth);
    let paydayMonth = closingMonth;
    let paydayYear = closingYear;
    
    if (getDayNum(workplace.payday, closingYear, closingMonth) <= closingDayNum) {
        paydayMonth++;
        if (paydayMonth > 11) {
            paydayMonth = 0;
            paydayYear++;
        }
    }
    
    const paydayNum = getDayNum(workplace.payday, paydayYear, paydayMonth);
    let paydayDate = new Date(paydayYear, paydayMonth, paydayNum);

    if (workplace.paydayRule !== 'as-is') {
        while (JapaneseHolidays.isWeekend(paydayDate) || JapaneseHolidays.isHoliday(paydayDate) === true) {
            paydayDate.setDate(paydayDate.getDate() + (workplace.paydayRule === 'before' ? -1 : 1));
        }
    }
    return paydayDate;
}