# Nectar Wallet

Pencatat keuangan pribadi. Berjalan lokal: React (frontend) + Express (backend) + MySQL XAMPP.

1. `nectar-backend/` — ikuti README di dalamnya (XAMPP, import schema.sql, npm run dev)
2. `Nectar_Desktop/` — ikuti README di dalamnya (npm run dev)

Urutan menyalakan setiap hari: XAMPP MySQL -> backend -> frontend.

# Nectar Wallet

Pencatat keuangan pribadi yang berjalan lokal (React + Express + MySQL XAMPP).
Data tersimpan di komputer Anda sendiri, tidak dikirim ke mana pun.

## Kebutuhan
- Node.js 20.19 atau lebih baru
- XAMPP (MySQL/MariaDB)

## Pemasangan
1. Jalankan MySQL di XAMPP Control Panel.
2. Di phpMyAdmin, Import `nectar-backend/schema.sql`.
3. Opsional: di `my.ini` XAMPP, set `max_allowed_packet=16M` (untuk upload struk), lalu restart MySQL.
4. Backend:
   ```
   cd nectar-backend
   copy .env.example .env      (Mac/Linux: cp .env.example .env)
   npm install
   npm run dev
   ```
5. Frontend (terminal kedua):
   ```
   cd Nectar_Desktop
   copy .env.example .env
   npm install
   npm run dev
   ```
6. Buka http://localhost:5173

Cek backend: http://127.0.0.1:4000/api/health