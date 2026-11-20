# Decisions tècniques i límits

> Per a l’estat consolidat del traspàs, consulta `TRASPAS_CLAUDE_CODE.md`. Per a la preferència posterior d’allotjament sense pagar, consulta `HOSTING_SENSE_COST.md`.

## Base escollida

El repositori inicial només contenia l’especificació funcional. Django 5.2 LTS proporciona autenticació individual amb contrasenyes xifrades per hash, sessions al servidor, formularis validats, escapament HTML i CSRF, sense afegir una API i una aplicació de client separades. Les pàgines renderitzades al servidor funcionen sense JavaScript; CSS adapta la presentació al mòbil. SQLite permet una arrencada local sense serveis addicionals i una base compartida per les tres usuàries en un únic servidor. No hi ha alta pública ni permisos diferents entre Laura, Elena i Sandra.

## Model implementat

- **Workshop**: títol, ubicació, notes, termini en hores i autoria/data d’alta. Agrupa sessions.
- **Session**: data, aforament, preu i senyal per persona, autoria/data. Només s’implementen sessions amb cobraments propis.
- **Customer**: nom i contacte, autoria/data. La reserva pot seleccionar-la o donar-la d’alta atòmicament.
- **Reservation**: una sessió i una clienta, diverses places, preu i senyal unitaris congelats, venciment concret, estat i assistència nullable (no registrada és diferent de zero).
- **Payment**: registre independent amb import decimal, data efectiva, mètode, concepte, data de registre i usuària. No hi ha cap booleà «pagat» que substitueixi els moviments. El saldo i els resums es calculen. Els cobraments es conserven encara que es cancel·li la reserva; els pendents actius exclouen cancel·lades i espera.
- **Audit**: alta i canvis de reserva, usuària i instant del servidor. Els canvis d’assistència, places, venciment, cancel·lació, promoció i cobraments passen per serveis transaccionals.

Les claus foranes utilitzen PROTECT per conservar historial. Imports amb Decimal i dues xifres, mai float. Les condicions dels tallers i sessions es defineixen en crear-los; la interfície no inclou edició posterior. El canvi de places conserva el preu per persona original, i no permet reduccions incompatibles amb els diners ja rebuts. Una senyal zero confirma directament; no es confon amb un valor desconegut.

## Places i concurrència

Les pendents de senyal i confirmades ocupen plaça. Espera i cancel·lades no. El venciment és un avís calculat, sense tasca automàtica que cancel·li reserves. Cancel·lar allibera places, i la promoció de l’espera és explícita. S’amplien terminis només a una data futura posterior a l’actual.

SQLite està configurada amb `transaction_mode=IMMEDIATE` i timeout de 20 segons. Els serveis d’alta, canvi de places, promoció i cobrament obren una transacció **abans** de llegir aforament o imports. BEGIN IMMEDIATE serialitza escriptores entre processos i connexions: la segona usuària llegeix el recompte després del commit de la primera. No es confia en `select_for_update` a SQLite (no bloqueja files aquí). La validació no depèn del nombre de places que es veia al navegador. Una clienta creada dins d’una alta fallida també es desfà.

PostgreSQL ja està suportat amb `DATABASE_URL`. Totes les operacions d’escriptura de reserves bloquegen primer la mateixa fila de Session amb `SELECT FOR UPDATE`; els canvis i cobraments bloquegen després la Reservation. L’ordre és consistent per evitar interbloqueigs. La relació Reserva–Sessió és immutable. Així una alta, promoció o augment de places espera les altres operacions de la mateixa sessió i torna a comprovar l’ocupació. També s’han afegit proves mixtes d’alta/promoció i d’augment de places. Vegeu `docs/desplegament.md` per a Render i els passos encara pendents.

Els cobraments també se serialitzen: dos pagaments simultanis no poden superar el pendent. La senyal és només Bizum, amb parcials fins al mínim requerit; el saldo final es registra després de completar-la, en Bizum o efectiu. Es rebutgen dates futures, imports nuls/negatius i sobrepagaments. No es cobren reserves en espera o cancel·lades.

## Evolució prevista

La separació Taller/Sessió/Reserva/Moviment evita barrejar ocupació amb caixa i facilita afegir esdeveniments que agrupin sessions. Per als següents blocs es preveuen entitats explícites de venda, línia, comanda, extra i moviment de devolució vinculat a l’original; un desglossament ha de permetre un cobrament únic sense duplicar caixa. No es creen taules buides ni funcionalitats anticipades.

Les sessions externes necessitaran modalitat de cobrament i recompte extern nullable, separat de reserves internes i caixa. La migració afegirà identificadors de font únics, camps històrics desconeguts i conciliació: no s’han de convertir imports desconeguts en zero ni inventar dates/mètodes. Col·laboradors i tasques es vincularan a taller/esdeveniment, sense duplicar per sessió.

## Abans d’utilitzar dades reals

Aquest lliurament és una base local funcional. Falta configurar allotjament, HTTPS, servidor WSGI i servei d’estàtics, còpies de seguretat verificades i gestió/recuperació de comptes. Per desplegar: `GLOW_DEBUG=0`, una `GLOW_SECRET_KEY` secreta i persistent i `GLOW_ALLOWED_HOSTS` explícit. Amb DEBUG=0 s’exigeix clau i les cookies són Secure; no utilitzis les credencials demo. Cal afegir limitació d’intents d’accés i recuperació. SQLite ha de residir en disc local persistent, compartit pel mateix servei, sense rèpliques amb fitxers separats ni volums de xarxa.

Els moviments no s’editen ni s’eliminen des de la interfície; les devolucions i anul·lacions comptables vinculades queden pendents. Una cancel·lació conserva el cobrat i no pressuposa cap devolució. L’aplicació no comprova ni executa transferències Bizum: només anota imports ja rebuts.


Actualització de desplegament: `GLOW_DEBUG=0` ara requereix PostgreSQL i `DATABASE_URL`; SQLite només és per a desenvolupament. Hi ha recuperació de contrasenya implementada i provada amb bústia de test, pendent de configurar i provar SMTP real. WhiteNoise serveix estàtics i Gunicorn serveix Django en el desplegament proposat.
