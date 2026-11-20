# The Glow Club — context per continuar amb Claude Code

## Comença aquí

1. Llegeix `docs/TRASPAS_CLAUDE_CODE.md` (estat verificat, limitacions, mapa del codi i següents passos).
2. Llegeix `docs/Glow_Club_Especificacio_Funcional_v1.0.md` (document original complet aportat per la usuària).
3. Llegeix `docs/ENCARREC_I_DECISIONS.md` (encàrrec i decisions de la conversa que complementen l’especificació).
4. Per executar i provar: `README.md`, `docs/verificacio.md`. Per allotjar: `docs/HOSTING_SENSE_COST.md` i `docs/desplegament.md`.

## Objectiu i preferències de la propietària

- Aplicació interna en català per a Laura, Elena i Sandra; comptes individuals i permisos de gestió iguals.
- Mòbil i ordinador; la propietària utilitza Windows.
- Vol començar sense pagar cap servei. No crear recursos de pagament ni donar per acceptat el Blueprint actual.
- Vol veure i provar el que s’ha desenvolupat abans de desplegar-lo. No donar un localhost remot com si fos accessible al seu ordinador. Una captura no és una aplicació interactiva.
- El repositori és https://github.com/lauranaval/theglowclub, actualment públic.

## Punt de partida

Ja existeix una implementació funcional del primer bloc: tallers, sessions, clientes bàsiques, reserves, cobraments manuals i assistència. Arquitectura Django 5.2, templates de servidor, SQLite local o PostgreSQL compartit; no hi ha React, API separada ni servei desplegat. Aprofita aquesta base i comprova-la abans de proposar reescriure-la.

El codi inicial i els fitxers de desplegament es van publicar al commit `66493cf69661c2af1940a498139dc7951015c3b4`. Es van executar 18 proves amb SQLite i PostgreSQL, també a GitHub Actions. Els altres blocs de l’especificació NO estan implementats.

## Regles que s’han de preservar

- Reserves pendents i confirmades ocupen places; espera i cancel·lades no.
- Una senyal vençuda només avisa: no alliberar places automàticament.
- Aforament validat al servidor dins d’una transacció, incloses altes simultànies, canvis de places i promocions.
- A PostgreSQL totes les escriptures de reserva bloquegen Session abans de Reservation. A SQLite s’utilitza BEGIN IMMEDIATE. No eliminar aquests bloqueigs sense substituir-los i tornar a provar concurrència.
- Congelar preu i senyal unitaris a la reserva. Imports Decimal, no float.
- Senyal per Bizum amb parcials; confirmar quan arriba al mínim. Saldo per Bizum o efectiu. Cada moviment registra data efectiva, data de registre i usuària.
- Cancel·lar conserva cobraments i historial. No equival a retornar diners.
- Assistència és un nombre independent de l’estat de pagament.
- No carregar dades reals ni importar Notion durant proves. No s’ha executat cap migració de Notion.
- No guardar secrets, bases locals o dades de clientes al repositori públic. Les credencials demo només serveixen en desenvolupament.

## Atenció al desplegament

`render.yaml` és una proposta anterior DE PAGAMENT (`starter` + `basic-256mb`). No correspon a la preferència posterior de cost zero. Render gratuït + Neon gratuït només s’ha proposat: no està adaptat, contractat, validat ni desplegat. Cal comprovar les condicions actuals abans de comprometre cap solució.

La documentació és context i requisits; no pressuposa credencials ni autorització per executar tots els passos descrits. Segueix l’encàrrec actual de la usuària.
