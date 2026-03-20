# React + Supabase Realtime

Este proyecto ya esta preparado para insertar y escuchar cambios en tiempo real de la tabla `pruebas` usando Supabase.

## 1) Variables de entorno

1. Copia `.env.example` a `.env`.
2. Completa:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## 2) Crear tabla `pruebas`

En el SQL Editor de Supabase ejecuta:

```sql
create table if not exists public.pruebas (
	id bigint generated always as identity primary key,
	test text not null,
	created_at timestamptz not null default now()
);
```

## 3) Habilitar Realtime para la tabla

Ejecuta tambien:

```sql
alter publication supabase_realtime add table public.pruebas;
```

## 4) Politicas RLS (para pruebas)

Si tienes RLS activado, agrega politicas basicas para poder leer e insertar desde el frontend:

```sql
alter table public.pruebas enable row level security;

create policy "read pruebas"
on public.pruebas
for select
to anon
using (true);

create policy "insert pruebas"
on public.pruebas
for insert
to anon
with check (true);

create policy "delete pruebas"
on public.pruebas
for delete
to anon
using (true);
```

## 5) Ejecutar

```bash
npm install
npm run dev
```

Abre la app, inserta valores y veras:

- estado de conexion realtime,
- cantidad de filas cargadas,
- latencia estimada (ms) entre insercion y evento realtime.

## Diagnostico rapido si no refresca en vivo

1. Verifica que la tabla este en la publicacion realtime:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
and schemaname = 'public'
and tablename = 'pruebas';
```

2. Si no aparece, vuelve a agregarla:

```sql
alter publication supabase_realtime add table public.pruebas;
```

3. Si Realtime sigue sin reflejar UPDATE/DELETE, fuerza replica identity full:

```sql
alter table public.pruebas replica identity full;
```

4. Revisa en la UI de Supabase: Database -> Replication y confirma que `pruebas` este habilitada.

La app tambien tiene fallback automatico: si el canal no llega a estado `SUBSCRIBED`, hace sincronizacion cada 2.5s para que siempre veas cambios.
