import { Router } from "express";
import pool from "../db.js";
import { HttpError, sendError } from "../lib/util.js";

const router = Router();

async function readSettings() {
  const [rows] = await pool.query("SELECT k, v FROM settings");
  const map = Object.fromEntries(rows.map((r) => [r.k, r.v]));
  return { cycleStartDay: Number(map.cycleStartDay) || 1 };
}

router.get("/", async (req, res) => {
  try {
    res.json(await readSettings());
  } catch (err) {
    sendError(res, err, "Gagal mengambil pengaturan");
  }
});

// PUT /api/settings  { cycleStartDay: 1..28 }
router.put("/", async (req, res) => {
  try {
    const day = Number(req.body.cycleStartDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      throw new HttpError(400, "Tanggal siklus harus bilangan bulat 1-28");
    }
    await pool.query(
      "INSERT INTO settings (k, v) VALUES ('cycleStartDay', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
      [String(day)]
    );
    res.json(await readSettings());
  } catch (err) {
    sendError(res, err, "Gagal menyimpan pengaturan");
  }
});

export default router;
