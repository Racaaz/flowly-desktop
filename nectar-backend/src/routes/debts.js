import { Router } from "express";
import pool from "../db.js";
import { HttpError, newId, positiveNumber, sendError, todayLocal, withTransaction } from "../lib/util.js";
import { serialize, serializeAll } from "../lib/serialize.js";
import { insertTransactionWithBalance } from "../ledger.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM debts ORDER BY created_at ASC, id ASC");
    res.json(serializeAll(rows));
  } catch (err) {
    sendError(res, err, "Gagal mengambil data utang/piutang");
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, kind, autopay = false } = req.body;
    if (!name || !String(name).trim()) throw new HttpError(400, "Nama wajib diisi");
    if (!["debt", "receivable"].includes(kind)) throw new HttpError(400, "Jenis harus 'debt' atau 'receivable'");

    const principal = positiveNumber(req.body.principal, "Pokok pinjaman");
    const remaining = req.body.remaining === undefined ? principal : Number(req.body.remaining);
    const monthlyInstallment = Number(req.body.monthlyInstallment ?? 0);
    const dueDay = Number(req.body.dueDay ?? 1);
    if (!Number.isFinite(remaining) || remaining < 0 || remaining > principal) {
      throw new HttpError(400, "Sisa harus antara 0 dan pokok pinjaman");
    }
    if (!Number.isFinite(monthlyInstallment) || monthlyInstallment < 0) throw new HttpError(400, "Cicilan tidak valid");
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new HttpError(400, "Tanggal jatuh tempo harus 1-31");

    const id = newId("d");
    await pool.query(
      `INSERT INTO debts (id, name, kind, principal, remaining, monthly_installment, due_day, autopay)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(name).trim().slice(0, 150), kind, principal, remaining, monthlyInstallment, dueDay, !!autopay]
    );
    const [[row]] = await pool.query("SELECT * FROM debts WHERE id = ?", [id]);
    res.status(201).json(serialize(row));
  } catch (err) {
    sendError(res, err, "Gagal menambah data utang/piutang");
  }
});

// PATCH /api/debts/:id/pay — bayar 1x cicilan.
// Jika body berisi { accountId }, saldo akun ikut berubah dan tercatat sebagai transaksi:
//   utang    -> pengeluaran (kategori Tagihan)
//   piutang  -> pemasukan   (kategori Pemasukan Lain)
router.patch("/:id/pay", async (req, res) => {
  try {
    const updated = await withTransaction(pool, async (conn) => {
      const [[debt]] = await conn.query("SELECT * FROM debts WHERE id = ? FOR UPDATE", [req.params.id]);
      if (!debt) throw new HttpError(404, "Data tidak ditemukan");

      const remaining = Number(debt.remaining);
      const installment = Number(debt.monthly_installment);
      if (remaining <= 0) throw new HttpError(400, "Sudah lunas");
      if (installment <= 0) throw new HttpError(400, "Cicilan per bulan belum diatur");

      const payment = Math.min(remaining, installment);
      await conn.query("UPDATE debts SET remaining = remaining - ? WHERE id = ?", [payment, debt.id]);

      if (req.body?.accountId) {
        const isDebt = debt.kind === "debt";
        await insertTransactionWithBalance(conn, {
          date: todayLocal(),
          accountId: req.body.accountId,
          categoryId: isDebt ? "cat-tagihan" : "cat-pemasukan-lain",
          amount: payment,
          note: `${isDebt ? "Cicilan" : "Terima cicilan"}: ${debt.name}`,
          type: isDebt ? "expense" : "income",
        });
      }
      const [[row]] = await conn.query("SELECT * FROM debts WHERE id = ?", [debt.id]);
      return row;
    });
    res.json(serialize(updated));
  } catch (err) {
    sendError(res, err, "Gagal memproses pembayaran cicilan");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM debts WHERE id = ?", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    sendError(res, err, "Gagal menghapus data");
  }
});

export default router;
