create table if not exists categories (
  id text primary key,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id text primary key,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  category_id text not null references categories(id) on delete restrict,
  note text,
  date date not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists budgets (
  id text primary key,
  category_id text not null references categories(id) on delete cascade,
  month text not null,
  amount_limit numeric(12,2) not null check (amount_limit > 0),
  updated_at timestamptz not null,
  unique (category_id, month)
);

alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

create policy "read categories" on categories for select to anon using (true);
create policy "write categories" on categories for all to anon using (true) with check (true);

create policy "read transactions" on transactions for select to anon using (true);
create policy "write transactions" on transactions for all to anon using (true) with check (true);

create policy "read budgets" on budgets for select to anon using (true);
create policy "write budgets" on budgets for all to anon using (true) with check (true);
