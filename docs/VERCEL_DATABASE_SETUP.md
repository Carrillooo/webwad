# Base de datos de Vercel para ZERO

ZERO usa ahora PostgreSQL conectado al proyecto de Vercel en vez de Supabase para la persistencia principal.

## Variable necesaria

Conecta una base PostgreSQL al proyecto desde Vercel y asegúrate de que el proyecto recibe una URL de conexión. ZERO comprueba, en este orden:

- `DATABASE_URL`
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

No pongas la URL ni la contraseña dentro del repositorio.

## Qué se guarda

La base conserva preferencias, memoria de ZERO, estado y tokens cifrados de Google/Outlook, suscripciones push, sesiones, mensajes, recibos de acciones, logs y notificaciones.

El esquema se crea automáticamente al primer acceso del backend mediante sentencias idempotentes.

## Propietario

ZERO funciona en modo de propietario único por defecto. Se puede personalizar con:

- `ZERO_OWNER_ID`
- `ZERO_OWNER_NAME`
- `ZERO_LOCALE`
- `ZERO_TIMEZONE`

Si no se definen, se usan valores estables por defecto.

## Comprobación

Tras desplegar, abre `/api/health`. Debe devolver `database: true` y la capacidad `database` debe aparecer como `READY`.

Si `database` es `false`, revisa que la integración de base de datos esté vinculada al mismo proyecto y entorno de Vercel que el despliegue.
