import { Router } from "express";
import pool from "../db.js";
import { HttpError, newId, sendError, todayLocal, withTransaction } from "../lib/util.js";
import { serialize, serializeAll } from "../lib/serialize.js";
import { insertTransactionWithBalance } from "../ledger.js";

const router = Router();
const ACCOUNT_TYPES = ["cash", "bank", "ewallet", "debt"];

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM accounts ORDER BY is_default DESC, created_at ASC, id ASC");
    res.json(serializeAll(rows));
  } catch (err) {
    sendError(res, err, "Gagal mengambil daftar akun");
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, type = "bank", color = "#64748b" } = req.body;
    const balance = Number(req.body.balance ?? 0);
    if (!name || !String(name).trim()) throw new HttpError(400, "Nama akun wajib diisi");
    if (!ACCOUNT_TYPES.includes(type)) throw new HttpError(400, "Jenis akun tidak valid");
    if (!Number.isFinite(balance)) throw new HttpError(400, "Saldo awal harus berupa angka");

    const id = newId("acc");
    const cleanName = String(name).trim().slice(0, 100);
    const shortcode = cleanName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ACC";

    await pool.query(
      "INSERT INTO accounts (id, name, shortcode, type, balance, color) VALUES (?, ?, ?, ?, ?, ?)",
      [id, cleanName, shortcode, type, balance, String(color).slice(0, 20)]
    );
    const [[row]] = await pool.query("SELECT * FROM accounts WHERE id = ?", [id]);
    res.status(201).json(serialize(row));
  } catch (err) {
    sendError(res, err, "Gagal menambah akun");
  }
});

// PATCH /api/accounts/:id — ubah nama/warna, atau KOREKSI SALDO.
// Koreksi saldo tidak menimpa angka begitu saja: dicatat sebagai transaksi "Koreksi saldo"
// (ditandai is_transfer supaya tidak masuk hitungan pemasukan/pengeluaran) agar ada jejaknya.
router.patch("/:id", async (req, res) => {
  try {
    const updated = await withTransaction(pool, async (conn) => {
      const [[acc]] = await conn.query("SELECT * FROM accounts WHERE id = ? FOR UPDATE", [req.params.id]);
      if (!acc) throw new HttpError(404, "Akun tidak ditemukan");

      const { name, color, balance } = req.body;
      if (name !== undefined) {
        if (!String(name).trim()) throw new HttpError(400, "Nama akun tidak boleh kosong");
        await conn.query("UPDATE accounts SET name = ? WHERE id = ?", [String(name).trim().slice(0, 100), acc.id]);
      }
      if (color !== undefined) {
        await conn.query("UPDATE accounts SET color = ? WHERE id = ?", [String(color).slice(0, 20), acc.id]);
      }
      if (balance !== undefined) {
        const newBalance = Number(balance);
        if (!Number.isFinite(newBalance)) throw new HttpError(400, "Saldo harus berupa angka");
        const delta = Math.round((newBalance - Number(acc.balance)) * 100) / 100;
        if (delta !== 0) {
          await insertTransactionWithBalance(conn, {
            date: todayLocal(),
            accountId: acc.id,
            categoryId: delta > 0 ? "cat-pemasukan-lain" : "cat-lainnya",
            amount: Math.abs(delta),
            note: "Koreksi saldo",
            type: delta > 0 ? "income" : "expense",
            isTransfer: true,
          });
        }
      }
      const [[row]] = await conn.query("SELECT * FROM accounts WHERE id = ?", [acc.id]);
      return row;
    });
    res.json(serialize(updated));
  } catch (err) {
    sendError(res, err, "Gagal mengupdate akun");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const [[acc]] = await pool.query("SELECT * FROM accounts WHERE id = ?", [req.params.id]);
    if (!acc) throw new HttpError(404, "Akun tidak ditemukan");
    if (acc.is_default) {
      throw new HttpError(400, "Akun default tidak bisa dihapus");
    }
    // Semua transaksi akun ini ikut terhapus (ON DELETE CASCADE di schema.sql).
    await pool.query("DELETE FROM accounts WHERE id = ?", [acc.id]);
    res.status(204).send();
  } catch (err) {
    sendError(res, err, "Gagal menghapus akun");
  }
});

export default router;
