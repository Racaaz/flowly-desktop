import { randomUUID } from "crypto";

// Error yang membawa kode HTTP, supaya pesan ke pengguna jelas (400/404, bukan 500).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function newId(prefix) {
  return prefix + "-" + randomUUID().slice(0, 8);
}

// Kirim error ke klien. Error yang kita lempar sendiri (HttpError) ditampilkan apa adanya;
// error tak terduga hanya dicatat di terminal dan klien menerima pesan umum.
export function sendError(res, err, fallbackMessage) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: fallbackMessage });
}

// "Hari ini" menurut zona waktu aplikasi (default WIB), format YYYY-MM-DD.
// Memakai toISOString() akan salah antara jam 00:00-07:00 WIB karena itu waktu UTC.
export function todayLocal() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: process.env.APP_TZ || "Asia/Jakarta",
  });
}

export function isDateString(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function positiveNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 9_999_999_999_999) {
    throw new HttpError(400, `${label} harus berupa angka lebih dari 0`);
  }
  return n;
}

// Menjalankan beberapa query sebagai SATU kesatuan: semua berhasil, atau semua dibatalkan.
export async function withTransaction(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
