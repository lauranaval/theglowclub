# Tauler del projecte

Pàgina per veure com avança The Glow Club: quant falta, què s'ha fet cada dia, quines proves passen i quants tokens s'han consumit.

## Com obrir-lo

- Fes doble clic a `tauler/index.html` (s'obre al navegador; no cal connexió).
- Es regenera sol cada cop que Claude Code acaba un torn en aquest projecte. Per regenerar-lo a mà: `npm run tauler`.
- Cada dia queda una línia a `tauler/historial.json`, que és d'on surt el gràfic «Curs del projecte».

## Què vol dir cada xifra

| Xifra | Significat |
| --- | --- |
| **Projecte fet** | Mitjana ponderada dels 6 blocs de l'especificació v2.0. Els pesos són a `tauler/config.json` (Fira 25 %, Tallers i reserves 25 %, Contactes 15 %, Economia 15 %, Tasques/calendari/Excel 10 %, Notion 10 %). |
| **Bloc en curs** | El primer bloc que encara no és al 100 %. |
| **Resultats fets** | Resultats dels fitxers `outcomes/` amb les proves en verd o verificats pel revisor. Un bloc sense fitxer de resultats compta 0 %. |
| **Dies per a la fira** | Dies que queden fins al 5/12/2026. |
| **Cost dels tokens** | El que costarien aquests tokens a preu públic de l'API d'Anthropic, en dòlars (Opus 5.5: 4 $ per milió d'entrada, 20 $ per milió generats, 0,20 $ per milió llegits de memòria cau; escriure a la memòria cau, 1,25× o 2× l'entrada). Amb una subscripció de Claude no és el que pagues: és una mesura de l'esforç. Els preus són a `tauler/config.json` (camp `preus`) i es poden actualitzar. |
| **Tokens consumits** | Suma de tots els tokens de les sessions de Claude Code d'aquest PC. «Generats» és el text que escriu Claude; «llegits» és el context que llegeix (la major part, reaprofitat de la memòria cau). |

## Estats d'un resultat

- **✔✔ Verificat:** el revisor independent l'ha marcat amb ✅ al fitxer de resultats.
- **✔ Proves en verd:** totes les proves amb aquest identificador passen (i hi ha proves de cada eina que demana el resultat).
- **✖ Proves en vermell:** alguna prova falla, o el revisor l'ha marcat amb ❌.
- **✋ Manual:** es comprova a mà, en el desplegament (per exemple, la còpia diària).
- **○ Pendent:** encara no té proves.

## Limitacions

- Només compta els tokens de les sessions fetes en aquest PC. Les sessions anteriors fetes a claude.ai/code (web) no hi són.
- Les proves es llegeixen de l'última execució (`npm run check`); si fa dies que no s'executen, el tauler mostra l'estat d'aquell dia.
- «Coses fetes» són els canvis desats a git (commits). El que encara no s'ha desat no hi surt.
