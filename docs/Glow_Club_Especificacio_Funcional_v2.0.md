# The Glow Club · Especificació funcional v2.0 (aplicació de gestió)

Data: 20 de novembre de 2026 · Autora: Laura (amb Claude)

Document viu original: https://claude.ai/artifact/6KnTEKE6vmJSbENRf83ZDD
Prototip navegable (estil, pantalles i vista mòbil): https://claude.ai/artifact/F4SBAPcnnfPNt6biMA7XEz

## Abast i principis

L'aplicació de gestió és una eina web interna en català per a Laura, Elena i Sandra, usable des del mòbil i l'ordinador. Substitueix l'ús de Notion per a tallers, reserves, cobraments, vendes, contactes i tasques. Aquesta v2.0 amplia la [v1.0](Glow_Club_Especificacio_Funcional_v1.0.md) amb les decisions preses el 20 de novembre de 2026. En cas de diferència, mana la v2.0.

- **Fora d'abast:** la web pública de The Glow Club és un projecte separat. Aquesta app no té part pública ni pagaments en línia; les inscripcions entren pels formularis de Tally (vegeu «Inscripcions des de Tally»).
- **Fiscalitat:** l'app només serveix per al control intern de cobraments. No emet tiquets ni factures i no gestiona IVA.
- **Usuàries:** comptes individuals, tots amb els mateixos permisos. Cada alta, cobrament, anul·lació o correcció desa qui l'ha fet i quan.

| Tema | v1.0 | v2.0 |
| --- | --- | --- |
| Estructura | Tallers amb sessions; esdeveniments que agrupen sessions | Cada data és un taller; un esdeveniment opcional agrupa tallers |
| Llista d'espera | Oferta manual | Igual, sense ordre automàtic: l'usuària tria |
| Comunicacions | No definides | Textos editables, enviament manual per WhatsApp i automàtics desactivables |
| Paradeta | Sense catàleg | Catàleg de productes + línia lliure |
| Economia del taller | No definida | Pagaments a tercers i despeses per taller |
| Contactes | Dades i historial | + consentiment de dades i de la comunitat de WhatsApp |
| Altres | — | Calendari, exportació a Excel, còpies de seguretat, cost zero |

## Model d'activitats

La unitat bàsica és el **taller**, i cada data és un taller diferent. Un **esdeveniment** (per exemple, la Fira de Nadal de Llavaneres) és opcional i agrupa diversos tallers i vendes de paradeta.

- **Taller:** nom, data, hora d'inici i fi, ubicació, públic (infantil, adult, família), modalitat (propi o d'inscripció externa), estat, aforament, preu i senyal per persona, termini de pagament, col·laboradora o espai, tasques, reserves i resum econòmic.
- **Duplicar:** qualsevol taller es pot duplicar com a plantilla. Es copien totes les dades excepte la data, les reserves i els cobraments.
- **Esdeveniment:** nom, dates, ubicació, organització, notes, tasques i tallers vinculats. La fitxa suma l'ocupació i el resultat econòmic de tots els seus tallers i vendes.
- **Tasques i despeses** es poden vincular al taller o a l'esdeveniment. Una tasca vinculada a l'esdeveniment no es duplica per cada taller.
- **Inscripció externa:** quan l'organització cobra les inscripcions (cas Llavaneres), el taller desa un recompte opcional amb data d'actualització. Sense recompte, mostra «Ocupació desconeguda». Aquests cobraments queden fora de la caixa i dels pendents de Glow.

Cada taller té una **experiència** d'una llista editable (Joieria sostenible, Pilates & Charms, Yoga & Chakras, Altres) per filtrar i fer estadístiques. L'aforament no es pot superar: si calen més places, primer s'amplia l'aforament. Estats del taller: Esborrany, Obert, Complet, Fet, Cancel·lat. «Complet» es calcula automàticament quan no queden places.

## Reserves i cobraments

Una reserva correspon a un taller, té un únic contacte i pot incloure diverses places. Es manté tot el que defineix la v1.0, amb aquestes regles:

- **Condicions congelades:** la reserva desa el preu, la senyal i el venciment concret aplicats en el moment de l'alta. En tallers infantils, el contacte és la persona adulta responsable.
- **Estats:** Pendent de senyal, Confirmada, Liquidada, Llista d'espera, Cancel·lada. Les dues primeres i Liquidada ocupen plaça.
- **Aforament:** es comprova al servidor en cada alta, canvi de places o promoció des de la llista d'espera, també quan dues usuàries actuen alhora.
- **Senyal:** es registra manualment (normalment Bizum) i admet pagaments parcials. Quan la suma arriba al mínim, la reserva passa a Confirmada.
- **Venciment:** quan venç la senyal, l'app mostra un avís i les places es mantenen. Una usuària pot alliberar-les, ampliar el termini o registrar un Bizum que ja havia arribat.
- **Saldo i extres:** el saldo es cobra en efectiu o Bizum. Els extres (per exemple, un charm addicional) es vinculen a la reserva. Si es cobren junts, es genera un sol cobrament amb el desglossament.
- **Cobrament:** cada moviment desa import, data, mètode, concepte i usuària. El pendent es calcula a partir del total acordat, els extres i els moviments vàlids.
- **Cancel·lació:** allibera les places i conserva l'historial. Una devolució es registra com a moviment vinculat al cobrament original.
- **Llista d'espera:** sense ordre automàtic. La fitxa del taller mostra la llista i la data d'alta de cada persona. Quan s'allibera una plaça, una usuària tria a qui l'ofereix i l'app li prepara el missatge.
- **Assistència:** es registra el nombre de participants presents, independentment del pagament.

### Inscripcions des de Tally

Les clientes continuen inscrivint-se amb els formularis de Tally (pla gratuït). Cada inscripció arriba a l'app com a **sol·licitud de reserva** pendent de revisar; mai no ocupa plaça sola.

1. Cada taller té el seu enllaç de Tally amb un camp ocult que l'identifica (per exemple, `?taller=polseres-22-11`). L'app genera l'enllaç i el botó per copiar-lo.
2. Tally envia la resposta a l'app amb un webhook (gratuït a tots els plans de Tally).
3. L'app crea la sol·licitud: nom, telèfon, correu, places demanades, consentiments i taller. Si la clienta ja existeix (mateix telèfon o correu), s'hi vincula.
4. La safata «Sol·licituds pendents» (a l'inici i a la fitxa del taller) permet **acceptar** (es comprova l'aforament i es crea la reserva pendent de senyal), **passar a llista d'espera** o **descartar** amb motiu.
5. En acceptar, l'app prepara el missatge de confirmació amb l'import de la senyal.

Regles: les respostes duplicades (reintents de Tally) s'ignoren; si el taller no s'identifica, la sol·licitud queda a la safata per assignar-la a mà; si Tally no pot contactar amb l'app, les respostes continuen guardades a Tally i es poden importar després. No es fan servir funcions de pagament de Tally.

### Preus, descomptes i cancel·lacions

La gran majoria de tallers tenen un preu únic per plaça. De manera opcional, un taller pot tenir:

- **Tarifes:** preu adult i preu infant, cadascuna amb la seva senyal. La reserva desa quantes places de cada tarifa.
- **Suplement de material:** opcional, per plaça o per reserva.
- **Descomptes:** percentatge o import fix aplicat a la reserva, amb motiu (germanes, comunitat, codi promocional). Queda registrat qui l'ha aplicat.

**Cancel·lació:** cada taller fixa el termini de devolució de la senyal (per exemple, 48 h abans). Si la clienta cancel·la dins del termini, l'app proposa registrar la devolució; si és fora de termini, la senyal es queda. Una usuària pot fer una excepció indicant el motiu.

### Encàrrecs privats

Un encàrrec privat és un taller tancat que encarrega i paga una sola clienta. No té places obertes ni llista d'espera. Tipus d'encàrrec:

| Tipus | Qui encarrega | Notes |
| --- | --- | --- |
| Festa infantil | Una família | Nombre d'infants, edat aproximada i temàtica |
| Grup privat | Una persona per a un grup d'adults | Com un taller, però tancat |
| Empresa (team building) | Una empresa | Es guarda el nom de l'empresa i la persona de contacte |
| Casament | Parella o wedding planner | Previst; encara no se n'ha fet cap |

- Data, hora, lloc (de la clienta o un espai), nombre de participants i notes.
- **Preu:** per participant amb un mínim, o preu tancat. Es tria a cada encàrrec.
- Senyal i saldo com a qualsevol reserva, amb el mateix termini de devolució.
- Estats: Sol·licitat, Pressupost enviat, Confirmat, Fet, Cancel·lat.
- Es pot afegir material, despeses, tasques i col·laboradores com a qualsevol taller.

## Comunicacions amb clientes

L'app prepara els missatges a clientes amb les dades de la reserva i permet enviar-los a mà per WhatsApp. Els enviaments automàtics queden preparats, però es poden activar o desactivar.

| Missatge | Quan | Dades que inclou |
| --- | --- | --- |
| Confirmació de reserva | En donar d'alta la reserva | Taller, data, places, senyal a pagar, termini i com pagar |
| Recordatori de senyal | Les hores abans del venciment que fixi el taller, i quan ha vençut | Import pendent i data límit |
| Recordatori del taller | Els dies abans que fixi cada taller | Data, hora, ubicació i saldo pendent |
| Plaça alliberada | Quan s'ofereix una plaça de la llista d'espera | Taller, data i termini per respondre |

- **Plantilles editables:** les usuàries poden modificar el text de cada missatge, amb camps que s'omplen sols (nom, taller, data, imports).
- **Enviament manual:** un botó obre WhatsApp (web o mòbil) amb el telèfon de la clienta i el text ja escrit. L'app registra que s'ha preparat el missatge.
- **Enviament automàtic:** interruptor general i per tipus de missatge, desactivat per defecte. El canal gratuït és el correu electrònic. WhatsApp automàtic requereix l'API de WhatsApp Business i té cost, per això queda com a opció futura.
- **Historial:** la fitxa de la reserva mostra quins missatges s'han enviat o preparat i quan.

## Vendes i caixa

Les vendes de paradeta (fires, Charm Bar) es fan des del mòbil amb un catàleg de productes i línies lliures. Cada dia de paradeta es tanca quadrant l'efectiu i la targeta.

**Catàleg**

- Producte: nom, categoria, preu de venda i actiu o inactiu. No hi ha control d'estoc.
- El preu del producte es pot modificar a la línia de venda. La venda desa el preu realment cobrat.

**Venda ràpida**

- Diverses línies, cadascuna del catàleg o lliure (descripció + import). Contacte opcional.
- Botons Efectiu i Targeta per registrar el cobrament un cop fet. A la paradeta no es cobra per Bizum. Es desa data, hora, esdeveniment o taller si escau, i usuària.
- Una venda duplicada s'anul·la indicant el motiu. Les devolucions reals redueixen el net cobrat i queden vinculades a la venda original.

**Comandes personalitzades**

- Contacte, descripció, preu, data de lliurament i estat: Pendent, Preparada, Entregada.
- Es poden registrar la bestreta i el saldo com a cobraments.

**Tancament de caixa**

1. Obrir caixa: una usuària anota el canvi inicial en efectiu.
2. Vendre durant la jornada.
3. Tancar: s'anota el recompte d'efectiu i el total del resum del TPV.
4. L'app compara l'efectiu esperat (canvi inicial + vendes en efectiu − devolucions) amb el recompte, i la targeta amb el TPV. Mostra la diferència i permet afegir una nota.

El **resum de cobraments** mostra els cobraments nets per data, taller o esdeveniment, mètode i concepte, amb els pendents per separat.

## Economia del taller

Cada taller i esdeveniment mostra el resultat: cobrat net − pagaments a tercers − despeses. Els pendents de cobrament es mostren a part i no compten com a cobrats.

**Pagaments a tercers** (espai, col·laboradora, organització)

| Tipus d'acord | Càlcul |
| --- | --- |
| Percentatge | % sobre el cobrat net del taller |
| Import per persona | Import × places ocupades (o participants presents, segons l'acord) |

- Un taller pot tenir més d'un tercer, cadascun amb el seu acord.
- L'app calcula l'import a pagar i permet marcar-lo com a pagat amb data, mètode i usuària.
- L'acord es pot proposar des de la fitxa de la col·laboradora i ajustar-se a cada taller.

**Despeses**

- Concepte, categoria (material, lloguer, desplaçament, altres), import, data i usuària.
- Es vinculen a un taller o a un esdeveniment. Les de l'esdeveniment no es repeteixen a cada taller.
- Les despeses i els pagaments a tercers no entren al tancament de caixa de paradeta.

## Contactes, tasques, calendari i exportació

**Clientes**

- Nom, telèfon, correu, origen (com ens va conèixer), notes i historial de reserves, compres i comandes.
- **Consentiment de dades:** casella i data en què la clienta accepta que es guardin les seves dades.
- **Comunitat de WhatsApp:** si en forma part, amb la casella de consentiment i la data.
- Control de duplicats per telèfon o correu en donar d'alta.

**Col·laboradores i espais**

- Les que ja treballen amb Glow: persona de contacte, tipus (espai, estudi, restaurant, organització…), acord econòmic habitual, tallers fets, pagaments i notes de seguiment.

**Prospecció**

- Tauler per estats: Per contactar, Contactat, Pendent resposta, En conversa, Proposta enviada, Confirmat, No interessa.
- Cada fitxa: nom, tipus, població, Instagram o web, persona de contacte, últim contacte, pròxim seguiment i notes.
- En passar a Confirmat, un botó la converteix en col·laboradora i en conserva l'historial. És el mateix contacte, sense duplicats.
- La pantalla d'inici mostra els seguiments que toquen avui o estan endarrerits.

**Tasques**

- Responsable, data límit, prioritat i estat. Vincle opcional a un taller o esdeveniment.
- Filtres per activitat, responsable i venciment. La pantalla d'inici mostra les tasques pròximes de cada usuària.

**Calendari**

- Vista mensual i setmanal amb tallers, esdeveniments, dates de lliurament de comandes i tasques amb data límit.

**Exportació a Excel**

- Clientes, reserves i cobraments, amb filtres per dates.

## Traspàs de Notion

Les dades de Notion s'importen abans d'estrenar l'app: tallers, reserves, clientes, col·laboradors i tasques. Notion queda com a arxiu de consulta.

1. Revisar els esquemes de totes les bases de dades (fet el 20/11/2026, vegeu la revisió de sota).
2. Fer una importació de prova amb control de duplicats de clientes.
3. Conciliar reserves, places i imports amb Notion, i revisar les diferències.
4. Fer la importació definitiva i començar a treballar només amb l'app.

Regles de la v1.0 que es mantenen:

- Una senyal de zero i un camp buit tenen significats diferents.
- Els cobraments històrics amb data o mètode desconeguts es mostren com a pendents d'informar i queden fora dels tancaments diaris.
- Un pagament marcat com a Pagat es mostra com a pagat segons l'històric.
- Les reserves sense clienta vinculada es conserven per revisar-les. Els contactes vinculats directament a un taller es conserven com a historial i no ocupen places.
- Les clientes importades queden sense consentiment registrat fins que es confirmi.

### Revisió de Notion (20/11/2026)

| Base de dades | Registres | Observacions per a la importació |
| --- | --- | --- |
| Tallers | 15 | 3 sense data, 5 sense preu. La majoria només tenen el nombre de reserves, sense detall. Modalitats Obert, Privat, Empresa i Wedding. Camp Experiència. |
| Reserves | 8 | 3 buides, 3 sense clienta, 2 sense taller. «Data Bizum» mai informada. |
| Clientes | 43 | 12 sense correu, 3 sense telèfon. Comunitat de WhatsApp mai marcada. No hi ha camp de consentiment. |
| Col·laboradors | 22 | Sobretot prospeccions (wedding planners, estudis de pilates i ioga) amb estat i seguiment. 1 registre buit. |
| Tasques | 16 | 14 fetes. 8 sense taller i 8 sense responsable. |

Decisions de la importació:

- Els tallers històrics sense detall s'importen com a fets amb un **recompte històric** de places. Aquest recompte no genera cobraments ni pendents, i pot superar l'aforament perquè és històric.
- Els espais que només apareixen al nom del taller (Metru, Port Vintage, La Copa Negra, Yucca, Massorrer, Casa Loco, Can Nadal, Aspedi, Bona Teka, Sora Wellness, Petit Délice) es creen com a espais o col·laboradores i es vinculen al taller. Les usuàries revisen la llista abans de la importació definitiva.
- Els registres buits no s'importen. Les reserves sense clienta o sense taller queden a una llista de revisió.
- Els col·laboradors de Notion en estat Confirmat passen a Col·laboradores; la resta, a Prospecció amb el seu estat. Els tallers amb modalitat Privat o Empresa s'importen com a encàrrecs privats del tipus corresponent.

## Requisits no funcionals

- **Cost zero:** allotjament, base de dades, correu i còpies amb serveis gratuïts mentre sigui possible. Qualsevol servei de pagament requereix aprovació explícita de la propietària.
- **Dades compartides:** les tres usuàries treballen contra la mateixa base de dades en línia.
- **Còpies de seguretat:** automàtiques, com a mínim diàries, guardades fora del servidor principal, amb procés de restauració provat.
- **Mòbil primer:** venda ràpida, nova reserva i registre de cobrament s'han de poder fer amb una mà des del mòbil.
- **Seguretat:** accés només amb usuari i contrasenya, connexió xifrada (HTTPS) i recuperació de contrasenya per correu. Els correus surten de hola.theglowclub@gmail.com.
- **Traçabilitat:** les anul·lacions i correccions no esborren dades; queden registrades amb motiu, usuària i data.
- **Idioma:** tota la interfície en català, amb imports en euros i format de data dd/mm/aaaa.

**Usabilitat**

- **Navegació:** a l'ordinador, menú lateral. Al mòbil (menys de 760 px), barra superior compacta i barra inferior fixa amb Inici, Tallers, Vendre (botó central), Contactes i Més. «Més» obre un menú agrupat: Feina (tasques, calendari), Vendes (caixa, catàleg, comandes), Contactes (prospecció, col·laboradores), Economia (pagaments a tercers, despeses, exportar) i Configuració (plantilles, enllaços de Tally, enviaments automàtics, usuàries), amb avisos de pendents.
- **Venda al mòbil:** el total i els botons Efectiu i Targeta queden sempre visibles en una barra fixa mentre hi ha articles al tiquet.
- **Llistes:** les taules amples es mostren com a targetes al mòbil, sense desplaçament horitzontal.
- **Formularis:** teclat numèric per a imports i aforament, selectors natius de data i hora, text d'entrada de 16 px com a mínim.
- **Mida tàctil:** tots els botons i enllaços d'acció fan 44 px com a mínim.
- **Accions irreversibles** (alliberar places, descartar una sol·licitud, anul·lar una venda, tancar la caixa): demanen confirmació. Els cobraments mostren un avís amb opció de desfer durant uns segons.
- **Contrast:** text amb contrast mínim 4,5:1; els estats no es distingeixen només pel color.

**Identitat visual** (vegeu el prototip): logo de The Glow Club; vermell #DE2F40 per a accions principals, rosa #F6A3DB / #FCE4F2 només com a accent, fons blanc trencat #FAF6F7 i text #3A1830; títols en serif (DM Serif Display) i text en sans geomètrica (Poppins).

## Criteris d'acceptació

Es mantenen tots els criteris de la v1.0 i s'hi afegeixen els nous.

| Cas | Resultat esperat |
| --- | --- |
| Reserva de 2 places a 35 € amb 20 € de senyal per persona | Ocupa 2 places. Amb 40 € per Bizum queda confirmada i resten 30 €. Amb 30 € en efectiu es liquida; el resum mostra 40 € Bizum i 30 € efectiu. |
| Senyal parcial o vençuda | El pendent és visible, el venciment genera un avís i només l'alliberament explícit retorna les places. |
| Dues altes simultànies per a l'última plaça | Només una ocupa plaça; l'altra pot anar a la llista d'espera. |
| Plaça alliberada amb 3 persones en espera | L'usuària en tria qualsevol; l'app comprova l'aforament i prepara el missatge «Plaça alliberada». |
| Duplicar un taller | Es crea un taller nou amb les mateixes dades, sense data, reserves ni cobraments. |
| Taller extern sense recompte | Mostra «Ocupació desconeguda» i cap cobrament ni pendent a la caixa de Glow. |
| Venda de paradeta amb un producte del catàleg i una línia lliure, per targeta | Apareix una sola vegada al tancament del dia, a Targeta, amb les dues línies. |
| Tancament amb 50 € de canvi, 120 € en vendes en efectiu i recompte de 165 € | Mostra 170 € esperats i una diferència de −5 €, amb opció de nota. |
| Saldo de taller i charm extra cobrats junts | La caixa suma un cobrament i la fitxa conserva els dos conceptes. |
| Taller amb 300 € cobrats nets, espai al 20 % i 40 € de material | Pagament a l'espai 60 €; resultat del taller 200 €. |
| Enviaments automàtics desactivats | No s'envia cap missatge; el botó de WhatsApp continua disponible. |
| Tasca de packaging vinculada a la fira | Apareix a la fitxa de la fira i a la vista de la responsable, sense duplicar-se per taller. |
| Importació de senyal sense data o reserva sense contacte | Es preserven imports i places; els camps desconeguts queden visibles i fora del tancament diari. |

## Ordre de construcció

Prioritat: tenir la venda de paradeta a punt per a la Fira de Nadal de Llavaneres (5 i 6 de desembre de 2026). Cada bloc s'estrena quan funciona, sense esperar els següents.

1. **Fira:** accés, catàleg, venda ràpida (efectiu i targeta), obrir i tancar caixa, resum del dia, esdeveniment amb tallers d'inscripció externa.
2. **Tallers i reserves:** tallers i duplicació, reserves, senyals, cobraments, llista d'espera, encàrrecs privats, tarifes i descomptes, sol·licituds de Tally, missatges.
3. **Contactes:** clientes amb consentiments, col·laboradores i espais, prospecció.
4. **Economia:** pagaments a tercers, despeses i resultat per taller i esdeveniment; comandes personalitzades.
5. **Tasques, calendari i exportació a Excel.**
6. **Traspàs de Notion** i estrena completa.

## Punts oberts

- [ ] Quin proveïdor d'allotjament i base de dades gratuït es fa servir? Cal verificar-ne les condicions vigents abans de desplegar, i que funcioni abans del 5/12.
- [ ] Correus personals de Laura, Elena i Sandra per als comptes de l'app.
- [ ] Quines dades d'empresa cal guardar als encàrrecs de team building (nom fiscal, NIF, persona de contacte)?
- [ ] Llista inicial de productes i preus del catàleg per a la fira.
- [ ] Configurar el formulari de Tally (camp ocult del taller i webhook) quan l'app estigui allotjada.

Resolts el 20/11/2026: pagament per persona segons l'acord; recordatoris configurables per taller; sense Bizum a la paradeta; termini de devolució configurable per taller; encàrrecs privats amb preu per participant o tancat; vals regal ajornats; correu d'enviament hola.theglowclub@gmail.com.
