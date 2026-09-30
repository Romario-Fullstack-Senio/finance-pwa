create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Los ids los genera el cliente (offline-first); las categorías por defecto usan ids fijos
-- como 'cat-food', por eso la clave primaria es (user_id, id).
create table categories (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table transactions (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  category_id text not null,
  note text,
  date date not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  foreign key (user_id, category_id) references categories(user_id, id) on delete restrict
);

create index transactions_user_date_idx on transactions (user_id, date desc);

create table budgets (
  user_id uuid not null references users(id) on delete cascade,
  id text not null,
  category_id text not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount_limit numeric(14,2) not null check (amount_limit > 0),
  updated_at timestamptz not null,
  primary key (user_id, id),
  unique (user_id, category_id, month),
  foreign key (user_id, category_id) references categories(user_id, id) on delete cascade
);
