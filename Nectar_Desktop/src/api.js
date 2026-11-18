// Satu-satunya tempat frontend berbicara dengan backend.
// Alamat diatur di file .env frontend (VITE_API_URL), lihat .env.example.
const BASE = (import.meta.env?.VITE_API_URL || "http://127.0.0.1:4000/api").replace(/\/$/, "");
const API_KEY = import.meta.env?.VITE_API_KEY || "";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (API_KEY) headers["x-api-key"] = API_KEY;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Tidak bisa terhubung ke server. Pastikan MySQL di XAMPP sudah Start dan backend sudah jalan (npm run dev)."
    );
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || `Server error (${res.status})`, res.status);
  return data;
}

const get = (p) => request("GET", p);
const post = (p, b) => request("POST", p, b ?? {});
const patch = (p, b) => request("PATCH", p, b ?? {});
const put = (p, b) => request("PUT", p, b ?? {});
const del = (p) => request("DELETE", p);

export const api = {
  health: () => get("/health"),
  accounts: {
    list: () => get("/accounts"),
    create: (a) => post("/accounts", a),
    update: (id, fields) => patch(`/accounts/${id}`, fields),
    remove: (id) => del(`/accounts/${id}`),
  },
  categories: { list: () => get("/categories") },
  transactions: {
    list: () => get("/transactions"),
    receipt: (id) => get(`/transactions/${id}/receipt`),
    create: (t) => post("/transactions", t),
    bulk: (transactions) => post("/transactions/bulk", { transactions }),
    transfer: (fromAccountId, toAccountId, amount) =>
      post("/transactions/transfer", { fromAccountId, toAccountId, amount }),
    remove: (id) => del(`/transactions/${id}`),
  },
  debts: {
    list: () => get("/debts"),
    create: (d) => post("/debts", d),
    pay: (id, accountId) => patch(`/debts/${id}/pay`, { accountId }),
    remove: (id) => del(`/debts/${id}`),
  },
  goals: {
    list: () => get("/goals"),
    create: (g) => post("/goals", g),
    fund: (id, amount) => patch(`/goals/${id}/fund`, { amount }),
    remove: (id) => del(`/goals/${id}`),
  },
  budgets: {
    list: () => get("/budgets"),
    set: (categoryId, amount) => put(`/budgets/${categoryId}`, { amount }),
  },
  settings: {
    get: () => get("/settings"),
    update: (s) => put("/settings", s),
  },
};
