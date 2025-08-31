// src/utils.js
// Converts a Firebase Timestamp to a 'YYYY-MM-DD' string
export function timestampToYYYYMMDD(timestamp) {
    if (!timestamp || !timestamp.toDate) return '';
    const date = timestamp.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}