# Verificació del primer bloc · 17 de novembre de 2026

Entorn: Python 3.12, Django 5.2.19, SQLite, Chromium del sistema amb Playwright 1.65.2. No s’han utilitzat dades reals ni serveis externs de cobrament.

## Resultats

- `python manage.py check`: sense incidències.
- `python manage.py makemigrations --check --dry-run`: sense canvis pendents.
- `python manage.py test --noinput`: 14 proves superades, incloses connexions concurrents sobre SQLite de fitxer.
- `python tests/ui_flow.py`: flux complet superat amb navegador real i dos contextos autenticats independents.

## Flux observat a la interfície

| Pas | Resultat |
|---|---|
| Nova reserva de 2 places, preu 35 €, senyal 20 € per persona | Total 70 €, senyal requerida 40 €, dues places ocupades |
| Registrar 40 € per Bizum | Confirmada, saldo 30 € |
| Registrar 30 € en efectiu | Liquidada, saldo 0 € |
| Obrir fitxa del taller | Bizum 40 €, efectiu 30 €, dos moviments atribuïts a Laura |
| Desar assistència 2 | Resum del taller mostra 2 participants |
| Obrir reserva vençuda del seed | Avís visible; 11 de 12 places disponibles, la reserva encara ocupa plaça |
| Alliberar explícitament | Reserva cancel·lada; 12 de 12 places disponibles |
| Laura i Elena envien dues reserves per a una única plaça | Una acceptada, l’altra rebutjada per manca de places |
| Enviar la rebutjada a espera | No ocupa plaça; promoció rebutjada mentre la sessió és plena |
| Vista de 390 px amb Elena | Dades compartides visibles, formularis i fitxa sense desbordament de pàgina; taules amb desplaçament intern |

Les proves de servidor també comproven senyal parcial 15 + 25 €, zero de senyal, cobrament tardà, ampliació del termini, preservació dels preus, límits d’assistència, reversió de clienta en alta fallida, conservació de cobraments després de cancel·lar, CSRF i accés privat. Les proves concurrents cobreixen altes HTTP autenticades, promocions i intents de cobrament simultani.

Durant la verificació UI es va detectar i corregir el tipus del mínim decimal al formulari de cobrament; s’hi va afegir una prova HTTP de regressió. Les captures de treball es generen a `work/inici-desktop.png`, `work/taller-cobraments.png` i `work/taller-mobil.png`.

## Abast pendent

Vendes, comandes, extres, tasques, seguiment de col·laboradors, sessions de cobrament extern i migració de Notion queden per als blocs següents. També queden pendents devolucions vinculades i anul·lacions comptables, edició de condicions de tallers/sessions existents i preparació del desplegament real (HTTPS, còpies i recuperació de comptes). No s’ha verificat en dispositius iOS/Android físics ni en Safari/Firefox.

## Actualització: preparació GitHub / Render / PostgreSQL

S’han executat 18 proves contra SQLite i PostgreSQL 17 real en un contenidor local. Inclouen la recuperació de contrasenya amb bústia de test i concurrència mixta d’alta/promoció i augment de places. A PostgreSQL s’ha corregit la neteja de connexions dels fils de prova perquè la base temporal es pugui eliminar correctament després de les assercions.

S’han afegit `render.yaml`, GitHub Actions, servidor Gunicorn, WhiteNoise, configuració DATABASE_URL i ordre `create_team`. Aquesta era la situació abans de la publicació a GitHub; la verificació remota posterior es registra al final. No hi ha desplegament fet. SMTP real, còpies externes i limitació d’intents d’accés encara s’han de configurar.

La prova de producció local també ha passat: Gunicorn amb dues workers, comprovació de base de dades, pantalla d’accés i CSS amb hash servit per WhiteNoise. `check --deploy` deixa dos avisos intencionats d’HSTS (subdominis i preload desactivats fins a confirmar el domini). L’ordre `create_team` s’ha comprovat amb tres correus ficticis i sense privilegis d’administració. No s’ha provat Render real.

## Publicació i verificació remota

El codi es va publicar al commit `66493cf69661c2af1940a498139dc7951015c3b4`. Els dos jobs SQLite i PostgreSQL van finalitzar correctament a [GitHub Actions](https://github.com/lauranaval/theglowclub/actions/runs/44268374566). La versió conté 18 proves. Aquesta evidència és de la publicació inicial, no d’una nova execució durant el traspàs de documentació. El llançador Windows i SMTP real continuen sense verificar en els entorns de la propietària.
