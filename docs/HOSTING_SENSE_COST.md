# Allotjament sense cost: estat i proposta pendent

## Preferència vigent

La propietària vol començar sense pagar. No hi ha cap servei contractat ni cap desplegament. La configuració actual `render.yaml` crea recursos de pagament i **no s’ha d’aplicar com si fos l’opció gratuïta**.

## Proposta que es va explicar, encara no executada

- Codi: repositori GitHub existent.
- Aplicació: Django al servei web gratuït de Render, si continua disponible i les condicions encaixen.
- Dades compartides: PostgreSQL al pla gratuït de Neon, si continua disponible i les condicions encaixen.
- Accés: HTTPS amb subdomini del proveïdor i login privat de Django.
- Tres comptes individuals amb els mateixos permisos.

Els plans, quotes, regions, inactivitat, retencions i requisits de targeta **no s’han verificat per a aquesta proposta**. No prometre cost zero permanent, disponibilitat contínua ni còpies automàtiques sense comprovar les condicions vigents. La proposta es pot revisar si hi ha una alternativa millor per a tres usuàries sense reescriure innecessàriament el projecte.

## Treball necessari si es manté aquesta proposta

1. Verificar els plans gratuïts i els seus límits a les fonts oficials. Explicar clarament les pauses per inactivitat i els límits de base de dades.
2. Preparar una configuració que no creï la base Render de pagament. Connectar la base externa amb `DATABASE_URL`, TLS i credencials al gestor de secrets.
3. Revisar connexió directa o amb pool de Neon, timeouts i durada de connexions de Django. Si s’usa un pool en mode transacció, valorar desactivar cursors de servidor de Django. Provar la concurrència contra la configuració escollida.
4. El servei gratuït pot no suportar `preDeployCommand` o Shell. Verificar-ho i definir com aplicar migracions una sola vegada i com crear els tres comptes, sense requerir una funció de pagament ni obrir altes públiques. No posar contrasenyes en arguments, commits o logs.
5. Mantenir `GLOW_DEBUG=0`, clau secreta persistent, hosts/CSRF correctes, HTTPS i estàtics WhiteNoise. El disc efímer de l’aplicació no ha de contenir la base real.
6. Escollir recuperació de contrasenya amb un servei de correu compatible amb el pressupost. La implementació SMTP existeix, però falta l’entrega real i protegir-la contra abusos.
7. Afegir limitació d’intents de login/recuperació abans de l’ús real.
8. Definir un procediment d’exportació i restauració PostgreSQL, un responsable i una ubicació de còpia independent. No hi ha scripts de backup/restore ni automatització implementats.
9. Provar-ho amb dades fictícies i dispositius de les usuàries abans d’introduir dades reals.

## Distinció important

El codi a GitHub es pot descarregar i executar a Windows ara. Una URL localhost funciona només a la màquina que executa Django. Per compartir-la entre les tres usuàries cal un servidor accessible i una sola base compartida. GitHub Pages no executa aquest backend Django; publicar només els estàtics no proporciona reserves compartides ni autenticació del servidor.
