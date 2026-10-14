create or replace function public.protect_transfer_ledger_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.transaction_type = 'transfer' then
    if tg_op = 'DELETE' and current_setting('app.allow_transfer_delete', true) = 'true' then
      return old;
    end if;
    raise exception 'Transfer entries are managed as a pair and cannot be edited or deleted individually.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.delete_account_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to delete a transfer.';
  end if;
  if not exists (
    select 1 from public.transfers
    where id = p_transfer_id and user_id = current_user_id
  ) then
    raise exception 'Transfer not found.';
  end if;

  perform set_config('app.allow_transfer_delete', 'true', true);
  delete from public.transfers
  where id = p_transfer_id and user_id = current_user_id;
end;
$$;

revoke all on function public.delete_account_transfer(uuid) from public, anon;
grant execute on function public.delete_account_transfer(uuid) to authenticated;
