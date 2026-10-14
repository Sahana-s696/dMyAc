-- Ensure existing Auth users have the profile row required by account ownership.
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  coalesce(u.email, ''),
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- Keep profile creation reliable for users who sign up after this migration.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

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
    (new.id, 'Account Transfer', 'transfer')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
