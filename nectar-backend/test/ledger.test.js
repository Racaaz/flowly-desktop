import { test } from "node:test";
import assert from "node:assert/strict";
import { insertTransactionWithBalance, deleteTransactionWithBalance } from "../src/ledger.js";
import { serialize } from "../src/lib/serialize.js";
import { todayLocal } from "../src/lib/util.js";

// Database tiruan super sederhana, cukup untuk menguji aturan di ledger.js
function fakeConn() {
  const accounts = { a1: { id: "a1", balance: 100000 }, a2: { id: "a2", balance: 0 } };
  const categories = {
    "cat-makan": { type: "expense" }, "cat-gaji": { type: "income" },
    "cat-lainnya": { type: "expense" }, "cat-pemasukan-lain": { type: "income" },
  };
  const txs = [];
  return {
    accounts, txs,
    async query(sql, p = []) {
      if (sql.startsWith("SELECT id FROM accounts")) return [[accounts[p[0]]]];
      if (sql.startsWith("SELECT type FROM categories")) return [[categories[p[0]]]];
      if (sql.startsWith("INSERT INTO transactions"))
        { txs.push({ id: p[0], account_id: p[2], amount: p[4], type: p[6], transfer_group_id: p[8] }); return [{}]; }
      if (sql.startsWith("UPDATE accounts SET balance")) { accounts[p[1]].balance += p[0]; return [{}]; }
      if (sql.startsWith("SELECT * FROM transactions WHERE id")) return [[txs.find((t) => t.id === p[0])]];
      if (sql.startsWith("SELECT * FROM transactions WHERE transfer_group_id"))
        return [txs.filter((t) => t.transfer_group_id === p[0])];
      if (sql.startsWith("DELETE FROM transactions")) { txs.splice(txs.findIndex((t) => t.id === p[0]), 1); return [{}]; }
      throw new Error("query tak dikenal: " + sql);
    },
  };
}
const base = { date: "2026-11-16", accountId: "a1", categoryId: "cat-makan", amount: 25000, type: "expense" };

test("pengeluaran mengurangi saldo", async () => {
  const c = fakeConn();
  await insertTransactionWithBalance(c, base);
  assert.equal(c.accounts.a1.balance, 75000);
});
test("pemasukan menambah saldo", async () => {
  const c = fakeConn();
  await insertTransactionWithBalance(c, { ...base, categoryId: "cat-gaji", type: "income" });
  assert.equal(c.accounts.a1.balance, 125000);
});
test("menolak nominal negatif / nol / bukan angka", async () => {
  const c = fakeConn();
  for (const amount of [-5, 0, "abc", null]) {
    await assert.rejects(insertTransactionWithBalance(c, { ...base, amount }), { status: 400 });
  }
  assert.equal(c.accounts.a1.balance, 100000);
});
test("menolak tipe tidak cocok dengan kategori (400, bukan 500)", async () => {
  await assert.rejects(insertTransactionWithBalance(fakeConn(), { ...base, type: "income" }), { status: 400 });
});
test("menolak kategori / akun / tanggal tidak valid", async () => {
  const c = fakeConn();
  await assert.rejects(insertTransactionWithBalance(c, { ...base, categoryId: "xx" }), { status: 400 });
  await assert.rejects(insertTransactionWithBalance(c, { ...base, accountId: "xx" }), { status: 400 });
  await assert.rejects(insertTransactionWithBalance(c, { ...base, date: "16/11/2026" }), { status: 400 });
});
test("hapus transfer menghapus KEDUA sisi dan saldo kembali", async () => {
  const c = fakeConn();
  const out = await insertTransactionWithBalance(c, { ...base, categoryId: "cat-lainnya", amount: 40000, isTransfer: true, transferGroupId: "tg-1" });
  await insertTransactionWithBalance(c, { ...base, accountId: "a2", categoryId: "cat-pemasukan-lain", amount: 40000, type: "income", isTransfer: true, transferGroupId: "tg-1" });
  assert.deepEqual([c.accounts.a1.balance, c.accounts.a2.balance], [60000, 40000]);
  const n = await deleteTransactionWithBalance(c, out);
  assert.equal(n, 2);
  assert.deepEqual([c.accounts.a1.balance, c.accounts.a2.balance], [100000, 0]);
  assert.equal(c.txs.length, 0);
});
test("serialize: DECIMAL teks -> angka, snake_case -> camelCase, sembunyikan receipt_data", () => {
  const out = serialize({ account_id: "a1", amount: "50000.00", is_transfer: 1, receipt_data: "xxx", has_receipt: 0 });
  assert.deepEqual(out, { accountId: "a1", amount: 50000, isTransfer: true, hasReceipt: false });
});
test("todayLocal berformat YYYY-MM-DD", () => {
  assert.match(todayLocal(), /^\d{4}-\d{2}-\d{2}$/);
});
