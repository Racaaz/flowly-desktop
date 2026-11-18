// Mengubah baris database (snake_case, DECIMAL berupa teks) menjadi bentuk
// yang diharapkan frontend (camelCase, angka asli, boolean asli).

const NUMERIC = new Set([
  "balance", "amount", "principal", "remaining",
  "monthlyInstallment", "target", "current", "dueDay",
]);
const BOOLEAN = new Set(["isDefault", "isTransfer", "autopay", "receiptIsPdf", "hasReceipt"]);
const HIDDEN = new Set(["createdAt", "receiptData"]);

export function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function serialize(row) {
  const out = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const key = snakeToCamel(rawKey);
    if (HIDDEN.has(key)) continue;
    if (NUMERIC.has(key) && value !== null) out[key] = Number(value);
    else if (BOOLEAN.has(key)) out[key] = Boolean(value);
    else out[key] = value;
  }
  return out;
}

export const serializeAll = (rows) => rows.map(serialize);
