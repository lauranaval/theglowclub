# Cloudflare (app nova)

Destí vigent (decisió del 21/11/2026): Cloudflare Workers + D1 + Access, pla gratuït i sense targeta. La proposta de Render de més avall és antiga i de pagament: no s'ha de fer servir.

Estat (21/11/2026): compte personal de la propietària creat; base D1 `glow` a Europa occidental amb les migracions aplicades; secret `USUARIES` configurat. En activar Zero Trust s'hi va registrar una targeta: només hi ha d'haver plans gratuïts (Zero Trust Free, Workers Free). Abans de canviar cap pla o activar cap servei, revisar **Billing → Subscriptions** i demanar aprovació explícita a la propietària.

En desplegar, abans d'obrir l'app a ningú:

- **Cloudflare Access:** crear l'aplicació amb la política de correu (codi d'un sol ús) per a les tres usuàries i una sessió llarga (per exemple, 30 dies).
- **Variables de `wrangler.jsonc`:** `ACCESS_TEAM_DOMAIN` (domini de l'equip, `<equip>.cloudflareaccess.com`) i `ACCESS_AUD` (AUD de l'aplicació d'Access).
- **Secret `USUARIES`:** els correus permesos separats per comes, amb `npx wrangler secret put USUARIES` (no es desa al repositori). Si queda buit, el Worker accepta qualsevol identitat que passi Access i no controla la usuària que declaren els dispositius.
- **D1:** crear la base `glow`, posar-ne el `database_id` a `wrangler.jsonc` i aplicar `wrangler d1 migrations apply glow --remote`.
- **No** posar mai `DEV_AUTH` a producció: només existeix per a l'arrencada local.
- **F-18 (còpia diària) queda per al desplegament:** tasca programada que exporti D1 (`wrangler d1 export`) a un repositori privat cada dia i una restauració de prova verificada. Fins aleshores, F-18 no està complert.

# Desplegament proposat: GitHub → Render → PostgreSQL

> Context històric de la proposta de pagament. La preferència posterior de la propietària és cost zero. Consulta `HOSTING_SENSE_COST.md` i `TRASPAS_CLAUDE_CODE.md`. No aplicar aquest Blueprint com si fos gratuït.

Repositori indicat per la usuària: https://github.com/lauranaval/theglowclub

## Estat

El repositori públic és accessible i la connexió de GitHub ja té permisos d’escriptura. Conté la implementació del primer bloc i la configuració proposada per desplegar-lo. No s’ha desplegat ni contractat cap servei.

## Recursos i costos

`render.yaml` proposa un servei web Python `starter` i una base PostgreSQL `basic-256mb`, tots dos a Frankfurt, amb desplegaments manuals. Són recursos de pagament: **revisar els preus vigents, les condicions i la regió al panell de Render abans de crear-los**. Els imports no s’han pressupostat ni comprovat en aquesta preparació. No hi ha cap ordre de desplegament executada.

El repositori no ha de contenir `db.sqlite3`, credencials, `.env`, cap contrasenya real ni fitxers de clientes. El projecte arrenca buit en producció: el seed demo no s’executa. La base local és fictícia i no s’importa.

## Primera posada en marxa

1. Verificar l’accés a `lauranaval/theglowclub` i revisar qui hi té accés. El repositori és públic. Revisar el resultat de GitHub Actions amb SQLite i PostgreSQL abans del desplegament.
2. La propietària crea o utilitza el seu compte Render i autoritza l’accés al repositori concret. Revisar pressupost abans de crear el Blueprint definit a `render.yaml`.
3. Render genera `GLOW_SECRET_KEY` i associa la connexió interna `DATABASE_URL`. No copiar-ne els valors al xat. `GLOW_DEBUG=0` exigeix una clau no demo i PostgreSQL; no admet una caiguda silenciosa a SQLite.
4. El build instal·la dependències i recull estàtics amb WhiteNoise. El pas previ aplica migracions. Gunicorn serveix Django amb dues workers. Render termina TLS; Django reconeix el seu proxy, obliga HTTPS i envia cookies Secure.
5. Render proporciona `RENDER_EXTERNAL_HOSTNAME`: s’utilitza per validar host i origen CSRF. Per a un domini propi, afegir-lo a `GLOW_ALLOWED_HOSTS` i `https://DOMINI` a `GLOW_CSRF_TRUSTED_ORIGINS`, a més de configurar el domini i DNS a Render.
6. Configurar el servei SMTP i provar l’entrega abans de crear els comptes. Variables: `GLOW_EMAIL_HOST`, `GLOW_EMAIL_PORT` (587 per defecte), `GLOW_EMAIL_USE_TLS` (1), `GLOW_EMAIL_USER`, `GLOW_EMAIL_PASSWORD`, `GLOW_FROM_EMAIL`. Escollir un remitent verificat pel proveïdor. Credencials només al panell de secrets de Render. El desenvolupament escriu els correus a la consola; producció usa SMTP.
7. Des del Shell del servei executar, substituint els correus per les adreces reals:

   ```sh
   python manage.py create_team --laura-email ADRECA_LAURA --elena-email ADRECA_ELENA --sandra-email ADRECA_SANDRA
   ```

   Crea tres comptes amb permisos iguals i contrasenyes aleatòries no divulgades. No modifica comptes existents. Cada usuària obre «He oblidat la contrasenya», rep un enllaç d’una hora i defineix la seva contrasenya. No hi ha alta pública. Alternativament, `python manage.py changepassword laura` permet establir-la de manera interactiva; mai posar contrasenyes en arguments o commits.
8. Provar des de Windows i mòbil: login, recuperació, reserva de dues places, Bizum 40 €, efectiu 30 €, concurrència, venciment i alliberament manual. Les migracions, el seed i el canvi de motor no impliquen que hi hagi una URL publicada.

## Còpies i activació real

Abans d’introduir dades reals cal verificar què inclou el pla escollit: retenció de còpies/PITR, restauració i possibilitat d’exportar PostgreSQL. Definir el responsable i comprovar una restauració en una base separada. Si el pla no cobreix la retenció acordada, configurar còpies addicionals xifrades fora del servei. No hi ha cap còpia externa configurada encara.

També queda pendent configurar limitació d’intents de login i recuperació de contrasenya abans d’exposar el servei a ús real. Revisar privacitat, accés al proveïdor, alertes i registres. La recuperació s’ha provat amb bústia de test; encara no amb el domini/remitent reals.

## Desenvolupament amb PostgreSQL

Amb Docker instal·lat (credencials exclusivament locals de prova):

```sh
docker run --name glow-postgres-test -e POSTGRES_USER=glow -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=glow -p 127.0.0.1:55432:5432 -d postgres:17
# Linux/macOS
export DATABASE_URL=postgresql://glow:local-test-only@127.0.0.1:55432/glow
python manage.py test --noinput
```

A PowerShell, definir-la amb `$env:DATABASE_URL='postgresql://glow:local-test-only@127.0.0.1:55432/glow'`. Per tornar a SQLite local, eliminar la variable amb `Remove-Item Env:DATABASE_URL`. Les proves creen/el·liminen una base de test separada; l’usuari de test necessita permís CREATEDB. Les credencials anteriors no s’utilitzen a Render.
