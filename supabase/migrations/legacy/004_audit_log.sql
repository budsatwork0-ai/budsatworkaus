-- Audit log table for tracking financial operations
-- Provides a tamper-evident trail of order, payment, and refund events

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,  -- 'order', 'payment', 'subscription'
  entity_id text NOT NULL,
  action text NOT NULL,       -- 'created', 'payment_received', 'status_changed', 'refunded'
  old_value jsonb,
  new_value jsonb,
  source text,                -- 'checkout', 'webhook', 'api', 'admin'
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);

-- Comment for documentation
COMMENT ON TABLE audit_log IS 'Immutable audit trail for financial events (orders, payments, refunds)';
COMMENT ON COLUMN audit_log.entity_type IS 'The type of entity affected: order, payment, subscription';
COMMENT ON COLUMN audit_log.entity_id IS 'The UUID of the affected entity';
COMMENT ON COLUMN audit_log.action IS 'What happened: created, payment_received, status_changed, refunded';
COMMENT ON COLUMN audit_log.source IS 'What triggered this event: checkout, webhook, api, admin';
