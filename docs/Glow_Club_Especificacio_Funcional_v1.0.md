# The Glow Club · Especificació funcional v1.0

## Objectiu i accés

Aplicació web interna en català, usable des del mòbil i l’ordinador. Laura, Elena i Sandra disposen de comptes individuals i els mateixos permisos de gestió. Les altes de reserves, els cobraments i les correccions registren qui les ha fet i quan.

## Pantalles

| Pantalla | Funcions |
|---|---|
| Inici | Pròxims tallers, places disponibles, cobraments pendents, senyals vençudes, tasques pròximes i accés a Nova venda. |
| Activitats | Tallers independents i esdeveniments que agrupen sessions. Fitxa amb dates, horaris, ubicació, públic, modalitat, estat, col·laborador, tasques, reserves i resum econòmic. |
| Contactes | Clientes amb dades de contacte, origen, comunitat de WhatsApp i historial. Col·laboradors amb persona de contacte, estat de la conversa, acords, notes i dates de seguiment. |
| Tasques | Responsable, data límit, prioritat i estat. Filtres per activitat, responsable i venciment. |
| Vendes | Venda ràpida, comandes personalitzades, devolucions i resum de cobraments per data, activitat i mètode. |

## Tallers habituals

- Cada sessió té aforament, preu i paga i senyal per persona. El taller fixa el termini de pagament i la reserva mostra el venciment concret. La reserva desa les condicions de preu aplicades en el moment de l’alta.
- La reserva correspon a una sessió i admet diverses places amb un únic contacte. En tallers infantils, s’utilitza el contacte de la persona adulta responsable.
- Les reserves pendents de senyal i les confirmades ocupen plaça. Les cancel·lades i les de llista d’espera queden fora del recompte. Es comprova l’aforament en cada alta, canvi de places o promoció manual, també quan dues usuàries actuen alhora.
- Registre manual de la senyal per Bizum. La suma rebuda confirma la reserva quan arriba al mínim exigit. Els pagaments parcials mostren quant falta. En vèncer el termini, es mostra un avís i es mantenen les places fins que una usuària les allibera. També es pot ampliar el termini o registrar un Bizum que ja havia arribat.
- El saldo del dia es registra en efectiu o Bizum. Cada cobrament desa import, data, mètode i concepte. El pendent es calcula a partir del total acordat, els extres i els moviments vàlids. L’assistència es registra per nombre de participants presents, independentment del pagament.
- En cancel·lar, s’alliberen les places i es conserva l’historial de cobraments. Una devolució, si escau, es registra com a moviment vinculat. Les places alliberades poden oferir-se manualment a la llista d’espera.

## Vendes i tancament

- Venda ràpida sense catàleg. S’introdueix la descripció i l’import real, amb contacte opcional i possibilitat de diverses línies. Els botons Efectiu i Targeta registren el cobrament un cop efectuat. L’aplicació desa la data, l’hora, l’activitat si escau i la usuària.
- Comanda personalitzada amb contacte, descripció, preu, data de lliurament i estat pendent, preparada o entregada. Es poden registrar la bestreta i el saldo.
- Els extres del taller es vinculen a la reserva. Si es cobren amb el saldo, l’operació genera un únic cobrament i el resum conserva el desglossament.
- Una venda duplicada es pot anul·lar indicant-ne el motiu. Les devolucions reals redueixen el net cobrat i queden vinculades al cobrament original.
- El resum mostra cobraments nets per mètode i concepte, i pendents per separat. El tancament diari de paradeta permet comparar l’efectiu amb el recompte menys el canvi inicial, i la targeta amb el resum del terminal.

## Llavaneres · inscripcions externes

La fira del 5 i 6 de desembre de 2026 agrupa quatre sessions, amb una infantil de 10 € i una d’adults de 15 € cada dia. L’organització gestiona i cobra les inscripcions. Per sessió es pot anotar un recompte i la data d’actualització. Si no arriba cap recompte, es mostra Ocupació desconeguda. El llistat nominal és opcional. Els cobraments externs queden fora de caixa i dels pendents de Glow. Les vendes pròpies del Charm Bar sí que entren a caixa.

## Traspàs de Notion

S’han revisat els esquemes de Tallers, Reserves, Clientes, Col·laboradors i Tasques i quatre reserves detallades de Can Nadal. Es preserven les relacions i els imports originals. Una senyal de zero i un camp buit tenen significats diferents. Els cobraments històrics amb data o mètode desconeguts es mostren amb aquesta informació pendent. Els imports sense data queden fora dels tancaments diaris. Un pagament final marcat com a Pagat es mostra com a pagat segons l’històric, amb els detalls que constin.

Les reserves sense clienta vinculada es conserven per revisar-les. Els contactes vinculats directament al taller es conserven com a historial i, per si sols, no generen places ocupades. Abans del traspàs definitiu es farà una importació de prova amb control de duplicats i conciliació de reserves, places i imports. La revisió feta fins ara correspon a un sol taller.

## Criteris d’acceptació

| Cas | Resultat esperat |
|---|---|
| Reserva de dues places a 35 € amb 20 € de senyal per persona | Ocupa dues places. Amb 40 € per Bizum queda confirmada i resten 30 €. En registrar 30 € en efectiu es liquida i el resum mostra 40 € en Bizum i 30 € en efectiu. |
| Senyal parcial o vençuda | El pendent és visible. El venciment genera un avís. Només l’alliberament explícit retorna les places. |
| Dues altes simultànies per a l’última plaça | Només una ocupa plaça. L’altra pot anar a la llista d’espera. |
| Taller extern sense llistat ni recompte | Mostra ocupació desconeguda i cap cobrament o pendent de les inscripcions a la caixa de Glow. |
| Venda de paradeta amb targeta sense catàleg | Apareix una sola vegada al tancament del dia i de la forma de pagament correctes. |
| Saldo de taller i charm extra cobrats junts | La caixa suma un cobrament i la fitxa conserva el detall dels dos conceptes. |
| Tasca de packaging vinculada a la fira | Apareix a la fitxa de la fira i a la vista de la responsable, sense duplicar-se per sessió. |
| Importació de senyal sense data o reserva sense contacte | Es preserven imports i places. Els camps desconeguts queden visibles i no s’imputen cobraments sense data al tancament d’un dia. |

## Fonts

- [Espai Glow Club](https://app.notion.com/p/65bba2ed7c4083c9b887019f1f83946e)
- [Reserves](https://app.notion.com/p/3dfc172c135e4273932153a28ff1d5be)
- [Can Nadal](https://app.notion.com/p/3cdba2ed7c4080c19263d87d91f30dd8)
- [Pla de la Fira de Nadal de Llavaneres](https://app.notion.com/p/410ba2ed7c40816dad36db6218307bc0)
