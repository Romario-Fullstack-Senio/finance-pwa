# Control Finanzas PWA

Aplicacion de finanzas personales hecha con Angular 21, modo offline-first con Service Worker e IndexedDB, y sincronizacion opcional con Supabase.

## Funcionalidades MVP

- Registro de ingresos y gastos.
- Gestion de categorias.
- Presupuestos mensuales por categoria.
- Reporte visual de tendencia 6 meses.
- Exportacion CSV.
- PWA instalable y usable offline.

## Desarrollo local

```bash
npm install
npm start
```

## Variables de entorno para Supabase

Edita estos archivos y completa tus credenciales:

- `src/environments/environment.development.ts`
- `src/environments/environment.ts`

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_ANON_KEY',
};
```

## SQL base para Supabase

Ejecuta el script:

- `supabase/schema.sql`

Nota: esta politica RLS esta abierta para MVP personal. Para produccion multiusuario, agrega autenticacion y politicas por usuario.

## Build produccion

```bash
npm run build
```

## Deploy en GitHub Pages

Este repo incluye workflow en `.github/workflows/deploy-pages.yml`.

Pasos:

1. Crear repositorio en GitHub y subir codigo a rama `main`.
2. En GitHub: Settings > Pages > Build and deployment > Source = GitHub Actions.
3. Hacer push a `main`.
4. El workflow publica automaticamente en Pages con base href del nombre del repo.

## Inicializar git y publicar

```bash
git init
git add .
git commit -m "feat: finance pwa mvp"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```
