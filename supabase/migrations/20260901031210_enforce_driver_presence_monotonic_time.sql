-- Storage-level invariant: a presence heartbeat can never predate the session
-- it belongs to. This turns future reconnect/time-order regressions into an
-- immediate, observable failure instead of a stale invisible driver.
alter table public.driver_presence_sessions
  add constraint driver_presence_last_seen_order
  check (last_seen_at >= started_at);
