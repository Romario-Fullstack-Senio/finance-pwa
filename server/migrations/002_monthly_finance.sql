-- Tipo de categoría: ingreso, gasto fijo (necesidades), gasto variable (deseos) o ahorro
alter table categories
  add column kind text not null default 'variable'
  check (kind in ('income', 'fixed', 'variable', 'savings'));

-- Categorías por defecto que ya existían
update categories set kind = 'income' where id = 'cat-salary';
update categories set kind = 'fixed' where id = 'cat-home';

-- Toda cuenta existente arranca con una categoría para registrar ahorros
insert into categories (user_id, id, name, color, kind)
select id, 'cat-savings', 'Ahorro', '#9085e9', 'savings' from users
on conflict (user_id, id) do nothing;

-- Movimiento de ahorro: dinero apartado (cuenta de ahorros, CDT...), no cuenta como gasto
alter table transactions drop constraint transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('income', 'expense', 'saving'));

-- Regla de distribución del ingreso mensual (50/30/20 por defecto)
alter table users
  add column rule_needs smallint not null default 50 check (rule_needs between 0 and 100),
  add column rule_wants smallint not null default 30 check (rule_wants between 0 and 100),
  add column rule_savings smallint not null default 20 check (rule_savings between 0 and 100),
  add constraint users_rule_total_check check (rule_needs + rule_wants + rule_savings = 100);
