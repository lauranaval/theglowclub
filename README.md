# The Glow Club · Gestió interna

## Continuar amb Claude Code

Comença per [CLAUDE.md](CLAUDE.md) i el [traspàs complet](docs/TRASPAS_CLAUDE_CODE.md). L’[especificació original](docs/Glow_Club_Especificacio_Funcional_v1.0.md) i l’[encàrrec i decisions posteriors](docs/ENCARREC_I_DECISIONS.md) també són al repositori.

**Estat vigent:** primer bloc implementat; aplicació encara no desplegada. La propietària vol començar sense pagar. `render.yaml` és una proposta anterior de pagament: llegir [hosting sense cost](docs/HOSTING_SENSE_COST.md) abans de desplegar.

Primer bloc funcional de l’especificació v1.0: tallers, sessions, clientes, reserves, cobraments manuals i assistència. Interfície en català, adaptable a mòbil i ordinador. Totes les dades inicials són fictícies.

## Arrencada local

Requisits: Python 3.12 o posterior, pip i un navegador. Des de l’arrel del repositori:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Obre http://127.0.0.1:8000. Comptes **laura**, **elena** i **sandra**, tots amb contrasenya **GlowDemo2026!** i els mateixos permisos. La contrasenya és només de demostració: pots definir `GLOW_DEMO_PASSWORD` abans de crear els comptes. El seed és idempotent, no duplica tallers ni sobreescriu contrasenyes existents. Per canviar-les: `python manage.py changepassword laura` (igual per a la resta).

Windows: activa l’entorn amb `.venv\Scripts\activate`; les altres ordres són equivalents. La base de dades persistent es desa a `db.sqlite3`, exclosa de Git. Les tres usuàries treballen contra **el mateix servidor i fitxer**, no contra una còpia local per persona.

Per veure la demo des d’un mòbil de la mateixa xarxa: configura `GLOW_ALLOWED_HOSTS` amb la IP de l’ordinador (i localhost), executa `python manage.py runserver 0.0.0.0:8000` i obre `http://IP:8000`. Aquest servidor és per a desenvolupament en xarxes de confiança.

## Prova manual del flux

1. Entra com a Laura. Crea un taller amb termini de 48 hores i una sessió amb aforament 5, preu **35 €** i senyal **20 €** per persona.
2. Prem «Nova reserva», crea una clienta fictícia o selecciona’n una, i reserva **2 places**. Total 70 €, senyal requerida 40 €; ocupa dues places.
3. Registra **40 €**, mètode **Bizum**, concepte **Paga i senyal**, amb una data no futura. Estat **Confirmada**, saldo pendent **30 €**.
4. Registra **30 €**, mètode **Efectiu**, concepte **Saldo final**. Apareix **Liquidada** i pendent 0 €. A la fitxa del taller: **40 € Bizum**, **30 € efectiu**, amb dos moviments i qui els ha registrat.
5. Registra el nombre de participants presents; és independent del cobrament. Pots provar senyals parcials amb 15 € + 25 €.
6. El seed inclou una reserva de Júlia Exemple amb senyal vençuda. L’avís apareix a inici i a la reserva. Les places continuen ocupades. Desplega «Cancel·lar i alliberar places» i confirma-ho: només aleshores s’alliberen. També pots ampliar el termini o anotar un Bizum ja rebut.
7. Per comprovar la concurrència, crea una sessió d’**una plaça**. Obre dos navegadors o perfils independents, un amb Laura i l’altre amb Elena. Carrega «Nova reserva» en tots dos i envia’ls alhora. Només una reserva s’accepta; l’altra mostra l’error i permet marcar llista d’espera. La promoció manual també comprova aforament.

## Verificació automatitzada

```sh
python manage.py check
python manage.py test --noinput
```

Les proves utilitzen una base **de fitxer**, `work/test.sqlite3`, separada de la demo, per verificar bloqueig entre connexions reals. Inclouen imports i pagaments parcials, atribució de moviments, preus congelats, venciment i alliberament manual, ampliació, Bizum tardà, aforament, llista d’espera, assistència, accés privat, CSRF i concurrència d’altes, promocions i cobraments.

Prova de navegador reproduïble (Chromium instal·lat a `/usr/bin/chromium`):

```sh
pip install -r requirements-dev.txt
GLOW_DB="$PWD/work/ui-nova.sqlite3" python manage.py migrate
GLOW_DB="$PWD/work/ui-nova.sqlite3" python manage.py seed_demo
GLOW_DB="$PWD/work/ui-nova.sqlite3" python manage.py runserver 127.0.0.1:8001 --noreload
# En un altre terminal, amb l’entorn virtual activat:
GLOW_URL=http://127.0.0.1:8001 python tests/ui_flow.py
```

Fes servir una base nova per a cada execució del flux UI: la prova cancel·la la reserva vençuda del seed. L’script prova els pagaments 40/30, assistència, venciment, alliberament, dues usuàries que competeixen per una plaça, llista d’espera i vista mòbil de 390 px. Desa captures a `work/`, excloses de Git.

## Decisions i següents blocs

Vegeu `docs/arquitectura.md` per al model, les garanties de concurrència i els límits de desplegament. No s’han implementat vendes, comandes, extres, tasques, seguiment de col·laboradors, sessions amb cobrament extern ni migració de Notion. Tampoc s’ha fet cap importació ni connexió a Notion.

L’última verificació executada queda registrada a `docs/verificacio.md`.

## Windows: arrencada amb doble clic

Instal·la Python 3.12 o posterior de python.org. Extreu tota la carpeta del projecte abans d’executar res. Fes doble clic a `IniciaGlow.bat`: crea l’entorn virtual, instal·la dependències, aplica migracions, crea la demo sense duplicar-la i obre http://127.0.0.1:3000/. Deixa la finestra oberta mentre utilitzes l’aplicació. La primera arrencada necessita Internet per descarregar Django. No executis el fitxer des de dins del ZIP. Aquest llançador s’ha preparat però no s’ha pogut executar en Windows des d’aquest entorn Linux.

## GitHub i Render

Configuració proposada disponible a `render.yaml`, servidor Gunicorn i estàtics WhiteNoise. PostgreSQL es configura amb `DATABASE_URL`; SQLite queda com a opció local. En producció cal `GLOW_DEBUG=0` i clau secreta. Recuperació de contrasenya i creació dels tres comptes amb `create_team` disponibles. Vegeu `docs/desplegament.md` abans de crear cap servei: detalla recursos de pagament, secrets, SMTP, proves i còpies. El desplegament encara no s’ha executat.
