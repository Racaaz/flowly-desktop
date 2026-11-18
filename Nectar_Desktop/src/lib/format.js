// Format tampilan & helper tanggal. Semua murni (tanpa React) sehingga mudah dites.

export function formatIDR(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
}

export function formatCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000000) return (n / 1000000000).toFixed(1) + "M";
  if (abs >= 1000000) return (n / 1000000).toFixed(1) + "jt";
  if (abs >= 1000) return (n / 1000).toFixed(0) + "rb";
  return String(n);
}

export function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// Date -> "YYYY-MM-DD" memakai tanggal LOKAL (WIB di laptop Anda).
// JANGAN pakai date.toISOString(): itu waktu UTC, sehingga jam 00:00-07:00 WIB
// akan terbaca sebagai hari sebelumnya.
export function toDateStr(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}
