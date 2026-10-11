/* Engine proof: simulates full bot-vs-bot games, validates placement rules. */
'use strict';
const assert = require('assert');
const B = require('../engine.js');

// Seeded RNG so the run is reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let checks = 0;
function check(cond, msg) {
  checks++;
  assert(cond, msg);
}

// 1. Placement validation rules.
(function placementRules() {
  const b = B.createBoard();
  check(B.canPlace(b, 0, 0, 0, true) === true, 'carrier fits at 0,0 horizontal');
  check(B.canPlace(b, 0, 6, 0, true) === false, 'carrier overflows right edge');
  check(B.canPlace(b, 0, 0, 9, false) === false, 'carrier overflows bottom edge');
  check(B.canPlace(b, 4, 9, 9, true) === false, 'destroyer overflows right edge');
  check(B.placeShip(b, 0, 0, 0, true) === true, 'place carrier');
  check(B.canPlace(b, 4, 0, 0, true) === false, 'overlap rejected');
  check(B.canPlace(b, 4, 5, 0, true) === true, 'touching allowed (classic rules)');
  check(B.placeShip(b, 0, 5, 5, false) === true, 're-place moves ship');
  check(B.occupiedCount(b) === 5, 're-placed ship leaves no ghost cells');
  check(B.fleetComplete(b) === false, 'partial fleet not complete');
})();

// 2. Random placement always yields a legal full fleet.
(function randomPlacement() {
  for (let i = 0; i < 200; i++) {
    const b = B.createBoard();
    B.placeFleetRandom(b, mulberry32(i));
    check(B.fleetComplete(b), 'fleet complete, seed ' + i);
    check(B.occupiedCount(b) === 17, 'exactly 17 cells occupied, seed ' + i);
  }
})();

// 3. Firing semantics.
(function firing() {
  const b = B.createBoard();
  B.placeShip(b, 4, 0, 0, true); // destroyer at (0,0)-(1,0)
  let r = B.fireAt(b, 5, 5);
  check(r.result === 'miss', 'water is a miss');
  r = B.fireAt(b, 5, 5);
  check(r.result === 'repeat', 're-firing same cell is a repeat');
  r = B.fireAt(b, 0, 0);
  check(r.result === 'hit', 'ship cell is a hit');
  check(B.allSunk(b) === false, 'one ship down, fleet alive');
  r = B.fireAt(b, 1, 0);
  check(r.result === 'sunk' && r.ship === 'Kettle' && r.size === 2, 'final cell sinks with name+size');
})();

// 4. Full bot-vs-bot games: must terminate, winner sinks all 17, loser does not.
const GAMES = 300;
let totalTurns = 0;
let maxTurns = 0;
(function fullGames() {
  for (let g = 0; g < GAMES; g++) {
    const rngA = mulberry32(g * 2 + 1);
    const rngB = mulberry32(g * 2 + 2);
    const boardA = B.createBoard(); // bot A defends this
    const boardB = B.createBoard(); // bot B defends this
    B.placeFleetRandom(boardA, rngA);
    B.placeFleetRandom(boardB, rngB);
    const botA = B.createBot(rngA); // bot A shoots at boardB
    const botB = B.createBot(rngB); // bot B shoots at boardA
    let turn = 0;
    let winner = null;
    while (turn < 400) {
      turn++;
      // A shoots
      const sa = B.botNextShot(botA);
      check(sa !== null, 'bot A always has a legal shot, game ' + g);
      const ra = B.fireAt(boardB, sa[0], sa[1]);
      check(ra.result !== 'repeat' && ra.result !== 'invalid', 'bot A never repeats, game ' + g);
      B.botRecord(botA, sa[0], sa[1], ra);
      if (B.allSunk(boardB)) { winner = 'A'; break; }
      // B shoots
      const sb = B.botNextShot(botB);
      check(sb !== null, 'bot B always has a legal shot, game ' + g);
      const rb = B.fireAt(boardA, sb[0], sb[1]);
      check(rb.result !== 'repeat' && rb.result !== 'invalid', 'bot B never repeats, game ' + g);
      B.botRecord(botB, sb[0], sb[1], rb);
      if (B.allSunk(boardA)) { winner = 'B'; break; }
    }
    check(winner !== null, 'game terminates, game ' + g);
    const sunkA = B.allSunk(boardA), sunkB = B.allSunk(boardB);
    check(sunkA !== sunkB, 'exactly one fleet fully sunk, game ' + g);
    check(B.hitCount(winner === 'A' ? boardB : boardA) === 17, 'winner landed all 17 hits, game ' + g);
    totalTurns += turn;
    if (turn > maxTurns) maxTurns = turn;
  }
})();

console.log('ENGINE PROOF: ' + GAMES + ' bot-vs-bot games completed.');
console.log('avg turns/game: ' + (totalTurns / GAMES).toFixed(1) + ', max turns: ' + maxTurns);
console.log('assertions passed: ' + checks);
