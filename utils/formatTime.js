// utils/formatTime.js
// Converts any time format to 24hr HH:MM

export function formatTo24Hr(timeStr) {
  if (!timeStr) return null;

  // Already in 24hr format (e.g., "09:30", "14:00")
  if (/^\d{1,2}:\d{2}$/.test(timeStr) && !timeStr.includes('AM') && !timeStr.includes('PM')) {
    const [h, m] = timeStr.split(':');
    return h.padStart(2, '0') + ':' + m;
  }

  // 12hr format (e.g., "8:30 AM", "1:00 PM")
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let [_, hours, mins, period] = match;
    hours = parseInt(hours);

    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }

    return hours.toString().padStart(2, '0') + ':' + mins;
  }

  // Return original if can't parse
  return timeStr;
}
