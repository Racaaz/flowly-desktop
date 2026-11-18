import { Router } from "express";
import pool from "../db.js";
import { sendError } from "../lib/util.js";
import { serializeAll } from "../lib/serialize.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM categories ORDER BY type, name ASC");
    res.json(serializeAll(rows));
  } catch (err) {
    sendError(res, err, "Gagal mengambil daftar kategori");
  }
});

export default router;
