-- Migration: create agent_errors table for structured error observability
CREATE TABLE IF NOT EXISTS agent_errors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     text        NOT NULL,
  timestamp    timestamptz NOT NULL DEFAULT now(),
  error_type   text        NOT NULL,
  error_message text       NOT NULL,
  input_payload text,
  model_response text
);

CREATE INDEX IF NOT EXISTS idx_agent_errors_agent_id  ON agent_errors (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_errors_timestamp ON agent_errors (timestamp);
