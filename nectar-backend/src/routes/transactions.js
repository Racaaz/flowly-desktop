import { Router } from "express";
import pool from "../db.js";
import { HttpError, newId, sendError, todayLocal, withTransaction } from "../lib/util.js";
import { serializeAll } from "../lib/serialize.js";
import { insertTransactionWithBalance, deleteTransactionWithBalance } from "../ledger.js";

const router = Router();

// Kolom daftar transaksi. SENGAJA tanpa receipt_data (base64 besar) agar daftar tetap ringan;
// gambar struk diambil terpisah lewat GET /:id/receipt.
const LIST_COLUMNS = `id, date, account_id, category_id, amount, note, type, is_transfer,
  transfer_group_id, receipt_name, receipt_is_pdf, (receipt_name IS NOT NULL) AS has_receipt`;

// GET /api/transactions?month=2026-11&accountId=...&categoryId=...
router.get("/", async (req, res) => {
  try {
    const { month, accountId, categoryId } = req.query;
    const conditions = [];
    const values = [];

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Format month harus YYYY-MM");
      // Rentang tanggal (bukan DATE_FORMAT) supaya index idx_tx_date bisa dipakai.
      conditions.push("date >= ? AND date < DATE_ADD(?, INTERVAL 1 MONTH)");
      values.push(`${month}-01`, `${month}-01`);
    }
    if (accountId) { conditions.push("account_id = ?"); values.push(accountId); }
    if (categoryId) { conditions.push("category_id = ?"); values.push(categoryId); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM transactions ${where} ORDER BY date DESC, created_at DESC, id DESC`,
      values
    );
    res.json(serializeAll(rows));
  } catch (err) {
    sendError(res, err, "Gagal mengambil transaksi");
  }
});

// GET /api/transactions/:id/receipt — gambar/PDF struk (diambil hanya saat dibutuhkan)
router.get("/:id/receipt", async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT receipt_name, receipt_data, receipt_is_pdf FROM transactions WHERE id = ?",
      [req.params.id]
    );
    if (!row || !row.receipt_data) throw new HttpError(404, "Struk tidak ditemukan");
    res.json({ name: row.receipt_name, dataUrl: row.receipt_data, isPdf: !!row.receipt_is_pdf });
  } catch (err) {
    sendError(res, err, "Gagal mengambil struk");
  }
});

async function fetchByIds(ids) {
  const [rows] = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM transactions WHERE id IN (${ids.map(() => "?").join(",")})
     ORDER BY created_at DESC, id DESC`,
    ids
  );
  return serializeAll(rows);
}

// POST /api/transactions — satu transaksi manual
router.post("/", async (req, res) => {
  try {
    const id = await withTransaction(pool, (conn) =>
      insertTransactionWithBalance(conn, { ...req.body, date: req.body.date || todayLocal(), isTransfer: false })
    );
    const [row] = await fetchByIds([id]);
    res.status(201).json(row);
  } catch (err) {
    sendError(res, err, "Gagal menyimpan transaksi");
  }
});

// POST /api/transactions/bulk — banyak transaksi sekaligus (Command Bar)
router.post("/bulk", async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new HttpError(400, "Body harus berisi array 'transactions'");
    }
    if (transactions.length > 50) throw new HttpError(400, "Maksimal 50 transaksi sekali kirim");

    const ids = await withTransaction(pool, async (conn) => {
      const result = [];
      for (const tx of transactions) {
        result.push(await insertTransactionWithBalance(conn, {
          ...tx, date: tx.date || todayLocal(), isTransfer: false, receipt: null,
        }));
      }
      return result;
    });
    res.status(201).json(await fetchByIds(ids));
  } catch (err) {
    sendError(res, err, "Gagal menyimpan transaksi (bulk)");
  }
});

// POST /api/transactions/transfer — dua baris terhubung lewat transfer_group_id
router.post("/transfer", async (req, res) => {
  try {
    const { fromAccountId, toAccountId } = req.body;
    const amount = Number(req.body.amount);
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || !(amount > 0)) {
      throw new HttpError(400, "Data transfer tidak valid");
    }

    const ids = await withTransaction(pool, async (conn) => {
      const [[from]] = await conn.query("SELECT name FROM accounts WHERE id = ?", [fromAccountId]);
      const [[to]] = await conn.query("SELECT name FROM accounts WHERE id = ?", [toAccountId]);
      if (!from || !to) throw new HttpError(404, "Akun tidak ditemukan");

      const groupId = newId("tg");
      const date = todayLocal();
      const outId = await insertTransactionWithBalance(conn, {
        date, accountId: fromAccountId, categoryId: "cat-lainnya", amount,
        note: `Transfer ke ${to.name}`, type: "expense", isTransfer: true, transferGroupId: groupId,
      });
      const inId = await insertTransactionWithBalance(conn, {
        date, accountId: toAccountId, categoryId: "cat-pemasukan-lain", amount,
        note: `Transfer dari ${from.name}`, type: "income", isTransfer: true, transferGroupId: groupId,
      });
      return [outId, inId];
    });
    res.status(201).json(await fetchByIds(ids));
  } catch (err) {
    sendError(res, err, "Gagal memproses transfer");
  }
});

// DELETE /api/transactions/:id — hapus + kembalikan saldo (transfer: kedua sisi sekaligus)
router.delete("/:id", async (req, res) => {
  try {
    await withTransaction(pool, (conn) => deleteTransactionWithBalance(conn, req.params.id));
    res.status(204).send();
  } catch (err) {
    sendError(res, err, "Gagal menghapus transaksi");
  }
});

export default router;
