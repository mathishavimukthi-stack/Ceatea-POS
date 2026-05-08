-- ═══════════════════════════════════════════════════
--  CEATEA POS — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════

-- TABLES

create table if not exists public.products (
  id      bigint primary key generated always as identity,
  name    text not null,
  em      text not null default '📦',
  cat     text not null,
  price   numeric(10,2) not null default 0,
  stock   integer not null default 0,
  low     integer not null default 5,
  age     boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id      bigint primary key generated always as identity,
  ref     text not null unique,
  type    text not null check (type in ('sale','refund')),
  method  text not null,
  total   numeric(10,2) not null,
  items   jsonb not null default '[]',
  created_at timestamptz default now()
);

create table if not exists public.customers (
  id             bigint primary key generated always as identity,
  name           text not null,
  email          text default '',
  phone          text default '',
  credit_balance numeric(10,2) not null default 0,
  created_at     timestamptz default now()
);

create table if not exists public.credit_accounts (
  id           bigint primary key generated always as identity,
  name         text not null,
  credit_limit numeric(10,2) not null default 100,
  balance      numeric(10,2) not null default 0,
  history      jsonb not null default '[]',
  created_at   timestamptz default now()
);

create table if not exists public.quotations (
  id         text primary key,
  customer   text not null,
  items      jsonb not null default '[]',
  total      numeric(10,2) not null default 0,
  status     text not null default 'Draft',
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id         text primary key,
  customer   text not null,
  items      jsonb not null default '[]',
  total      numeric(10,2) not null default 0,
  status     text not null default 'Pending',
  due_date   date,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY (allow anon full access — POS is a trusted terminal)

alter table public.products        enable row level security;
alter table public.transactions    enable row level security;
alter table public.customers       enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.quotations      enable row level security;
alter table public.invoices        enable row level security;

create policy "anon_all" on public.products        for all to anon using (true) with check (true);
create policy "anon_all" on public.transactions    for all to anon using (true) with check (true);
create policy "anon_all" on public.customers       for all to anon using (true) with check (true);
create policy "anon_all" on public.credit_accounts for all to anon using (true) with check (true);
create policy "anon_all" on public.quotations      for all to anon using (true) with check (true);
create policy "anon_all" on public.invoices        for all to anon using (true) with check (true);

-- SEED PRODUCTS

insert into public.products (name, em, cat, price, stock, low, age) values
  ('Bananas',           '🍌', 'Fruit & Veg', 0.79,  48, 10, false),
  ('Apples 6pk',        '🍎', 'Fruit & Veg', 1.49,  32, 10, false),
  ('Potatoes 1.5kg',    '🥔', 'Fruit & Veg', 1.10,  20,  8, false),
  ('Carrots 500g',      '🥕', 'Fruit & Veg', 0.65,  15,  8, false),
  ('Broccoli',          '🥦', 'Fruit & Veg', 0.79,   3,  5, false),
  ('Cherry Tomatoes',   '🍅', 'Fruit & Veg', 1.35,   0,  5, false),
  ('Avocado',           '🥑', 'Fruit & Veg', 0.90,  12,  5, false),
  ('Baby Spinach 200g', '🥬', 'Fruit & Veg', 1.20,   8,  5, false),
  ('Milk 2L',           '🥛', 'Dairy',       1.55,  30, 10, false),
  ('Cheddar 400g',      '🧀', 'Dairy',       3.20,   4,  5, false),
  ('Butter 250g',       '🧈', 'Dairy',       1.85,  18,  5, false),
  ('Greek Yoghurt',     '🍦', 'Dairy',       2.40,  12,  5, false),
  ('Free Range Eggs 6', '🥚', 'Dairy',       2.10,  22,  8, false),
  ('Oat Milk 1L',       '🥛', 'Dairy',       1.75,   2,  5, false),
  ('White Bread 800g',  '🍞', 'Bakery',      1.10,  14,  5, false),
  ('Sourdough Loaf',    '🥖', 'Bakery',      2.50,   6,  3, false),
  ('Croissants 4pk',    '🥐', 'Bakery',      2.20,   9,  3, false),
  ('Bagels 4pk',        '🥯', 'Bakery',      1.80,  11,  3, false),
  ('Chicken 500g',      '🍗', 'Meat',        4.50,  16,  5, false),
  ('Minced Beef 500g',  '🥩', 'Meat',        4.20,   8,  5, false),
  ('Smoked Salmon',     '🐟', 'Meat',        3.80,   4,  3, false),
  ('Back Bacon 300g',   '🥓', 'Meat',        3.40,  12,  5, false),
  ('Orange Juice 1L',   '🍊', 'Drinks',      1.65,  24,  8, false),
  ('Sparkling Water',   '💧', 'Drinks',      0.75,  40, 10, false),
  ('Coca-Cola 6pk',     '🥤', 'Drinks',      5.50,  18,  5, false),
  ('Lager 4pk',         '🍺', 'Drinks',      4.80,  10,  5, true),
  ('Red Wine 75cl',     '🍷', 'Drinks',      7.50,   7,  3, true),
  ('Crisps',            '🍟', 'Snacks',      0.85,  50, 15, false),
  ('Chocolate Bar',     '🍫', 'Snacks',      1.10,  35, 10, false),
  ('Mixed Nuts 200g',   '🥜', 'Snacks',      3.20,   3,  5, false),
  ('Digestives 400g',   '🍪', 'Snacks',      1.45,  22,  8, false),
  ('Tobacco Pouch 30g', '🚬', 'Snacks',     12.50,   5,  3, true)
on conflict do nothing;

-- SEED CUSTOMERS

insert into public.customers (name, email, phone, credit_balance) values
  ('Aisha Perera',   'aisha@example.com', '0771 234 567', 0),
  ('Rohan Silva',    'rohan@example.com', '0712 345 678', 50),
  ('Nimal Fernando', 'nimal@example.com', '0765 432 100', 0)
on conflict do nothing;

-- SEED CREDIT ACCOUNTS

insert into public.credit_accounts (name, credit_limit, balance) values
  ('Aisha Perera',   200, 0),
  ('Rohan Silva',    150, 50),
  ('Nimal Fernando', 100, 0)
on conflict do nothing;

-- SEED QUOTATIONS

insert into public.quotations (id, customer, items, total, status) values
  ('QT-001', 'Aisha Perera', '[{"name":"Milk 2L","qty":2,"price":1.55},{"name":"Cheddar 400g","qty":1,"price":3.20}]', 6.30,  'Sent'),
  ('QT-002', 'Walk-in',      '[{"name":"Chicken 500g","qty":3,"price":4.50}]',                                         13.50, 'Draft'),
  ('QT-003', 'Rohan Silva',  '[{"name":"Coca-Cola 6pk","qty":2,"price":5.50}]',                                        11.00, 'Accepted')
on conflict do nothing;

-- SEED INVOICES

insert into public.invoices (id, customer, total, status, due_date) values
  ('INV-001', 'Aisha Perera', 6.30,  'Paid',    '2025-05-05'),
  ('INV-002', 'Rohan Silva',  11.00, 'Pending', '2025-05-16'),
  ('INV-003', 'Walk-in',      21.60, 'Overdue', '2025-04-15')
on conflict do nothing;
