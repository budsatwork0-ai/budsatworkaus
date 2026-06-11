-- Migration: 023_payouts
-- Creates a payouts table to track Stripe payouts to the NAB business bank account.
-- Populated by payout.created / payout.paid / payout.failed webhook events.

CREATE TABLE IF NOT EXISTS payouts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payout_id  TEXT        UNIQUE NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'aud',
  status            TEXT        NOT NULL,   -- 'pending' | 'paid' | 'failed' | 'canceled'
  arrival_date      TIMESTAMPTZ,            -- when funds are expected to / did land in NAB
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  description       TEXT,
  failure_code      TEXT,
  failure_message   TEXT
);

CREATE INDEX idx_payouts_status       ON payouts(status);
CREATE INDEX idx_payouts_arrival_date ON payouts(arrival_date);
CREATE INDEX idx_payouts_created_at   ON payouts(created_at DESC);
