// "Buku besar": satu-satunya tempat yang boleh mengubah saldo akun karena transaksi.
// Dipakai bersama oleh route transaksi, akun, dan utang supaya aturannya konsisten.
import { HttpError, isDateString, newId, positiveNumber } from "./lib/util.js";

const MAX_RECEIPT_CHARS = 8_000_000; // ~6 MB file asli setelah di-base64

// Menyimpan 1 transaksi + mengubah saldo akun. WAJIB dipanggil di dalam withTransaction().
export async function insertTransactionWithBalance(conn, tx) {
  const amount = positiveNumber(tx.amount, "Nominal");
  if (!["income", "expense"].includes(tx.type)) {
    throw new HttpError(400, "Tipe transaksi harus 'income' atau 'expense'");
  }
  if (!isDateString(tx.date)) {
    throw new HttpError(400, "Tanggal harus berformat YYYY-MM-DD");
  }

  const [[account]] = await conn.query("SELECT id FROM accounts WHERE id = ?", [tx.accountId]);
  if (!account) throw new HttpError(400, "Akun tidak ditemukan");

  const [[category]] = await conn.query("SELECT type FROM categories WHERE id = ?", [tx.categoryId]);
  if (!category) throw new HttpError(400, "Kategori tidak ditemukan");
  if (!tx.isTransfer && category.type !== tx.type) {
    throw new HttpError(400, "Tipe transaksi tidak cocok dengan tipe kategori");
  }

  const receipt = tx.receipt || null;
  if (receipt) {
    const ok = typeof receipt.dataUrl === "string" &&
      (receipt.dataUrl.startsWith("data:image/") || receipt.dataUrl.startsWith("data:application/pdf"));
    if (!ok) throw new HttpError(400, "Lampiran struk harus berupa gambar atau PDF");
    if (receipt.dataUrl.length > MAX_RECEIPT_CHARS) {
      throw new HttpError(400, "Ukuran struk terlalu besar (maksimal ±6 MB)");
    }
  }

  const id = newId("t");
  const delta = tx.type === "income" ? amount : -amount;

  await conn.query(
    `INSERT INTO transactions
      (id, date, account_id, category_id, amount, note, type, is_transfer, transfer_group_id,
       receipt_name, receipt_data, receipt_is_pdf)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tx.date, tx.accountId, tx.categoryId, amount,
      String(tx.note || "").slice(0, 255), tx.type,
      !!tx.isTransfer, tx.transferGroupId || null,
      receipt ? String(receipt.name || "struk").slice(0, 255) : null,
      receipt ? receipt.dataUrl : null,
      !!receipt?.isPdf,
    ]
  );
  await conn.query("UPDATE accounts SET balance = balance + ? WHERE id = ?", [delta, tx.accountId]);
  return id;
}

// Menghapus transaksi + mengembalikan saldo. Jika bagian dari transfer,
// kedua sisinya dihapus sekaligus. Mengembalikan jumlah baris yang dihapus.
export async function deleteTransactionWithBalance(conn, id) {
  const [[tx]] = await conn.query("SELECT * FROM transactions WHERE id = ?", [id]);
  if (!tx) throw new HttpError(404, "Transaksi tidak ditemukan");

  const targets = tx.transfer_group_id
    ? (await conn.query("SELECT * FROM transactions WHERE transfer_group_id = ?", [tx.transfer_group_id]))[0]
    : [tx];

  for (const t of targets) {
    const reverse = t.type === "income" ? -Number(t.amount) : Number(t.amount);
    await conn.query("UPDATE accounts SET balance = balance + ? WHERE id = ?", [reverse, t.account_id]);
    await conn.query("DELETE FROM transactions WHERE id = ?", [t.id]);
  }
  return targets.length;
}
