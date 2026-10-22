-- Raapustamo: näyttöjen syke
-- Näyttö ilmoittaa itsestään 30 sekunnin välein, ja moderointi näyttää, onko screen elossa.

create table public.naytot (
  tunnus text primary key check (tunnus ~ '^[a-z0-9-]{1,40}$'),
  viimeksi_nahty timestamptz not null default now(),
  tiedot jsonb not null default '{}'
);

alter table public.naytot enable row level security;
revoke all on public.naytot from anon, authenticated;
grant select on public.naytot to authenticated;

create policy "moderaattorit nakevat naytot" on public.naytot
  for select to authenticated using (public.on_moderaattori());

-- Näyttö ei kirjaudu, joten syke kirjataan rajatulla funktiolla.
create or replace function public.naytto_syke(naytto text, syke_tiedot jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if naytto !~ '^[a-z0-9-]{1,40}$' or pg_column_size(syke_tiedot) > 2000 then
    raise exception 'virheellinen syke';
  end if;
  insert into public.naytot (tunnus, viimeksi_nahty, tiedot)
  values (naytto, now(), coalesce(syke_tiedot, '{}'::jsonb))
  on conflict (tunnus) do update set viimeksi_nahty = now(), tiedot = excluded.tiedot;
end $$;

revoke all on function public.naytto_syke(text, jsonb) from public;
grant execute on function public.naytto_syke(text, jsonb) to anon, authenticated;

alter publication supabase_realtime add table public.naytot;
