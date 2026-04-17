# Generador de Títulos en VIDA (estático)

Herramienta pequeña y estática para generar títulos usando una fuente WOFF2 local y exportarlos como PNG transparentes.

- Cómo usar
- Coloca tu archivo WOFF2 en `fonts/Vida-Regular.woff2` (sobrescribe el placeholder).
- Abre `index.html` en el navegador (preferiblemente servido por `http://localhost` o HTTPS para la copia al portapapeles de imágenes).
- Escribe el título, ajusta `Tamaño` y `Color`, pulsa `Copiar PNG` o `Descargar PNG`.

Dónde cambiar la configuración
- Ruta de la fuente: editar `CONFIG.FONT_PATH` en `script.js` (línea superior).
- Colores: editar el array `CONFIG.COLORS` en `script.js`.
- Ancho máximo de render: editar `CONFIG.MAX_RENDER_WIDTH` en `script.js`.
- Nombre de archivo: la descarga usa `getDownloadFilename()` y `CONFIG.FALLBACK_FILENAME` en `script.js`.

Ajustes tipográficos
- Separación entre dos líneas: editar `CONFIG.TWO_LINE_GAP_FACTOR` en `script.js` (valor por defecto `0.08`, es fracción del tamaño de fuente).

Manifest y iconos
- Para que la app sea instalable, hay un `manifest.json` que referencia `icons/icon-192.png` y `icons/icon-512.png`.
- Coloca las imágenes en la carpeta `icons/` con esos nombres (192x192 y 512x512 PNG).

Notas
- La copia de imagen al portapapeles funciona mejor en HTTPS o en `localhost` y en navegadores modernos (Chromium/Firefox recientes).
- Esta es una web estática sin dependencias.
