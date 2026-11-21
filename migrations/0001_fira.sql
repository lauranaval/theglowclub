-- Bloc 1 · Fira: catàleg, esdeveniments, tallers externs, caixes i vendes de paradeta.
-- Imports sempre en cèntims enters. Res no s'esborra: les anul·lacions són registres a part.

CREATE TABLE productes (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  categoria TEXT NOT NULL,                 -- polsera | collaret | arracades | charm
  preu_cents INTEGER NOT NULL CHECK (preu_cents >= 0),
  charms_inclosos INTEGER NOT NULL DEFAULT 0,
  nota TEXT,
  unitat TEXT NOT NULL DEFAULT 'unitat' CHECK (unitat IN ('unitat', 'parell')),
  tipus_charm TEXT CHECK (tipus_charm IN ('basic', 'especial')),
  ordre INTEGER NOT NULL DEFAULT 0,
  actiu INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE esdeveniments (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  data_inici TEXT NOT NULL,
  data_fi TEXT NOT NULL,
  ubicacio TEXT,
  organitzacio TEXT,
  notes TEXT
);

CREATE TABLE tallers (
  id TEXT PRIMARY KEY,
  esdeveniment_id TEXT REFERENCES esdeveniments(id),
  nom TEXT NOT NULL,
  data TEXT,
  hora_inici TEXT,
  hora_fi TEXT,
  public TEXT NOT NULL CHECK (public IN ('infantil', 'adult', 'familia')),
  modalitat TEXT NOT NULL CHECK (modalitat IN ('propi', 'extern')),
  preu_cents INTEGER,
  recompte INTEGER,                        -- només tallers externs; NULL = ocupació desconeguda
  recompte_actualitzat_a TEXT
);

CREATE TABLE caixes (
  id TEXT PRIMARY KEY,                     -- generat al dispositiu
  dispositiu_id TEXT NOT NULL,
  esdeveniment_id TEXT REFERENCES esdeveniments(id),
  dia TEXT NOT NULL,                       -- aaaa-mm-dd, hora local del dispositiu
  oberta_a TEXT NOT NULL,
  canvi_inicial_cents INTEGER NOT NULL CHECK (canvi_inicial_cents >= 0),
  usuaria_obertura TEXT NOT NULL,
  tancada_a TEXT,
  recompte_efectiu_cents INTEGER,
  tpv_targeta_cents INTEGER,
  nota TEXT,
  usuaria_tancament TEXT,
  registrada_a TEXT NOT NULL,
  registrada_per TEXT NOT NULL
);

CREATE TABLE vendes (
  id TEXT PRIMARY KEY,                     -- generat al dispositiu: reenviar-la no la duplica
  caixa_id TEXT NOT NULL REFERENCES caixes(id),
  dispositiu_id TEXT NOT NULL,
  esdeveniment_id TEXT REFERENCES esdeveniments(id),
  dia TEXT NOT NULL,
  creada_a TEXT NOT NULL,
  metode TEXT NOT NULL CHECK (metode IN ('efectiu', 'targeta')),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  usuaria TEXT NOT NULL,
  registrada_a TEXT NOT NULL,
  registrada_per TEXT NOT NULL
);
CREATE INDEX vendes_dia ON vendes (dia);
CREATE INDEX vendes_esdeveniment ON vendes (esdeveniment_id);
CREATE INDEX vendes_dispositiu ON vendes (dispositiu_id);

CREATE TABLE linies_venda (
  venda_id TEXT NOT NULL REFERENCES vendes(id),
  posicio INTEGER NOT NULL,
  pare INTEGER,                            -- posició de la línia de producte a la qual s'afegeix un charm
  tipus TEXT NOT NULL CHECK (tipus IN ('producte', 'lliure')),
  producte_id TEXT REFERENCES productes(id),
  descripcio TEXT NOT NULL,
  preu_cents INTEGER NOT NULL CHECK (preu_cents >= 0),
  quantitat INTEGER NOT NULL CHECK (quantitat >= 1),
  PRIMARY KEY (venda_id, posicio)
);

CREATE TABLE anulacions (
  id TEXT PRIMARY KEY,
  venda_id TEXT NOT NULL UNIQUE REFERENCES vendes(id),
  motiu TEXT NOT NULL,
  usuaria TEXT NOT NULL,
  creada_a TEXT NOT NULL,
  registrada_a TEXT NOT NULL,
  registrada_per TEXT NOT NULL
);
