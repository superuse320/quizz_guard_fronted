# Quizzia

Plataforma web para crear formularios, quizzes y examenes con monitoreo en tiempo real.

![Status](https://img.shields.io/badge/status-activo-16a34a?style=for-the-badge)
![Hackathon](https://img.shields.io/badge/CubePath-2026-0ea5e9?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=0b1020)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite&logoColor=ffffff)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ecf8e?style=for-the-badge&logo=supabase&logoColor=ffffff)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-06b6d4?style=for-the-badge&logo=tailwindcss&logoColor=ffffff)

[![Demo Online](https://img.shields.io/badge/Ver%20Demo-quizziia.jojlab.com-black?style=for-the-badge&logo=vercel&logoColor=white)](https://quizziia.jojlab.com/)
[![Repositorio](https://img.shields.io/badge/GitHub-QuizGuard-111827?style=for-the-badge&logo=github&logoColor=white)](https://github.com/superuse320/QuizGuard)

## Demo

- Demo publica: https://quizziia.jojlab.com/
- Repositorio: https://github.com/superuse320/QuizGuard

## Que puedes hacer con Quizzia

- Crear formularios personalizados con multiples tipos de preguntas.
- Generar preguntas con IA para acelerar la creacion de contenido.
- Publicar actividades por enlace publico o codigo.
- Cambiar entre modos de uso:
- `Normal`: recopilacion de respuestas.
- `Quiz`: experiencia dinamica para jugar o competir.
- `Strict`: examen supervisado con reglas de control.
- Ver respuestas y resultados desde paneles de administracion.
- Monitorear actividad en tiempo real en sesiones de examen.

## Funcionalidades destacadas

- Autenticacion de usuarios con Supabase.
- Constructor visual de formularios.
- Dashboard de formularios y respuestas.
- Modo estricto con seguimiento y eventos de seguridad.
- Integracion con Supabase Realtime.
- Estado global con Redux Toolkit + RTK Query.

## Stack

- React 19
- Vite 8
- Tailwind CSS 4
- Redux Toolkit
- React Router DOM
- Supabase

## Como ejecutar en local

1. Instala dependencias:

```bash
npm install
```

2. Crea tu archivo `.env` con:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

3. Inicia el proyecto:

```bash
npm run dev
```

4. Build de produccion:

```bash
npm run build
```

## Ejecucion con Docker (opcional)

```bash
docker-compose up --build
```

La app quedara disponible en `http://localhost:5173`.

## Estructura principal

- `src/pages`: vistas principales (landing, home, quiz, respuestas).
- `src/components`: componentes UI y paneles.
- `src/redux/services`: endpoints de datos con RTK Query.
- `src/lib/supabase.js`: cliente Supabase.
- `migraciones/`: scripts SQL del proyecto.

## Estado del proyecto

Proyecto en evolucion para hackaton Cube Path 2026, con foco en UX, tiempo real y control de examenes.
