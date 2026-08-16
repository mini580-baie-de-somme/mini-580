/** Digit-masked date display/parse helpers (DD.MM.YYYY and DD.MM.YYYY HH:MM). */

const DATE_DIGITS = 8;
const DATETIME_DIGITS = 12;

/** Strip non-digits and apply DD.MM.YYYY mask while typing. */
export function applyDateDigitMask(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, DATE_DIGITS);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += ".";
    out += digits[i];
  }
  return out;
}

/** Strip non-digits and apply DD.MM.YYYY HH:MM mask while typing. */
export function applyDatetimeDigitMask(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, DATETIME_DIGITS);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += ".";
    if (i === 8) out += " ";
    if (i === 10) out += ":";
    out += digits[i];
  }
  return out;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/** Parse DD.MM.YYYY or YYYY-MM-DD to ISO date (YYYY-MM-DD), or null if invalid/incomplete. */
export function parseDisplayDate(text: string): string | null {
  const v = text.trim();
  if (!v) return null;

  const dotted = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) {
    const day = Number(dotted[1]);
    const month = Number(dotted[2]);
    const year = Number(dotted[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return v;
  }

  return null;
}

/** Parse DD.MM.YYYY HH:MM or datetime-local / ISO prefix to YYYY-MM-DDTHH:MM, or null. */
export function parseDisplayDatetime(text: string): string | null {
  const v = text.trim();
  if (!v) return null;

  const dotted = v.match(/^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})$/);
  if (dotted) {
    const day = Number(dotted[1]);
    const month = Number(dotted[2]);
    const year = Number(dotted[3]);
    const hour = Number(dotted[4]);
    const minute = Number(dotted[5]);
    if (
      !isValidCalendarDate(year, month, day) ||
      hour > 23 ||
      minute > 59
    ) {
      return null;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
  }

  const local = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (local) {
    const year = Number(local[1]);
    const month = Number(local[2]);
    const day = Number(local[3]);
    const hour = Number(local[4]);
    const minute = Number(local[5]);
    if (
      !isValidCalendarDate(year, month, day) ||
      hour > 23 ||
      minute > 59
    ) {
      return null;
    }
    return `${local[1]}-${local[2]}-${local[3]}T${local[4]}:${local[5]}`;
  }

  return null;
}

/** Format YYYY-MM-DD as DD.MM.YYYY for display. */
export function isoDateToDisplay(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** Format datetime-local value as DD.MM.YYYY HH:MM for display. */
export function isoDatetimeToDisplay(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}
