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
    if tg_op = 'UPDATE' and current_setting('app.allow_transfer_update', true) = 'true' then
      return new;
    end if;
    raise exception 'Transfer entries are managed as a pair and cannot be edited or deleted individually.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.update_account_transfer(
  p_transfer_id uuid,
  p_transfer_date date,
  p_description text,
  p_amount numeric,
  p_reference_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_account_id uuid;
  destination_account_id uuid;
  source_opening_date date;
  destination_opening_date date;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to update a transfer.';
  end if;
  if p_transfer_date is null or p_description is null or btrim(p_description) = '' or p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid date, description, and amount for the transfer.';
  end if;

  select from_account_id, to_account_id
  into source_account_id, destination_account_id
  from public.transfers
  where id = p_transfer_id and user_id = current_user_id;

  if not found then
    raise exception 'Transfer not found.';
  end if;

  select opening_balance_date
  into source_opening_date
  from public.accounts
  where id = source_account_id and user_id = current_user_id;

  select opening_balance_date
  into destination_opening_date
  from public.accounts
  where id = destination_account_id and user_id = current_user_id;

  if source_opening_date is null or destination_opening_date is null then
    raise exception 'Source or destination account not found.';
  end if;
  if p_transfer_date < source_opening_date or p_transfer_date < destination_opening_date then
    raise exception 'Transfer date cannot predate either account opening date.';
  end if;

  update public.transfers
  set transfer_date = p_transfer_date,
      description = btrim(p_description),
      amount = p_amount,
      reference_number = p_reference_number
  where id = p_transfer_id and user_id = current_user_id;

  perform set_config('app.allow_transfer_update', 'true', true);
  perform set_config('app.allow_transfer_post', 'true', true);
  update public.transactions
  set transaction_date = p_transfer_date,
      description = btrim(p_description),
      amount = p_amount,
      reference_number = p_reference_number,
      updated_at = now()
  where transfer_id = p_transfer_id and user_id = current_user_id;
end;
$$;

revoke all on function public.update_account_transfer(uuid, date, text, numeric, text) from public, anon;
grant execute on function public.update_account_transfer(uuid, date, text, numeric, text) to authenticated;
