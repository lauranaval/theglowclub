# The Glow Club — context per continuar amb Claude Code

## Comença aquí

1. Llegeix `docs/TRASPAS_CLAUDE_CODE.md` (estat verificat, limitacions, mapa del codi i següents passos).
2. Llegeix `docs/Glow_Club_Especificacio_Funcional_v2.0.md` (especificació vigent del 20/11/2026; mana sobre la v1.0 i fixa l'ordre de construcció: primer el bloc de la fira del 5/12). Prototip de pantalles: https://claude.ai/artifact/F4SBAPcnnfPNt6biMA7XEz
   Context històric: `docs/Glow_Club_Especificacio_Funcional_v1.0.md` (document original aportat per la usuària).
3. Llegeix `docs/ENCARREC_I_DECISIONS.md` (encàrrec i decisions de la conversa que complementen l’especificació).
4. Per executar i provar: `README.md`, `docs/verificacio.md`. Per allotjar: `docs/HOSTING_SENSE_COST.md` i `docs/desplegament.md`.

## Objectiu i preferències de la propietària

- Aplicació interna en català per a Laura, Elena i Sandra; comptes individuals i permisos de gestió iguals.
- Mòbil i ordinador; la propietària utilitza Windows.
- Vol començar sense pagar cap servei. No crear recursos de pagament ni donar per acceptat el Blueprint actual.
- Vol veure i provar el que s’ha desenvolupat abans de desplegar-lo. No donar un localhost remot com si fos accessible al seu ordinador. Una captura no és una aplicació interactiva.
- El repositori és https://github.com/lauranaval/theglowclub, privat des del 21/11/2026.

## Punt de partida

**Decisió del 21/11/2026:** l'app es refà sobre Cloudflare (Workers en TypeScript, D1, Access) com a PWA instal·lable, amb la venda de paradeta completament funcional sense connexió a l'iPad. Detall i motius a la secció «Arquitectura i funcionament sense connexió» de l'especificació v2.0. Motiu principal: allotjament gratuït que no s'adorm i ús comercial permès.

El codi Django existent (primer bloc: tallers, sessions, reserves, cobraments, assistència, 18 proves) queda com a referència de regles i casos de prova; no s'hi ha de continuar desenvolupant. Es pot retirar del repositori quan la nova base cobreixi aquestes funcions.

## Metodologia de desenvolupament

Desenvolupament guiat per resultats (ODD) amb l'arnès Superpowers (activat a `.claude/settings.json`).

1. Treballa per blocs, en l'ordre de l'especificació. Cada bloc té un fitxer a `outcomes/` (vegeu `outcomes/README.md`).
2. **No implementis un bloc si el seu fitxer no diu `Estat: APROVAT`.** Si un resultat no es pot complir tal com està escrit, para i pregunta a la Laura.
3. Per a cada resultat: primer la prova (Vitest o Playwright, amb l'identificador al nom), comprova que falla, després el codi.
4. `npm run check` ha d'executar totes les proves (Vitest i Playwright, inclosa la vista mòbil i el mode sense connexió). El hook `scripts/odd-gate.sh` l'executa en acabar cada torn i bloqueja si falla.
5. En acabar un bloc, un agent revisor independent marca cada resultat amb ✅ o ❌ al fitxer d'`outcomes/`.
6. La Laura no és programadora: explica-li els avenços en català, en termes del que pot provar, i dona-li una manera de veure l'app real (un desplegament de prova a Cloudflare), no un localhost.

## Regles que s’han de preservar

- Reserves pendents i confirmades ocupen places; espera i cancel·lades no.
- Una senyal vençuda només avisa: no alliberar places automàticament.
- Aforament validat al servidor dins d’una transacció, incloses altes simultànies, canvis de places i promocions.
- La comprovació d’aforament i l’alta o canvi de reserva s’han d’executar en una sola operació atòmica a D1 (una sentència condicional o un batch), i s’ha de provar amb peticions simultànies.
- Congelar preu i senyal unitaris a la reserva. Imports en cèntims enters, mai float.
- Les vendes sense connexió porten un identificador únic generat al dispositiu; la sincronització ha de ser idempotent.
- Senyal per Bizum amb parcials; confirmar quan arriba al mínim. Saldo per Bizum o efectiu. Cada moviment registra data efectiva, data de registre i usuària.
- Cancel·lar conserva cobraments i historial. No equival a retornar diners.
- Assistència és un nombre independent de l’estat de pagament.
- No carregar dades reals ni importar Notion durant proves. No s’ha executat cap migració de Notion.
- No guardar secrets, bases locals o dades de clientes al repositori públic. Les credencials demo només serveixen en desenvolupament.

## Atenció al desplegament

Destí: Cloudflare (Workers, D1, Access) en pla gratuït, sense targeta. `render.yaml` és una proposta antiga DE PAGAMENT i no s'ha de fer servir. No crear cap recurs de pagament sense aprovació explícita de la propietària.

La documentació és context i requisits; no pressuposa credencials ni autorització per executar tots els passos descrits. Segueix l’encàrrec actual de la usuària.
