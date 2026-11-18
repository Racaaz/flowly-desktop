import mysql from "mysql2/promise";
import "dotenv/config";

// Koneksi ke MySQL/MariaDB milik XAMPP.
// Semua nilai dibaca dari file .env (lihat .env.example).
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "nectar_desktop",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  // PENTING: kolom DATE/TIMESTAMP dikembalikan sebagai teks "2026-11-16"
  // (bukan objek Date JavaScript yang rawan bergeser zona waktu).
  dateStrings: true,
});

export default pool;
