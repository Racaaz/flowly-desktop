# Nectar Backend (XAMPP / MySQL lokal)

API Express + MySQL untuk Nectar Desktop. Berjalan **sepenuhnya di laptop Anda**
memakai MySQL (MariaDB) bawaan XAMPP. Tidak butuh Railway/internet.

## Jalankan (ringkas)
1. XAMPP Control Panel -> **Start** pada MySQL (Apache tidak wajib, kecuali ingin phpMyAdmin).
2. phpMyAdmin -> Import -> pilih `schema.sql` -> Go.
3. Salin `.env.example` menjadi `.env` (isi default sudah cocok untuk XAMPP).
4. `npm install` lalu `npm run dev`.
5. Buka http://127.0.0.1:4000/api/health -> harus `{"status":"ok","database":"connected",...}`.

## Tes
`npm test` — menguji aturan saldo/transfer/validasi memakai database tiruan (tanpa MySQL).

## Struktur
```
src/
  server.js        entry point, CORS, API key opsional, cek koneksi DB
  db.js            koneksi MySQL (pool)
  ledger.js        SATU-SATUNYA tempat yang mengubah saldo karena transaksi
  lib/util.js      HttpError, transaksi DB, tanggal WIB, validasi angka
  lib/serialize.js snake_case -> camelCase, DECIMAL -> number
  routes/          accounts, categories, transactions, debts, goals, budgets, settings
test/ledger.test.js
schema.sql         tabel + data awal (aman dijalankan berulang)
```

## Endpoint
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /api/health | Status server + koneksi database |
| GET/POST | /api/accounts | Daftar / tambah akun |
| PATCH | /api/accounts/:id | Ubah nama/warna atau koreksi saldo (tercatat sebagai transaksi koreksi) |
| DELETE | /api/accounts/:id | Hapus akun (akun default ditolak; transaksinya ikut terhapus) |
| GET | /api/categories | Daftar kategori |
| GET | /api/transactions?month=YYYY-MM&accountId=&categoryId= | Daftar transaksi (tanpa isi struk) |
| GET | /api/transactions/:id/receipt | Gambar/PDF struk |
| POST | /api/transactions | Satu transaksi |
| POST | /api/transactions/bulk | Banyak transaksi (Command Bar) |
| POST | /api/transactions/transfer | Transfer antar-akun |
| DELETE | /api/transactions/:id | Hapus + kembalikan saldo (transfer: dua sisi) |
| GET/POST | /api/debts | Daftar / tambah utang-piutang |
| PATCH | /api/debts/:id/pay | Bayar cicilan `{ accountId }` (opsional) |
| DELETE | /api/debts/:id | Hapus |
| GET/POST | /api/goals | Daftar / tambah target |
| PATCH | /api/goals/:id/fund | Tambah dana `{ amount }` |
| DELETE | /api/goals/:id | Hapus |
| GET | /api/budgets | `{ "cat-jajan": 500000, ... }` |
| PUT | /api/budgets/:categoryId | `{ amount }` |
| GET/PUT | /api/settings | `{ cycleStartDay }` (1-28) |
