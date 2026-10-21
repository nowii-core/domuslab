/* DomusLab — testi: consigli dei mondi, rango, obiettivi. */
(function (root) {
  'use strict';
  var TIPS = {
    1: 'Trascina i cubi nel programma (oppure toccali) e premi Play. Domo fa una mossa per ogni cubo: Avanti, Gira a sinistra, Gira a destra. Portalo sulla centralina verde: il livello finisce appena ci arriva!',
    2: 'Nuovo cubo: Accendi. Fermati su una lampada e usa Accendi: il livello è vinto quando Domo arriva sulla centralina con tutte le luci accese.',
    3: 'Nuovo cubo: Ripeti. I cubi al suo interno si ripetono N volte (tocca + e − o scrivi il numero). Il limite di cubi ti obbliga a cercare gli schemi che si ripetono!',
    4:'Un Ripeti può stare dentro un altro Ripeti. Cerca i cicli dentro i cicli: sono la chiave dei percorsi lunghi.',
    5: 'Nuovo cubo: F1. Costruisci una sequenza nella corsia "Funzione F1" e richiamala quante volte vuoi con il cubo F1 nel programma.', 6: 'Nuovo cubo: Finché. Ripete i suoi cubi fnché la condizione è vera (per esempio "finché davanti è libero"). Tocca la condizione per cambiarla.',
    7: 'Nuovo cubo: Se. Esegue i cubi sopra solo se la condizione è vera, altrimenti quelli sotto "altrimenti". Con Ripeti riesci a far seguire i muri a Domo!',
    8: 'Ora puoi usare tutto: cicli, funzioni, wcondizioni. I limiti sono stretti: niente cubi sprecati.',
    9: 'La Torre Domus: pochissimi cubi e percorsi enormi. Dopo questo mondo iniziano nuovi luoghi e nuove meccaniche!',
    10: 'Novità: le MONETE . Raccogline il più possibile passandoci sopra: servono per comprare nuovi personaggi. Non sono obbligatorie per vincere.',
    11: 'Novità: i PORTALI . Se Domo entra in un portale esce dall\'altro con lo stesso colore. Ogni passaggio conta come una mossa.',
    12: 'Novità: CHIAVI e PORTE  Passa su una chiave per prenderla: la porta dello stesso colore si apre. Senza chiave, la porta è un muro.',
    13: 'Novità: le TRAPPOLE . Le punte salgono e scendono a tempo: ogni cubo eseguito è un istante. I pallini sotto la trappola mostrano i prossimi istanti (rosso = attiva). Se serve, aspetta con il cubo Accendi su una casella senza lampada!',
    14: 'Novità: le SENTINELLE . Fanno avanti e indietro tra due caselle a ogni mossa; il contorno tratteggiato mostra dove saranno. Non farti schiacciare!'
  };
  var FEAT_LABEL = { coins: ['', 'monete'], portal: ['', 'portali'], door: ['', 'chiavi e porte'], trap: ['', 'trappole'], mover: ['', 'sentinelle'] };

  var RANKS = [
    [0, 'Apprendista'], [30, 'Programmatore'], [100, 'Esperto'], [250, 'Ingegnere'],
    [500, 'Architetto'], [900, 'Maestro'], [1500, 'Leggenda'], [2400, 'Mito dei Cubi']
  ];
  function rankFor(stars) {
    var r = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) { if (stars >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } }
    return { name: r[1], next: next ? { at: next[0], name: next[1] } : null };
  }

  /* Obiettivi: test(S) riceve lo stato del salvataggio. */
  function cleared(S) { var n = 0; for (var k in S.stars) if (S.stars[k] > 0 || S.skip[k]) n++; return n; }
  function threes(S) { var n = 0; for (var k in S.stars) if (S.stars[k] === 3) n++; return n; }
  var ACH = [
    { id: 'first', icon: '', name: 'Primo passo', desc: 'Completa il tuo primo livello', test: function (S) { return cleared(S) >= 1; } },
    { id: 'c10', icon: '', name: 'Si comincia', desc: 'Completa 10 livelli', test: function (S) { return cleared(S) >= 10; } },
    { id: 'c50', icon: '', name: 'In cammino', desc: 'Completa 50 livelli', test: function (S) { return cleared(S) >= 50; } },
    { id: 'c100', icon: '', name: 'Centurione', desc: 'Completa 100 livelli', test: function (S) { return cleared(S) >= 100; } },
    { id: 'c300', icon: '', name: 'Inarrestabile', desc: 'Completa 300 livelli', test: function (S) { return cleared(S) >= 300; } },
    { id: 'c1000', icon: '', name: 'Re dei Cubi', desc: 'Completa tutti i 1000 livelli', test: function (S) { return cleared(S) >= 1000; } },
    { id: 't10', icon: '', name: 'Perfezionista', desc: '10 livelli con 3 stelle', test: function (S) { return threes(S) >= 10; } },
    { id: 't100', icon: '', name: 'Stella polare', desc: '100 livelli con 3 stelle', test: function (S) { return threes(S) >= 100; } },
    { id: 'coin50', icon: '', name: 'Collezionista', desc: 'Raccogli 50 monete', test: function (S) { return S.stats.coins >= 50; } },
    { id: 'coin300', icon: '', name: 'Tesoriere', desc: 'Raccogli 300 monete', test: function (S) { return S.stats.coins >= 300; } },
    { id: 'portal', icon: '', name: 'Viaggiatore', desc: 'Vinci un livello con i portali', test: function (S) { return S.stats.portalWins >= 1; } },
    { id: 'door', icon: '', name: 'Scassinatore', desc: 'Vinci un livello con chiavi e porte', test: function (S) { return S.stats.doorWins >= 1; } },
    { id: 'trap', icon: '', name: 'Schivafulmini', desc: 'Vinci un livello con le trappole', test: function (S) { return S.stats.trapWins >= 1; } },
    { id: 'guard', icon: '', name: 'Furtivo', desc: 'Vinci un livello con le sentinelle', test: function (S) { return S.stats.moverWins >= 1; } },
    { id: 'dark', icon: '', name: 'Nel buio', desc: 'Vinci un livello in Modalità Buio', test: function (S) { return S.stats.dark >= 1; } },
    { id: 'speed', icon: '', name: 'Velocista', desc: 'Completa una Speedrun', test: function (S) { return S.stats.speedruns >= 1; } },
    { id: 'daily', icon: '', name: 'Sfida accettata', desc: 'Completa la sfida del giorno', test: function (S) { return S.stats.dailies >= 1; } },
    { id: 'streak3', icon: '', name: 'In serie', desc: '3 giorni di fila di sfida giornaliera', test: function (S) { return S.daily.best >= 3; } },
    { id: 'builder', icon: '', name: 'Costruttore', desc: 'Crea e verifica un livello nell\'editor', test: function (S) { return S.stats.built >= 1; } },
    { id: 'skin', icon: '', name: 'Nuovo look', desc: 'Compra un personaggio', test: function (S) { return S.stats.bought >= 1; } },
    { id: 'w10', icon: '', name: 'Esploratore', desc: 'Raggiungi il Mondo 10', test: function (S) { return S.current >= 91; } },
    { id: 'w50', icon: '', name: 'Navigatore', desc: 'Raggiungi il Mondo 50', test: function (S) { return S.current >= 491; } }
  ];

  root.DomusData = { TIPS: TIPS, FEAT_LABEL: FEAT_LABEL, RANKS: RANKS, rankFor: rankFor, ACH: ACH };
})(typeof self !== 'undefined' ? self : this);
