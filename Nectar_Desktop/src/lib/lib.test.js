import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmountToken, parseMoneyInput, parseCommandLine } from "./parser.js";
import { getCycleRange } from "./period.js";
import { toDateStr } from "./format.js";

test("parseAmountToken: singkatan", () => {
  assert.equal(parseAmountToken("50k"), 50000);
  assert.equal(parseAmountToken("50rb"), 50000);
  assert.equal(parseAmountToken("1jt"), 1000000);
  assert.equal(parseAmountToken("1,5jt"), 1500000);
  assert.equal(parseAmountToken("1.5jt"), 1500000);
  assert.equal(parseAmountToken("2m"), 2000000000);
});
test("parseAmountToken: BUG LAMA — 50.000 harus 50 ribu, bukan 50", () => {
  assert.equal(parseAmountToken("50.000"), 50000);
  assert.equal(parseAmountToken("1.500.000"), 1500000);
  assert.equal(parseAmountToken("50000"), 50000);
});
test("parseAmountToken: input tidak valid -> null", () => {
  for (const bad of ["abc", "", "12,5", "1.50", "50kk", "-5", "5 0"]) assert.equal(parseAmountToken(bad), null, bad);
});
test("parseMoneyInput", () => {
  assert.equal(parseMoneyInput("Rp 50.000"), 50000);
  assert.equal(parseMoneyInput("-25.000"), -25000);
  assert.equal(parseMoneyInput("abc"), null);
  assert.equal(parseMoneyInput(null), null);
});

const cats = [
  { id: "cat-jajan", shortcode: "J", name: "Jajan", type: "expense" },
  { id: "cat-gaji", shortcode: "G", name: "Gaji", type: "income" },
  { id: "cat-lainnya", shortcode: "L", name: "Lainnya", type: "expense" },
  { id: "cat-pemasukan-lain", shortcode: "PL", name: "Pemasukan Lain", type: "income" },
];
const accs = [{ id: "acc-cash", shortcode: "CASH", name: "Cash" }, { id: "acc-bca", shortcode: "BCA", name: "BCA" }];

test("Command Bar: kategori, akun, dan tanda + untuk pemasukan", () => {
  const [a, b, c, d] = parseCommandLine("J 50.000 Donuts; BCA 100k Bensin; BCA +5jt Gaji; X 10k", cats, accs, "acc-cash");
  assert.deepEqual([a.amount, a.accountId, a.type, a.note], [50000, "acc-cash", "expense", "Donuts"]);
  assert.deepEqual([b.categoryId, b.accountId, b.type], ["cat-lainnya", "acc-bca", "expense"]);
  assert.deepEqual([c.categoryId, c.accountId, c.type, c.amount], ["cat-pemasukan-lain", "acc-bca", "income", 5000000]);
  assert.match(d.error, /tidak dikenali/);
});

test("Siklus bulanan", () => {
  assert.deepEqual(getCycleRange(25, new Date(2026, 10, 16)), { start: "2026-10-25", end: "2026-11-25", last: "2026-11-24" });
  assert.deepEqual(getCycleRange(25, new Date(2026, 10, 25)), { start: "2026-11-25", end: "2026-12-25", last: "2026-12-24" });
  assert.deepEqual(getCycleRange(1, new Date(2026, 10, 16)), { start: "2026-11-01", end: "2026-12-01", last: "2026-11-30" });
  assert.deepEqual(getCycleRange(25, new Date(2026, 0, 10)), { start: "2025-12-25", end: "2026-01-25", last: "2026-01-24" });
});
test("toDateStr memakai tanggal lokal (bukan UTC)", () => {
  assert.equal(toDateStr(new Date(2026, 10, 16, 0, 30)), "2026-11-16");
});
