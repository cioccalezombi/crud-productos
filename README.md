# CRUD de productos

Aplicación de gestión de productos hecha con JavaScript (ES modules) y Vite, sin frameworks. Los datos se guardan en `localStorage`.

## Funciones
- Alta, edición y baja de productos (con confirmación al eliminar)
- Validación de formulario con mensajes por campo
- Búsqueda por nombre o categoría y ordenamiento
- Resumen con cantidad de productos y valor total del inventario
- Aviso visual de stock bajo (5 o menos)
- Exportar e importar en JSON (combinar o reemplazar, con validación de cada producto)
- Paginación de 8 productos por página

## Estructura
- `src/store.js` – capa de datos (CRUD + localStorage), validación y normalización
- `src/main.js` – interfaz y eventos
- `src/utils.js` – paginación y descarga de archivos
- `src/store.test.js`, `src/utils.test.js` – tests con Vitest (el storage se inyecta, no hace falta navegador)

## Uso
```bash
npm install
npm run dev     # desarrollo
npm test        # tests
npm run build   # producción
```
