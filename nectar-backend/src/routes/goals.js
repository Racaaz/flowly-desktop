import { Router } from "express";
import pool from "../db.js";
import { HttpError, isDateString, newId, positiveNumber, sendError, todayLocal } from "../lib/util.js";
import { serialize, serializeAll } from "../lib/serialize.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM goals ORDER BY created_at ASC, id ASC");
    res.json(serializeAll(rows));
  } catch (err) {
    sendError(res, err, "Gagal mengambil target tabungan");
  }
});

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) throw new HttpError(400, "Nama target wajib diisi");
    const target = positiveNumber(req.body.target, "Target");
    const current = Number(req.body.current ?? 0);
    if (!Number.isFinite(current) || current < 0) throw new HttpError(400, "Dana awal tidak valid");
    const deadline = req.body.deadline || todayLocal();
    if (!isDateString(deadline)) throw new HttpError(400, "Tanggal harus berformat YYYY-MM-DD");

    const id = newId("g");
    await pool.query(
      "INSERT INTO goals (id, name, target, current, deadline) VALUES (?, ?, ?, ?, ?)",
      [id, String(name).trim().slice(0, 150), target, current, deadline]
    );
    const [[row]] = await pool.query("SELECT * FROM goals WHERE id = ?", [id]);
    res.status(201).json(serialize(row));
  } catch (err) {
    sendError(res, err, "Gagal menambah target tabungan");
  }
});

// PATCH /api/goals/:id/fund — tambah dana { amount }
router.patch("/:id/fund", async (req, res) => {
  try {
    const amount = positiveNumber(req.body.amount, "Nominal");
    const [result] = await pool.query("UPDATE goals SET current = current + ? WHERE id = ?", [amount, req.params.id]);
    if (result.affectedRows === 0) throw new HttpError(404, "Target tidak ditemukan");
    const [[row]] = await pool.query("SELECT * FROM goals WHERE id = ?", [req.params.id]);
    res.json(serialize(row));
  } catch (err) {
    sendError(res, err, "Gagal menambah dana");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM goals WHERE id = ?", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    sendError(res, err, "Gagal menghapus target");
  }
});

export default router;
