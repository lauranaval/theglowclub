-- Dades només per a les proves de navegador. Les carrega scripts/servidor-local.mjs en mode --proves,
-- a la base de proves (.wrangler/proves), que s'esborra a cada arrencada. No s'apliquen mai a producció.
-- Esdeveniment propi de la prova F-12 de e2e/revisio.spec.ts: cap altra prova hi ven.
INSERT INTO esdeveniments (id, nom, data_inici, data_fi, notes)
VALUES ('esd-proves-f12', 'Prova F-12', '2027-01-10', '2027-01-11', 'Esdeveniment de proves');
