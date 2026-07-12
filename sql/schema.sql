-- ============================================================
-- LiftHub — esquema de base de datos
-- Pega y ejecuta esto en Supabase → SQL Editor → New query → Run
-- ============================================================

-- Tabla genérica de "llave-valor" por usuario.
-- food.js y gym.js guardan aquí cosas como 'foods', 'gymData',
-- y 'log:2026-07-11' (uno por cada día que registras comida).
create table if not exists user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  unique (user_id, key)
);

-- Activa seguridad a nivel de fila: por defecto nadie puede leer/escribir nada.
alter table user_data enable row level security;

-- Cada usuario solo puede ver y modificar SUS PROPIAS filas.
create policy "Users can manage their own data"
on user_data
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Índice para que las búsquedas por prefijo (ej. 'log:') sean rápidas.
create index if not exists user_data_user_key_idx on user_data (user_id, key);
