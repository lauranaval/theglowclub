-- Dades inicials del bloc 1: catàleg de docs/CATALEG_FIRA.md (21/11/2026) i Fira de Nadal de Llavaneres.
-- No conté dades de clientes.

INSERT INTO productes (id, nom, categoria, preu_cents, charms_inclosos, nota, unitat, tipus_charm, ordre) VALUES
  ('polsera-eslabons', 'Polsera d''eslabons + 3 charms', 'polsera', 1200, 3, NULL, 'unitat', NULL, 10),
  ('collaret-eslabons', 'Collaret d''eslabons + 3 charms', 'collaret', 1500, 3, NULL, 'unitat', NULL, 20),
  ('collaret-cordill', 'Collaret de cordill + 1 charm', 'collaret', 500, 1, NULL, 'unitat', NULL, 30),
  ('polsera-vellut', 'Polsera de vellut + 2 charms', 'polsera', 600, 2, NULL, 'unitat', NULL, 40),
  ('polseres-amistat', 'Polseres amistat (parell)', 'polsera', 1000, 2, '1 charm per polsera + cor d''imant. Només es venen en parella.', 'parell', NULL, 50),
  ('collarets-cadeneta-parell', 'Collarets de cadeneta fina + charm BFF + 1 charm (parell)', 'collaret', 1600, 4, '2 charms per collaret', 'parell', NULL, 60),
  ('collaret-cadeneta-unitat', 'Collaret de cadeneta fina + charm BFF + 1 charm (unitat)', 'collaret', 900, 2, NULL, 'unitat', NULL, 70),
  ('arracades-floreta', 'Arracades floreta', 'arracades', 500, 0, NULL, 'parell', NULL, 80),
  ('arracades-boles', 'Arracades boles', 'arracades', 600, 0, NULL, 'parell', NULL, 90),
  ('arracades-aro-finet', 'Arracades d''aro finet + charm (parell)', 'arracades', 800, 2, '1 charm per arracada', 'parell', NULL, 100),
  ('charm-basic', 'Charm extra bàsic', 'charm', 200, 0, 'S''afegeix a qualsevol producte', 'unitat', 'basic', 110),
  ('charm-especial', 'Charm extra especial', 'charm', 300, 0, 'La venedora tria bàsic o especial a cada venda', 'unitat', 'especial', 120);

INSERT INTO esdeveniments (id, nom, data_inici, data_fi, ubicacio, organitzacio, notes) VALUES
  ('fira-nadal-llavaneres-2026', 'Fira de Nadal de Llavaneres', '2026-12-05', '2026-12-06', 'Llavaneres', 'Organització de la fira',
   'Les inscripcions als tallers les gestiona i cobra l''organització. Les vendes del Charm Bar entren a la caixa de Glow.');

INSERT INTO tallers (id, esdeveniment_id, nom, data, public, modalitat, preu_cents, recompte) VALUES
  ('llavaneres-infantil-0512', 'fira-nadal-llavaneres-2026', 'Taller infantil', '2026-12-05', 'infantil', 'extern', 1000, NULL),
  ('llavaneres-adult-0512', 'fira-nadal-llavaneres-2026', 'Taller d''adults', '2026-12-05', 'adult', 'extern', 1500, NULL),
  ('llavaneres-infantil-0612', 'fira-nadal-llavaneres-2026', 'Taller infantil', '2026-12-06', 'infantil', 'extern', 1000, NULL),
  ('llavaneres-adult-0612', 'fira-nadal-llavaneres-2026', 'Taller d''adults', '2026-12-06', 'adult', 'extern', 1500, NULL);
