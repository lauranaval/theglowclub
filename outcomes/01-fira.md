# Bloc 1 · Fira de Nadal de Llavaneres

Estat: APROVAT (Laura, 21/11/2026)
Data límit d'ús real: 5/12/2026 (proves a l'iPad abans del 3/12)
Fonts: `docs/Glow_Club_Especificacio_Funcional_v2.0.md` (Vendes i caixa; Arquitectura i funcionament sense connexió) i `docs/CATALEG_FIRA.md`.

Abast: base Cloudflare (Workers, D1, Access), PWA instal·lable, catàleg, venda ràpida sense connexió, sincronització, caixa per dispositiu, resum del dia i de l'esdeveniment, esdeveniment amb tallers d'inscripció externa. Fora d'abast: reserves, clientes, Tally, economia, tasques (blocs següents).

## Resultats

| Id | Cas | Resultat esperat | Com es comprova | Revisió |
| --- | --- | --- | --- | --- |
| F-01 | Petició a l'app sense identitat de Cloudflare Access | Resposta 403; cap dada | Vitest (Worker) | ✅ |
| F-02 | Carregar el catàleg inicial | 12 productes amb els preus i charms inclosos de `CATALEG_FIRA.md`, inclosos charm bàsic (2 €) i especial (3 €) | Vitest | ✅ |
| F-03 | Polsera d'eslabons + 1 charm especial + 1 charm bàsic, en efectiu | Total 17,00 €; una venda amb el desglossament 12 + 3 + 2; suma 17 € a l'efectiu de la caixa | Vitest + Playwright | ✅ |
| F-04 | Collaret de cordill (5 €) + línia lliure «Peça personalitzada» 8 €, amb targeta | Una sola venda de 13,00 € amb dues línies; apareix una vegada a Targeta | Vitest + Playwright | ✅ |
| F-05 | Polseres amistat | Una línia de 10,00 € (parell); no es pot vendre una unitat | Vitest | ✅ |
| F-06 | Anul·lar una venda de 17 € indicant el motiu «duplicada» | El net del dia baixa 17 €; la venda queda visible com a anul·lada amb motiu, usuària i hora | Vitest | ✅ |
| F-07 | Caixa: canvi inicial 50 €, vendes en efectiu 120 €, recompte 165 €; targeta 86 €, TPV 86 € | Efectiu esperat 170 €, diferència −5 €; targeta diferència 0 €; es pot desar una nota | Vitest + Playwright | ✅ |
| F-08 | Imports amb cèntims (3 × 0,10 € de línia lliure) | Total 0,30 € exacte; tots els imports es desen en cèntims enters | Vitest | ✅ |
| F-09 | 30 vendes sense connexió, tancar l'app i tornar-la a obrir | Les 30 vendes hi són; el comptador indica 30 pendents | Playwright (mode sense connexió) | ✅ |
| F-10 | Torna la connexió amb 30 vendes pendents; la connexió es talla després d'enviar-ne 12 i torna | Al servidor hi ha exactament 30 vendes, sense duplicats; el comptador queda a 0 | Vitest + Playwright | ✅ |
| F-11 | Tancar la caixa sense connexió | Calcula la diferència amb les vendes locals; el tancament se sincronitza quan torna la connexió | Playwright | ✅ |
| F-12 | Dos dispositius venen sense connexió (dispositiu A: 3 vendes, 40 €; B: 2 vendes, 25 €) i sincronitzen | El resum de l'esdeveniment mostra 5 vendes i 65 €, amb dues caixes | Vitest | ✅ |
| F-13 | Esdeveniment Llavaneres amb 4 tallers d'inscripció externa (2 infantils a 10 €, 2 d'adults a 15 €) sense recompte | Cada taller mostra «Ocupació desconeguda»; cap import d'inscripcions a la caixa ni als pendents | Vitest | ✅ |
| F-14 | Fer la venda de F-03 en amplada de mòbil (390 px) i d'iPad (820 px) | Flux complet sense desplaçament horitzontal; total i botons de pagament sempre visibles; tots els botons ≥ 44 px | Playwright | ✅ |
| F-15 | Primera càrrega amb connexió i després sense connexió | L'app obre i permet vendre; té manifest i service worker (instal·lable a la pantalla d'inici) | Playwright | ✅ |
| F-16 | La sessió d'accés ha caducat amb vendes pendents | L'app demana tornar a entrar i no perd cap venda pendent | Playwright | ✅ |
| F-17 | Descarregar còpia d'emergència amb 5 vendes pendents | Es descarrega un fitxer amb les 5 vendes i els seus imports | Playwright | ✅ |
| F-18 | Còpia diària de la base de dades | Una tasca programada exporta D1 a un repositori privat cada dia; es verifica una restauració de prova | Manual, al desplegament | ❌ |

## Verificació a l'iPad (la Laura, abans del 3/12)

- [ ] Instal·lar l'app a la pantalla d'inici.
- [ ] Activar el mode avió, fer 5 vendes, tancar i obrir l'app: hi són.
- [ ] Desactivar el mode avió: se sincronitzen i es veuen des de l'ordinador.
- [ ] Obrir i tancar una caixa de prova.

## Revisió independent (21/11/2026)

Execucions: `npm run typecheck` sense errors; `npx vitest run` 18/18 passen; `npx playwright test` 12/12 passen (mòbil 390 px i iPad 820 px per a F-14). Comprovació addicional del revisor (fora del repositori): a 390 px, totes les pantalles (obrir caixa, diàleg de línia lliure, avís de venda, Caixa, Resum, Fira, Més) tenen tots els controls ≥ 44 px i cap desplaçament horitzontal.

### ❌

- **F-18** — pendent: no hi ha desplegament ni tasca programada. No hi ha cap Worker amb `triggers.crons` a `wrangler.jsonc`, cap flux de GitHub Actions que faci `wrangler d1 export` (`.github/workflows/test.yml` encara és la verificació de Django) ni cap restauració de prova documentada (`docs/desplegament.md:36` diu que no hi ha cap còpia externa configurada).

### Reserves en resultats marcats ✅ (no impedeixen el resultat tal com està escrit, però s'haurien de corregir)

1. **Tancament de caixa que es pot perdre (afecta F-11).** `src/client/magatzem.ts:73` marca com a sincronitzat el registre *actual* de la base local (`{ ...actual, sync: 1 }`), no la versió que s'ha enviat. Si una sincronització amb la caixa encara oberta és en curs i en aquell moment es tanca la caixa (`src/client/app.ts:300-308` la desa amb `sync: 0`), la resposta marca la caixa tancada com a sincronitzada i el tancament no s'envia mai al servidor. Cal comparar la versió (p. ex. `tancadaA`) abans de marcar-la.
2. **La usuària de vendes, anul·lacions i caixes la diu el dispositiu (afecta F-06).** El servidor desa `v.usuaria`, `a.usuaria`, `usuariaObertura` i `usuariaTancament` tal com arriben (`src/worker/dades.ts:162`, `src/worker/dades.ts:194`) sense comparar-les amb la identitat verificada d'Access; la verificada només va a `registrada_per`, que `resum` no retorna. Una usuària autenticada podria anul·lar en nom d'una altra. La identitat d'Access, en canvi, no es pot falsificar: el JWT es verifica (signatura RS256, `iss`, `aud`, `exp`) i la cookie i les rutes `/dev/*` només funcionen amb `DEV_AUTH=1`, que només posa `scripts/servidor-local.mjs`.
3. **Anul·lacions acceptades però no desades.** Una segona anul·lació de la mateixa venda amb un altre id topa amb `UNIQUE (venda_id)` i `ON CONFLICT DO NOTHING` (`src/worker/dades.ts:192`), però es retorna igualment com a acceptada (`src/worker/dades.ts:196`). El dispositiu la mostra sincronitzada amb un motiu que el servidor no té (dos dispositius que anul·len la mateixa venda sense connexió).
4. **Anul·lació d'una venda rebutjada queda pendent per sempre.** `src/client/app.ts:161` només envia anul·lacions de vendes del lot o ja sincronitzades; si la venda va ser rebutjada (`sync: 2`), l'anul·lació no s'envia mai i la barra mostra «Canvis de caixa per sincronitzar» indefinidament.
5. **F-13: prova poc exigent.** `pendentsCents` és la constant `0` (`src/worker/dades.ts:333`) i la prova comprova que la caixa és igual a la suma de les vendes, que és cert per construcció. Avui no hi ha cap camí perquè una inscripció externa entri a la caixa, per tant el resultat es compleix, però la prova no detectaria una regressió futura.
6. **F-12: resum de l'esdeveniment només a l'API.** La prova filtra per esdeveniment *i* dia (`test/f07-f13-caixa-sync-fira.test.ts`, «F-12») i l'app no té cap pantalla que mostri el resum de l'esdeveniment (la pantalla Resum demana `/api/resum?dia=` sense esdeveniment, `src/client/app.ts:229`; Fira no mostra imports). Es compleix com a Vitest, que és el que fixa el resultat.
7. **F-16: caducitat simulada en mode de prova.** La prova esborra la cookie de desenvolupament; el client tracta `opaqueredirect`/401/403 com a sessió caducada (`src/client/app.ts:134`), que és el que hauria de fer Access, però el comportament real d'Access s'ha de comprovar al desplegament.
8. **`USUARIES` buit** a `wrangler.jsonc:27`: a producció qualsevol identitat que passi la política d'Access entra. Cal omplir-lo amb els tres correus en desplegar.

## Segona revisió (21/11/2026)

Execucions: `npm run typecheck` sense errors; `npx vitest run` 25/25 passen (5 fitxers, 7 proves noves a `test/revisio.test.ts`); `npm run test:e2e` 15/15 passen (3 proves noves a `e2e/revisio.spec.ts`; F-14 a 390 px i 820 px). La columna «Revisió» es manté: F-01..F-17 ✅, F-18 ❌.

### ❌

- **F-18** — continua pendent: no hi ha `triggers.crons` a `wrangler.jsonc`, `.github/workflows/test.yml` continua sent el flux de Django i no hi ha cap `wrangler d1 export` ni restauració de prova. `docs/desplegament.md:11` ho reconeix explícitament.

### Estat de les reserves de la primera revisió

1. **Tancament de caixa que es pot perdre (F-11): resolta.** `marca` rep la versió enviada i no marca el registre si ha canviat mentrestant (`src/client/magatzem.ts:84`); `src/client/app.ts:172-200` passa `enviat` per a acceptades i rebutjades. El registre queda `sync: 0` i el bucle (`src/client/app.ts:157`) l'envia de nou a la volta següent. La prova `e2e/revisio.spec.ts:5` reté la petició amb la caixa oberta, tanca la caixa, allibera la petició i comprova al servidor `recompteEfectiuCents = 2000`: sense l'arranjament fallaria.
2. **Usuària declarada pel dispositiu (F-06): resolta en part.** El servidor rebutja caixes, vendes i anul·lacions amb una usuària que no és a `USUARIES` (`src/worker/dades.ts:87-88`, `:108`, `:153`, `:191`), i `resum` ara retorna `registradaPer` (identitat d'Access verificada) a vendes, anul·lacions i caixes (`src/worker/dades.ts:293`, `:307`, `:337`). Queda: (a) una usuària de l'equip encara pot declarar-ne una altra de l'equip; (b) l'app no mostra `registradaPer` enlloc (`src/client/app.ts:575` mostra l'usuària declarada), només l'API; (c) amb `USUARIES` buit, com està ara a `wrangler.jsonc:27`, el control no s'aplica (`src/worker/dades.ts:88`). Amb permisos iguals per a les tres, és acceptable com a reserva.
3. **Anul·lacions acceptades però no desades: resolta per al cas seqüencial i dins d'un lot.** `anulacionsExistents` + mapa per venda (`src/worker/dades.ts:101`, `:193-197`) rebutgen la segona anul·lació amb «la venda ja estava anul·lada» i accepten el reenviament del mateix id. Proves `test/revisio.test.ts:49` i `:64`, exactes. Queda una finestra de carrera: la comprovació és una lectura prèvia i la inserció es fa després en un altre batch amb `ON CONFLICT DO NOTHING` (`src/worker/dades.ts:206`); dues peticions `/api/sync` simultànies de dos dispositius per a la mateixa venda poden passar totes dues la comprovació i la segona es retornaria com a acceptada sense desar-se. Probabilitat baixa; no hi ha prova de concurrència.
4. **Anul·lació d'una venda rebutjada pendent per sempre: resolta.** `src/client/app.ts:160-166` marca aquestes anul·lacions com a error (`sync: 2`) abans d'enviar el lot. La prova `e2e/revisio.spec.ts:37` simula un servidor que rebutja la venda i comprova «2 amb errors» i que ja no apareix «per sincronitzar».
5. **F-13, prova poc exigent: millorada, no resolta del tot.** `test/revisio.test.ts:91` crea un esdeveniment propi amb 4 tallers externs (2 × 10 €, 2 × 15 €) i 2 vendes, i comprova la caixa exacta (22 €) i «Ocupació desconeguda». És una prova millor, però `pendentsCents` continua sent la constant `0` (`src/worker/dades.ts:363`): no detectaria una regressió als pendents fins que existeixin. El resultat es compleix.
6. **F-12, resum de l'esdeveniment només a l'API: resolta.** La pantalla Fira mostra el resum de totes les caixes de l'esdeveniment (`src/client/app.ts:594-602`, desat per consultar sense connexió a `:242-249`). `test/revisio.test.ts:78` fa servir dos dispositius en dies diferents i filtra només per esdeveniment (5 vendes, 65 €, 2 caixes, exacte); `e2e/revisio.spec.ts:65` ho comprova a la pantalla amb dos contextos de navegador (per diferència, perquè la base de proves és compartida).
7. **F-16, caducitat simulada: sense canvis** (inherent; s'ha de comprovar amb Access real al desplegament).
8. **`USUARIES` buit: documentada, no resolta.** `docs/desplegament.md:8` ara ho exigeix en desplegar, però `wrangler.jsonc:27` continua buit. Ara és més important: sense `USUARIES` tampoc s'aplica el control de la reserva 2.

### Problemes nous o observacions

- **(Baixa) Vendes amb usuària «desconeguda» rebutjades per sempre.** `usuaria()` retorna `"desconeguda"` si no hi ha dades descarregades (`src/client/app.ts:64`), i obrir caixa i vendre amb línies lliures no requereix dades (`src/client/app.ts:519-531`). Amb `USUARIES` configurat, aquestes vendes ara es rebutgen (`src/worker/dades.ts:153`) i queden com a error sense cap camí per reenviar-les (es conserven a la còpia d'emergència). Abans s'acceptaven. Cas poc probable (cal que l'app s'obri sense haver descarregat mai `/api/dades`), però s'hauria d'impedir obrir caixa sense usuària coneguda.
- **(Baixa) Rebuig sense remei.** Qualsevol registre rebutjat per «usuària no permesa» (p. ex. si es corregeix un correu a `USUARIES` amb vendes pendents) queda en `sync: 2` per sempre; no hi ha cap acció per tornar-lo a enviar.
- **(Informativa) Les proves de navegador no exerceixen el control d'usuàries.** `scripts/servidor-local.mjs:27` no passa `USUARIES`; el control només el cobreix Vitest (`vitest.config.ts:14`).
- **(Informativa) Possible inestabilitat de `e2e/revisio.spec.ts:65`.** Compta per diferència sobre la base compartida amb `fullyParallel` i 2 workers (`playwright.config.ts:10-11`); si una altra prova obrís una caixa a l'esdeveniment de Llavaneres en paral·lel, fallaria. Avui cap altra prova ho fa.
