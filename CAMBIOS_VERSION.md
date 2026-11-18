# Cambios de esta versión

## 1. Publicación y funcionamiento

- Se agregó `render.yaml` para que Render detecte cómo instalar y ejecutar UrbanIA.
- Se agregó `runtime.txt` para fijar Python 3.11.11.
- Se agregó `/health` para comprobar que el servidor y la base de datos respondan.
- Se reforzó la creación inicial de usuarios: en producción ya no se aceptan contraseñas de ejemplo; hay que definir las tres contraseñas desde las variables privadas del alojamiento.
- Se amplió `.gitignore` para evitar subir bases locales, entornos virtuales, cachés y archivos `.env`.
- Se reescribió el README con instrucciones paso a paso para GitHub, PostgreSQL/Supabase y Render, además de una guía de uso y solución de problemas.

## 2. Comparación de años con dos mapas

- La pestaña “Antes y después” ahora presenta dos mapas separados.
- El mapa izquierdo muestra la imagen del año inicial y el derecho la del año final.
- Los mapas sincronizan el zoom y el desplazamiento: al explorar una zona en uno, el otro acompaña.
- El control deslizante de equilibrio visual modifica la opacidad de las imágenes para dar mayor protagonismo al año inicial o al final.
- La casilla de cambios detectados superpone el mapa de cambios sobre el mapa del año final.
- En celulares, los dos mapas se apilan verticalmente para que se puedan usar con comodidad.

## 3. Más detalle al explicar los cambios

- La tabla de zonas ahora incluye una explicación en lenguaje sencillo de lo que representa cada tipo de cambio.
- Se muestran coordenadas aproximadas junto con la distancia y dirección respecto del centro.
- Se mantiene el botón “Ver en el mapa”; al usarlo, se abre la comparación y se enfoca la zona seleccionada.
- Se conservan los filtros por tipo de cambio, las estadísticas y las descargas CSV/PNG.

## 4. Uso más simple

- El panel explica el flujo de trabajo antes de empezar.
- Los campos están numerados para guiar al usuario: ciudad, años, época y tamaño del área.
- Se cambiaron textos técnicos del botón y del estado de procesamiento por indicaciones más claras.
- La documentación explica qué significa cada rol y cómo leer los resultados.

## 5. Comprobaciones realizadas

- Los archivos Python pasan una comprobación de sintaxis.
- Los archivos JavaScript pasan `node --check`.
- No se pudo ejecutar una prueba completa del servidor en este entorno porque no están instaladas las dependencias de Flask y del procesamiento geoespacial. El primer despliegue debe comprobarse en Render y sus registros.

## Importante antes de publicar

UrbanIA es una aplicación Flask, no un sitio estático. GitHub almacena el proyecto, pero no ejecuta el servidor Python. El enlace público de la aplicación lo entrega Render (o un proveedor equivalente). Se necesita configurar una base PostgreSQL persistente y las variables privadas de producción antes del primer despliegue.
