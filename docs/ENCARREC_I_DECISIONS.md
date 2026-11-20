# Encàrrec i decisions de la conversa

Data del traspàs: 20 de novembre de 2026.

## Fonts i com interpretar-les

- `Glow_Club_Especificacio_Funcional_v1.0.md` és una còpia íntegra del document aportat per la usuària. És la font dels requisits funcionals complets.
- Aquest document recull l’encàrrec explícit i les preferències posteriors. En cas de diferència, cal tenir en compte l’última indicació de la usuària.
- Les propostes tècniques de l’assistent es distingeixen de les decisions de la usuària. Una proposta no és un servei contractat ni desplegat.
- El document original afirma que s’han revisat esquemes de Notion i quatre reserves de Can Nadal. Això és informació de l’especificació aportada: en aquesta implementació no s’ha accedit a Notion ni s’ha verificat aquella revisió de manera independent.

## Encàrrec inicial

La usuària va demanar començar una aplicació web interna de The Glow Club, en català, per a tres usuàries i usable des del mòbil i l’ordinador. Calia llegir l’especificació, revisar el repositori i aprofitar una arquitectura existent; si només hi havia el document, escollir una arquitectura senzilla amb autenticació individual i base de dades compartida. Calia documentar l’arrencada local, justificar la tria i implementar el primer bloc.

### Primer bloc autoritzat: tallers, reserves i cobraments

- Accés privat, comptes individuals i els mateixos permisos per a les tres usuàries.
- Crear tallers i sessions amb aforament, preu, senyal per persona i termini de pagament. Fitxa amb places disponibles, reserves i imports pendents.
- Seleccionar o donar d’alta una clienta des de la reserva. Diverses places en una reserva, amb preu i senyal conservats des de l’alta.
- Estats pendent de senyal, confirmada, espera i cancel·lada. Validar aforament al servidor, també si dues usuàries intenten ocupar l’última plaça alhora.
- Senyal vençuda: mostrar avís i alliberar només manualment.
- Cobraments manuals: senyal per Bizum amb parcials; confirmar en arribar al mínim. Saldo final en efectiu o Bizum. Cada moviment desa import, data, mètode, concepte i qui l’ha registrat.
- Assistència per nombre de participants i resum de cobraments per mètode al taller.
- Fer servir dades fictícies.

### Proves requerides explícitament

Reserva de dues places a 35 € cadascuna i senyal de 20 € per persona. Després de 40 € per Bizum: confirmada, 30 € pendents. Després de 30 € en efectiu: liquidada, dos cobraments visibles al resum. Comprovar també venciment, alliberament manual i concurrència per a l’última plaça, inclòs el flux des de la interfície.

### Ajornat expressament

Vendes, comandes, extres, tasques, seguiment de col·laboradors, sessions amb cobrament extern i migració de Notion. Cal tenir-ho present al model, però no donar-ho per implementat.

## Preferències i fets posteriors

| Tema | Indicació o fet |
|---|---|
| Ordinador | La propietària utilitza Windows. |
| Visualització | Vol veure i provar l’aplicació abans d’allotjar-la. Els enllaços localhost remots no li funcionaven i les captures emeses al xat no se li mostraven. No consta que hagi arribat a provar-la al seu Windows. |
| Cost | Va demanar explícitament una opció sense pagar. Aquesta preferència és posterior al Blueprint de pagament. |
| GitHub | El seu repositori és `lauranaval/theglowclub`. El va fer públic i va connectar GitHub amb permisos d’escriptura. |
| Publicació del codi | El primer bloc és al repositori; les proves de GitHub Actions passen. Això no equival a allotjar l’aplicació. |
| Arquitectura | Django + SQLite local es van escollir perquè inicialment només hi havia l’especificació. Després es va afegir suport PostgreSQL i preparació Render. |
| Hosting | Render + PostgreSQL de pagament es va proposar inicialment. Després es va proposar Render gratuït + Neon gratuït. La segona opció no s’ha implementat ni verificat amb els proveïdors. |
| Serveis | No s’ha contractat res, no hi ha una URL de producció i no s’han creat bases de dades allotjades ni configurat correu real. |
| Continuïtat | La usuària ha demanat deixar tota la documentació al repositori per continuar amb Claude Code. |

## Què no s’ha decidit encara

No hi ha aprovació d’un proveïdor/pla amb condicions vigents verificades, domini propi, correus definitius de les tres usuàries, proveïdor SMTP, política de còpies ni calendari dels blocs següents. No inventar aquests detalls. Tampoc interpretar la configuració tècnica existent com a autorització per generar costos.
