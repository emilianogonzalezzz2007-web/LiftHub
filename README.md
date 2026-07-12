# LiftHub

**Entrena. Registra. Mejora.**

App personal para trackear macros/calorías de tu comida y tu progreso de pesos/reps en el gym. Sin backend, sin cuentas — pensada para uso individual.

## Estructura del proyecto

```
lifthub/
├── index.html            Estructura de las pantallas (Login, Menú, Combustible, Hierro) y sus modales
├── css/
│   └── styles.css         Todo el diseño (tema oscuro "gym" + tema claro "nutrition label" para Combustible)
├── js/
│   ├── config.js            Aquí pegas tu URL y anon key de Supabase (ver más abajo)
│   ├── supabaseClient.js    Inicializa el cliente de Supabase
│   ├── storage.js            Wrapper async sobre la base de datos de Supabase (get/set/delete/list)
│   ├── auth.js                 Login, registro, cerrar sesión, sesión persistente
│   ├── openfoodfacts.js    Integración de búsqueda con la API de Open Food Facts
│   ├── nav.js                   Navegación entre pantallas
│   ├── food.js                   Lógica de Combustible: alimentos, registro diario, historial
│   └── gym.js                    Lógica de Hierro: músculos, ejercicios, sets (peso/reps/nota)
├── sql/
│   └── schema.sql          SQL para crear la tabla de datos + seguridad (pégalo en Supabase)
└── README.md
```

## 🔑 Paso obligatorio antes de probarlo: crea tu proyecto de Supabase

Esta versión tiene cuentas de usuario reales (login/registro) y tus datos se guardan en una base de datos en la nube, sincronizada entre todos tus dispositivos. Para eso usa **[Supabase](https://supabase.com)** (gratis para este tipo de uso). Yo no puedo crear esta cuenta por ti — son ~5 minutos:

1. Ve a **[supabase.com](https://supabase.com)** y crea una cuenta gratis (puedes usar GitHub para entrar más rápido).
2. Click en **"New project"**. Ponle el nombre que quieras (ej. "lifthub"), elige una contraseña de base de datos (guárdala) y una región cercana a ti.
3. Espera 1-2 minutos a que Supabase termine de crear el proyecto.
4. En el menú lateral, ve a **SQL Editor → New query**, pega todo el contenido de `sql/schema.sql` (está en esta carpeta) y dale **Run**. Esto crea la tabla donde se guardan tus datos, con seguridad activada (cada quien solo ve lo suyo).
5. Ve a **Project Settings → API**. Copia:
   - **Project URL**
   - La llave **anon / public** (a veces aparece como "publishable key")
6. Abre `js/config.js` en esta carpeta y pega esos dos valores donde dice `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

**Opcional pero recomendado para probar rápido:** por defecto, Supabase pide confirmar el correo antes de poder iniciar sesión. Si quieres registrarte y entrar de inmediato sin revisar tu correo (solo mientras pruebas), ve a **Authentication → Providers → Email** y desactiva "Confirm email". Puedes volver a activarlo después.

## Cómo probarlo localmente

No necesitas ningún build ni instalar nada. Con `js/config.js` ya configurado:

```bash
cd lifthub
python3 -m http.server 8000
# abre http://localhost:8000
```

(Usa un servidor local en vez de abrir `index.html` directamente con doble clic — algunos navegadores bloquean ciertas llamadas de red si abres el archivo con `file://`.)

Al abrir la app verás la pantalla de **"Crear cuenta"** — regístrate con cualquier correo y contraseña (mínimo 6 caracteres), y ya puedes usar LiftHub.

## Cómo subirlo a GitHub

```bash
cd lifthub
git init
git add .
git commit -m "LiftHub: primera versión"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/lifthub.git
git push -u origin main
```

## Cómo hospedarlo (gratis)

Como es un sitio 100% estático (HTML/CSS/JS, sin backend), cualquiera de estas opciones funciona sin configuración extra:

- **GitHub Pages**: en tu repo → Settings → Pages → Source: rama `main`, carpeta `/ (root)`. Tu app queda en `https://TU_USUARIO.github.io/lifthub/`.
- **Netlify**: arrastra la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop), o conecta el repo de GitHub para despliegue automático en cada push.
- **Vercel**: `vercel` desde la carpeta del proyecto, o importa el repo desde [vercel.com/new](https://vercel.com/new).

## ✅ Cómo se guardan tus datos ahora

Con Supabase configurado:

- Tus datos viven en una base de datos real en la nube (Postgres), no en el navegador.
- **Sí se sincronizan entre dispositivos** — inicia sesión con el mismo correo en tu celular y tu computadora, y vas a ver exactamente lo mismo.
- Cada persona que se registre tiene sus propios datos, completamente separados de los de cualquier otro usuario (esto lo garantiza "Row Level Security", activado en `sql/schema.sql` — nadie puede leer ni modificar los datos de otra cuenta, ni siquiera manipulando la app).
- La contraseña nunca se guarda en texto plano — Supabase la maneja de forma segura de fondo (hash), tú no tienes que preocuparte por eso.

**Dato técnico:** la llave que pones en `js/config.js` (la "anon key") es segura de exponer en el navegador — está diseñada para eso. Lo que la protege no es que esté oculta, sino la seguridad a nivel de fila (RLS) que configuraste con `sql/schema.sql`. Nunca uses la "service_role key" en el frontend — esa sí es secreta y le da acceso total a la base de datos sin restricciones.

## Integración con Open Food Facts

La pestaña "Buscar" del modal de "Nuevo alimento" consulta la API pública de [Open Food Facts](https://world.openfoodfacts.org) en tiempo real (no se descarga ninguna base de datos). La pestaña "Escanear" usa el mismo servicio, pero por código de barras.

Detalles técnicos relevantes (importante si en el futuro algo deja de funcionar):

- **Búsqueda por texto usa DOS motores, en orden**: primero el servicio nuevo de Open Food Facts, "Search-a-licious" (`search.openfoodfacts.org`), todavía en beta. Si no da resultados o falla, la app automáticamente intenta con el motor anterior (`cgi/search.pl`) como respaldo. Solo si ambos fallan, ves un mensaje de error — y siempre puedes usar "Escanear" o "Manual" mientras tanto.
- **Escaneo de código de barras**: usa `/api/v2/product/{barcode}`, un endpoint estable y documentado — no depende de ninguno de los dos motores de búsqueda, así que es la opción más confiable de las tres.
- Los datos son colaborativos/comunitarios: pueden faltar macros en algunos productos, o venir incompletos. Por eso, al elegir un resultado (de cualquiera de las dos formas), los valores se cargan en la pestaña "Manual" para que los revises antes de guardar — nunca se guardan automáticamente sin que los veas.
- Si Open Food Facts no responde (sin internet, límite alcanzado, servicio caído, etc.), la app te lo indica con un mensaje claro y puedes seguir agregando el alimento manualmente.

## Cambios recientes incluidos en esta versión

- **Unidad de peso por intento (kg o lb)** en Hierro — eliges antes de registrar cada intento, y el historial guarda con qué unidad registraste cada uno.
- **Historial completo por ejercicio** — el último intento se sigue mostrando directo en la lista para verlo rápido, y un botón "Ver historial completo" abre todos tus intentos anteriores (con opción de borrar alguno si te equivocaste).
- **Cuentas de usuario reales** (registro/login/cerrar sesión) con Supabase — tus datos ahora se sincronizan entre todos tus dispositivos.
- **Los alimentos ya no se fuerzan a "favoritos".** Todo lo que agregas en "Nuevo alimento" se guarda automáticamente en "Mis alimentos". Marcar la estrella (★) es opcional y solo sirve para que ese alimento aparezca primero en la lista.
- **Búsqueda/filtro** de tus propios alimentos guardados (útil cuando la lista crece).
- **Búsqueda en Open Food Facts** para no tener que escribir los macros a mano cuando el producto ya existe en su base de datos.

## Al hospedarlo (GitHub Pages / Netlify / Vercel)

Todo funciona igual una vez publicado — solo asegúrate de que `js/config.js` con tus credenciales de Supabase esté incluido en el repo que subas (la anon key es segura de publicar, como se explica arriba).

## Escaneo de código de barras

La pestaña "Escanear" del modal de "Nuevo alimento" usa la cámara de tu dispositivo (librería [html5-qrcode](https://github.com/mebjas/html5-qrcode)) para leer códigos EAN-13, EAN-8, UPC-A y UPC-E — los formatos típicos de productos de supermercado. Al detectar un código, se consulta directo el producto en Open Food Facts por su código de barras.

Notas importantes:

- **Requiere una conexión segura (HTTPS)** para pedir permiso de cámara — excepto en `http://localhost`, que los navegadores tratan como excepción para desarrollo. GitHub Pages, Netlify y Vercel dan HTTPS automático, así que una vez publicado funciona sin configurar nada extra.
- Si el producto no está en Open Food Facts, te lo indica y puedes agregarlo manualmente o buscarlo por nombre.
- Igual que con la búsqueda por texto, los datos se cargan en la pestaña "Manual" para que los revises antes de guardar.

## Próximos pasos posibles (no incluidos todavía)

- Metas diarias de calorías/macros con barras de progreso.
- Recuperar contraseña ("olvidé mi contraseña") — Supabase lo soporta, pero no está conectado en la UI todavía.
