# Finance Manager

Finance Manager is a React, TypeScript, and Vite personal finance app. Accounts, banking transactions, transfers, calculated balances, statements, and spreadsheet workflows are supported. Without Supabase credentials, it runs with browser-local demo data.

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env` in this project directory.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's URL and public anon/publishable key. Never put a service-role key in a client-side environment file.
4. In the Supabase SQL Editor, run the migrations in order for a new database:
   - [`supabase/migrations/20261008000000_initial_profiles_accounts.sql`](./supabase/migrations/20261008000000_initial_profiles_accounts.sql)
   - [`supabase/migrations/20261008000100_banking_transactions.sql`](./supabase/migrations/20261008000100_banking_transactions.sql)
   - [`supabase/migrations/20261008000200_repair_existing_profiles.sql`](./supabase/migrations/20261008000200_repair_existing_profiles.sql)
   
   If your project already has the profiles and accounts tables from the earlier setup, do not rerun the first migration; run the banking transactions migration and the repair migration.
5. Restart Vite with `npm run dev`.
6. Use **New here? Create an account** on the login page. Confirm your email if email confirmation is enabled, then sign in. The migration creates the user's profile and default categories automatically.

The migrations enable row-level security and restrict records to the authenticated owner. Transaction triggers calculate account balances; they reject direct edits to calculated balances. Transfers are posted atomically as a pair. Keep the browser's Supabase key public; never use a service-role key in this app.

If account creation reports `accounts_user_id_fkey`, run `20261008000200_repair_existing_profiles.sql` in the Supabase SQL Editor. It safely creates profile rows for existing Auth users and reinstalls the profile-creation trigger for new signups; it does not alter existing profiles.

The dashboard, account ledger, transactions, deposits, withdrawals, transfers, and calculated balances use Supabase when credentials are configured. Without credentials, the same workflows use browser-local demo data.

## Development

```sh
npm install
npm run dev
npm run build
npm run lint
```
