# Nectar Desktop (frontend)

React 19 + Vite + Tailwind v4. Data disimpan di database lewat `nectar-backend`.

## Jalankan
1. Pastikan backend sudah jalan (lihat `../nectar-backend/README.md`).
2. Salin `.env.example` menjadi `.env`.
3. `npm install` lalu `npm run dev` -> buka http://localhost:5173

## Skrip
- `npm run dev`   server pengembangan
- `npm run build` build produksi ke folder `dist`
- `npm test`      tes parser nominal, Command Bar, dan siklus bulanan
- `npm run lint`  pemeriksaan kode

## Struktur
```
src/
  api.js                 satu-satunya tempat memanggil backend
  lib/format.js          format rupiah/tanggal (tanggal LOKAL, bukan UTC)
  lib/parser.js          parser nominal & Command Bar
  lib/period.js          perhitungan siklus bulanan
  lib/lib.test.js        tes untuk ketiganya
  nectar-desktop.jsx     komponen UI
```
