// src/utils/salaryCalculator.js
// This file uses the global 'JapaneseHolidays' object loaded from index.html.

/**
 * 表示されている月に支払われる給料の合計と詳細を計算するメイン関数
 */
export function calculateSalaryForPaydaysInMonth(displayDate, shifts, workplaces) {
    if (workplaces.length === 0) {
        return { totalSalary: 0, details: [] };
    }
    const displayYear = displayDate.getFullYear();
    const displayMonth = displayDate.getMonth();
    let totalSalary = 0;
    const details = [];

    workplaces.forEach(wp => {
        // 2つの期間をチェックし、その給料日が「今月」に該当するかどうかを判定
        [-1, 0].forEach(monthOffset => {
            const closingMonthDate = new Date(displayYear, displayMonth + monthOffset, 1);
            const payday = getPaydayForClosingMonth(closingMonthDate.getFullYear(), closingMonthDate.getMonth(), wp);
            
            if (payday.getFullYear() === displayYear && payday.getMonth() === displayMonth) {
                const periodData = calculateSalaryForPeriod(closingMonthDate.getFullYear(), closingMonthDate.getMonth(), wp, shifts);
                // 重複追加を防ぐ
                if(periodData.salary > 0 && !details.some(d => d.periodStr === periodData.periodStr && d.workplaceName === periodData.workplaceName)) {
                    totalSalary += periodData.salary;
                    details.push(periodData);
                }
            }
        });
    });
    return { totalSalary, details };
}

/**
 * 特定の「締め月」に対する給与計算期間を特定し、その期間の給与を計算する
 */
function calculateSalaryForPeriod(year, month, workplace, allShifts) {
    const closingDay = getDayNum(workplace.closingDay, year, month);
    const periodEnd = new Date(year, month, closingDay, 23, 59, 59);
    const periodStart = new Date(year, month, closingDay + 1);
    periodStart.setMonth(periodStart.getMonth() - 1);
    periodStart.setHours(0, 0, 0, 0);
    
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

/**
 * 1回のシフトの給料を計算する（パフォーマンス改善版）
 */
function calculateShiftSalary(shift, workplace) {
    if (typeof JapaneseHolidays === 'undefined' || !workplace) return { salary: 0, workMinutes: 0 };
    let start = shift.start.toDate();
    const end = shift.end.toDate();
    let breakMinutes = shift.breakMinutes || 0;
    let workMinutes = (end - start) / 60000 - breakMinutes;
    if (workMinutes <= 0) return { salary: 0, workMinutes: 0 };
    if (shift.workplaceId === 'none') return { salary: 0, workMinutes: 0 };
    
    const baseWage = shift.workplaceId === 'one-off' ? (shift.manualWage || 0) : (workplace.baseWage || 0);
    const transportFee = (shift.workplaceId !== 'one-off' && workplace.transportFee) ? workplace.transportFee : 0;
    
    let totalSalary = 0;
    let currentTime = new Date(start);

    // 1分ずつではなく、時間帯が変わるタイミングでまとめて計算
    while(currentTime < end) {
        const nextTime = new Date(currentTime);
        nextTime.setMinutes(nextTime.getMinutes() + 1);

        const isNight = currentTime.getHours() >= 22 || currentTime.getHours() < 5;
        const isHoli = JapaneseHolidays.isWeekend(currentTime) || JapaneseHolidays.isHoliday(currentTime) === true;
        
        let rate = 1.0;
        if (isHoli && workplace.allowances?.holiday?.type === 'multiplier') rate *= workplace.allowances.holiday.value;
        if (isNight && workplace.allowances?.lateNight?.type === 'multiplier') rate *= workplace.allowances.lateNight.value;
        
        let addedYen = 0;
        if (isHoli && workplace.allowances?.holiday?.type === 'yen') addedYen += workplace.allowances.holiday.value / 60;
        if (isNight && workplace.allowances?.lateNight?.type === 'yen') addedYen += workplace.allowances.lateNight.value / 60;

        totalSalary += (baseWage / 60) * rate + addedYen;
        currentTime = nextTime;
    }
    
    // 休憩時間を給与から引く（単純化のため、通常時給で減算）
    totalSalary -= (baseWage / 60) * breakMinutes;

    return { salary: Math.round(Math.max(0, totalSalary) + transportFee), workMinutes };
}

/**
 * ヘルパー関数：日付文字列を数値に変換
 */
const getDayNum = (dayStr, y, m) => {
    if (dayStr === 'eom') return new Date(y, m + 1, 0).getDate();
    return Number(dayStr);
};

/**
 * 特定の「締め月」に対する給料日を計算する
 */
export function getPaydayForClosingMonth(year, month, workplace) {
    if (typeof JapaneseHolidays === 'undefined' || !workplace || !workplace.closingDay || !workplace.payday) return new Date(9999, 0, 1);
    const closingDate = new Date(year, month, 1);
    const closingYear = closingDate.getFullYear();
    const closingMonth = closingDate.getMonth();
    const closingDayNum = getDayNum(workplace.closingDay, closingYear, closingMonth);
    let paydayMonth = closingMonth;
    let paydayYear = closingYear;
    if (getDayNum(workplace.payday, closingYear, closingMonth) <= closingDayNum) {
        paydayMonth++;
        if (paydayMonth > 11) { paydayMonth = 0; paydayYear++; }
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