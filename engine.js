/* Battleship Arena engine — shared by the browser app and the node test harness.
 * Classic mode: 10x10, standard fleet, one shot per turn, win at 17 hits. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Battleship = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SIZE = 10;
  var SHIPS = [
    { name: 'The Smoker', size: 5 },
    { name: 'Grill', size: 4 },
    { name: 'Fryer', size: 3 },
    { name: 'Griddle', size: 3 },
    { name: 'Kettle', size: 2 }
  ];
  var TOTAL_CELLS = 17;

  function createBoard() {
    var cells = [];
    for (var y = 0; y < SIZE; y++) {
      var row = [];
      for (var x = 0; x < SIZE; x++) row.push({ ship: -1, hit: false });
      cells.push(row);
    }
    return {
      size: SIZE,
      cells: cells,
      ships: SHIPS.map(function (s) {
        return { name: s.name, size: s.size, hits: 0, sunk: false, cells: [] };
      })
    };
  }

  function inBounds(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  function shipCells(shipIdx, x, y, horizontal) {
    var size = SHIPS[shipIdx].size;
    var out = [];
    for (var i = 0; i < size; i++) {
      out.push(horizontal ? [x + i, y] : [x, y + i]);
    }
    return out;
  }

  function canPlace(board, shipIdx, x, y, horizontal) {
    if (shipIdx < 0 || shipIdx >= SHIPS.length) return false;
    var cells = shipCells(shipIdx, x, y, horizontal);
    for (var i = 0; i < cells.length; i++) {
      var cx = cells[i][0], cy = cells[i][1];
      if (!inBounds(cx, cy)) return false;
      var existing = board.cells[cy][cx].ship;
      if (existing !== -1 && existing !== shipIdx) return false;
    }
    return true;
  }

  function removeShip(board, shipIdx) {
    var ship = board.ships[shipIdx];
    for (var i = 0; i < ship.cells.length; i++) {
      var c = ship.cells[i];
      board.cells[c[1]][c[0]].ship = -1;
    }
    ship.cells = [];
    ship.hits = 0;
    ship.sunk = false;
  }

  function placeShip(board, shipIdx, x, y, horizontal) {
    if (!canPlace(board, shipIdx, x, y, horizontal)) return false;
    removeShip(board, shipIdx);
    var cells = shipCells(shipIdx, x, y, horizontal);
    var ship = board.ships[shipIdx];
    for (var i = 0; i < cells.length; i++) {
      var cx = cells[i][0], cy = cells[i][1];
      board.cells[cy][cx].ship = shipIdx;
      ship.cells.push([cx, cy]);
    }
    return true;
  }

  function fleetComplete(board) {
    for (var i = 0; i < SHIPS.length; i++) {
      if (board.ships[i].cells.length !== SHIPS[i].size) return false;
    }
    return true;
  }

  function occupiedCount(board) {
    var n = 0;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (board.cells[y][x].ship !== -1) n++;
      }
    }
    return n;
  }

  /* Places all 5 ships at random legal positions. rng() -> [0,1). */
  function placeFleetRandom(board, rng) {
    rng = rng || Math.random;
    for (var s = 0; s < SHIPS.length; s++) {
      var placed = false;
      for (var attempt = 0; attempt < 500 && !placed; attempt++) {
        var x = Math.floor(rng() * SIZE);
        var y = Math.floor(rng() * SIZE);
        var horizontal = rng() < 0.5;
        placed = placeShip(board, s, x, y, horizontal);
      }
      if (!placed) throw new Error('placeFleetRandom: could not place ' + SHIPS[s].name);
    }
    return board;
  }

  function fireAt(board, x, y) {
    if (!inBounds(x, y)) return { result: 'invalid' };
    var cell = board.cells[y][x];
    if (cell.hit) return { result: 'repeat' };
    cell.hit = true;
    if (cell.ship === -1) return { result: 'miss', x: x, y: y };
    var ship = board.ships[cell.ship];
    ship.hits++;
    if (ship.hits >= ship.size) {
      ship.sunk = true;
      return { result: 'sunk', x: x, y: y, ship: ship.name, shipIndex: cell.ship, size: ship.size };
    }
    return { result: 'hit', x: x, y: y, ship: ship.name };
  }

  function allSunk(board) {
    for (var i = 0; i < SHIPS.length; i++) {
      if (!board.ships[i].sunk) return false;
    }
    return true;
  }

  function hitCount(board) {
    var n = 0;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var c = board.cells[y][x];
        if (c.hit && c.ship !== -1) n++;
      }
    }
    return n;
  }

  function shotCount(board) {
    var n = 0;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (board.cells[y][x].hit) n++;
      }
    }
    return n;
  }

  /* ---- Bot: hunt/target ---- */
  function neighbors(x, y) {
    var out = [];
    if (inBounds(x - 1, y)) out.push([x - 1, y]);
    if (inBounds(x + 1, y)) out.push([x + 1, y]);
    if (inBounds(x, y - 1)) out.push([x, y - 1]);
    if (inBounds(x, y + 1)) out.push([x, y + 1]);
    return out;
  }

  function createBot(rng) {
    var tried = [];
    for (var y = 0; y < SIZE; y++) {
      tried.push(new Array(SIZE).fill(false));
    }
    return { tried: tried, targets: [], unresolved: [], rng: rng || Math.random };
  }

  function pushTargets(bot, x, y) {
    var ns = neighbors(x, y);
    for (var i = 0; i < ns.length; i++) {
      var nx = ns[i][0], ny = ns[i][1];
      if (!bot.tried[ny][nx]) bot.targets.push([nx, ny]);
    }
  }

  function botNextShot(bot) {
    while (bot.targets.length > 0) {
      var t = bot.targets.pop();
      if (!bot.tried[t[1]][t[0]]) return t;
    }
    // Hunt: checkerboard parity first (guaranteed to find every ship of size >= 2).
    var parity = [];
    var any = [];
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (!bot.tried[y][x]) {
          any.push([x, y]);
          if ((x + y) % 2 === 0) parity.push([x, y]);
        }
      }
    }
    var pool = parity.length > 0 ? parity : any;
    if (pool.length === 0) return null;
    return pool[Math.floor(bot.rng() * pool.length)];
  }

  function botRecord(bot, x, y, outcome) {
    bot.tried[y][x] = true;
    if (outcome.result === 'hit' || outcome.result === 'sunk') {
      bot.unresolved.push([x, y]);
      pushTargets(bot, x, y);
    }
    if (outcome.result === 'sunk') {
      // Attribute the sunk ship's cells: BFS from the final hit over unresolved
      // cells, taking `size` of them (BFS order). Handles touching ships in the
      // common case; any misattribution only costs efficiency, never correctness.
      var size = outcome.size;
      var seen = {};
      var queue = [[x, y]];
      var key = x + ',' + y;
      seen[key] = true;
      var group = [];
      while (queue.length > 0 && group.length < size) {
        var c = queue.shift();
        group.push(c);
        var ns = neighbors(c[0], c[1]);
        for (var i = 0; i < ns.length; i++) {
          var nk = ns[i][0] + ',' + ns[i][1];
          if (!seen[nk]) {
            seen[nk] = true;
            var isUnresolved = bot.unresolved.some(function (u) {
              return u[0] === ns[i][0] && u[1] === ns[i][1];
            });
            if (isUnresolved) queue.push(ns[i]);
          }
        }
      }
      var groupKeys = {};
      group.forEach(function (g) { groupKeys[g[0] + ',' + g[1]] = true; });
      bot.unresolved = bot.unresolved.filter(function (u) {
        return !groupKeys[u[0] + ',' + u[1]];
      });
      // Rebuild targets from remaining unresolved hits (covers adjacent ships).
      bot.targets = [];
      bot.unresolved.forEach(function (u) { pushTargets(bot, u[0], u[1]); });
    }
  }

  return {
    SIZE: SIZE,
    SHIPS: SHIPS,
    TOTAL_CELLS: TOTAL_CELLS,
    createBoard: createBoard,
    inBounds: inBounds,
    canPlace: canPlace,
    placeShip: placeShip,
    removeShip: removeShip,
    fleetComplete: fleetComplete,
    occupiedCount: occupiedCount,
    placeFleetRandom: placeFleetRandom,
    fireAt: fireAt,
    allSunk: allSunk,
    hitCount: hitCount,
    shotCount: shotCount,
    createBot: createBot,
    botNextShot: botNextShot,
    botRecord: botRecord
  };
});
