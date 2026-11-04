-- Additive migration. The original products, sync state and tombstones are untouched.
CREATE TABLE IF NOT EXISTS catalog_public_v2 (
 source_rowid INTEGER PRIMARY KEY, id_lote TEXT NOT NULL UNIQUE,
 lote_num INTEGER NOT NULL, anime TEXT NOT NULL, precio_num REAL,
 is_preventa INTEGER NOT NULL, has_rank INTEGER NOT NULL, search_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cp2_newest ON catalog_public_v2(lote_num DESC);
CREATE INDEX IF NOT EXISTS idx_cp2_anime ON catalog_public_v2(anime COLLATE NOCASE,lote_num DESC);
CREATE INDEX IF NOT EXISTS idx_cp2_price ON catalog_public_v2((precio_num IS NULL),precio_num,lote_num DESC);
CREATE INDEX IF NOT EXISTS idx_cp2_price_desc ON catalog_public_v2((precio_num IS NULL),precio_num DESC,lote_num DESC);
CREATE INDEX IF NOT EXISTS idx_cp2_price_range ON catalog_public_v2(precio_num,lote_num DESC);
CREATE INDEX IF NOT EXISTS idx_cp2_availability ON catalog_public_v2(is_preventa,lote_num DESC);
CREATE INDEX IF NOT EXISTS idx_cp2_rank ON catalog_public_v2(has_rank,lote_num DESC);
CREATE TABLE IF NOT EXISTS catalog_counts_v2 (
 anime TEXT NOT NULL, is_preventa INTEGER NOT NULL, has_rank INTEGER NOT NULL,
 total INTEGER NOT NULL CHECK(total>=0), PRIMARY KEY(anime,is_preventa,has_rank)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_cc2_anime ON catalog_counts_v2(anime COLLATE NOCASE);
CREATE VIRTUAL TABLE IF NOT EXISTS catalog_search_v2 USING fts5(
 search_text, content='catalog_public_v2',content_rowid='source_rowid',
 tokenize='trigram',detail='none',columnsize=0
);
CREATE TABLE IF NOT EXISTS catalog_build_v2 (
 id INTEGER PRIMARY KEY CHECK(id=1), last_rowid INTEGER NOT NULL DEFAULT 0,
 target_rowid INTEGER NOT NULL DEFAULT 0, ready INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO catalog_build_v2(id) VALUES(1);

CREATE TRIGGER IF NOT EXISTS cp2_ai AFTER INSERT ON catalog_public_v2 BEGIN
 INSERT INTO catalog_search_v2(rowid,search_text) VALUES(new.source_rowid,new.search_text);
 INSERT INTO catalog_counts_v2(anime,is_preventa,has_rank,total)
 VALUES(new.anime,new.is_preventa,new.has_rank,1)
 ON CONFLICT(anime,is_preventa,has_rank) DO UPDATE SET total=total+1;
END;
CREATE TRIGGER IF NOT EXISTS cp2_ad AFTER DELETE ON catalog_public_v2 BEGIN
 INSERT INTO catalog_search_v2(catalog_search_v2,rowid,search_text)
 VALUES('delete',old.source_rowid,old.search_text);
 UPDATE catalog_counts_v2 SET total=total-1
 WHERE anime=old.anime AND is_preventa=old.is_preventa AND has_rank=old.has_rank;
 DELETE FROM catalog_counts_v2 WHERE total=0;
END;

CREATE TRIGGER IF NOT EXISTS pj_cp2_ai AFTER INSERT ON productos_japon
WHEN new.activo=1 AND UPPER(COALESCE(new.visible,'SI'))='SI' BEGIN
 INSERT INTO catalog_public_v2(source_rowid,id_lote,lote_num,anime,precio_num,is_preventa,has_rank,search_text) SELECT new.rowid,new.id_lote,new.lote_num,COALESCE(new.anime,''),new.precio_num,CASE WHEN LOWER(COALESCE(new.etiqueta,''))='preventa' OR LOWER(COALESCE(new.busqueda,'')) LIKE '%amazon%' THEN 1 ELSE 0 END,CASE WHEN TRIM(COALESCE(new.rank,''))<>'' THEN 1 ELSE 0 END,LOWER(COALESCE(new.id_lote,'')) || char(31) || LOWER(COALESCE(new.etiqueta,'')) || char(31) || LOWER(COALESCE(new.anime,'')) || char(31) || LOWER(COALESCE(new.tipo,'')) || char(31) || LOWER(COALESCE(new.busqueda,''));
END;
CREATE TRIGGER IF NOT EXISTS pj_cp2_ad AFTER DELETE ON productos_japon BEGIN
 DELETE FROM catalog_public_v2 WHERE source_rowid=old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS pj_cp2_au AFTER UPDATE ON productos_japon
WHEN old.id_lote IS NOT new.id_lote OR old.lote_num IS NOT new.lote_num OR old.anime IS NOT new.anime OR old.etiqueta IS NOT new.etiqueta OR old.tipo IS NOT new.tipo OR old.busqueda IS NOT new.busqueda OR old.precio_num IS NOT new.precio_num OR old.rank IS NOT new.rank OR old.activo IS NOT new.activo OR old.visible IS NOT new.visible OR old.rowid IS NOT new.rowid BEGIN
 DELETE FROM catalog_public_v2 WHERE source_rowid=old.rowid;
 INSERT INTO catalog_public_v2(source_rowid,id_lote,lote_num,anime,precio_num,is_preventa,has_rank,search_text) SELECT new.rowid,new.id_lote,new.lote_num,COALESCE(new.anime,''),new.precio_num,CASE WHEN LOWER(COALESCE(new.etiqueta,''))='preventa' OR LOWER(COALESCE(new.busqueda,'')) LIKE '%amazon%' THEN 1 ELSE 0 END,CASE WHEN TRIM(COALESCE(new.rank,''))<>'' THEN 1 ELSE 0 END,LOWER(COALESCE(new.id_lote,'')) || char(31) || LOWER(COALESCE(new.etiqueta,'')) || char(31) || LOWER(COALESCE(new.anime,'')) || char(31) || LOWER(COALESCE(new.tipo,'')) || char(31) || LOWER(COALESCE(new.busqueda,'')) WHERE new.activo=1 AND UPPER(COALESCE(new.visible,'SI'))='SI';
END;
