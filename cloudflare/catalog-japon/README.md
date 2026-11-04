# Catálogo Japón: consultas indexadas

El Worker público usa una proyección de los productos activos y visibles. El historial original en `productos_japon`, la sincronización y sus tombstones siguen siendo la fuente de verdad.

## Funcionamiento

- `catalog_public_v2` contiene solamente productos publicados y los campos compactos de búsqueda/filtro. Las imágenes y los datos mostrados se leen de la fuente únicamente para las filas de la página elegida.
- `catalog_search_v2` usa FTS5 trigram con `detail=none` y contenido externo. Los trigramas generan candidatos; `instr` verifica cada palabra literal y evita coincidencias falsas. Las palabras pueden estar en campos diferentes.
- `catalog_counts_v2` mantiene totales por anime, disponibilidad y rank. Los totales generales y los filtros sin precio/búsqueda no cuentan la tabla de productos.
- Los índices B-tree sirven a las listas por fecha, anime, disponibilidad, rank y precio. Los registros ocultos no participan en las consultas públicas.
- Triggers mantienen proyección, FTS y contadores dentro de la misma transacción de cada alta/cambio/baja/reactivación en la fuente. Cambios de bookkeeping (`source_seq`, timestamps, hashes) no reconstruyen el índice.
- Cache API comparte respuestas durante 30 segundos; una caché acotada por isolate y promesas compartidas evitan consultas duplicadas de páginas, recuentos y metadatos. Los errores nunca se cachean.
- La búsqueda libre necesita al menos una palabra de tres caracteres. Los términos más cortos acompañantes funcionan como filtros literales; los animes de nombre corto siguen accesibles mediante el selector. `%` y `_` se interpretan literalmente.
- Los parámetros no reconocidos no generan variantes de caché. Se limita longitud y cantidad de términos. No se expone el mensaje interno de la base al público.

## Pruebas

Con Node 24: `node test.mjs`. Compara 91 combinaciones contra una consulta de referencia, comprueba FTS, contadores, orden, backfill repetido, bajas/reactivaciones, cambios concurrentes durante la carga y coalescencia de veinte solicitudes iguales. Las pruebas usan SQLite en memoria y no acceden a red ni a producción.

## Instalación / reconstrucción

1. Guardar la versión actual del Worker, sus bindings, esquema y bookmark de D1 Time Travel. Una restauración completa de la base no es el rollback normal: sobrescribiría actualizaciones posteriores.
2. Aplicar `migration.sql` una sola vez con `wrangler d1 execute mardant-japon-db --remote --file migration.sql`. Solo añade tablas, índices y triggers. No insertar/actualizar manualmente la proyección: usar la fuente.
3. Registrar `target_rowid=MAX(rowid)` de la fuente en `catalog_build_v2`. Completar `backfill.sql.template` en rangos crecientes de rowid (por ejemplo 1,000–5,000 filas), usando parámetros enlazados en una sentencia individual, o enteros validados si se combina con la actualización del cursor. Guardar `last_rowid` solo después del INSERT. `INSERT OR IGNORE` permite repetir un rango tras un fallo sin duplicar postings ni contadores. Los triggers capturan simultáneamente las novedades; no hay que parar la sincronización.
4. Verificar cursor, totales fuente/proyección/contadores, búsquedas, estados y avance del sync. Establecer `ready=1` solamente después de una carga completa validada.
5. Validar el Worker en un servicio temporal con el mismo binding; después `wrangler deploy --config wrangler.jsonc`.
6. Verificar búsquedas, filtros, caché, registros y salud de sincronización. Revisar D1 Insights para confirmar la reducción de filas leídas.

El Worker se niega a consultar un índice no preparado. No reconstruir ni vaciar tablas derivadas en caliente mientras este Worker recibe tráfico.

## Rollback del despliegue del 3 de noviembre de 2026

`wrangler rollback f6e61c70-a5af-4210-b7ef-38dad3acc185 --name mardant-japon`

Si además hay que retirar la actualización del índice, eliminar solamente `pj_cp2_ai`, `pj_cp2_au` y `pj_cp2_ad` después de volver al Worker anterior. Conservar las tablas para investigar; no restaurar la base completa ni modificar productos, estados o secuencias del sync. Reanudar esos triggers requiere reconciliar la proyección antes de volver a v2.

## Capacidad

El crecimiento de registros desactivados ya no encarece la búsqueda pública. El trabajo de búsqueda depende de las coincidencias indexadas y de los productos visibles, no de recorrer el historial. Búsquedas muy amplias y páginas muy profundas siguen costando más; observar latencia, espacio D1 y tasa de sincronización al crecer. El índice reduce trabajo y no convierte una base de capacidad finita en almacenamiento ilimitado.
