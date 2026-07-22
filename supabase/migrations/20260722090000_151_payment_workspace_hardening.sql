-- Payment workspace hardening. All validation is fail-closed: ambiguous financial
-- records are reported and must be repaired deliberately before this migration runs.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'aud',
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_event_id text;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_environment_check,
  ADD CONSTRAINT payments_environment_check CHECK (environment IN ('production', 'sandbox')),
  DROP CONSTRAINT IF EXISTS payments_payment_provider_check,
  ADD CONSTRAINT payments_payment_provider_check CHECK (payment_provider IN ('manual', 'stripe', 'paypal'));

DO $$
DECLARE details text;
BEGIN
  SELECT string_agg(format('quote_id=%s orders=%s statuses=%s environments=%s', quote_id, order_ids, statuses, environments), '; ')
    INTO details
  FROM (
    SELECT quote_id, array_agg(id ORDER BY id) order_ids,
           array_agg(status ORDER BY id) statuses,
           array_agg(environment ORDER BY id) environments
    FROM public.orders WHERE quote_id IS NOT NULL GROUP BY quote_id HAVING count(*) > 1
  ) duplicates;
  IF details IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce one order per quote; duplicate orders require manual audit: %', details;
  END IF;

  SELECT string_agg(format('order=%s customer=%s order_environment=%s customer_environment=%s',
                           p.order_id, p.customer_id, o.environment, c.environment), '; ')
    INTO details
  FROM public.payments p
  JOIN public.orders o ON o.id = p.order_id
  JOIN public.customers c ON c.id = p.customer_id
  WHERE o.environment IS DISTINCT FROM c.environment;
  IF details IS NOT NULL THEN
    RAISE EXCEPTION 'Payment parent workspace mismatch requires manual repair: %', details;
  END IF;
END $$;

UPDATE public.payments p SET environment = o.environment
FROM public.orders o WHERE p.order_id = o.id;

UPDATE public.payments p SET environment = c.environment
FROM public.customers c WHERE p.order_id IS NULL AND p.customer_id = c.id;

-- This is the only reliable legacy inference available without external audit data.
UPDATE public.payments SET payment_provider = 'stripe'
WHERE payment_provider = 'manual' AND payment_reference ~ '^pi_[A-Za-z0-9_]+$';

DO $$
DECLARE details text;
BEGIN
  SELECT string_agg(format('%s/%s ids=%s', payment_provider, payment_reference, ids), '; ')
    INTO details
  FROM (
    SELECT payment_provider, payment_reference, array_agg(id ORDER BY id) ids
    FROM public.payments WHERE payment_reference IS NOT NULL
    GROUP BY payment_provider, payment_reference HAVING count(*) > 1
  ) duplicates;
  IF details IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate payment provider references require manual audit: %', details;
  END IF;

  SELECT string_agg(format('%s/%s ids=%s', payment_provider, provider_event_id, ids), '; ')
    INTO details
  FROM (
    SELECT payment_provider, provider_event_id, array_agg(id ORDER BY id) ids
    FROM public.payments WHERE provider_event_id IS NOT NULL
    GROUP BY payment_provider, provider_event_id HAVING count(*) > 1
  ) duplicates;
  IF details IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate payment provider event IDs require manual audit: %', details;
  END IF;

  SELECT string_agg(format('%s/order=%s ids=%s', payment_provider, order_id, ids), '; ')
    INTO details
  FROM (
    SELECT payment_provider, order_id, array_agg(id ORDER BY id) ids
    FROM public.payments
    WHERE order_id IS NOT NULL AND payment_provider IN ('stripe', 'paypal')
    GROUP BY payment_provider, order_id HAVING count(*) > 1
  ) duplicates;
  IF details IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate provider payments per order require manual audit: %', details;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_environment ON public.payments(environment);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_reference_unique
  ON public.payments(payment_provider, payment_reference) WHERE payment_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_event_unique
  ON public.payments(payment_provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_quote_id_unique
  ON public.orders(quote_id) WHERE quote_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_unique
  ON public.payments(payment_provider, order_id)
  WHERE order_id IS NOT NULL AND payment_provider IN ('stripe', 'paypal');

CREATE OR REPLACE FUNCTION public.validate_payment_workspace()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_environment text; customer_environment text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.environment IS DISTINCT FROM OLD.environment THEN
    RAISE EXCEPTION 'Payment environment cannot be reclassified';
  END IF;
  IF NEW.subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'Subscription-linked payments are not Workspace-safe until subscriptions are migrated';
  END IF;
  IF NEW.order_id IS NOT NULL THEN
    SELECT environment INTO order_environment FROM public.orders WHERE id = NEW.order_id;
    IF order_environment IS NULL THEN RAISE EXCEPTION 'Payment order does not exist'; END IF;
    IF NEW.environment IS NOT NULL AND NEW.environment <> 'production' AND NEW.environment <> order_environment THEN
      RAISE EXCEPTION 'Payment environment conflicts with order workspace';
    END IF;
    NEW.environment := order_environment;
  END IF;
  IF NEW.customer_id IS NOT NULL THEN
    SELECT environment INTO customer_environment FROM public.customers WHERE id = NEW.customer_id;
    IF customer_environment IS NULL THEN RAISE EXCEPTION 'Payment customer does not exist'; END IF;
    IF order_environment IS NOT NULL AND order_environment <> customer_environment THEN
      RAISE EXCEPTION 'Payment customer and order belong to different workspaces';
    END IF;
    IF NEW.order_id IS NULL THEN
      IF NEW.environment IS NOT NULL AND NEW.environment <> 'production' AND NEW.environment <> customer_environment THEN
        RAISE EXCEPTION 'Payment environment conflicts with customer workspace';
      END IF;
      NEW.environment := customer_environment;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payments_validate_workspace ON public.payments;
CREATE TRIGGER trg_payments_validate_workspace
BEFORE INSERT OR UPDATE OF order_id, customer_id, subscription_id, environment ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_workspace();

CREATE TABLE IF NOT EXISTS public.payment_provider_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  environment text NOT NULL CHECK (environment IN ('production', 'sandbox')),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'manual')),
  object_type text NOT NULL CHECK (object_type IN ('checkout_session', 'payment_intent', 'charge', 'paypal_order', 'paypal_capture')),
  object_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_objects_identity_unique UNIQUE (provider, object_type, object_id),
  CONSTRAINT payment_provider_objects_payment_type_unique UNIQUE (payment_id, provider, object_type)
);
CREATE INDEX IF NOT EXISTS idx_payment_provider_objects_payment_id
  ON public.payment_provider_objects(payment_id);

CREATE OR REPLACE FUNCTION public.validate_payment_provider_object()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_environment text; parent_provider text;
BEGIN
  SELECT environment, payment_provider INTO parent_environment, parent_provider
  FROM public.payments WHERE id = NEW.payment_id;
  IF parent_environment IS NULL THEN RAISE EXCEPTION 'Provider object payment does not exist'; END IF;
  IF NEW.environment <> parent_environment THEN RAISE EXCEPTION 'Provider object workspace mismatch'; END IF;
  IF NEW.provider <> parent_provider THEN RAISE EXCEPTION 'Provider object provider mismatch'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.payment_id IS DISTINCT FROM OLD.payment_id
      OR NEW.environment IS DISTINCT FROM OLD.environment
      OR NEW.provider IS DISTINCT FROM OLD.provider
      OR NEW.object_type IS DISTINCT FROM OLD.object_type
      OR NEW.object_id IS DISTINCT FROM OLD.object_id) THEN
    RAISE EXCEPTION 'Provider object mapping cannot be rewritten';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_provider_objects_validate
BEFORE INSERT OR UPDATE ON public.payment_provider_objects
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_provider_object();

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  environment text CHECK (environment IN ('production', 'sandbox')),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'manual')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_object_type text,
  provider_object_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'quarantined')),
  failure_reason text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_event_unique UNIQUE (provider, provider_event_id),
  CONSTRAINT payment_events_resolution_consistent CHECK (
    (payment_id IS NULL AND environment IS NULL) OR (payment_id IS NOT NULL AND environment IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events(payment_id);

CREATE OR REPLACE FUNCTION public.create_or_get_pending_payment(
  pending_provider text, pending_order_id uuid, pending_customer_id uuid,
  pending_amount numeric, pending_currency text, pending_environment text
) RETURNS public.payments LANGUAGE plpgsql AS $$
DECLARE parent_environment text; customer_environment text; result public.payments%ROWTYPE;
BEGIN
  SELECT environment INTO parent_environment FROM public.orders WHERE id = pending_order_id FOR UPDATE;
  IF parent_environment IS NULL THEN RAISE EXCEPTION 'Payment order does not exist'; END IF;
  IF parent_environment <> pending_environment THEN RAISE EXCEPTION 'Payment workspace mismatch'; END IF;
  IF pending_customer_id IS NOT NULL THEN
    SELECT environment INTO customer_environment FROM public.customers WHERE id = pending_customer_id;
    IF customer_environment IS NULL OR customer_environment <> parent_environment THEN
      RAISE EXCEPTION 'Payment customer workspace mismatch';
    END IF;
  END IF;
  INSERT INTO public.payments (order_id, customer_id, amount, currency, payment_method,
    payment_provider, status, environment)
  VALUES (pending_order_id, pending_customer_id, pending_amount, lower(pending_currency),
    CASE WHEN pending_provider = 'stripe' THEN 'card' ELSE 'other' END,
    pending_provider, 'pending', pending_environment)
  ON CONFLICT DO NOTHING
  RETURNING * INTO result;
  IF result.id IS NULL THEN
    SELECT * INTO result FROM public.payments
    WHERE payment_provider = pending_provider AND order_id = pending_order_id;
    IF result.environment <> pending_environment OR result.customer_id IS DISTINCT FROM pending_customer_id
       OR result.amount <> pending_amount OR lower(result.currency) <> lower(pending_currency) THEN
      RAISE EXCEPTION 'Existing payment conflicts with checkout';
    END IF;
  END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.attach_payment_provider_object(
  mapping_payment_id uuid, mapping_expected_environment text, mapping_provider text,
  mapping_object_type text, mapping_object_id text
) RETURNS public.payment_provider_objects LANGUAGE plpgsql AS $$
DECLARE captured public.payments%ROWTYPE; result public.payment_provider_objects%ROWTYPE;
BEGIN
  SELECT * INTO captured FROM public.payments WHERE id = mapping_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment mapping not found'; END IF;
  IF captured.environment <> mapping_expected_environment THEN RAISE EXCEPTION 'Payment workspace mismatch'; END IF;
  IF captured.payment_provider <> mapping_provider THEN RAISE EXCEPTION 'Payment provider mismatch'; END IF;
  INSERT INTO public.payment_provider_objects (payment_id, environment, provider, object_type, object_id)
  VALUES (captured.id, captured.environment, mapping_provider, mapping_object_type, mapping_object_id)
  ON CONFLICT DO NOTHING RETURNING * INTO result;
  IF result.id IS NULL THEN
    SELECT * INTO result FROM public.payment_provider_objects
    WHERE provider = mapping_provider AND object_type = mapping_object_type
      AND object_id = mapping_object_id;
    IF result.id IS NULL OR result.payment_id <> captured.id OR result.environment <> captured.environment THEN
      RAISE EXCEPTION 'Provider object mapping conflicts with durable payment';
    END IF;
  END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.claim_payment_event(
  event_provider text, event_provider_id text, event_type_value text,
  event_object_type text DEFAULT NULL, event_object_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result public.payment_events%ROWTYPE; claimed boolean := false;
BEGIN
  INSERT INTO public.payment_events (provider, provider_event_id, event_type,
    provider_object_type, provider_object_id, status)
  VALUES (event_provider, event_provider_id, event_type_value,
    event_object_type, event_object_id, 'pending')
  ON CONFLICT DO NOTHING RETURNING * INTO result;
  IF result.id IS NOT NULL THEN claimed := true; END IF;
  IF result.id IS NULL THEN
    SELECT * INTO result FROM public.payment_events
    WHERE provider = event_provider AND provider_event_id = event_provider_id FOR UPDATE;
    IF result.event_type <> event_type_value THEN RAISE EXCEPTION 'Event replay type mismatch'; END IF;
    IF result.status = 'failed' THEN
      UPDATE public.payment_events SET status = 'pending', failure_reason = NULL, updated_at = now()
      WHERE id = result.id RETURNING * INTO result;
      claimed := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('event', to_jsonb(result), 'claimed', claimed);
END $$;

CREATE OR REPLACE FUNCTION public.finish_payment_event(
  event_row_id uuid, event_status text, resolved_payment_id uuid DEFAULT NULL,
  event_failure_reason text DEFAULT NULL
) RETURNS public.payment_events LANGUAGE plpgsql AS $$
DECLARE result public.payment_events%ROWTYPE; payment_environment text;
BEGIN
  IF event_status NOT IN ('processed', 'failed', 'quarantined') THEN RAISE EXCEPTION 'Invalid terminal event status'; END IF;
  IF resolved_payment_id IS NOT NULL THEN
    SELECT environment INTO payment_environment FROM public.payments WHERE id = resolved_payment_id;
    IF payment_environment IS NULL THEN RAISE EXCEPTION 'Resolved payment does not exist'; END IF;
  END IF;
  UPDATE public.payment_events SET payment_id = COALESCE(payment_id, resolved_payment_id),
    environment = COALESCE(environment, payment_environment), status = event_status,
    failure_reason = event_failure_reason,
    processed_at = CASE WHEN event_status = 'processed' THEN now() ELSE processed_at END,
    updated_at = now()
  WHERE id = event_row_id
    AND (payment_id IS NULL OR payment_id = resolved_payment_id)
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Event payment resolution conflict'; END IF;
  RETURN result;
END $$;

-- Refunds are append-only financial events. Provider identifiers on the captured
-- payment remain untouched; each provider refund/event receives its own replay key.
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  environment text NOT NULL,
  provider text NOT NULL,
  provider_refund_reference text NOT NULL,
  provider_event_reference text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  reason text,
  provider_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_refunds_environment_check CHECK (environment IN ('production', 'sandbox')),
  CONSTRAINT payment_refunds_provider_check CHECK (provider IN ('stripe', 'paypal', 'manual')),
  CONSTRAINT payment_refunds_currency_lowercase CHECK (currency = lower(currency)),
  CONSTRAINT payment_refunds_provider_refund_unique UNIQUE (provider, provider_refund_reference)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_provider_event_unique
  ON public.payment_refunds(provider, provider_event_reference)
  WHERE provider_event_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_id
  ON public.payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_environment
  ON public.payment_refunds(environment);

-- A provider refund can be observed through more than one webhook event. Keep
-- every event replay key without replacing the refund's first durable reference.
CREATE TABLE IF NOT EXISTS public.payment_refund_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_refund_id uuid NOT NULL REFERENCES public.payment_refunds(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_event_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_refund_events_provider_check CHECK (provider IN ('stripe', 'paypal', 'manual')),
  CONSTRAINT payment_refund_events_provider_event_unique UNIQUE (provider, provider_event_reference)
);
CREATE INDEX IF NOT EXISTS idx_payment_refund_events_refund_id
  ON public.payment_refund_events(payment_refund_id);

CREATE OR REPLACE FUNCTION public.validate_payment_refund_workspace()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment_environment text; payment_provider text;
BEGIN
  SELECT environment, payments.payment_provider
    INTO payment_environment, payment_provider
  FROM public.payments WHERE id = NEW.payment_id;
  IF payment_environment IS NULL THEN
    RAISE EXCEPTION 'Refund payment does not exist';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.payment_id IS DISTINCT FROM OLD.payment_id
      OR NEW.environment IS DISTINCT FROM OLD.environment
      OR NEW.provider IS DISTINCT FROM OLD.provider
      OR NEW.provider_refund_reference IS DISTINCT FROM OLD.provider_refund_reference
      OR NEW.provider_event_reference IS DISTINCT FROM OLD.provider_event_reference
      OR NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.currency IS DISTINCT FROM OLD.currency) THEN
    RAISE EXCEPTION 'Refund financial identity cannot be rewritten';
  END IF;
  IF NEW.environment <> payment_environment THEN
    RAISE EXCEPTION 'Refund environment conflicts with payment workspace';
  END IF;
  IF NEW.provider <> payment_provider THEN
    RAISE EXCEPTION 'Refund provider conflicts with captured payment';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_refunds_validate_workspace ON public.payment_refunds;
CREATE TRIGGER trg_payment_refunds_validate_workspace
BEFORE INSERT OR UPDATE ON public.payment_refunds
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_refund_workspace();

CREATE OR REPLACE FUNCTION public.record_payment_refund(
  refund_payment_id uuid,
  refund_expected_environment text,
  refund_provider text,
  refund_provider_reference text,
  refund_provider_event_reference text,
  refund_amount numeric,
  refund_currency text,
  refund_status text,
  refund_reason text DEFAULT NULL,
  refund_provider_created_at timestamptz DEFAULT NULL
) RETURNS public.payment_refunds
LANGUAGE plpgsql
AS $$
DECLARE
  captured public.payments%ROWTYPE;
  recorded public.payment_refunds%ROWTYPE;
  total_succeeded numeric;
  replay_refund_id uuid;
BEGIN
  SELECT * INTO captured FROM public.payments
  WHERE id = refund_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment mapping not found'; END IF;
  IF captured.environment <> refund_expected_environment THEN
    RAISE EXCEPTION 'Payment workspace mismatch';
  END IF;
  IF captured.payment_provider <> refund_provider THEN
    RAISE EXCEPTION 'Refund provider mismatch';
  END IF;
  IF lower(captured.currency) <> lower(refund_currency) THEN
    RAISE EXCEPTION 'Refund currency mismatch';
  END IF;
  IF captured.status NOT IN ('completed', 'partial_refund', 'refunded') THEN
    RAISE EXCEPTION 'Payment is not refundable in status %', captured.status;
  END IF;
  IF refund_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
  IF refund_status NOT IN ('pending', 'succeeded', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid refund status';
  END IF;

  INSERT INTO public.payment_refunds (
    payment_id, environment, provider, provider_refund_reference,
    provider_event_reference, amount, currency, status, reason, provider_created_at
  ) VALUES (
    captured.id, captured.environment, refund_provider, refund_provider_reference,
    refund_provider_event_reference, refund_amount, lower(refund_currency), refund_status,
    refund_reason, refund_provider_created_at
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO recorded;

  IF recorded.id IS NULL THEN
    SELECT * INTO recorded FROM public.payment_refunds
    WHERE provider = refund_provider
      AND (provider_refund_reference = refund_provider_reference
        OR (refund_provider_event_reference IS NOT NULL
          AND provider_event_reference = refund_provider_event_reference))
    ORDER BY (provider_refund_reference = refund_provider_reference) DESC
    LIMIT 1;
    IF recorded.id IS NULL THEN
      RAISE EXCEPTION 'Refund replay key conflicts with another durable record';
    END IF;
    IF recorded.payment_id <> captured.id
       OR recorded.environment <> captured.environment
       OR recorded.amount <> refund_amount
       OR recorded.currency <> lower(refund_currency)
       OR recorded.provider_refund_reference <> refund_provider_reference THEN
      RAISE EXCEPTION 'Refund replay conflicts with durable record';
    END IF;
    -- Out-of-order delivery may advance a pending refund, but terminal provider
    -- outcomes are never rewritten by a stale event.
    IF recorded.status = 'pending' AND refund_status <> 'pending' THEN
      UPDATE public.payment_refunds SET status = refund_status,
        reason = COALESCE(refund_reason, reason), updated_at = now()
      WHERE id = recorded.id RETURNING * INTO recorded;
    END IF;
  END IF;

  IF refund_provider_event_reference IS NOT NULL THEN
    INSERT INTO public.payment_refund_events (
      payment_refund_id, provider, provider_event_reference
    ) VALUES (
      recorded.id, refund_provider, refund_provider_event_reference
    ) ON CONFLICT DO NOTHING;
    SELECT payment_refund_id INTO replay_refund_id
    FROM public.payment_refund_events
    WHERE provider = refund_provider
      AND provider_event_reference = refund_provider_event_reference;
    IF replay_refund_id IS DISTINCT FROM recorded.id THEN
      RAISE EXCEPTION 'Refund event replay conflicts with another durable refund';
    END IF;
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO total_succeeded
  FROM public.payment_refunds
  WHERE payment_id = captured.id AND status = 'succeeded';
  IF total_succeeded > captured.amount THEN
    RAISE EXCEPTION 'Cumulative successful refunds exceed captured payment amount';
  END IF;

  UPDATE public.payments
  SET status = CASE
    WHEN total_succeeded = captured.amount THEN 'refunded'
    WHEN total_succeeded > 0 THEN 'partial_refund'
    ELSE captured.status
  END,
  updated_at = now()
  WHERE id = captured.id;
  RETURN recorded;
END $$;
