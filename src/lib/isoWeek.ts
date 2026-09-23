// ISO-8601 week numbering. "Semaine courante = semaine ISO" (README §Interactions & Behavior).

export interface IsoWeek {
  isoWeek: number;
  year: number;
}

export function getIsoWeek(date: Date = new Date()): IsoWeek {
  // Read with UTC getters, not local ones: on a UTC-behind timezone (e.g.
  // America/Toronto), a UTC-midnight Monday reads back as Sunday in local
  // time, silently shifting the whole calculation back a day/week.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of this week decides the ISO year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoWeek, year: d.getUTCFullYear() };
}

/** Last `count` ISO weeks ending at `end` (inclusive), oldest first. */
export function lastNIsoWeeks(count: number, end: Date = new Date()): IsoWeek[] {
  const out: IsoWeek[] = [];
  const cursor = new Date(end);
  for (let i = 0; i < count; i++) {
    out.unshift(getIsoWeek(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return out;
}

export function isoWeekLabel(w: IsoWeek): string {
  return `S${String(w.isoWeek).padStart(2, "0")}`;
}

export function isoWeekEquals(a: IsoWeek, b: IsoWeek): boolean {
  return a.isoWeek === b.isoWeek && a.year === b.year;
}

/** Monday (00:00 UTC) of the given ISO week, as a millisecond timestamp. */
function isoWeekMondayMs(w: IsoWeek): number {
  const jan4 = Date.UTC(w.year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7; // 1 (Mon) .. 7 (Sun)
  const week1MondayMs = jan4 - (jan4Day - 1) * 86400000;
  return week1MondayMs + (w.isoWeek - 1) * 7 * 86400000;
}

export function previousIsoWeek(w: IsoWeek): IsoWeek {
  return getIsoWeek(new Date(isoWeekMondayMs(w) - 7 * 86400000));
}
