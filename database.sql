-- MicroEarn Cloudflare D1 Database Schema
-- SQLite compatible schema for Telegram Mini App earning platform

-- ====================================
-- USERS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    balance REAL DEFAULT 0.00,
    total_earned REAL DEFAULT 0.00,
    referral_code TEXT NOT NULL UNIQUE,
    referred_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);

-- ====================================
-- EARNINGS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    telegram_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'DAILY', 'AD', 'SURVEY', 'REFERRAL'
    amount REAL NOT NULL,
    source TEXT, -- External offer ID or reference
    metadata TEXT, -- JSON string for additional data
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_earnings_user_id ON earnings(user_id);
CREATE INDEX idx_earnings_telegram_id ON earnings(telegram_id);
CREATE INDEX idx_earnings_type ON earnings(type);
CREATE INDEX idx_earnings_created_at ON earnings(created_at);

-- ====================================
-- WITHDRAWALS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    telegram_id INTEGER NOT NULL,
    username TEXT,
    amount REAL NOT NULL,
    method TEXT NOT NULL, -- 'bKash', 'Nagad', 'Rocket'
    account TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    admin_note TEXT,
    processed_by TEXT,
    processed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_telegram_id ON withdrawals(telegram_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at);

-- ====================================
-- REFERRALS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referrer_telegram_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    referred_telegram_id INTEGER NOT NULL,
    bonus_amount REAL DEFAULT 0.00,
    bonus_paid INTEGER DEFAULT 0, -- 0 = no, 1 = yes
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(referrer_id, referred_id)
);

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX idx_referrals_bonus_paid ON referrals(bonus_paid);

-- ====================================
-- FRAUD LOGS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS fraud_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    fraud_type TEXT NOT NULL, -- 'DUPLICATE_DAILY', 'DUPLICATE_OFFER', 'FAKE_CALLBACK', 'SELF_REFERRAL'
    details TEXT, -- JSON string with additional information
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_fraud_logs_telegram_id ON fraud_logs(telegram_id);
CREATE INDEX idx_fraud_logs_fraud_type ON fraud_logs(fraud_type);
CREATE INDEX idx_fraud_logs_created_at ON fraud_logs(created_at);

-- ====================================
-- ADMIN ACTIONS TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL, -- 'APPROVE_WITHDRAWAL', 'REJECT_WITHDRAWAL', 'RESET_BALANCE', 'LOGIN'
    target_telegram_id INTEGER,
    details TEXT, -- JSON string with action details
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at);

-- ====================================
-- DAILY CLAIMS TABLE
-- ====================================
-- Tracks daily income claims to prevent abuse
CREATE TABLE IF NOT EXISTS daily_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    telegram_id INTEGER NOT NULL,
    claim_date TEXT NOT NULL, -- Date in YYYY-MM-DD format
    amount REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(telegram_id, claim_date)
);

CREATE INDEX idx_daily_claims_telegram_id ON daily_claims(telegram_id);
CREATE INDEX idx_daily_claims_claim_date ON daily_claims(claim_date);

-- ====================================
-- OFFER COMPLETIONS TABLE
-- ====================================
-- Tracks completed offers to prevent duplicate rewards
CREATE TABLE IF NOT EXISTS offer_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    telegram_id INTEGER NOT NULL,
    offer_id TEXT NOT NULL,
    offer_type TEXT NOT NULL, -- 'AD', 'SURVEY'
    amount REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(telegram_id, offer_id)
);

CREATE INDEX idx_offer_completions_telegram_id ON offer_completions(telegram_id);
CREATE INDEX idx_offer_completions_offer_id ON offer_completions(offer_id);

-- ====================================
-- ADMIN SESSIONS TABLE
-- ====================================
-- Stores admin authentication tokens
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- ====================================
-- INITIAL DATA (OPTIONAL)
-- ====================================
-- You can insert initial test data here if needed

-- Example: Insert a test user (uncomment if needed)
-- INSERT INTO users (telegram_id, username, first_name, referral_code)
-- VALUES (123456789, 'testuser', 'Test User', 'TEST001');
