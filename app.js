/* Battleship Arena — free-play client. Player vs bot, classic mode. */
(function () {
  'use strict';

  var B = window.Battleship;
  var COLS = 'ABCDEFGHIJ';

  function label(x, y) { return COLS[x] + (y + 1); }

  /* ---------- screen management ---------- */
  var screens = ['start', 'place', 'battle', 'over'];
  function show(name) {
    screens.forEach(function (s) {
      document.getElementById('screen-' + s).hidden = (s !== name);
    });
    window.scrollTo(0, 0);
  }

  /* ---------- board rendering ---------- */
  // view: 'place' | 'enemy' | 'own'
  function renderBoard(el, board, view, opts) {
    opts = opts || {};
    el.innerHTML = '';
    var corner = document.createElement('span');
    corner.className = 'coord';
    corner.setAttribute('aria-hidden', 'true');
    el.appendChild(corner);
    for (var x = 0; x < 10; x++) {
      var cl = document.createElement('span');
      cl.className = 'coord';
      cl.textContent = COLS[x];
      cl.setAttribute('aria-hidden', 'true');
      el.appendChild(cl);
    }
    for (var y = 0; y < 10; y++) {
      var rl = document.createElement('span');
      rl.className = 'coord';
      rl.textContent = String(y + 1);
      rl.setAttribute('aria-hidden', 'true');
      el.appendChild(rl);
      for (var cx = 0; cx < 10; cx++) {
        el.appendChild(makeCell(board, view, cx, y, opts));
      }
    }
  }

  function makeCell(board, view, x, y, opts) {
    var cell = board.cells[y][x];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';
    btn.dataset.x = x;
    btn.dataset.y = y;

    var state = 'water';
    var aria = label(x, y);
    if (view === 'place') {
      if (cell.ship !== -1) {
        state = 'ship';
        aria += ', ' + B.SHIPS[cell.ship].name;
      } else {
        aria += ', empty water';
      }
      btn.classList.add('fireable');
    } else if (view === 'enemy') {
      if (cell.hit) {
        if (cell.ship !== -1) {
          state = board.ships[cell.ship].sunk ? 'sunk' : 'hit';
          aria += state === 'sunk' ? ', sunk ' + board.ships[cell.ship].name : ', hit';
        } else {
          state = 'miss';
          aria += ', miss';
        }
      } else if (opts.selected && opts.selected[0] === x && opts.selected[1] === y) {
        state = 'selected';
        aria += ', targeted';
      } else {
        aria += ', untested water';
        btn.classList.add('fireable');
      }
    } else { // own
      if (cell.ship !== -1) state = 'ship';
      if (cell.hit) {
        if (cell.ship !== -1) {
          state = board.ships[cell.ship].sunk ? 'sunk' : 'hit';
        } else {
          state = 'miss';
        }
      }
      aria += ', ' + state;
    }

    btn.dataset.state = state;
    btn.setAttribute('aria-label', aria);
    return btn;
  }

  /* ================= PLACEMENT ================= */
  var playerBoard = B.createBoard();
  var placements = []; // {ship, x, y, horizontal} for rematch rebuild
  var selectedShip = 0;
  var horizontal = true;

  var placeBoardEl = document.getElementById('place-board');
  var chipsEl = document.getElementById('fleet-chips');
  var hintEl = document.getElementById('place-hint');
  var sailBtn = document.getElementById('btn-sail');
  var rotateLabel = document.getElementById('rotate-label');

  function refreshPlacement() {
    renderBoard(placeBoardEl, playerBoard, 'place');
    renderChips();
    var done = B.fleetComplete(playerBoard);
    sailBtn.disabled = !done;
    if (done) {
      hintEl.textContent = 'Fleet ready. Set sail when you are.';
    } else {
      var next = firstUnplaced();
      hintEl.textContent = 'Placing: ' + B.SHIPS[next].name + ' (' + B.SHIPS[next].size + ' squares). Tap a square.';
    }
  }

  function firstUnplaced() {
    for (var i = 0; i < B.SHIPS.length; i++) {
      if (playerBoard.ships[i].cells.length === 0) return i;
    }
    return 0;
  }

  function renderChips() {
    chipsEl.innerHTML = '';
    B.SHIPS.forEach(function (s, i) {
      var placed = playerBoard.ships[i].cells.length > 0;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ship-chip' + (placed ? ' placed' : '');
      chip.setAttribute('aria-pressed', i === selectedShip ? 'true' : 'false');
      var pips = '';
      for (var p = 0; p < s.size; p++) pips += '<i></i>';
      chip.innerHTML = '<span class="pips">' + pips + '</span><span>' + s.name + '</span>';
      chip.setAttribute('aria-label', s.name + ', ' + s.size + ' squares' + (placed ? ', placed' : ''));
      chip.addEventListener('click', function () {
        selectedShip = i;
        renderChips();
      });
      chipsEl.appendChild(chip);
    });
  }

  placeBoardEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.cell');
    if (!btn) return;
    var x = +btn.dataset.x, y = +btn.dataset.y;
    var existing = playerBoard.cells[y][x].ship;
    if (existing !== -1) {
      // Tap a placed ship to lift it back off the board.
      B.removeShip(playerBoard, existing);
      placements = placements.filter(function (p) { return p.ship !== existing; });
      selectedShip = existing;
      refreshPlacement();
      return;
    }
    if (B.placeShip(playerBoard, selectedShip, x, y, horizontal)) {
      placements = placements.filter(function (p) { return p.ship !== selectedShip; });
      placements.push({ ship: selectedShip, x: x, y: y, horizontal: horizontal });
      selectedShip = firstUnplaced();
      refreshPlacement();
    } else {
      btn.classList.add('shake');
      setTimeout(function () { btn.classList.remove('shake'); }, 320);
      hintEl.textContent = B.SHIPS[selectedShip].name + ' does not fit there. Try another square or rotate.';
    }
  });

  document.getElementById('btn-rotate').addEventListener('click', function () {
    horizontal = !horizontal;
    rotateLabel.textContent = horizontal ? 'Horizontal' : 'Vertical';
  });

  document.getElementById('btn-random').addEventListener('click', function () {
    playerBoard = B.createBoard();
    B.placeFleetRandom(playerBoard);
    placements = [];
    playerBoard.ships.forEach(function (s, i) {
      var c0 = s.cells[0];
      var horiz = s.cells.length > 1 && s.cells[1][0] !== c0[0];
      placements.push({ ship: i, x: c0[0], y: c0[1], horizontal: horiz });
    });
    refreshPlacement();
  });

  document.getElementById('btn-clear').addEventListener('click', function () {
    playerBoard = B.createBoard();
    placements = [];
    selectedShip = 0;
    refreshPlacement();
  });

  /* ================= BATTLE ================= */
  var botBoard, bot;
  var selectedTarget = null;
  var busy = false;
  var playerShots = 0, playerHits = 0;
  var botShots = []; // bot shots in order, for bot-state rebuild on resume

  var enemyBoardEl = document.getElementById('enemy-board');
  var ownBoardEl = document.getElementById('own-board');
  var fireBtn = document.getElementById('btn-fire');
  var bannerEl = document.getElementById('battle-status');
  var logEl = document.getElementById('battle-log');
  var scoreYouEl = document.getElementById('score-you');
  var scoreBotEl = document.getElementById('score-bot');

  function log(msg, cls) {
    var li = document.createElement('li');
    li.textContent = msg;
    if (cls) li.className = cls;
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setBanner(text, mode) {
    bannerEl.textContent = text;
    bannerEl.className = 'battle-banner ' + mode;
  }

  function refreshBattle() {
    renderBoard(enemyBoardEl, botBoard, 'enemy', { selected: selectedTarget });
    renderBoard(ownBoardEl, playerBoard, 'own');
    scoreYouEl.textContent = B.hitCount(botBoard) + '/17';
    scoreBotEl.textContent = B.hitCount(playerBoard) + '/17';
    fireBtn.disabled = busy || !selectedTarget;
  }

  function sunkCount(board) {
    return board.ships.filter(function (s) { return s.sunk; }).length;
  }

  function startBattle() {
    botBoard = B.createBoard();
    B.placeFleetRandom(botBoard);
    bot = B.createBot();
    botShots = [];
    selectedTarget = null;
    busy = false;
    playerShots = 0;
    playerHits = 0;
    logEl.innerHTML = '';
    setBanner('Your shot', 'your-turn');
    log('Battle stations. You fire first.');
    refreshBattle();
    saveBattle();
    show('battle');
  }

  enemyBoardEl.addEventListener('click', function (e) {
    if (busy) return;
    var btn = e.target.closest('.cell');
    if (!btn) return;
    var x = +btn.dataset.x, y = +btn.dataset.y;
    var cell = botBoard.cells[y][x];
    if (cell.hit) return;
    selectedTarget = [x, y];
    refreshBattle();
  });

  fireBtn.addEventListener('click', function () {
    if (busy || !selectedTarget) return;
    busy = true;
    var x = selectedTarget[0], y = selectedTarget[1];
    selectedTarget = null;
    playerShots++;
    var r = B.fireAt(botBoard, x, y);
    if (r.result === 'miss') {
      log('You fired ' + label(x, y) + ': miss.');
    } else if (r.result === 'hit') {
      playerHits++;
      log('You fired ' + label(x, y) + ': HIT.', 'hit');
    } else if (r.result === 'sunk') {
      playerHits++;
      log('You fired ' + label(x, y) + ': HIT — you sunk their ' + r.ship + '.', 'sunk');
    }
    refreshBattle();
    saveBattle();
    if (r.result === 'hit' || r.result === 'sunk') {
      var flash = enemyBoardEl.querySelector('.cell[data-x="' + x + '"][data-y="' + y + '"]');
      if (flash) flash.classList.add('hit-flash');
    }
    if (B.allSunk(botBoard)) {
      setTimeout(function () { endGame(true); }, 650);
      return;
    }
    setBanner('Enemy inbound', 'waiting');
    setTimeout(botTurn, 750);
  });

  function botTurn() {
    var s = B.botNextShot(bot);
    var r = B.fireAt(playerBoard, s[0], s[1]);
    B.botRecord(bot, s[0], s[1], r);
    botShots.push([s[0], s[1]]);
    if (r.result === 'miss') {
      log('Enemy fired ' + label(s[0], s[1]) + ': miss.');
    } else if (r.result === 'hit') {
      log('Enemy fired ' + label(s[0], s[1]) + ': HIT on your ' + r.ship + '.', 'hit');
    } else if (r.result === 'sunk') {
      log('Enemy fired ' + label(s[0], s[1]) + ': HIT — they sunk your ' + r.ship + '.', 'sunk');
    }
    busy = false;
    refreshBattle();
    saveBattle();
    if (B.allSunk(playerBoard)) {
      setTimeout(function () { endGame(false); }, 650);
      return;
    }
    setBanner('Your shot', 'your-turn');
  }

  /* ================= SAVE / RESUME =================
   * The game used to live only in memory, so any tab reload (app switch,
   * screen lock, memory pressure on a phone) wiped a mid-battle game.
   * Now every shot is persisted to localStorage and the start screen
   * offers a resume. Bot state is rebuilt by replaying its shots in order. */
  var SAVE_KEY = 'battleship-arena-save-v1';

  function boardPlacements(board) {
    var out = [];
    board.ships.forEach(function (s, i) {
      if (s.cells.length === 0) return;
      var c0 = s.cells[0];
      var horiz = s.cells.length > 1 && s.cells[1][0] !== c0[0];
      out.push({ ship: i, x: c0[0], y: c0[1], horizontal: horiz });
    });
    return out;
  }

  function boardShots(board) {
    var out = [];
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 10; x++) {
        if (board.cells[y][x].hit) out.push([x, y]);
      }
    }
    return out;
  }

  function rebuildBoard(placementsList, shots) {
    var board = B.createBoard();
    placementsList.forEach(function (p) { B.placeShip(board, p.ship, p.x, p.y, p.horizontal); });
    shots.forEach(function (s) { B.fireAt(board, s[0], s[1]); });
    return board;
  }

  function saveBattle() {
    try {
      if (!botBoard || !B.fleetComplete(playerBoard)) return;
      if (B.allSunk(botBoard) || B.allSunk(playerBoard)) { clearSave(); return; }
      var logItems = [];
      var lis = logEl.querySelectorAll('li');
      for (var i = Math.max(0, lis.length - 60); i < lis.length; i++) {
        logItems.push({ msg: lis[i].textContent, cls: lis[i].className || '' });
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        playerPlacements: placements.slice(),
        botPlacements: boardPlacements(botBoard),
        playerShots: boardShots(botBoard),
        botShots: botShots.slice(),
        log: logItems
      }));
    } catch (e) { /* storage unavailable: game still works, just no resume */ }
  }

  function validSave(s) {
    if (!s || s.v !== 1) return false;
    if (!Array.isArray(s.playerPlacements) || s.playerPlacements.length !== 5) return false;
    if (!Array.isArray(s.botPlacements) || s.botPlacements.length !== 5) return false;
    return true;
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return validSave(s) ? s : null;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  function resumeBattle(s) {
    playerBoard = rebuildBoard(s.playerPlacements, []);
    bot = B.createBot();
    botShots = [];
    (s.botShots || []).forEach(function (xy) {
      var r = B.fireAt(playerBoard, xy[0], xy[1]);
      B.botRecord(bot, xy[0], xy[1], r);
      botShots.push(xy);
    });
    botBoard = rebuildBoard(s.botPlacements, s.playerShots || []);
    placements = s.playerPlacements.slice();
    selectedTarget = null;
    busy = false; // if we reloaded mid-bot-turn, its shot never happened; player goes again
    playerShots = (s.playerShots || []).length;
    playerHits = B.hitCount(botBoard);
    logEl.innerHTML = '';
    (s.log || []).forEach(function (item) { log(item.msg, item.cls || undefined); });
    log('Welcome back. Your shot.');
    setBanner('Your shot', 'your-turn');
    refreshBattle();
    hideResumeCard();
    show('battle');
  }

  var resumeCard = document.getElementById('resume-card');

  function hideResumeCard() { resumeCard.hidden = true; }

  function maybeShowResume() {
    var s = loadSave();
    if (!s) { hideResumeCard(); return; }
    document.getElementById('resume-sub').textContent =
      'Saved ' + new Date(s.savedAt).toLocaleString() + '. Your fleet is right where you left it.';
    resumeCard.hidden = false;
    document.getElementById('btn-resume').onclick = function () { resumeBattle(s); };
    document.getElementById('btn-discard').onclick = function () { clearSave(); hideResumeCard(); };
  }

  /* ================= GAME OVER ================= */
  function endGame(won) {
    clearSave();
    var title = document.getElementById('over-title');
    title.textContent = won ? 'Victory' : 'Defeat';
    title.className = won ? 'win' : '';
    document.getElementById('over-eyebrow').textContent = won ? 'Enemy fleet destroyed' : 'Your fleet was lost';
    document.getElementById('over-sub').textContent = won
      ? 'All five enemy ships rest on the ocean floor. The sea is yours.'
      : 'The enemy found every ship. Regroup and run it back.';
    document.getElementById('stat-shots').textContent = playerShots;
    document.getElementById('stat-hits').textContent = playerHits;
    document.getElementById('stat-acc').textContent =
      playerShots === 0 ? '0%' : Math.round((playerHits / playerShots) * 100) + '%';
    document.getElementById('stat-sunk').textContent = sunkCount(botBoard) + '/5';
    show('over');
  }

  /* ================= NAV ================= */
  document.getElementById('btn-deploy').addEventListener('click', function () {
    clearSave();
    playerBoard = B.createBoard();
    placements = [];
    selectedShip = 0;
    horizontal = true;
    rotateLabel.textContent = 'Horizontal';
    refreshPlacement();
    show('place');
  });

  sailBtn.addEventListener('click', function () {
    if (!B.fleetComplete(playerBoard)) return;
    startBattle();
  });

  document.getElementById('btn-rematch').addEventListener('click', function () {
    // Same placement, fresh boards, new enemy fleet.
    var keep = placements.slice();
    playerBoard = B.createBoard();
    keep.forEach(function (p) { B.placeShip(playerBoard, p.ship, p.x, p.y, p.horizontal); });
    startBattle();
  });

  document.getElementById('btn-newfleet').addEventListener('click', function () {
    clearSave();
    playerBoard = B.createBoard();
    placements = [];
    selectedShip = 0;
    refreshPlacement();
    show('place');
  });

  show('start');
  maybeShowResume();
})();
