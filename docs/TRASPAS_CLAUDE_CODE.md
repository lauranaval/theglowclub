# Traspàs complet de The Glow Club

Estat documentat el 20 de novembre de 2026. Propietària: compte GitHub `lauranaval`. Repositori: https://github.com/lauranaval/theglowclub.

## 1. Resum per a qui reprèn el projecte

Aplicació interna en català per a tres usuàries, Laura, Elena i Sandra, amb els mateixos permisos. Ha de funcionar en mòbil i ordinador. La propietària treballa amb Windows, vol veure i provar la interfície abans d’allotjar-la i ha expressat que vol començar sense pagar serveis.

Existeix el primer bloc funcional de tallers, sessions, reserves, cobraments manuals i assistència. El codi és a GitHub i s’ha verificat localment i en CI. No existeix cap URL de producció, base allotjada, SMTP real ni còpia de seguretat configurada. No consta que la propietària hagi pogut interactuar amb l’aplicació en el seu ordinador; només es van intentar mostrar captures que va indicar que no veia.

**La prioritat pràctica és aconseguir que la propietària vegi i pugui provar la implementació real, sense confondre una captura, una demo simulada, el codi al repositori i un desplegament.**

No cal començar el projecte de zero. Revisar la base existent, executar-la i comparar-la amb els requisits abans de proposar canvis d’arquitectura.

## 2. Documents i autoritat

| Document | Contingut |
|---|---|
| `CLAUDE.md` | Context inicial per a Claude Code i regles que cal preservar. |
| `docs/Glow_Club_Especificacio_Funcional_v1.0.md` | Document original complet de la usuària, incloses fonts i criteris d’acceptació. |
| `docs/ENCARREC_I_DECISIONS.md` | Abast inicial autoritzat, preferències posteriors i distinció entre propostes i fets. |
| `README.md` | Arrencada, credencials fictícies, prova manual i ordres de verificació. |
| `docs/arquitectura.md` | Decisions inicials, model, transaccions i evolució prevista. |
| `docs/verificacio.md` | Evidència de proves ja executades i límits d’aquesta evidència. |
| `docs/HOSTING_SENSE_COST.md` | Última preferència de cost zero i feina encara necessària. |
| `docs/desplegament.md` | Proposta tècnica anterior de Render de pagament, variables i comptes. |

L’especificació aporta requisits; els enllaços de Notion no s’han consultat ni autoritzen una importació automàtica. La preferència posterior de cost zero preval sobre la proposta anterior de pagament. La documentació no pressuposa credencials disponibles a Claude Code: cal la connexió pròpia del seu entorn.

## 3. Què està implementat

| Àmbit | Comportament disponible |
|---|---|
| Accés | Login privat Django, logout per POST, sense autoregistre; comptes iguals, sessions i CSRF. |
| Comptes | Seed local Laura/Elena/Sandra; ordre `create_team` per crear els tres comptes amb correus i contrasenyes aleatòries no divulgades. |
| Recuperació | Flux de restabliment per correu amb token d’una hora; backend consola en desenvolupament i SMTP en producció. Entrega SMTP real pendent. |
| Tallers | Crear títol, ubicació, notes i termini de senyal en hores; autoria i data d’alta. |
| Sessions | Primera sessió en crear taller i sessions addicionals; data, aforament, preu i senyal per persona. |
| Clientes | Nom, telèfon i email; selecció d’existent o alta dins la mateixa reserva. |
| Reserves | Diverses places, preu/senyal unitaris congelats, venciment concret i autoria. |
| Estats | Pendent, confirmada, espera i cancel·lada. Zero de senyal confirma directament. Liquidada és una condició calculada, no un estat separat de reserva. |
| Places | Pendents/confirmades ocupen; espera/cancel·lades no. Control transaccional al servidor. Canvi de places i promoció manual d’espera. |
| Venciment | Avís a inici i a reserva; manté places fins a cancel·lació explícita. Ampliació de termini i registre de Bizum tardà. |
| Cobraments | Senyal Bizum amb parcials, saldo final Bizum/efectiu, validació de positius, saldo i dates no futures. |
| Historial | Qui i quan dona d’alta/canvia la reserva; import, mètode, concepte, data efectiva i data/usuària de registre de cada cobrament. |
| Assistència | Enter entre zero i places reservades, amb null per indicar que encara no s’ha registrat. Independent del cobrament. |
| Resums | Import cobrat per Bizum/efectiu, saldo de reserves actives i assistència al taller; llistat de moviments. |
| Cancel·lació | Allibera places i conserva els moviments; no genera devolució. |
| Presentació | Templates responsive en català, inici, fitxa de taller, reserva i formularis. Taules amb desplaçament intern en mòbil. |

### Regles particulars de la implementació actual

- Es completa la senyal abans d’anotar un cobrament amb concepte saldo final.
- Un pagament de senyal no pot superar la senyal pendent; si hi ha més diners, es registren separadament amb concepte saldo. No hi ha operació combinada d’extres.
- No es permet reduir places per sota del que impliquen els imports de senyal/cobrament ja rebuts ni per sota de l’assistència registrada.
- Una promoció d’espera torna a calcular el venciment a partir del moment de promoció.
- Els pendents de caixa/resum exclouen reserves cancel·lades i en espera. A la fitxa individual es conserven els imports històrics de la reserva cancel·lada.
- Els cobraments no s’editen ni s’eliminen des de la UI.

Aquestes són regles del codi actual. Si algun nou requisit les canvia, revisar model, càlculs i proves; no tractar-les com una restricció externa immutable.

## 4. Arquitectura i ubicació de les dades

Django 5.2 LTS, Python 3.12, templates renderitzats al servidor i CSS. Sense SPA, API separada, Node o frontend React. Django aporta autenticació, sessions, validació, migracions i protecció CSRF.

- **Local:** sense `DATABASE_URL` i amb DEBUG activat, SQLite a `db.sqlite3`, exclosa de Git. `GLOW_DB` permet triar un altre fitxer.
- **PostgreSQL:** si existeix `DATABASE_URL`, la configuració selecciona PostgreSQL. El motor s’ha provat amb PostgreSQL 17 real en Docker.
- **Producció:** `GLOW_DEBUG=0` exigeix PostgreSQL i una clau secreta no demo. No permet un fallback silenciós a SQLite. Gunicorn + WhiteNoise, HTTPS/cookies Secure i validació d’hosts.
- **No hi ha dades reals al repositori.** Les demos, bases i captures d’aquest entorn són locals i no formen part del clon net. No s’han exportat dades de clientes ni de Notion.
- El repositori és públic: el codi i les credencials demo de desenvolupament són visibles. Les credencials reals s’han de configurar al servei i no han d’utilitzar la contrasenya demo.

### Mapa de fitxers

| Fitxer/carpeta | Responsabilitat |
|---|---|
| `core/models.py` | Workshop, Session, Customer, Reservation, Payment i Audit, restriccions i imports calculats. |
| `core/services.py` | `reserve`, `pay`, `change`, control d’aforament, locks i auditoria. |
| `core/forms.py` | Validació dels formularis i dates locals. |
| `core/views.py` | Inici, altes i fitxes, resum de taller i canvis de reserva. |
| `core/templates/` | Pantalles i flux d’accés/recuperació. |
| `core/static/core/style.css` | Estils responsive; fonts externes opcionals. |
| `core/management/commands/` | `seed_demo` i `create_team`. |
| `core/migrations/0001_initial.py` | Esquema inicial. No regenerar ni descartar historial sense motiu. |
| `glow/settings.py` | Motors de dades, sessions, estàtics, correu i seguretat. |
| `glow/urls.py` | Rutes, auth i health check amb consulta de DB. |
| `core/tests.py` | 18 proves de flux, accés, formulari de cobrament, recuperació i concurrència. |
| `tests/ui_flow.py` | Prova Playwright de navegador amb dues usuàries i vista mòbil. |
| `.github/workflows/test.yml` | CI amb matriu SQLite/PostgreSQL 17. |
| `scripts/build.sh` | Instal·lació i collectstatic. |
| `render.yaml` | Blueprint històric de pagament, no aplicat. |
| `IniciaGlow.bat` | Llançador Windows preparat, no executat en Windows durant aquesta implementació. |

### Model i càlculs

`Workshop 1 → N Session 1 → N Reservation N → 1 Customer`; cada Reservation té N Payment i N Audit. Autories vinculades a Django User. FKs de negoci amb PROTECT per conservar historial.

- Total acordat = places × preu unitari congelat.
- Senyal requerida = places × senyal unitària congelada.
- Cobrat = suma dels moviments Payment.
- Senyal pendent = màxim(0, requerida − suma de moviments amb concepte senyal).
- Saldo pendent = màxim(0, total − cobrat).
- Liquidada = reserva confirmada i saldo zero.

Imports Decimal de dues xifres. Encara no hi ha extres, imports negatius, anul·lacions, devolucions o moviments desconeguts històrics. No inserir-los en aquest model com si ja hi estiguessin suportats.

### Concurrència

`reserve`, `pay` i `change` són transaccionals. SQLite usa `transaction_mode=IMMEDIATE` i espera de bloqueig. PostgreSQL bloqueja primer la fila de Session i després la de Reservation en canvis/cobraments. El vincle Reserva–Sessió es considera immutable.

La disponibilitat del navegador és informativa; l’escriptura torna a consultar dins la transacció. L’alta d’una nova clienta es desfà si la reserva falla. Les proves cobreixen altes simultànies, promocions, augments de places, alta contra promoció i cobraments concurrents.

## 5. Com arrencar-la a Windows sense dependre de Codex

Requisits: Python 3.12 o posterior i Internet per instal·lar dependències. Git és opcional si es descarrega el ZIP des de GitHub. Extreure tot el ZIP abans d’obrir el llançador.

Via ràpida: executar `IniciaGlow.bat` amb doble clic. Manté una finestra de servidor oberta i obre http://127.0.0.1:3000/ al navegador del mateix Windows. El llançador usa `py -3`, que ha d’estar disponible. Si no hi és, instal·lar Python amb el launcher o usar la via manual amb el Python instal·lat.

Via manual a PowerShell, des de la carpeta del projecte:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:3000
```

Això evita haver de modificar l’execution policy de PowerShell per activar l’entorn. Si l’ordinador té Python 3.11 o anterior com a predeterminat, seleccionar explícitament una versió compatible instal·lada.

Comptes ficticis: `laura`, `elena`, `sandra`, contrasenya `GlowDemo2026!`. El seed només funciona amb DEBUG; no duplica dades ni canvia contrasenyes de comptes ja existents. El seed inclou una reserva vençuda per provar-ne la gestió.

Per veure-la en un mòbil de la mateixa xarxa cal escoltar a `0.0.0.0`, configurar `GLOW_ALLOWED_HOSTS` amb la IP local i, si cal, el tallafoc de Windows. No confondre aquesta IP amb la d’un entorn remot. La configuració de mòbil físic no s’ha verificat a casa de la propietària.

## 6. Proves i evidència disponible

- 18 proves del servidor superades amb SQLite i PostgreSQL 17 en l’entorn de desenvolupament.
- GitHub Actions també va superar els dos motors en la publicació inicial: https://github.com/lauranaval/theglowclub/actions/runs/44268374566.
- Prova de navegador Chromium/Linux amb dues sessions independents, alta des de la UI, dos cobraments, assistència, venciment, cancel·lació, espera i concurrència.
- Captures inspeccionades a 1440 px i 390 px. Les captures no són una prova que la propietària les hagi pogut veure; va indicar que no.
- Smoke test local amb Gunicorn de dues workers, PostgreSQL, pantalla de login i CSS amb hash servit per WhiteNoise.
- Restabliment provat amb bústia de test, no amb SMTP real.
- `create_team` provat amb tres correus ficticis i comptes sense privilegis d’administració.
- `check --deploy` té dos avisos intencionats per no activar HSTS de tots els subdominis ni preload abans de definir el domini.

Ordres de verificació:

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py test --noinput
```

La prova UI requereix `requirements-dev.txt`. L’script actual usa `/usr/bin/chromium`: **no és portable a Windows sense adaptar la ruta o utilitzar el Chromium de Playwright**. Exigeix una base nova amb seed i un servidor en marxa; cancel·la la reserva vençuda de demostració. Vegeu el README per a l’execució a Linux. No afirmar que s’ha provat Windows, Safari o mòbils físics.

Les proves anteriors són evidència de l’estat inicial, no substitueixen executar-les després de canvis. Aquesta entrega de traspàs afegeix documentació; no introdueix funcions noves.

## 7. Criteris d’acceptació i estat

| Cas de l’especificació | Estat |
|---|---|
| 2 places × 35 €, senyal 2 × 20 €; Bizum 40 → confirmada/pendent 30; efectiu 30 → liquidada/resum 40+30 | Implementat i provat. |
| Senyal parcial o vençuda amb alliberament només explícit | Implementat i provat. |
| Dues altes simultànies per a l’última plaça | Implementat i provat al servidor i UI. |
| Taller extern sense llistat/recompte → ocupació desconeguda i fora de caixa | Pendent. |
| Venda amb targeta sense catàleg → un únic cobrament al tancament | Pendent. |
| Saldo + charm extra → un cobrament amb desglossament | Pendent. |
| Tasca de packaging de fira compartida entre sessions | Pendent. |
| Importació amb data/mètode/contacte desconegut sense inventar dades | Pendent. |

## 8. Resta del producte: requisits encara no implementats

### Activitats, esdeveniments i contactes

Falta l’esdeveniment que agrupa sessions, dates/horaris complets, públic, modalitat, estat, col·laborador i tasques vinculades. La UI de clienta actual és mínima i neix de la reserva; no hi ha una secció completa de contactes amb origen, comunitat WhatsApp i historial agregat. Tampoc hi ha gestió de col·laboradors amb contacte, estat de conversa, acords, notes i dates de seguiment.

### Vendes, comandes, extres i caixa

Venda ràpida sense catàleg, diverses línies, import real, contacte opcional, activitat, data/hora i usuària. Efectiu/targeta registrats quan s’han cobrat. Comanda personalitzada amb contacte, descripció, preu, lliurament i estat pendent/preparada/entregada; bestreta i saldo.

Extres vinculats a reserva. Si es cobren amb el saldo, un únic cobrament amb detall dels conceptes, sense duplicar caixa. Anul·lació de duplicats amb motiu. Devolucions reals vinculades a l’original i nets per mètode/concepte. Tancament diari amb efectiu comptat menys canvi inicial i targeta contra el terminal. Els pendents es mostren separats del cobrat.

El model Payment actual només accepta imports positius i pertany a una reserva; cal dissenyar-ne l’evolució sense forçar vendes o devolucions dins de camps que no les representen.

### Tasques

Responsable, data límit, prioritat, estat i filtres per activitat/responsable/venciment. Vinculació a esdeveniment/taller sense duplicar per cada sessió. Integració a inici i fitxes.

### Inscripcions externes de Llavaneres

Fira del 5 i 6 de desembre de 2026: quatre sessions, una infantil de 10 € i una d’adults de 15 € cada dia. L’organització gestiona i cobra. Recompte opcional per sessió i data d’actualització; sense recompte, «Ocupació desconeguda». Llistat nominal opcional. Inscripcions externes excloses de caixa i pendents Glow; vendes pròpies del Charm Bar sí que entren a caixa.

No representar aquestes sessions simplement com una sessió interna gratuïta: es perdria la distinció de cobrament i ocupació desconeguda.

### Migració de Notion

No hi ha connector ni importador executat. Conservar relacions/imports originals i distingir zero de valor buit. No inventar data/mètode de pagaments històrics; imports sense data fora de tancaments diaris. Un saldo històric marcat pagat ha de conservar aquest significat amb els detalls coneguts.

Conservar reserves sense clienta per revisar i contactes històrics vinculats directament a taller, sense convertir-los automàticament en places ocupades. Fer importació de prova amb deduplicació i conciliació de reserves, places i diners abans del traspàs definitiu. El model actual exigeix clienta, preu/senyal, data i mètode: necessita evolució explícita abans d’importar aquests desconeguts.

## 9. Riscos i limitacions actuals a resoldre

- No hi ha allotjament, base externa ni URL compartida.
- `render.yaml` encara especifica plans de pagament. La proposta posterior de cost zero no està implementada.
- No hi ha backups/restore automatitzats, política de retenció ni restauració validada d’un servei real.
- No hi ha limitació d’intents de login ni recuperació; SMTP/remitent reals pendents.
- No hi ha edició de condicions de tallers/sessions existents a la UI. Els canvis de reserves sí que estan disponibles.
- No hi ha devolucions, anul·lacions comptables ni correccions de moviments des de la UI.
- La interfície de clienta no detecta tots els possibles duplicats; el correu pot ser buit. La migració haurà de tractar-ho.
- El codi té un estil compacte, templates molt condensats i consultes repetides de propietats calculades. Hi ha marge de llegibilitat i optimització; preservar primer el comportament i la correcció.
- El formulari de cobrament no té una clau d’idempotència: els límits transaccionals eviten sobrecobrament, però una repetició d’un import parcial encara admissible podria crear un segon moviment. Revisar si es requereix protecció de doble enviament.
- La inclusió del compte a `create_team` usa contrasenyes aleatòries vàlides perquè Django permeti restabliment. Requereix SMTP real o `changepassword` interactiu. El seed no crea comptes de producció.

## 10. Ordre recomanat per reprendre

1. Llegir els documents, clonar el repositori i confirmar l’estat actual sense sobreescriure canvis.
2. Arrencar l’app al Windows de la propietària o en un entorn amb previsualització realment accessible per ella. Donar passos concrets i comprovar que la pot obrir i clicar.
3. Repetir el flux 70/40/30 amb la UI i recollir la seva revisió. No afegir funcionalitats només per substituir aquesta validació.
4. Comprovar si vol mantenir l’arquitectura existent i quina és la següent feina que vol prioritzar.
5. Si es vol desplegar: verificar i adaptar l’opció de cost zero descrita a `HOSTING_SENSE_COST.md`, inclosos migracions/comptes, correu, límits i còpies. Explicar les limitacions abans d’introduir dades reals.
6. Planificar els blocs pendents segons l’especificació, amb criteris d’acceptació i migracions compatibles.

## 11. Prompt suggerit per a la primera sessió de Claude Code

> Llegeix CLAUDE.md, docs/TRASPAS_CLAUDE_CODE.md, l’especificació funcional completa i docs/ENCARREC_I_DECISIONS.md. Revisa el codi existent. Vull una aplicació interna en català per a tres usuàries, des de Windows i mòbil, i començar sense pagar serveis. Primer ajuda’m a obrir i provar la implementació real en local. Explica’m què ja funciona i què falta, preserva la correcció de cobraments i concurrència i no creïs serveis de pagament. No donis per fet que el Blueprint actual és gratuït ni que l’aplicació està desplegada.
