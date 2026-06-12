-- Migration 128: Add is_test column to business tables + propagation triggers
-- Allows test/seed data to coexist with production data.
-- Business reporting excludes is_test=true by default.
-- Dashboards can opt-in via ?show_test_data=1.

ALTER TABLE customers          ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE quotes             ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads              ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lead_conversations ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversations      ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages           ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ratings            ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- Partial indexes — test records are the minority; these keep production queries fast
CREATE INDEX IF NOT EXISTS idx_customers_is_test      ON customers(is_test)           WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_quotes_is_test          ON quotes(is_test)              WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_orders_is_test          ON orders(is_test)              WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_leads_is_test           ON leads(is_test)               WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_ratings_is_test         ON ratings(is_test)             WHERE is_test = true;

-- Propagation: lead_conversation inherits is_test from parent lead
CREATE OR REPLACE FUNCTION propagate_lead_conversation_test_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_test = false THEN
    SELECT is_test INTO NEW.is_test FROM leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_conversation_inherit_test ON lead_conversations;
CREATE TRIGGER trg_lead_conversation_inherit_test
  BEFORE INSERT ON lead_conversations
  FOR EACH ROW EXECUTE FUNCTION propagate_lead_conversation_test_flag();

-- Propagation: order inherits is_test from source quote
CREATE OR REPLACE FUNCTION propagate_order_test_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_test = false AND NEW.quote_id IS NOT NULL THEN
    SELECT is_test INTO NEW.is_test FROM quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_inherit_test ON orders;
CREATE TRIGGER trg_order_inherit_test
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION propagate_order_test_flag();

-- Propagation: message inherits is_test from parent conversation
CREATE OR REPLACE FUNCTION propagate_message_test_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_test = false THEN
    SELECT is_test INTO NEW.is_test FROM conversations WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_inherit_test ON messages;
CREATE TRIGGER trg_message_inherit_test
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION propagate_message_test_flag();
