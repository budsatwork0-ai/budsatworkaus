-- A charge.refunded delivery can contain multiple refunds. The delivery itself
-- is deduplicated in payment_events; this join records every refund observed in it.
DROP INDEX IF EXISTS public.idx_payment_refunds_provider_event_unique;
ALTER TABLE public.payment_refund_events
  DROP CONSTRAINT IF EXISTS payment_refund_events_provider_event_unique;
ALTER TABLE public.payment_refund_events
  ADD CONSTRAINT payment_refund_events_refund_event_unique
  UNIQUE (payment_refund_id, provider, provider_event_reference);

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
) RETURNS public.payment_refunds LANGUAGE plpgsql AS $$
DECLARE captured public.payments%ROWTYPE; recorded public.payment_refunds%ROWTYPE; total_succeeded numeric;
BEGIN
  SELECT * INTO captured FROM public.payments WHERE id = refund_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment mapping not found'; END IF;
  IF captured.environment <> refund_expected_environment THEN RAISE EXCEPTION 'Payment workspace mismatch'; END IF;
  IF captured.payment_provider <> refund_provider THEN RAISE EXCEPTION 'Refund provider mismatch'; END IF;
  IF lower(captured.currency) <> lower(refund_currency) THEN RAISE EXCEPTION 'Refund currency mismatch'; END IF;
  IF captured.status NOT IN ('completed', 'partial_refund', 'refunded') THEN
    RAISE EXCEPTION 'Payment is not refundable in status %', captured.status;
  END IF;
  IF refund_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
  IF refund_status NOT IN ('pending', 'succeeded', 'failed', 'cancelled') THEN RAISE EXCEPTION 'Invalid refund status'; END IF;

  INSERT INTO public.payment_refunds (payment_id, environment, provider,
    provider_refund_reference, provider_event_reference, amount, currency,
    status, reason, provider_created_at)
  VALUES (captured.id, captured.environment, refund_provider,
    refund_provider_reference, refund_provider_event_reference, refund_amount,
    lower(refund_currency), refund_status, refund_reason, refund_provider_created_at)
  ON CONFLICT DO NOTHING RETURNING * INTO recorded;
  IF recorded.id IS NULL THEN
    SELECT * INTO recorded FROM public.payment_refunds
    WHERE provider = refund_provider AND provider_refund_reference = refund_provider_reference;
    IF recorded.id IS NULL OR recorded.payment_id <> captured.id
       OR recorded.environment <> captured.environment OR recorded.amount <> refund_amount
       OR recorded.currency <> lower(refund_currency) THEN
      RAISE EXCEPTION 'Refund replay conflicts with durable record';
    END IF;
    IF recorded.status = 'pending' AND refund_status <> 'pending' THEN
      UPDATE public.payment_refunds SET status = refund_status,
        reason = COALESCE(refund_reason, reason), updated_at = now()
      WHERE id = recorded.id RETURNING * INTO recorded;
    END IF;
  END IF;
  IF refund_provider_event_reference IS NOT NULL THEN
    INSERT INTO public.payment_refund_events
      (payment_refund_id, provider, provider_event_reference)
    VALUES (recorded.id, refund_provider, refund_provider_event_reference)
    ON CONFLICT DO NOTHING;
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO total_succeeded FROM public.payment_refunds
  WHERE payment_id = captured.id AND status = 'succeeded';
  IF total_succeeded > captured.amount THEN
    RAISE EXCEPTION 'Cumulative successful refunds exceed captured payment amount';
  END IF;
  UPDATE public.payments SET status = CASE
    WHEN total_succeeded = captured.amount THEN 'refunded'
    WHEN total_succeeded > 0 THEN 'partial_refund' ELSE captured.status END,
    updated_at = now() WHERE id = captured.id;
  RETURN recorded;
END $$;

CREATE OR REPLACE FUNCTION public.attach_payment_stripe_customer(
  customer_payment_id uuid, customer_expected_environment text, stripe_customer_id text
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE payment public.payments%ROWTYPE; existing_customer_id text;
BEGIN
  SELECT * INTO payment FROM public.payments WHERE id = customer_payment_id FOR UPDATE;
  IF NOT FOUND OR payment.environment <> customer_expected_environment THEN RAISE EXCEPTION 'Payment workspace mismatch'; END IF;
  IF payment.customer_id IS NULL THEN RETURN false; END IF;
  SELECT customers.stripe_customer_id INTO existing_customer_id FROM public.customers
  WHERE id = payment.customer_id AND environment = payment.environment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment customer workspace mismatch'; END IF;
  IF existing_customer_id IS NOT NULL AND existing_customer_id <> stripe_customer_id THEN
    RAISE EXCEPTION 'Stripe customer mapping conflict';
  END IF;
  UPDATE public.customers SET stripe_customer_id = attach_payment_stripe_customer.stripe_customer_id
  WHERE id = payment.customer_id AND environment = payment.environment AND customers.stripe_customer_id IS NULL;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.transition_operational_payment(
  transition_payment_id uuid, transition_expected_environment text,
  transition_kind text, transition_reference text, transition_amount numeric,
  transition_currency text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE payment public.payments%ROWTYPE; parent_order public.orders%ROWTYPE;
  parent_quote public.quotes%ROWTYPE; changed boolean := false;
BEGIN
  SELECT * INTO payment FROM public.payments WHERE id = transition_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment mapping not found'; END IF;
  IF payment.environment <> transition_expected_environment THEN RAISE EXCEPTION 'Payment workspace mismatch'; END IF;
  IF payment.payment_provider <> 'stripe' THEN RAISE EXCEPTION 'Payment provider mismatch'; END IF;
  IF payment.amount <> transition_amount THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  IF lower(payment.currency) <> lower(transition_currency) THEN RAISE EXCEPTION 'Payment currency mismatch'; END IF;
  SELECT * INTO parent_order FROM public.orders WHERE id = payment.order_id FOR UPDATE;
  IF parent_order.id IS NULL OR parent_order.environment <> payment.environment THEN RAISE EXCEPTION 'Payment order workspace mismatch'; END IF;
  IF parent_order.quote_id IS NOT NULL THEN
    SELECT * INTO parent_quote FROM public.quotes WHERE id = parent_order.quote_id FOR UPDATE;
    IF parent_quote.id IS NULL OR parent_quote.environment <> payment.environment
       OR parent_quote.converted_order_id IS DISTINCT FROM parent_order.id THEN
      RAISE EXCEPTION 'Payment quote relationship mismatch';
    END IF;
  END IF;
  IF transition_kind = 'succeeded' THEN
    IF parent_quote.id IS NOT NULL AND parent_quote.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled quote cannot be revived'; END IF;
    IF payment.payment_reference IS NOT NULL AND payment.payment_reference <> transition_reference THEN
      RAISE EXCEPTION 'Payment reference mismatch';
    END IF;
    IF payment.status NOT IN ('completed', 'partial_refund', 'refunded') THEN
      UPDATE public.payments SET status = 'completed', payment_reference = transition_reference,
        paid_at = COALESCE(paid_at, now()), updated_at = now() WHERE id = payment.id;
      UPDATE public.orders SET status = 'confirmed', stripe_payment_intent_id = transition_reference,
        updated_at = now() WHERE id = parent_order.id;
      IF parent_quote.id IS NOT NULL THEN
        UPDATE public.quotes SET status = 'paid', payment_status = 'paid',
          paid_at = COALESCE(paid_at, now()), stripe_payment_intent_id = transition_reference,
          converted_order_id = parent_order.id, updated_at = now() WHERE id = parent_quote.id;
      END IF;
      changed := true;
    END IF;
  ELSIF transition_kind = 'failed' THEN
    IF payment.status NOT IN ('completed', 'partial_refund', 'refunded', 'failed') THEN
      UPDATE public.payments SET status = 'failed', updated_at = now() WHERE id = payment.id;
      UPDATE public.orders SET status = 'failed', updated_at = now()
        WHERE id = parent_order.id AND status NOT IN ('confirmed', 'completed');
      IF parent_quote.id IS NOT NULL AND parent_quote.status NOT IN ('paid', 'cancelled') THEN
        UPDATE public.quotes SET status = 'finalized', payment_status = 'not_requested',
          stripe_checkout_url = NULL, updated_at = now() WHERE id = parent_quote.id;
      END IF;
      changed := true;
    END IF;
  ELSE RAISE EXCEPTION 'Unsupported payment transition'; END IF;
  RETURN jsonb_build_object('changed', changed, 'payment_id', payment.id,
    'order_id', parent_order.id, 'quote_id', parent_quote.id,
    'customer_id', payment.customer_id, 'customer_email', parent_order.customer_email,
    'customer_name', parent_order.customer_name, 'service_type', parent_order.service_type,
    'analytics_session_id', parent_order.analytics_session_id,
    'context', parent_order.context, 'scope', parent_order.scope);
END $$;

CREATE OR REPLACE FUNCTION public.expire_operational_checkout(
  expire_payment_id uuid, expire_expected_environment text, expire_session_id text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE payment public.payments%ROWTYPE; parent_order public.orders%ROWTYPE;
  parent_quote public.quotes%ROWTYPE; changed boolean := false;
BEGIN
  SELECT * INTO payment FROM public.payments WHERE id = expire_payment_id FOR UPDATE;
  IF NOT FOUND OR payment.environment <> expire_expected_environment THEN RAISE EXCEPTION 'Payment workspace mismatch'; END IF;
  SELECT * INTO parent_order FROM public.orders WHERE id = payment.order_id FOR UPDATE;
  SELECT * INTO parent_quote FROM public.quotes WHERE id = parent_order.quote_id FOR UPDATE;
  IF parent_order.environment <> payment.environment OR parent_quote.environment <> payment.environment
     OR parent_order.stripe_checkout_session_id IS DISTINCT FROM expire_session_id
     OR parent_quote.stripe_checkout_session_id IS DISTINCT FROM expire_session_id THEN
    RAISE EXCEPTION 'Expired Checkout Session is not the current durable session';
  END IF;
  IF payment.status = 'pending' AND parent_quote.status = 'payment_pending' THEN
    UPDATE public.quotes SET status = 'finalized', payment_status = 'not_requested',
      stripe_checkout_url = NULL, updated_at = now() WHERE id = parent_quote.id;
    changed := true;
  END IF;
  RETURN jsonb_build_object('changed', changed, 'payment_id', payment.id,
    'order_id', parent_order.id, 'quote_id', parent_quote.id,
    'customer_email', parent_order.customer_email, 'customer_name', parent_order.customer_name,
    'service_type', parent_order.service_type, 'analytics_session_id', parent_order.analytics_session_id,
    'context', parent_order.context, 'scope', parent_order.scope);
END $$;

CREATE OR REPLACE FUNCTION public.apply_refund_parent_state(
  refund_payment_id uuid, refund_expected_environment text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE payment public.payments%ROWTYPE; changed boolean := false; changed_rows integer := 0;
BEGIN
  SELECT * INTO payment FROM public.payments WHERE id = refund_payment_id FOR UPDATE;
  IF NOT FOUND OR payment.environment <> refund_expected_environment THEN RAISE EXCEPTION 'Payment workspace mismatch'; END IF;
  IF payment.status = 'refunded' THEN
    UPDATE public.orders SET status = 'cancelled', updated_at = now()
    WHERE id = payment.order_id AND status <> 'cancelled';
    GET DIAGNOSTICS changed_rows = ROW_COUNT;
    changed := changed_rows > 0;
  END IF;
  RETURN jsonb_build_object('changed', changed, 'order_id', payment.order_id, 'status', payment.status);
END $$;
