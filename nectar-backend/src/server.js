import express from "express";
import cors from "cors";
import "dotenv/config";

import pool from "./db.js";
import accountsRouter from "./routes/accounts.js";
import categoriesRouter from "./routes/categories.js";
import transactionsRouter from "./routes/transactions.js";
import debtsRouter from "./routes/debts.js";
import goalsRouter from "./routes/goals.js";
import budgetsRouter from "./routes/budgets.js";
import settingsRouter from "./routes/settings.js";

const app = express();

// CORS_ORIGIN boleh berisi beberapa alamat dipisah koma.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.includes("*") ? "*" : allowedOrigins }));

// Batas 10 MB untuk foto struk base64.
app.use(express.json({ limit: "10mb" }));

// Health check (sengaja sebelum pengecekan API key). Sekalian mengetes koneksi database.
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected", time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "error", database: "disconnected", detail: err.code || err.message });
  }
});

// OPSIONAL: proteksi API key sederhana. Aktif hanya jika API_KEY diisi di .env.
app.use("/api", (req, res, next) => {
  const key = process.env.API_KEY;
  if (!key || req.method === "OPTIONS") return next();
  if (req.get("x-api-key") === key) return next();
  res.status(401).json({ error: "API key tidak valid" });
});

app.use("/api/accounts", accountsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/debts", debtsRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/settings", settingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route tidak ditemukan" });
});

// Penangkap error terakhir (mis. JSON rusak atau body terlalu besar).
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Data terlalu besar (maks 10 MB)" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON tidak valid" });
  console.error(err);
  res.status(500).json({ error: "Terjadi kesalahan di server" });
});

// Cek koneksi database saat start, dengan pesan yang membantu.
try {
  await pool.query("SELECT 1");
  console.log("[db] Terhubung ke MySQL XAMPP ✔");
} catch (err) {
  console.error("\n[db] GAGAL terhubung ke database:", err.code || err.message);
  if (err.code === "ECONNREFUSED") console.error("     -> MySQL belum jalan. Buka XAMPP Control Panel lalu klik Start pada MySQL.");
  if (err.code === "ER_BAD_DB_ERROR") console.error("     -> Database belum ada. Import schema.sql lewat phpMyAdmin dulu.");
  if (err.code === "ER_ACCESS_DENIED_ERROR") console.error("     -> User/password salah. Periksa DB_USER dan DB_PASSWORD di file .env.");
  process.exit(1);
}

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`[server] Nectar backend jalan di http://${HOST}:${PORT}`);
});
