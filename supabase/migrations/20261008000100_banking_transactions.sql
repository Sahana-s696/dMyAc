create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category_type text not null check (category_type in ('income', 'expense', 'transfer', 'broker')),
  parent_id uuid references public.categories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, category_type)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  transfer_date date not null,
  description text not null,
  reference_number text,
  created_at timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  transaction_date date not null,
  description text not null,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer', 'broker_deposit', 'broker_withdrawal', 'interest', 'ipo_payment', 'loan_repayment', 'bank_charge', 'cash_deposit', 'cash_withdrawal', 'other')),
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.categories(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  reference_number text,
  transfer_id uuid references public.transfers(id) on delete cascade,
  notes text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_transfer_pair check ((transaction_type = 'transfer') = (transfer_id is not null))
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date desc, created_at desc);
create index if not exists transactions_account_date_idx on public.transactions (account_id, transaction_date, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.categories enable row level security;
alter table public.transfers enable row level security;
alter table public.transactions enable row level security;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select on public.transfers to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

create or replace function public.enforce_account_balance_management()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.current_balance = new.opening_balance;
  elsif new.current_balance is distinct from old.current_balance and pg_trigger_depth() <= 1 then
    raise exception 'Current balance is calculated from account activity and cannot be edited directly.';
  end if;
  return new;
end;
$$;

create trigger manage_calculated_account_balance
  before insert or update of current_balance on public.accounts
  for each row execute function public.enforce_account_balance_management();

create or replace function public.validate_transaction_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is not null and new.user_id <> current_user_id then
    raise exception 'Transaction owner must match the signed-in user.';
  end if;
  if not exists (
    select 1 from public.accounts a
    where a.id = new.account_id
      and a.user_id = new.user_id
      and new.transaction_date >= a.opening_balance_date
  ) then
    raise exception 'The selected account must belong to this user, and the transaction date cannot predate its opening balance date.';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'The selected category does not belong to this user.';
  end if;
  if new.transaction_type = 'transfer' then
    if current_setting('app.allow_transfer_post', true) is distinct from 'true' then
      raise exception 'Transfer ledger entries must be created using the transfer operation.';
    end if;
    if not exists (
      select 1 from public.transfers t
      where t.id = new.transfer_id
        and t.user_id = new.user_id
        and new.account_id in (t.from_account_id, t.to_account_id)
    ) then
      raise exception 'The transfer does not match this account and user.';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_transaction_owner
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_ownership();

create or replace function public.protect_transfer_ledger_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.transaction_type = 'transfer' then
    raise exception 'Transfer entries are managed as a pair and cannot be edited or deleted individually.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger protect_transfer_transaction_rows
  before update or delete on public.transactions
  for each row execute function public.protect_transfer_ledger_rows();

create policy "Users can manage their own categories"
  on public.categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can read their own transfers"
  on public.transfers for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own transactions"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own transactions"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own transactions"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own transactions"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create or replace function public.transaction_movement(p_account_id uuid, p_type text, p_amount numeric, p_transfer_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when p_type in ('income', 'interest', 'cash_deposit', 'broker_withdrawal') then p_amount
    when p_type = 'transfer' and exists (
      select 1 from public.transfers t where t.id = p_transfer_id and t.to_account_id = p_account_id
    ) then p_amount
    when p_type = 'transfer' and exists (
      select 1 from public.transfers t where t.id = p_transfer_id and t.from_account_id = p_account_id
    ) then -p_amount
    when p_type = 'transfer' then 0
    else -p_amount
  end;
$$;

create or replace function public.recalculate_account_balance(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accounts a
  set current_balance = a.opening_balance + coalesce((
    select sum(public.transaction_movement(t.account_id, t.transaction_type, t.amount, t.transfer_id))
    from public.transactions t
    where t.account_id = a.id
      and t.transaction_date >= a.opening_balance_date
  ), 0)
  where a.id = p_account_id;
end;
$$;

create or replace function public.refresh_account_balance_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalculate_account_balance(old.account_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalculate_account_balance(new.account_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger refresh_balance_after_transaction
  after insert or update or delete on public.transactions
  for each row execute function public.refresh_account_balance_from_transaction();

create or replace function public.refresh_account_balance_from_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalculate_account_balance(new.id);
  return new;
end;
$$;

create trigger refresh_balance_after_opening_balance_change
  after update of opening_balance, opening_balance_date on public.accounts
  for each row execute function public.refresh_account_balance_from_account();

create or replace function public.create_account_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_transfer_date date,
  p_description text,
  p_amount numeric,
  p_reference_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_uuid uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to transfer money.';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'Choose two different accounts.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero.';
  end if;
  if not exists (
    select 1 from public.accounts
    where id = p_from_account_id and user_id = current_user_id and status = 'active'
  ) or not exists (
    select 1 from public.accounts
    where id = p_to_account_id and user_id = current_user_id and status = 'active'
  ) then
    raise exception 'Both accounts must belong to you and be active.';
  end if;

  insert into public.transfers (user_id, from_account_id, to_account_id, amount, transfer_date, description, reference_number)
  values (current_user_id, p_from_account_id, p_to_account_id, p_amount, p_transfer_date, p_description, p_reference_number)
  returning id into transfer_uuid;

  perform set_config('app.allow_transfer_post', 'true', true);
  insert into public.transactions (user_id, account_id, transaction_date, description, transaction_type, amount, reference_number, transfer_id)
  values
    (current_user_id, p_from_account_id, p_transfer_date, p_description, 'transfer', p_amount, p_reference_number, transfer_uuid),
    (current_user_id, p_to_account_id, p_transfer_date, p_description, 'transfer', p_amount, p_reference_number, transfer_uuid);

  return transfer_uuid;
end;
$$;

revoke all on function public.create_account_transfer(uuid, uuid, date, text, numeric, text) from public;
grant execute on function public.create_account_transfer(uuid, uuid, date, text, numeric, text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  insert into public.categories (user_id, name, category_type) values
    (new.id, 'Salary', 'income'),
    (new.id, 'Interest', 'income'),
    (new.id, 'Money Received', 'income'),
    (new.id, 'Refund', 'income'),
    (new.id, 'Cash Deposit', 'income'),
    (new.id, 'ATM Withdrawal', 'expense'),
    (new.id, 'House Rent', 'expense'),
    (new.id, 'Electricity', 'expense'),
    (new.id, 'Mobile Recharge', 'expense'),
    (new.id, 'Grocery', 'expense'),
    (new.id, 'IPO', 'expense'),
    (new.id, 'Bank Charge', 'expense'),
    (new.id, 'Other Expense', 'expense'),
    (new.id, 'Account Transfer', 'transfer');
  return new;
end;
$$;
