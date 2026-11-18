-- ============================================================
-- Nectar Desktop — Skema MySQL/MariaDB (untuk XAMPP + phpMyAdmin)
-- Cara pakai: phpMyAdmin -> tab "Import" -> pilih file ini -> Go
-- File ini AMAN dijalankan berulang kali (tidak menghapus data).
-- ============================================================

CREATE DATABASE IF NOT EXISTS nectar_desktop
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nectar_desktop;

CREATE TABLE IF NOT EXISTS accounts (
  id            VARCHAR(40)     PRIMARY KEY,
  name          VARCHAR(100)    NOT NULL,
  shortcode     VARCHAR(20)     NOT NULL,
  type          ENUM('cash','bank','ewallet','debt') NOT NULL DEFAULT 'bank',
  balance       DECIMAL(15,2)   NOT NULL DEFAULT 0,
  color         VARCHAR(20)     NOT NULL DEFAULT '#64748b',
  is_default    BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id            VARCHAR(40)     PRIMARY KEY,
  name          VARCHAR(100)    NOT NULL,
  shortcode     VARCHAR(10)     NOT NULL,
  type          ENUM('income','expense') NOT NULL,
  color         VARCHAR(20)     NOT NULL DEFAULT '#64748b'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id                VARCHAR(40)     PRIMARY KEY,
  date              DATE            NOT NULL,
  account_id        VARCHAR(40)     NOT NULL,
  category_id       VARCHAR(40)     NOT NULL,
  amount            DECIMAL(15,2)   NOT NULL,
  note              VARCHAR(255)    NOT NULL DEFAULT '',
  type              ENUM('income','expense') NOT NULL,
  -- is_transfer = TRUE untuk transfer antar-akun DAN koreksi saldo.
  -- Baris seperti ini TIDAK dihitung sebagai pemasukan/pengeluaran di laporan.
  is_transfer       BOOLEAN         NOT NULL DEFAULT FALSE,
  -- Kedua sisi (keluar & masuk) dari satu transfer berbagi ID yang sama,
  -- supaya saat salah satu dihapus, sisi lainnya ikut terhapus.
  transfer_group_id VARCHAR(40)     NULL,
  receipt_name      VARCHAR(255)    NULL,
  receipt_data      LONGTEXT        NULL,
  receipt_is_pdf    BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id)  REFERENCES accounts(id)   ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  INDEX idx_tx_date (date),
  INDEX idx_tx_account (account_id),
  INDEX idx_tx_category (category_id),
  INDEX idx_tx_group (transfer_group_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS debts (
  id                  VARCHAR(40)   PRIMARY KEY,
  name                VARCHAR(150)  NOT NULL,
  kind                ENUM('debt','receivable') NOT NULL,
  principal           DECIMAL(15,2) NOT NULL,
  remaining           DECIMAL(15,2) NOT NULL,
  monthly_installment DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_day             TINYINT       NOT NULL DEFAULT 1,
  autopay             BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS goals (
  id          VARCHAR(40)   PRIMARY KEY,
  name        VARCHAR(150)  NOT NULL,
  target      DECIMAL(15,2) NOT NULL,
  current     DECIMAL(15,2) NOT NULL DEFAULT 0,
  deadline    DATE          NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- BARU: anggaran per kategori (dulu tidak bisa disimpan sama sekali)
CREATE TABLE IF NOT EXISTS budgets (
  category_id VARCHAR(40)   PRIMARY KEY,
  amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- BARU: pengaturan aplikasi (key-value), mis. tanggal mulai siklus bulanan
CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(50)  PRIMARY KEY,
  v VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- ============================================================
-- DATA AWAL
-- ============================================================
INSERT IGNORE INTO categories (id, name, shortcode, type, color) VALUES
  ('cat-jajan',     'Jajan',          'J',  'expense', '#f59e0b'),
  ('cat-makan',     'Makan',          'M',  'expense', '#ef4444'),
  ('cat-transport', 'Transport',      'T',  'expense', '#3b82f6'),
  ('cat-belanja',   'Belanja',        'B',  'expense', '#a855f7'),
  ('cat-tagihan',   'Tagihan',        'TG', 'expense', '#ec4899'),
  ('cat-hiburan',   'Hiburan',        'H',  'expense', '#14b8a6'),
  ('cat-lainnya',   'Lainnya',        'L',  'expense', '#64748b'),
  ('cat-gaji',      'Gaji',           'G',  'income',  '#10b981'),
  ('cat-freelance', 'Freelance',      'F',  'income',  '#06b6d4'),
  ('cat-pemasukan-lain', 'Pemasukan Lain', 'PL', 'income', '#84cc16');

-- Sama persis dengan akun awal di frontend
INSERT IGNORE INTO accounts (id, name, shortcode, type, balance, color, is_default) VALUES
  ('acc-cash',    'Cash',    'CASH',  'cash',    0, '#f59e0b', TRUE),
  ('acc-bca',     'BCA',     'BCA',   'bank',    0, '#3b82f6', FALSE),
  ('acc-mandiri', 'Mandiri', 'MDR',   'bank',    0, '#f97316', FALSE),
  ('acc-gopay',   'Gopay',   'GOPAY', 'ewallet', 0, '#22c55e', FALSE),
  ('acc-ovo',     'OVO',     'OVO',   'ewallet', 0, '#8b5cf6', FALSE);

INSERT IGNORE INTO settings (k, v) VALUES ('cycleStartDay', '1');
