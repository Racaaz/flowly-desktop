import { toDateStr } from "./format.js";

// Menghitung rentang siklus bulanan yang sedang berjalan.
// startDay = tanggal mulai siklus (1-28). Contoh startDay=25, hari ini 16 Nov 2026:
//   siklus = 25 Okt 2026 s/d 24 Nov 2026
//   -> { start: "2026-10-25", end: "2026-11-25", last: "2026-11-24" }
// "end" EKSKLUSIF (25 Nov sudah masuk siklus berikutnya); "last" = hari terakhir siklus ini.
export function getCycleRange(startDay = 1, ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const start = ref.getDate() >= startDay ? new Date(y, m, startDay) : new Date(y, m - 1, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  return { start: toDateStr(start), end: toDateStr(end), last: toDateStr(last) };
}
