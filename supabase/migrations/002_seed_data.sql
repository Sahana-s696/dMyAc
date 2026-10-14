-- Seed default categories for new users
-- This runs after user signup via a trigger or can be run manually

CREATE OR REPLACE FUNCTION public.seed_default_categories(user_uuid UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  cat_id UUID;
BEGIN
  -- Income categories
  INSERT INTO public.categories (user_id, name, category_type, is_active) VALUES
  (user_uuid, 'Salary', 'income', true),
  (user_uuid, 'Interest', 'income', true),
  (user_uuid, 'Dividend', 'income', true),
  (user_uuid, 'Money Received', 'income', true),
  (user_uuid, 'Refund', 'income', true),
  (user_uuid, 'Other Income', 'income', true);

  -- Broker categories
  INSERT INTO public.categories (user_id, name, category_type, is_active) VALUES
  (user_uuid, 'Broker Deposit', 'broker', true),
  (user_uuid, 'Broker Withdrawal', 'broker', true),
  (user_uuid, 'IPO', 'broker', true),
  (user_uuid, 'ASBA', 'broker', true),
  (user_uuid, 'Share Purchase', 'broker', true),
  (user_uuid, 'Share Sale', 'broker', true);

  -- Expense categories
  INSERT INTO public.categories (user_id, name, category_type, is_active) VALUES
  (user_uuid, 'ATM Withdrawal', 'expense', true),
  (user_uuid, 'Mobile Recharge', 'expense', true),
  (user_uuid, 'House Rent', 'expense', true),
  (user_uuid, 'Electricity', 'expense', true),
  (user_uuid, 'Water', 'expense', true),
  (user_uuid, 'Brick', 'expense', true),
  (user_uuid, 'Guthi', 'expense', true),
  (user_uuid, 'Grocery', 'expense', true),
  (user_uuid, 'Hardware', 'expense', true),
  (user_uuid, 'Carpenter', 'expense', true),
  (user_uuid, 'School Fees', 'expense', true),
  (user_uuid, 'Transportation', 'expense', true),
  (user_uuid, 'Food', 'expense', true),
  (user_uuid, 'Medical', 'expense', true),
  (user_uuid, 'Miscellaneous', 'expense', true);

  -- Transfer categories
  INSERT INTO public.categories (user_id, name, category_type, is_active) VALUES
  (user_uuid, 'Transfer To Other Account', 'transfer', true),
  (user_uuid, 'Transfer From Other Account', 'transfer', true);
END $$;

-- Function to create sample data for demo
CREATE OR REPLACE FUNCTION public.create_sample_data(user_uuid UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  ctzn_id UUID;
  prime_id UUID;
  cash_id UUID;
  transfer_id UUID;
BEGIN
  -- Create sample accounts
  INSERT INTO public.accounts (user_id, account_name, bank_name, account_type, opening_balance, opening_balance_date, status)
  VALUES 
    (user_uuid, 'CTZN', 'Citizens Bank', 'checking', 100000, '2024-01-01', 'active')
  RETURNING id INTO ctzn_id;

  INSERT INTO public.accounts (user_id, account_name, bank_name, account_type, opening_balance, opening_balance_date, status)
  VALUES 
    (user_uuid, 'Prime', 'Prime Commercial Bank', 'checking', 50000, '2024-01-01', 'active')
  RETURNING id INTO prime_id;

  INSERT INTO public.accounts (user_id, account_name, bank_name, account_type, opening_balance, opening_balance_date, status)
  VALUES 
    (user_uuid, 'Cash', 'Cash in Hand', 'cash', 10000, '2024-01-01', 'active')
  RETURNING id INTO cash_id;

  -- Get category IDs
  DECLARE
    salary_cat UUID;
    interest_cat UUID;
    broker_dep_cat UUID;
    atm_cat UUID;
    rent_cat UUID;
    electricity_cat UUID;
    mobile_cat UUID;
    transfer_out_cat UUID;
    transfer_in_cat UUID;
  BEGIN
    SELECT id INTO salary_cat FROM public.categories WHERE user_id = user_uuid AND name = 'Salary' LIMIT 1;
    SELECT id INTO interest_cat FROM public.categories WHERE user_id = user_uuid AND name = 'Interest' LIMIT 1;
    SELECT id INTO broker_dep_cat FROM public.categories WHERE user_id = user_uuid AND name = 'Broker Deposit' LIMIT 1;
    SELECT id INTO atm_cat FROM public.categories WHERE user_id = user_uuid AND name = 'ATM Withdrawal' LIMIT 1;
    SELECT id INTO rent_cat FROM public.categories WHERE user_id = user_uuid AND name = 'House Rent' LIMIT 1;
    SELECT id INTO electricity_cat FROM public.categories WHERE user_id = user_uuid AND name = 'Electricity' LIMIT 1;
    SELECT id INTO mobile_cat FROM public.categories WHERE user_id = user_uuid AND name = 'Mobile Recharge' LIMIT 1;
    SELECT id INTO transfer_out_cat FROM public.categories WHERE user_id = user_uuid AND name = 'Transfer To Other Account' LIMIT 1;
    SELECT id INTO transfer_in_cat FROM public.categories WHERE user_id = user_uuid AND name = 'Transfer From Other Account' LIMIT 1;

    -- Sample transactions for CTZN
    INSERT INTO public.transactions (user_id, account_id, transaction_date, description, transaction_type, category_id, amount, reference_number) VALUES
    (user_uuid, ctzn_id, '2024-01-01', 'Opening Balance', 'income', salary_cat, 100000, 'OB-001'),
    (user_uuid, ctzn_id, '2024-01-05', 'Salary Credit', 'income', salary_cat, 50000, 'SAL-001'),
    (user_uuid, ctzn_id, '2024-01-10', 'ATM Withdrawal', 'expense', atm_cat, 5000, 'ATM-001'),
    (user_uuid, ctzn_id, '2024-01-15', 'House Rent', 'expense', rent_cat, 25000, 'RENT-001'),
    (user_uuid, ctzn_id, '2024-01-20', 'Electricity Bill', 'expense', electricity_cat, 3500, 'ELEC-001'),
    (user_uuid, ctzn_id, '2024-01-25', 'Mobile Recharge', 'expense', mobile_cat, 500, 'MOB-001'),
    (user_uuid, ctzn_id, '2024-02-01', 'Interest Received', 'income', interest_cat, 1200, 'INT-001'),
    (user_uuid, ctzn_id, '2024-02-05', 'Salary Credit', 'income', salary_cat, 50000, 'SAL-002'),
    (user_uuid, ctzn_id, '2024-02-10', 'Broker Deposit', 'broker_deposit', broker_dep_cat, 20000, 'BRK-001'),
    (user_uuid, ctzn_id, '2024-02-15', 'House Rent', 'expense', rent_cat, 25000, 'RENT-002');

    -- Sample transactions for Prime
    INSERT INTO public.transactions (user_id, account_id, transaction_date, description, transaction_type, category_id, amount, reference_number) VALUES
    (user_uuid, prime_id, '2024-01-01', 'Opening Balance', 'income', salary_cat, 50000, 'OB-002'),
    (user_uuid, prime_id, '2024-01-10', 'ATM Withdrawal', 'expense', atm_cat, 3000, 'ATM-002'),
    (user_uuid, prime_id, '2024-01-20', 'Grocery', 'expense', (SELECT id FROM public.categories WHERE user_id = user_uuid AND name = 'Grocery' LIMIT 1), 8000, 'GROC-001'),
    (user_uuid, prime_id, '2024-02-01', 'Interest Received', 'income', interest_cat, 800, 'INT-002'),
    (user_uuid, prime_id, '2024-02-05', 'Salary Credit', 'income', salary_cat, 30000, 'SAL-003');

    -- Sample transfer
    INSERT INTO public.transfers (user_id, from_account_id, to_account_id, amount, transfer_date, description, reference_number)
    VALUES (user_uuid, ctzn_id, prime_id, 50000, '2024-02-20', 'Transfer to Prime', 'TRF-001')
    RETURNING id INTO transfer_id;

    -- Linked transfer transactions
    INSERT INTO public.transactions (user_id, account_id, transaction_date, description, transaction_type, category_id, amount, reference_number, transfer_id) VALUES
    (user_uuid, ctzn_id, '2024-02-20', 'Transfer to Prime', 'transfer', transfer_out_cat, 50000, 'TRF-001', transfer_id),
    (user_uuid, prime_id, '2024-02-20', 'Transfer from CTZN', 'transfer', transfer_in_cat, 50000, 'TRF-001', transfer_id);

    -- Update account balances
    PERFORM public.update_account_balance(ctzn_id);
    PERFORM public.update_account_balance(prime_id);
    PERFORM public.update_account_balance(cash_id);
  END;
END $$;