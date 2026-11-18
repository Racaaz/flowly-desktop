import { Router } from "express";
import pool from "../db.js";
import { HttpError, sendError } from "../lib/util.js";

const router = Router();

// GET /api/budgets -> { "cat-jajan": 500000, ... }
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT category_id, amount FROM budgets");
    const result = {};
    for (const r of rows) result[r.category_id] = Number(r.amount);
    res.json(result);
  } catch (err) {
    sendError(res, err, "Gagal mengambil anggaran");
  }
});

// PUT /api/budgets/:categoryId  { amount }  (0 = tanpa anggaran)
router.put("/:categoryId", async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, "Anggaran harus berupa angka 0 atau lebih");

    const [[cat]] = await pool.query("SELECT type FROM categories WHERE id = ?", [req.params.categoryId]);
    if (!cat) throw new HttpError(404, "Kategori tidak ditemukan");
    if (cat.type !== "expense") throw new HttpError(400, "Anggaran hanya untuk kategori pengeluaran");

    await pool.query(
      "INSERT INTO budgets (category_id, amount) VALUES (?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)",
      [req.params.categoryId, amount]
    );
    res.json({ categoryId: req.params.categoryId, amount });
  } catch (err) {
    sendError(res, err, "Gagal menyimpan anggaran");
  }
});

export default router;
