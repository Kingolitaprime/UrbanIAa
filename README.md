# UrbanIA Córdoba

Aplicación web para comparar cambios urbanos y de vegetación en ciudades de Córdoba mediante imágenes satelitales Sentinel-2.

## Qué hace

- Permite elegir una ciudad, dos años, una estación del año y el tamaño del área a estudiar.
- Busca escenas Sentinel-2 L2A en el catálogo público Earth Search.
- Clasifica píxeles mediante índices espectrales NDVI, NDBI y MNDWI.
- Compara ambas fechas sobre una grilla común y calcula superficies estimadas.
- Muestra **dos mapas independientes**, uno por año, con zoom y desplazamiento sincronizados.
- Incluye un control deslizante para dar más o menos protagonismo visual a cada año.
- Identifica zonas de nueva urbanización, pérdida de vegetación y ganancia de vegetación.
- Presenta hectáreas, porcentajes, distancias, direcciones y coordenadas aproximadas de las zonas detectadas.
- Compara de forma visual y tabular la cobertura estimada de vegetación, superficie construida, agua y otras coberturas en ambas fechas.
- Genera un informe con IA si se configura una clave de Gemini; sin clave usa un informe alternativo.
- Guarda historial, usuarios y resultados en una base de datos.

> **Importante:** las superficies son estimaciones automáticas por teledetección, no mediciones oficiales ni verificaciones en terreno. Los resultados dependen de la disponibilidad y calidad de las imágenes, nubes, sombras y umbrales de clasificación.

## Estructura del proyecto

```text
app.py                 Servidor Flask, rutas, API y permisos
models.py              Modelos de base de datos
init_db.py             Creación de tablas y datos iniciales
analisis.py            Cálculos y clasificación de imágenes
satelite.py            Consulta y descarga de datos Sentinel-2
ia.py                  Informe con Gemini y alternativa sin IA
config.py              Configuración y variables de entorno
templates/             Páginas HTML
static/css/             Estilos
static/js/              Interacción, mapas y gráficos
render.yaml             Configuración de despliegue en Render
requirements.txt        Librerías de Python
```

---

# Publicar UrbanIA paso a paso

## Antes de empezar

Vas a usar:
1. Una cuenta de GitHub para guardar el código.
2. Una cuenta de Render para ejecutar la aplicación.
3. Una base PostgreSQL en Supabase (puede ser un proyecto gratuito).
4. Opcional: una clave de Google Gemini para los informes con IA.

**Por qué no alcanza GitHub Pages:** GitHub Pages publica sitios estáticos (HTML, CSS y JavaScript). UrbanIA necesita ejecutar Python/Flask, consultar imágenes satelitales y guardar usuarios y análisis. Por eso GitHub aloja el código y Render ejecuta la aplicación.

## Paso 1. Crear el repositorio en GitHub

1. Entrá a https://github.com e iniciá sesión.
2. Presioná **New repository**.
3. Escribí `urbania-cordoba` como nombre.
4. Elegí **Private** si no querés que cualquiera vea el código, o **Public** si querés compartirlo.
5. No marques la opción para agregar README, `.gitignore` ni licencia: este proyecto ya trae esos archivos.
6. Presioná **Create repository**.

## Paso 2. Subir los archivos

1. Descargá y descomprimí el ZIP.
2. Abrí la carpeta `urbania-cordoba` (la que contiene `app.py`, no la carpeta superior que la contiene).
3. En GitHub, dentro del repositorio vacío, elegí **uploading an existing file**.
4. Arrastrá el contenido de esa carpeta. También podés usar GitHub Desktop:
   - **File → Add Local Repository** y elegí la carpeta `urbania-cordoba`.
   - Si todavía no es un repositorio, elegí **Create a repository** en esa carpeta.
   - Hacé un commit llamado `Preparar UrbanIA para despliegue`.
   - Presioná **Publish repository**.
5. Comprobá que `app.py`, `requirements.txt`, `render.yaml` y las carpetas `templates` y `static` estén en la raíz del repositorio.

**Nunca subas un archivo `.env` ni contraseñas reales.** El `.gitignore` ya excluye esos archivos.

## Paso 3. Crear una base de datos PostgreSQL

UrbanIA necesita una base persistente: no conviene guardar la base SQLite dentro del servidor de alojamiento porque algunos servicios reinician o reemplazan su disco.

1. Entrá a https://supabase.com y creá un proyecto.
2. Guardá la contraseña de la base en un lugar seguro.
3. Cuando termine de crearse, entrá a **Project Settings → Database**.
4. Buscá la cadena de conexión PostgreSQL (URI). Copiala y reemplazá los valores de usuario, contraseña y host si hace falta.
5. La URL suele comenzar con `postgresql://` o `postgresql+...://`. Para este proyecto usá una URL PostgreSQL compatible con psycopg2, normalmente `postgresql://...`.
6. No publiques esa URL: contiene la contraseña de la base.

## Paso 4. Crear el servicio web en Render

1. Entrá a https://render.com y vinculá tu cuenta de GitHub.
2. Elegí **New → Blueprint**.
3. Seleccioná el repositorio `urbania-cordoba`.
4. Render va a leer el archivo `render.yaml` y preparar el servicio. El archivo está configurado con el plan **Starter**; verificá el precio mostrado antes de confirmar. Podés elegir el plan gratuito desde la configuración si está disponible para tu cuenta, pero puede dormir por inactividad y tener menos memoria.
5. Cuando solicite las variables marcadas como `sync: false`, completalas:

| Variable | Qué poner |
|---|---|
| `DATABASE_URL` | La URL PostgreSQL de Supabase |
| `ADMIN_PASSWORD` | Contraseña nueva y segura para el administrador |
| `PLANIFICADOR_PASSWORD` | Contraseña segura para el usuario planificador |
| `CONSULTOR_PASSWORD` | Contraseña segura para el usuario consultor |
| `GEMINI_API_KEY` | Opcional; clave de Google AI Studio. Dejala vacía si no usarás IA |

Las tres contraseñas deben tener al menos 12 caracteres en producción. No uses las contraseñas de ejemplo que aparecen en documentación antigua.

`SECRET_KEY` se genera automáticamente desde `render.yaml`. `COOKIE_SECURE` también queda configurada para HTTPS.

6. Confirmá la creación y esperá a que termine el despliegue.

## Paso 5. Abrir la aplicación

Cuando Render termine, mostrará una dirección parecida a:

`https://urbania-cordoba.onrender.com`

Ese será el enlace público de UrbanIA. El nombre exacto depende de la disponibilidad del servicio. También podés abrir **Settings → Custom Domains** para configurar un dominio propio.

La ruta `/health` permite comprobar que la aplicación y la base de datos respondan.

## Paso 6. Primer ingreso

La aplicación crea tres usuarios iniciales al preparar la base de datos:

| Perfil | Correo de acceso |
|---|---|
| Administrador | `admin@urbania.local` |
| Planificador Urbano | `planificador@urbania.local` |
| Consultor | `consultor@urbania.local` |

Usá las contraseñas que configuraste en Render para cada perfil. Cambialas y guardalas de forma segura. No compartas el acceso de administrador.

- **Administrador:** administra usuarios y ciudades, y puede generar análisis.
- **Planificador Urbano:** genera análisis y gestiona sus propios registros.
- **Consultor:** puede consultar el panel y el historial, sin generar ni modificar análisis.

## Uso sencillo de la aplicación

1. Iniciá sesión.
2. En el panel, buscá y elegí una ciudad.
3. Elegí el año inicial (antes) y el año final (después).
4. Seleccioná la época del año. Comparar períodos estacionales similares ayuda a reducir diferencias propias de las estaciones.
5. Elegí el radio de análisis. Un radio más grande cubre más superficie y puede tardar más.
6. Presioná **Iniciar análisis** y esperá a que termine.
7. En **Antes y después**, mirá ambos mapas. Podés acercar uno y el otro seguirá el mismo movimiento.
8. Mové la línea de equilibrio visual: hacia el año inicial para darle más presencia al primer mapa o hacia el año final para destacar el segundo.
9. En **Cambios detectados**, filtrá los tipos de cambio y usá **Ver en el mapa** para localizar cada zona.
10. En **Estadísticas**, revisá las superficies y porcentajes. En **Informe**, leé el diagnóstico y las recomendaciones. En **Fuentes**, consultá las escenas satelitales utilizadas.

## Ejecutar en tu computadora (opcional)

Necesitás Python 3.11.

En Windows, abrí una terminal dentro de la carpeta del proyecto y ejecutá:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Editá `.env` y configurá al menos `SECRET_KEY` con una cadena propia. Para probar localmente podés dejar SQLite como base de datos. Luego:

```powershell
python init_db.py
python app.py
```

Abrí http://127.0.0.1:5000.

## Actualizar la web después de hacer cambios

1. Editá los archivos en tu computadora.
2. Guardá los cambios.
3. En GitHub Desktop escribí un resumen del cambio en **Summary**.
4. Presioná **Commit to main** (o a tu rama de trabajo).
5. Presioná **Push origin**.
6. Render detectará el nuevo commit y volverá a desplegar la aplicación.

## Solución de problemas

- **Render muestra “Build failed”:** abrí los registros (*Logs*) y buscá la primera línea marcada como error. Revisá que `requirements.txt` esté en la raíz.
- **Falla al conectar la base:** revisá `DATABASE_URL`, la contraseña y que la URL corresponda a PostgreSQL.
- **Falta una variable de contraseña:** configurá `ADMIN_PASSWORD`, `PLANIFICADOR_PASSWORD` y `CONSULTOR_PASSWORD` en Render. No se crean cuentas de producción con claves de ejemplo.
- **No aparecen imágenes para un año:** probá otro año, otra estación o un radio menor. Puede no existir una escena con suficiente área libre de nubes.
- **El análisis tarda:** el procesamiento satelital puede demorar. En un plan gratuito el servidor puede dormir y tener menos memoria; para análisis más grandes conviene un plan con más recursos.
- **La IA no genera texto:** comprobá `GEMINI_API_KEY`. Sin esa clave, UrbanIA usa un informe alternativo y lo identifica como tal.
- **Costo del alojamiento:** el archivo `render.yaml` usa un servicio Starter para evitar las limitaciones más fuertes del plan gratuito. Revisá el precio en Render antes de confirmar o seleccioná manualmente un plan gratuito si preferís probar sin costo, aceptando sus límites.

## Fuentes y límites técnicos

- Imágenes: Sentinel-2 L2A, consultadas mediante el catálogo STAC Earth Search.
- Resolución de trabajo: 10 metros por píxel.
- Índices: NDVI, NDBI y MNDWI, con umbrales configurados en `analisis.py`.
- Se excluyen píxeles inválidos por nubes, sombras y falta de datos; la comparación usa píxeles válidos en ambas fechas.
- Los umbrales son aproximaciones iniciales y deberían calibrarse con puntos de verificación en terreno antes de usar resultados como evidencia oficial.
- Los datos poblacionales iniciales son aproximados y deben contrastarse con fuentes censales oficiales.

## Seguridad

- No subas `.env`, contraseñas, claves de Gemini ni cadenas de conexión.
- En producción, definí contraseñas fuertes desde el panel de Render.
- La aplicación usa hash de contraseñas, control de roles, sesiones y protección CSRF.
- Los análisis y las imágenes guardadas pueden ocupar espacio en la base de datos; planificá copias de seguridad periódicas.

### Diagnóstico de informes con Gemini

Si un análisis termina pero el informe indica **SIN IA**, el cálculo satelital puede haberse completado correctamente: el informe alternativo se activa cuando falta `GEMINI_API_KEY` o cuando Gemini devuelve un error. Para activar la generación con IA, configure una clave válida en la variable de entorno `GEMINI_API_KEY` (en local, dentro de `.env`; en Render, en Environment). No publique esa clave en GitHub.

La aplicación ahora registra en la terminal la causa del fallback (sin mostrar la clave), y distingue los errores de visualización del resultado de los errores de comunicación con Flask. Tras actualizar los archivos, recargue el navegador con `Ctrl + F5`.
