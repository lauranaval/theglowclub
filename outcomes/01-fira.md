# Bloc 1 · Fira de Nadal de Llavaneres

Estat: APROVAT (Laura, 21/11/2026)
Data límit d'ús real: 5/12/2026 (proves a l'iPad abans del 3/12)
Fonts: `docs/Glow_Club_Especificacio_Funcional_v2.0.md` (Vendes i caixa; Arquitectura i funcionament sense connexió) i `docs/CATALEG_FIRA.md`.

Abast: base Cloudflare (Workers, D1, Access), PWA instal·lable, catàleg, venda ràpida sense connexió, sincronització, caixa per dispositiu, resum del dia i de l'esdeveniment, esdeveniment amb tallers d'inscripció externa. Fora d'abast: reserves, clientes, Tally, economia, tasques (blocs següents).

## Resultats

| Id | Cas | Resultat esperat | Com es comprova |
| --- | --- | --- | --- |
| F-01 | Petició a l'app sense identitat de Cloudflare Access | Resposta 403; cap dada | Vitest (Worker) |
| F-02 | Carregar el catàleg inicial | 12 productes amb els preus i charms inclosos de `CATALEG_FIRA.md`, inclosos charm bàsic (2 €) i especial (3 €) | Vitest |
| F-03 | Polsera d'eslabons + 1 charm especial + 1 charm bàsic, en efectiu | Total 17,00 €; una venda amb el desglossament 12 + 3 + 2; suma 17 € a l'efectiu de la caixa | Vitest + Playwright |
| F-04 | Collaret de cordill (5 €) + línia lliure «Peça personalitzada» 8 €, amb targeta | Una sola venda de 13,00 € amb dues línies; apareix una vegada a Targeta | Vitest + Playwright |
| F-05 | Polseres amistat | Una línia de 10,00 € (parell); no es pot vendre una unitat | Vitest |
| F-06 | Anul·lar una venda de 17 € indicant el motiu «duplicada» | El net del dia baixa 17 €; la venda queda visible com a anul·lada amb motiu, usuària i hora | Vitest |
| F-07 | Caixa: canvi inicial 50 €, vendes en efectiu 120 €, recompte 165 €; targeta 86 €, TPV 86 € | Efectiu esperat 170 €, diferència −5 €; targeta diferència 0 €; es pot desar una nota | Vitest + Playwright |
| F-08 | Imports amb cèntims (3 × 0,10 € de línia lliure) | Total 0,30 € exacte; tots els imports es desen en cèntims enters | Vitest |
| F-09 | 30 vendes sense connexió, tancar l'app i tornar-la a obrir | Les 30 vendes hi són; el comptador indica 30 pendents | Playwright (mode sense connexió) |
| F-10 | Torna la connexió amb 30 vendes pendents; la connexió es talla després d'enviar-ne 12 i torna | Al servidor hi ha exactament 30 vendes, sense duplicats; el comptador queda a 0 | Vitest + Playwright |
| F-11 | Tancar la caixa sense connexió | Calcula la diferència amb les vendes locals; el tancament se sincronitza quan torna la connexió | Playwright |
| F-12 | Dos dispositius venen sense connexió (dispositiu A: 3 vendes, 40 €; B: 2 vendes, 25 €) i sincronitzen | El resum de l'esdeveniment mostra 5 vendes i 65 €, amb dues caixes | Vitest |
| F-13 | Esdeveniment Llavaneres amb 4 tallers d'inscripció externa (2 infantils a 10 €, 2 d'adults a 15 €) sense recompte | Cada taller mostra «Ocupació desconeguda»; cap import d'inscripcions a la caixa ni als pendents | Vitest |
| F-14 | Fer la venda de F-03 en amplada de mòbil (390 px) i d'iPad (820 px) | Flux complet sense desplaçament horitzontal; total i botons de pagament sempre visibles; tots els botons ≥ 44 px | Playwright |
| F-15 | Primera càrrega amb connexió i després sense connexió | L'app obre i permet vendre; té manifest i service worker (instal·lable a la pantalla d'inici) | Playwright |
| F-16 | La sessió d'accés ha caducat amb vendes pendents | L'app demana tornar a entrar i no perd cap venda pendent | Playwright |
| F-17 | Descarregar còpia d'emergència amb 5 vendes pendents | Es descarrega un fitxer amb les 5 vendes i els seus imports | Playwright |
| F-18 | Còpia diària de la base de dades | Una tasca programada exporta D1 a un repositori privat cada dia; es verifica una restauració de prova | Manual, al desplegament |

## Verificació a l'iPad (la Laura, abans del 3/12)

- [ ] Instal·lar l'app a la pantalla d'inici.
- [ ] Activar el mode avió, fer 5 vendes, tancar i obrir l'app: hi són.
- [ ] Desactivar el mode avió: se sincronitzen i es veuen des de l'ordinador.
- [ ] Obrir i tancar una caixa de prova.
