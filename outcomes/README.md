# Resultats (desenvolupament guiat per resultats)

Cada bloc de l'especificació v2.0 té aquí un fitxer de resultats. Un resultat és un cas concret amb dades i el resultat esperat, que es pot comprovar sense interpretar.

## Com es treballa

1. **Aprovació.** Un fitxer de resultats només es pot implementar quan la Laura l'ha aprovat (a la capçalera: `Estat: APROVAT` amb data). Si un resultat no es pot complir tal com està escrit, es para i se li pregunta; no es reinterpreta.
2. **Prova primer.** Per a cada resultat s'escriu primer la prova (Vitest per a la lògica, Playwright per al navegador, la vista mòbil i el mode sense connexió), es comprova que falla, i després s'escriu el codi que la fa passar. L'arnès Superpowers guia aquest cicle.
3. **Traçabilitat.** Cada prova porta l'identificador del resultat al nom (per exemple, `F-07 tancament amb diferència de −5 €`).
4. **Porta de sortida.** El hook `scripts/odd-gate.sh` executa `npm run check` en acabar cada torn. Si alguna prova falla, Claude Code no pot donar la feina per acabada.
5. **Revisió.** En acabar un bloc, un agent revisor independent comprova els resultats un per un i marca cada línia amb `✅` o `❌`. El bloc es tanca quan tots estan en `✅` i la Laura l'ha provat.

## Blocs

| Fitxer | Bloc | Estat |
| --- | --- | --- |
| `01-fira.md` | Fira: venda de paradeta sense connexió i caixa | Aprovat el 21/11/2026 |
