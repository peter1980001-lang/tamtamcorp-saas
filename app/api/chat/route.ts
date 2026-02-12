-- Atomic counters table (minute + day buckets)
create table if not exists public.company_usage_counters (
  company_id uuid not null,
  bucket text not null, -- e.g. 'minute:2026-02-12T03:58' or 'day:2026-02-12'
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (company_id, bucket)
);

-- Atomic rate limit enforcement RPC
-- Returns: allowed + counts + reset timestamps
create or replace function public.enforce_company_rate_limit(
  p_company_id uuid,
  p_limit_per_minute int,
  p_limit_per_day int
)
returns table(
  allowed boolean,
  minute_count int,
  day_count int,
  reset_minute timestamptz,
  reset_day timestamptz
)
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_min_bucket text;
  v_day_bucket text;
  v_min_count int;
  v_day_count int;
begin
  -- bucket keys
  v_min_bucket := 'minute:' || to_char(date_trunc('minute', v_now), 'YYYY-MM-DD"T"HH24:MI');
  v_day_bucket := 'day:' || to_char(date_trunc('day', v_now), 'YYYY-MM-DD');

  -- upsert minute counter
  insert into public.company_usage_counters (company_id, bucket, count)
  values (p_company_id, v_min_bucket, 1)
  on conflict (company_id, bucket)
  do update set count = public.company_usage_counters.count + 1,
               updated_at = now()
  returning count into v_min_count;

  -- upsert day counter
  insert into public.company_usage_counters (company_id, bucket, count)
  values (p_company_id, v_day_bucket, 1)
  on conflict (company_id, bucket)
  do update set count = public.company_usage_counters.count + 1,
               updated_at = now()
  returning count into v_day_count;

  minute_count := v_min_count;
  day_count := v_day_count;

  reset_minute := date_trunc('minute', v_now) + interval '1 minute';
  reset_day := date_trunc('day', v_now) + interval '1 day';

  allowed := (v_min_count <= greatest(1, p_limit_per_minute))
             and (v_day_count <= greatest(1, p_limit_per_day));

  return next;
end;
$$;
