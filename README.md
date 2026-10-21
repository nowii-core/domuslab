# DomusLab

Puzzle a blocchi in 3D isometrico: programma **Domo**, il piccolo robot. **Un cubo = una mossa.**
**1000 livelli in 100 mondi**, ognuno con la sua ambientazione (casa, foresta, deserto, ghiacciaio, vulcano, oceano, spazio, città neon, castello, giungla, miniera, nuvole, grotta di cristalli…).

## Come si avvia (senza Python, senza installare nulla)

1. Estrai lo zip.
2. **Doppio clic su `index.html`** (oppure su `dist/domuslab.html`, che è tutto in un solo file).

In VS Code: apri la cartella → tasto destro su `index.html` → *Open with Live Server* (estensione consigliata) oppure premi **F5** (apre Chrome).

## Come si gioca

- Trascina i cubi nel *Programma* (o toccali) e premi **Play** (Invio). Tasto **S** = un cubo alla volta, **Esc** = ricomincia, **Ctrl+Z** = annulla.
- Porta Domo sulla centralina 🏁. Con 🛠 meno cubi = più stelle (3★ se usi il numero "par" o meno).
- **Lampadina 💡**: costa stelle. *Aiuto* −1★ (ti inserisce l'inizio della soluzione, poi la soluzione completa), *Salta livello* −2★. Le stelle si accumulano livello dopo livello. I costi si cambiano in `js/game.js` (`COST_AID`, `COST_SKIP`).
- **Monete 🪙**: si raccolgono nei livelli e comprano nuovi personaggi.
- **Personaggi** (menu o icona in alto): 12 skin + il tuo (emoji o immagine caricata).

## Meccaniche che si sbloccano

Cubi: Avanti, Gira, Accendi, Ripeti, F1 (funzione), Finché, Se · Monete (mondo 10) · Portali 🌀 (11) · Chiavi e porte 🔑 (12) · Trappole ⚡ (13) · Sentinelle 👾 (14) · poi mix di tutto.

## Modalità

- **Sfida del giorno** 📅 (un livello al giorno, serie di giorni, bonus stelle e monete)
- **Speedrun** ⏱️ (10 livelli di un mondo di fila, classifica locale)
- **Modalità Buio** 🌙 (vedi solo vicino a Domo)
- **Editor** 🛠️: costruisci il tuo livello, risolvilo e condividilo con un codice `DL1:…` (l'importazione verifica che si possa vincere)
- Record, punteggi, tempi, 22 obiettivi e ranghi, musica e suoni generati (nessun file audio)

## Per sviluppatori

```
js/engine.js     motore logico (browser + Node)
js/levels.js     1000 livelli generati
js/render.js     grafica isometrica su canvas
js/themes.js     ambientazioni dei mondi
js/skins.js      personaggi
js/game.js       interfaccia e logica
js/editor.js     editor e codici di condivisione
tools/           generatore, verifica, build in file unico
```

`node tools/generate-levels.js` rigenera i livelli (deterministico) · `node tools/verify-levels.js` controlla che tutte le soluzioni vincano · `node tools/build-single.js` crea `dist/domuslab.html`.

Licenza MIT.
