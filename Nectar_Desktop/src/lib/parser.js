// Parser nominal & Command Bar.

// Mengubah teks nominal menjadi angka rupiah. Mengembalikan null jika tidak valid.
//   "50k" "50rb" -> 50000     "1jt" -> 1000000     "1,5jt" / "1.5jt" -> 1500000
//   "50.000" / "1.500.000" -> pemisah ribuan gaya Indonesia (BUKAN desimal)
//   "50000" -> 50000          "2m" -> 2000000000 (miliar)
export function parseAmountToken(tok) {
  const m = String(tok).trim().toLowerCase().match(/^(\d+(?:[.,]\d+)*)(k|rb|jt|m)?$/);
  if (!m) return null;
  const [, numStr, suffix] = m;

  let value;
  if (!suffix) {
    // Tanpa singkatan: titik/koma hanya boleh sebagai pemisah ribuan (kelompok 3 digit).
    if (/^\d+$/.test(numStr)) value = Number(numStr);
    else if (/^\d{1,3}([.,]\d{3})+$/.test(numStr)) value = Number(numStr.replace(/[.,]/g, ""));
    else return null;
  } else {
    // Dengan singkatan: satu pemisah berarti desimal ("1,5jt").
    if (/^\d+$/.test(numStr)) value = Number(numStr);
    else if (/^\d+[.,]\d+$/.test(numStr)) value = Number(numStr.replace(",", "."));
    else return null;
  }

  const multiplier = { k: 1e3, rb: 1e3, jt: 1e6, m: 1e9 }[suffix] ?? 1;
  return Math.round(value * multiplier);
}

// Untuk kolom input manual: menerima "Rp 50.000", "50000", "50k", dan "-25.000" (saldo negatif).
export function parseMoneyInput(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  let negative = false;
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  const n = parseAmountToken(s);
  if (n === null) return null;
  return negative ? -n : n;
}

// Sintaks: "<kode> <nominal> <catatan...>" dipisah ";"
//   <kode> = kode kategori (J, M, T, ...) -> dicatat ke akun default
//          = kode/nama akun (BCA, OVO, ...) -> pengeluaran "Lainnya" dari akun itu;
//            beri tanda + pada nominal (BCA +5jt Gaji) untuk PEMASUKAN.
export function parseCommandLine(line, categories, accounts, defaultAccountId) {
  const instructions = line.split(";").map((s) => s.trim()).filter(Boolean);
  const results = [];
  for (const instr of instructions) {
    const parts = instr.split(/\s+/);
    if (parts.length < 2) {
      results.push({ raw: instr, error: "Format tidak lengkap. Contoh: J 50k Donuts" });
      continue;
    }
    const [code, rawAmountTok, ...noteParts] = parts;
    const isPlus = rawAmountTok.startsWith("+");
    const amountTok = isPlus ? rawAmountTok.slice(1) : rawAmountTok;
    const amount = parseAmountToken(amountTok);
    if (amount === null || amount <= 0) {
      results.push({ raw: instr, error: "Nominal tidak valid: " + rawAmountTok });
      continue;
    }

    const upperCode = code.toUpperCase();
    const cat = categories.find((c) => c.shortcode.toUpperCase() === upperCode);
    const acc = accounts.find(
      (a) => a.shortcode.toUpperCase() === upperCode || a.name.toUpperCase() === upperCode
    );

    let category, account;
    if (cat) {
      category = cat;
      account = accounts.find((a) => a.id === defaultAccountId) || accounts[0];
    } else if (acc) {
      account = acc;
      category = categories.find((c) => c.id === (isPlus ? "cat-pemasukan-lain" : "cat-lainnya"));
    } else {
      results.push({ raw: instr, error: 'Kode "' + code + '" tidak dikenali (bukan kategori atau akun)' });
      continue;
    }
    if (!category || !account) {
      results.push({ raw: instr, error: "Data kategori/akun belum termuat" });
      continue;
    }

    results.push({
      raw: instr,
      error: null,
      amount,
      note: noteParts.join(" ") || category.name,
      categoryId: category.id,
      accountId: account.id,
      type: category.type,
    });
  }
  return results;
}
