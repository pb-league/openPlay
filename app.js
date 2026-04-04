const STORAGE_KEYS = {
  selectedLocationId: "openplay:selectedLocationId",
  sessions: "openplay:sessions",
  locations: "openplay:locations",
  notificationPlayerName: "openplay:notificationPlayerName",
  managerClaims: "openplay:managerClaims",
  devicePlayerName: "openplay:devicePlayerName",
  authSession: "openplay:authSession"
};

const DEFAULT_QUEUE = {
  format: "doubles",
  minRating: 1,
  courts: [1],
  maxGamesInRow: 2,
  winnersStay: true,
  winnersSplit: false,
  weights: {
    rating: 40,
    winRate: 30,
    wait: 30
  }
};

const config = window.APP_CONFIG ?? {};
const isWebProtocol = window.location.protocol === "http:" || window.location.protocol === "https:";
const state = {
  auth: loadJson(STORAGE_KEYS.authSession, null),
  locations: [],
  selectedLocationId: localStorage.getItem(STORAGE_KEYS.selectedLocationId) ?? "",
  session: null,
  sessionsCache: loadJson(STORAGE_KEYS.sessions, {}),
  deferredPrompt: null,
  pollHandle: null,
  lastNotifiedAssignmentKey: "",
  notificationPlayerName: localStorage.getItem(STORAGE_KEYS.notificationPlayerName) ?? "",
  devicePlayerName: localStorage.getItem(STORAGE_KEYS.devicePlayerName) ?? "",
  editingQueueId: "",
  managerClaims: loadJson(STORAGE_KEYS.managerClaims, {}),
  editingPlayerQueuesId: "",
  editingPlayerProfileId: ""
};

const els = {
  authCard: document.querySelector("#authCard"),
  authStatus: document.querySelector("#authStatus"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPin: document.querySelector("#loginPin"),
  registerForm: document.querySelector("#registerForm"),
  registerEmail: document.querySelector("#registerEmail"),
  mainLayout: document.querySelector("#mainLayout"),
  locationSelect: document.querySelector("#locationSelect"),
  refreshLocationsButton: document.querySelector("#refreshLocationsButton"),
  addLocationToggle: document.querySelector("#addLocationToggle"),
  addLocationForm: document.querySelector("#addLocationForm"),
  newLocationName: document.querySelector("#newLocationName"),
  newLocationNotes: document.querySelector("#newLocationNotes"),
  syncStatus: document.querySelector("#syncStatus"),
  joinForm: document.querySelector("#joinForm"),
  playerEmail: document.querySelector("#playerEmail"),
  playerName: document.querySelector("#playerName"),
  playerRating: document.querySelector("#playerRating"),
  playerGender: document.querySelector("#playerGender"),
  playerNotifications: document.querySelector("#playerNotifications"),
  playerNewPin: document.querySelector("#playerNewPin"),
  joinQueueLabel: document.querySelector("#joinQueueLabel"),
  joinQueueOptions: document.querySelector("#joinQueueOptions"),
  playerSummary: document.querySelector("#playerSummary"),
  managerStatusBar: document.querySelector("#managerStatusBar"),
  managerStatusText: document.querySelector("#managerStatusText"),
  relinquishManagerButton: document.querySelector("#relinquishManagerButton"),
  allowMultiQueue: document.querySelector("#allowMultiQueue"),
  queueForm: document.querySelector("#queueForm"),
  queueName: document.querySelector("#queueName"),
  queueFormat: document.querySelector("#queueFormat"),
  queueMinRating: document.querySelector("#queueMinRating"),
  queueCourtCount: document.querySelector("#queueCourtCount"),
  queueCourtsList: document.querySelector("#queueCourtsList"),
  queueMaxGamesInRow: document.querySelector("#queueMaxGamesInRow"),
  queueMaxGamesWrap: document.querySelector("#queueMaxGamesWrap"),
  queueWinnersStay: document.querySelector("#queueWinnersStay"),
  queueWinnerPairingWrap: document.querySelector("#queueWinnerPairingWrap"),
  queueWinnerPairing: document.querySelector("#queueWinnerPairing"),
  queueWeightRating: document.querySelector("#queueWeightRating"),
  queueWeightWinRate: document.querySelector("#queueWeightWinRate"),
  queueWeightWait: document.querySelector("#queueWeightWait"),
  queueWeightRatingValue: document.querySelector("#queueWeightRatingValue"),
  queueWeightWinRateValue: document.querySelector("#queueWeightWinRateValue"),
  queueWeightWaitValue: document.querySelector("#queueWeightWaitValue"),
  queueConfigList: document.querySelector("#queueConfigList"),
  generateButton: document.querySelector("#generateButton"),
  deleteAllPlayersButton: document.querySelector("#deleteAllPlayersButton"),
  courtsBoard: document.querySelector("#courtsBoard"),
  queueBoard: document.querySelector("#queueBoard"),
  historyOpenInlineButton: document.querySelector("#historyOpenInlineButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  historyDialog: document.querySelector("#historyDialog"),
  playerQueuesDialog: document.querySelector("#playerQueuesDialog"),
  playerQueuesTitle: document.querySelector("#playerQueuesTitle"),
  playerQueuesOptions: document.querySelector("#playerQueuesOptions"),
  savePlayerQueuesButton: document.querySelector("#savePlayerQueuesButton"),
  playerProfileDialog: document.querySelector("#playerProfileDialog"),
  playerProfileTitle: document.querySelector("#playerProfileTitle"),
  profileRating: document.querySelector("#profileRating"),
  profileGender: document.querySelector("#profileGender"),
  playerProfileNotice: document.querySelector("#playerProfileNotice"),
  savePlayerProfileButton: document.querySelector("#savePlayerProfileButton"),
  historyPlayerFilter: document.querySelector("#historyPlayerFilter"),
  historyInlinePlayerFilter: document.querySelector("#historyInlinePlayerFilter"),
  historyList: document.querySelector("#historyList"),
  historyPreview: document.querySelector("#historyPreview"),
  rankingsBoard: document.querySelector("#rankingsBoard"),
  shareLink: document.querySelector("#shareLink"),
  copyLinkButton: document.querySelector("#copyLinkButton"),
  qrCode: document.querySelector("#qrCode"),
  venmoLink: document.querySelector("#venmoLink"),
  installButton: document.querySelector("#installButton"),
  collapsibles: [...document.querySelectorAll(".collapsible")],
  locationLabels: [...document.querySelectorAll("[data-location-label]")]
};

boot();

async function boot() {
  bindEvents();
  syncCollapsibleLabels();
  setupSharing();
  registerServiceWorker();
  syncAuthDisplay();
  await restoreAuthSession();
  if (!state.auth) {
    return;
  }
  await loadLocations();
  await selectInitialLocation();
  hydrateAuthIntoForm();
  render();
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.registerForm.addEventListener("submit", handleRegister);
  els.refreshLocationsButton.addEventListener("click", loadLocations);
  els.addLocationToggle.addEventListener("click", () => {
    els.addLocationForm.hidden = !els.addLocationForm.hidden;
    if (!els.addLocationForm.hidden) {
      els.newLocationName.focus();
    }
  });
  els.addLocationForm.addEventListener("submit", handleAddLocation);
  els.locationSelect.addEventListener("change", async (event) => {
    state.selectedLocationId = event.target.value;
    localStorage.setItem(STORAGE_KEYS.selectedLocationId, state.selectedLocationId);
    await loadSessionForSelectedLocation();
    hydrateAuthIntoForm();
    render();
  });
  els.joinForm.addEventListener("submit", handleSaveMySettings);
  els.savePlayerQueuesButton.addEventListener("click", handleSavePlayerQueues);
  els.savePlayerProfileButton.addEventListener("click", handleSavePlayerProfile);
  els.relinquishManagerButton.addEventListener("click", handleRelinquishManager);
  els.allowMultiQueue.addEventListener("change", handleLocationSettingsChange);
  els.queueForm.addEventListener("submit", handleSaveQueue);
  els.queueConfigList.addEventListener("click", handleQueueConfigListClick);
  [els.queueFormat, els.queueCourtCount, els.queueMaxGamesInRow, els.queueWinnersStay, els.queueWeightRating, els.queueWeightWinRate, els.queueWeightWait, els.playerRating, els.playerGender].forEach((el) => {
    el.addEventListener("input", syncQueueFormDisplay);
  });
  els.generateButton.addEventListener("click", handleGenerate);
  els.deleteAllPlayersButton.addEventListener("click", handleDeleteAllPlayers);
  [els.historyOpenInlineButton].forEach((button) => {
    button.addEventListener("click", () => {
      populateHistoryFilter();
      renderHistory();
      els.historyDialog.showModal();
    });
  });
  els.clearHistoryButton.addEventListener("click", handleClearHistory);
  els.historyPlayerFilter.addEventListener("change", renderHistory);
  els.historyInlinePlayerFilter.addEventListener("change", renderHistory);
  els.copyLinkButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(window.location.href);
    setStatus("Share link copied.");
  });
  els.installButton.addEventListener("click", async () => {
    if (!state.deferredPrompt) {
      return;
    }
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    els.installButton.hidden = true;
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.installButton.hidden = false;
  });
  document.addEventListener("click", handleDocumentClick);
  els.qrCode.addEventListener("error", handleQrImageError);
  els.collapsibles.forEach((details) => details.addEventListener("toggle", syncCollapsibleLabels));
}

async function restoreAuthSession() {
  if (!state.auth?.token) {
    state.auth = null;
    saveAuthSession();
    syncAuthDisplay();
    return;
  }
  try {
    const profile = await apiGetProfile(state.auth.token);
    if (!profile) {
      state.auth = null;
      saveAuthSession();
    } else {
      state.auth = {
        token: state.auth.token,
        ...profile
      };
      state.devicePlayerName = state.auth.handle || "";
      localStorage.setItem(STORAGE_KEYS.devicePlayerName, state.devicePlayerName);
      saveAuthSession();
    }
  } catch (error) {
    console.error(error);
  }
  syncAuthDisplay();
}

function syncAuthDisplay() {
  const loggedIn = Boolean(state.auth?.token);
  els.authCard.hidden = loggedIn;
  els.mainLayout.hidden = !loggedIn;
  if (loggedIn) {
    els.authStatus.textContent = `Signed in as ${state.auth.email}.`;
    return;
  }
  els.authStatus.textContent = "Sign in or register before viewing queue details.";
}

function saveAuthSession() {
  if (state.auth) {
    localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(state.auth));
  } else {
    localStorage.removeItem(STORAGE_KEYS.authSession);
  }
}

function hydrateAuthIntoForm() {
  if (!state.auth) {
    return;
  }
  els.playerEmail.value = state.auth.email || "";
  els.playerName.value = state.auth.handle || "";
  els.playerRating.value = String(clamp(Number(state.auth.rating) || 3.5, 1, 6));
  els.playerGender.value = normalizeGender(state.auth.gender);
  els.playerNotifications.checked = Boolean(state.auth.notifications);
  els.playerNewPin.value = "";
  state.devicePlayerName = state.auth.handle || "";
  localStorage.setItem(STORAGE_KEYS.devicePlayerName, state.devicePlayerName);
}

async function handleLogin(event) {
  event.preventDefault();
  const email = els.loginEmail.value.trim();
  const pin = els.loginPin.value.trim();
  if (!email || !pin) {
    return;
  }
  try {
    const result = await apiLogin(email, pin);
    state.auth = {
      token: result.token,
      ...result.user
    };
    saveAuthSession();
    syncAuthDisplay();
    await loadLocations();
    await selectInitialLocation();
    hydrateAuthIntoForm();
    render();
    els.loginForm.reset();
    setStatus(`Signed in as ${state.auth.handle || state.auth.email}.`);
  } catch (error) {
    console.error(error);
    els.authStatus.textContent = error.message || "Sign in failed.";
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const email = els.registerEmail.value.trim();
  if (!email) {
    return;
  }
  try {
    await apiRegister(email);
    els.registerForm.reset();
    els.authStatus.textContent = `A starting PIN was emailed to ${email}. Use it to sign in.`;
  } catch (error) {
    console.error(error);
    els.authStatus.textContent = error.message || "Registration failed.";
  }
}

async function loadLocations() {
  try {
    const remoteLocations = await apiGetLocations();
    state.locations = dedupeLocations(remoteLocations.length ? remoteLocations : config.locationsFallback ?? []);
    localStorage.setItem(STORAGE_KEYS.locations, JSON.stringify(state.locations));
    setStatus(
      !isWebProtocol
        ? "Running from file:// for local testing. Install and manifest features still require http:// or https://."
        : (config.apiBaseUrl ? "Connected to shared session backend." : "Using local-only demo storage.")
    );
  } catch (error) {
    console.error(error);
    state.locations = dedupeLocations(loadJson(STORAGE_KEYS.locations, config.locationsFallback ?? []));
    setStatus(!isWebProtocol ? "Running from file:// using local data." : "Falling back to saved local locations.");
  }
  populateLocationSelect();
}

async function selectInitialLocation() {
  if (!state.locations.length) {
    state.locations = [createLocation("Default Location", "Created locally")];
    populateLocationSelect();
  }
  if (!state.locations.some((location) => location.id === state.selectedLocationId)) {
    state.selectedLocationId = state.locations[0].id;
    localStorage.setItem(STORAGE_KEYS.selectedLocationId, state.selectedLocationId);
  }
  els.locationSelect.value = state.selectedLocationId;
  await loadSessionForSelectedLocation();
  startPolling();
}

async function loadSessionForSelectedLocation() {
  if (!state.selectedLocationId) {
    return;
  }
  try {
    const remote = await apiGetSession(state.selectedLocationId);
    state.session = hydrateSession(remote || state.sessionsCache[state.selectedLocationId], getSelectedLocation());
  } catch (error) {
    console.error(error);
    state.session = hydrateSession(state.sessionsCache[state.selectedLocationId], getSelectedLocation());
    setStatus("Shared session unavailable, using saved local state.");
  }
  state.editingQueueId = "";
  state.editingPlayerProfileId = "";
  cacheCurrentSession();
  hydrateAuthIntoForm();
}

async function handleAddLocation(event) {
  event.preventDefault();
  const name = els.newLocationName.value.trim();
  const notes = els.newLocationNotes.value.trim();
  if (!name) {
    return;
  }
  const location = createLocation(name, notes);
  try {
    const saved = await apiAddLocation(location);
    const next = saved ?? location;
    state.locations = dedupeLocations([...state.locations, next]);
    state.selectedLocationId = next.id;
    localStorage.setItem(STORAGE_KEYS.selectedLocationId, state.selectedLocationId);
    setStatus(`Added ${name}.`);
  } catch (error) {
    console.error(error);
    state.locations = dedupeLocations([...state.locations, location]);
    state.selectedLocationId = location.id;
    localStorage.setItem(STORAGE_KEYS.selectedLocationId, state.selectedLocationId);
    setStatus("Saved location locally because shared location sync is not configured.");
  }
  localStorage.setItem(STORAGE_KEYS.locations, JSON.stringify(state.locations));
  els.newLocationName.value = "";
  els.newLocationNotes.value = "";
  els.addLocationForm.hidden = true;
  populateLocationSelect();
  await loadSessionForSelectedLocation();
  render();
}

async function handleLocationSettingsChange() {
  if (!state.session) {
    return;
  }
  if (!isManagerDevice()) {
    render();
    setStatus("Only the manager can change assignment settings.");
    return;
  }
  state.session.settings.allowMultiQueue = els.allowMultiQueue.checked;
  if (!state.session.settings.allowMultiQueue) {
    state.session.players.forEach((player) => {
      if (player.queueIds.length > 1) {
        player.queueIds = player.queueIds.slice(0, 1);
      }
    });
  }
  cacheCurrentSession();
  await persistSession();
  render();
}

async function handleSaveQueue(event) {
  event.preventDefault();
  if (!state.session) {
    return;
  }
  if (!isManagerDevice()) {
    setStatus("Only the manager can change queue and court settings.");
    return;
  }
  const name = els.queueName.value.trim();
  const courtCount = clamp(Number(els.queueCourtCount.value) || 1, 1, 20);
  const courts = getQueueCourtNames();
  if (!name || !courts.length) {
    setStatus("Each queue needs a name and at least one named court.");
    return;
  }
  if (courts.length !== courtCount) {
    setStatus(`Enter exactly ${courtCount} court name${courtCount === 1 ? "" : "s"} for this queue.`);
    return;
  }
  const queue = {
    id: state.editingQueueId || slugify(`${name}-${crypto.randomUUID().slice(0, 4)}`),
    name,
    format: els.queueFormat.value,
    minRating: clamp(Number(els.queueMinRating.value) || 1, 1, 6),
    courts,
    maxGamesInRow: clamp(Number(els.queueMaxGamesInRow.value) || 1, 1, 10),
    winnersStay: els.queueWinnersStay.checked,
    winnersSplit: els.queueFormat.value !== "singles" && els.queueWinnersStay.checked && Number(els.queueMaxGamesInRow.value) > 1
      ? els.queueWinnerPairing.value === "split"
      : false,
    weights: {
      rating: Number(els.queueWeightRating.value),
      winRate: Number(els.queueWeightWinRate.value),
      wait: Number(els.queueWeightWait.value)
    }
  };
  const index = state.session.queues.findIndex((item) => item.id === queue.id);
  if (index >= 0) {
    state.session.queues.splice(index, 1, queue);
  } else {
    state.session.queues.push(queue);
  }
  state.session.deletedQueueIds = (state.session.deletedQueueIds || []).filter((id) => id !== queue.id);
  state.session.players.forEach((player) => {
    if (!canPlayerJoinQueue(player, queue)) {
      player.queueIds = player.queueIds.filter((id) => id !== queue.id);
    }
    ensureQueueState(player, queue.id);
  });
  state.editingQueueId = "";
  resetQueueForm();
  cacheCurrentSession();
  await persistSession();
  render();
  setStatus(`Saved queue ${queue.name}.`);
}

async function handleEditQueue(queueId) {
  if (!isManagerDevice()) {
    setStatus("Only the manager can edit queue settings.");
    return;
  }
  const queue = findQueueById(queueId);
  if (!queue) {
    return;
  }
  state.editingQueueId = queue.id;
  els.queueName.value = queue.name;
  els.queueFormat.value = queue.format;
  els.queueMinRating.value = String(queue.minRating);
  els.queueCourtCount.value = String(queue.courts.length || 1);
  renderCourtNameInputs(queue.courts);
  els.queueMaxGamesInRow.value = String(queue.maxGamesInRow);
  els.queueWinnersStay.checked = queue.winnersStay;
  els.queueWinnerPairing.value = queue.winnersSplit ? "split" : "stay";
  els.queueWeightRating.value = String(queue.weights.rating);
  els.queueWeightWinRate.value = String(queue.weights.winRate);
  els.queueWeightWait.value = String(queue.weights.wait);
  syncQueueFormDisplay();
}

async function handleDeleteQueue(queueId) {
  if (!isManagerDevice()) {
    setStatus("Only the manager can delete queue settings.");
    return;
  }
  const queue = findQueueById(queueId);
  if (!queue) {
    setStatus("That queue no longer exists.");
    render();
    return;
  }
  state.session.deletedQueueIds ||= [];
  if (!state.session.deletedQueueIds.includes(queueId)) {
    state.session.deletedQueueIds.push(queueId);
  }
  state.session.queues = state.session.queues.filter((item) => item.id !== queueId);
  state.session.activeGames = state.session.activeGames.filter((game) => game.queueId !== queueId);
  state.session.courtHolds = (state.session.courtHolds || []).filter((hold) => hold.queueId !== queueId);
  state.session.history = state.session.history.filter((game) => game.queueId !== queueId);
  state.session.players.forEach((player) => {
    player.queueIds = player.queueIds.filter((id) => id !== queueId);
    delete player.queueStates[queueId];
  });
  state.editingQueueId = "";
  resetQueueForm();
  cacheCurrentSession();
  render();
  try {
    await persistSession();
    setStatus(`Deleted queue ${queue.name}.`);
  } catch (error) {
    console.error(error);
    setStatus(`Deleted queue ${queue.name} locally, but syncing the delete failed.`);
  }
}

async function handleSaveMySettings(event) {
  event.preventDefault();
  if (!state.session || !state.auth) {
    return;
  }
  const name = els.playerName.value.trim();
  const rating = Number(els.playerRating.value);
  const gender = normalizeGender(els.playerGender.value);
  const notifications = els.playerNotifications.checked;
  const newPin = els.playerNewPin.value.trim();
  const selectedQueueIds = getSelectedJoinQueueIds().filter((queueId) => {
    const queue = findQueueById(queueId);
    return queue && canPlayerJoinQueue({ rating, gender }, queue);
  });
  if (!name || Number.isNaN(rating)) {
    return;
  }
  const existingPlayer = findPlayerByAccountId(state.auth.id);
  if (state.session.players.some((item) => item.id !== existingPlayer?.id && item.name.toLowerCase() === name.toLowerCase())) {
    setStatus("That handle is already in use at this location. Please choose a different one.");
    return;
  }
  const previousQueueIds = existingPlayer ? [...existingPlayer.queueIds] : [];
  const player = existingPlayer || {
    id: crypto.randomUUID(),
    accountId: state.auth.id,
    email: state.auth.email,
    name,
    rating,
    gender,
    joinedAt: new Date().toISOString(),
    notifications,
    paused: false,
    queueIds: [],
    wins: 0,
    losses: 0,
    queueStates: {}
  };
  if (!existingPlayer) {
    state.session.players.push(player);
  }

  player.accountId = state.auth.id;
  player.email = state.auth.email;
  player.name = name;
  player.rating = clamp(rating, 1, 6);
  player.gender = gender;
  player.notifications = notifications;
  player.queueIds = state.session.settings.allowMultiQueue ? selectedQueueIds : selectedQueueIds.slice(0, 1);
  player.queueIds
    .filter((queueId) => !previousQueueIds.includes(queueId))
    .forEach((queueId) => {
      resetQueueState(player, queueId);
      markPlayerQueuedAtBottom(player, queueId);
    });
  previousQueueIds
    .filter((queueId) => !player.queueIds.includes(queueId))
    .forEach((queueId) => delete player.queueStates?.[queueId]);

  state.auth = {
    ...state.auth,
    handle: player.name,
    rating: player.rating,
    gender: player.gender,
    notifications,
    pendingNewPin: newPin || undefined
  };
  await persistProfile();
  delete state.auth.pendingNewPin;
  saveAuthSession();

  state.devicePlayerName = player.name;
  localStorage.setItem(STORAGE_KEYS.devicePlayerName, player.name);

  if (!state.session.managerId) {
    state.session.managerId = player.id;
    setManagerClaimForLocation(player.id);
  }

  if (player.notifications) {
    await ensureNotificationPermission();
    state.notificationPlayerName = player.name;
    localStorage.setItem(STORAGE_KEYS.notificationPlayerName, player.name);
    setStatus("Turn notifications enabled for this device. This works best when the app is saved to your phone's home screen.");
  }

  hydrateAuthIntoForm();
  cacheCurrentSession();
  await persistSession();
  render();
  if (!player.notifications) {
    setStatus(`Saved settings for ${player.name} at ${getSelectedLocation()?.name}.`);
  }
}

async function handleGenerate() {
  if (!state.session) {
    return;
  }
  const preview = previewAssignments(state.session, true);
  const assignments = preview.assignments;

  if (!assignments.length) {
    setStatus("No valid queue assignments are available right now.");
    return;
  }

  incrementQueueWaitCounts(assignments);
  state.session.courtHolds = preview.remainingHolds;
  state.session.activeGames.push(...assignments);
  state.session.round += 1;
  cacheCurrentSession();
  await persistSession();
  maybeNotifyAssignedPlayers();
  render();
  setStatus(`Generated ${assignments.length} game${assignments.length === 1 ? "" : "s"}.`);
}

async function handleCompleteGame(gameId, scoreA, scoreB) {
  const game = state.session.activeGames.find((item) => item.id === gameId);
  if (!game) {
    return;
  }
  const numericScoreA = Number(scoreA);
  const numericScoreB = Number(scoreB);
  if (Number.isNaN(numericScoreA) || Number.isNaN(numericScoreB) || numericScoreA === numericScoreB) {
    setStatus("Enter valid scores with a clear winner.");
    return;
  }

  const queue = findQueueById(game.queueId);
  const playersA = game.teamA.map(findPlayerById).filter(Boolean);
  const playersB = game.teamB.map(findPlayerById).filter(Boolean);
  const winners = numericScoreA > numericScoreB ? playersA : playersB;
  const losers = numericScoreA > numericScoreB ? playersB : playersA;
  const nextRound = state.session.round;

  [...playersA, ...playersB].forEach((player) => {
    const queueState = ensureQueueState(player, game.queueId);
    queueState.gamesPlayedInRow += 1;
    queueState.queueGamesWaited = 0;
  });
  winners.forEach((player) => {
    const queueState = ensureQueueState(player, game.queueId);
    player.wins += 1;
    if (!queue.winnersStay) {
      queueState.mustSitOutUntilRound = nextRound;
    }
  });
  losers.forEach((player) => {
    player.losses += 1;
  });

  if (queue?.format !== "singles" && queue.winnersStay && queue.winnersSplit && winners.length === 2) {
    const queueStateA = ensureQueueState(winners[0], game.queueId);
    const queueStateB = ensureQueueState(winners[1], game.queueId);
    queueStateA.splitPartnerId = winners[1].id;
    queueStateA.splitRound = nextRound;
    queueStateB.splitPartnerId = winners[0].id;
    queueStateB.splitRound = nextRound;
  } else {
    winners.concat(losers).forEach((player) => {
      const queueState = ensureQueueState(player, game.queueId);
      queueState.splitPartnerId = null;
      queueState.splitRound = 0;
    });
  }
  state.session.courtHolds ||= [];
  state.session.courtHolds = state.session.courtHolds.filter((hold) => hold.courtNumber !== game.courtNumber);
  if (queue?.winnersStay && winners.length) {
    state.session.courtHolds.push({
      queueId: game.queueId,
      courtNumber: game.courtNumber,
      playerIds: winners.map((player) => player.id),
      split: Boolean(queue.winnersSplit && winners.length === 2),
      splitPlayerIds: queue.winnersSplit && winners.length === 2 ? winners.map((player) => player.id) : []
    });
  }

  state.session.history.unshift({
    id: crypto.randomUUID(),
    queueId: game.queueId,
    queueName: queue?.name ?? "Queue",
    courtNumber: game.courtNumber,
    round: game.round,
    completedAt: new Date().toISOString(),
    teamA: [...game.teamA],
    teamB: [...game.teamB],
    teamANames: playersA.map((player) => player.name),
    teamBNames: playersB.map((player) => player.name),
    scoreA: numericScoreA,
    scoreB: numericScoreB,
    format: game.format,
    winnerIds: winners.map((player) => player.id)
  });

  state.session.activeGames = state.session.activeGames.filter((item) => item.id !== gameId);
  cacheCurrentSession();
  await persistSession();
  render();
}

async function handleRemovePlayer(playerId) {
  const player = findPlayerById(playerId);
  if (!canControlPlayer(player)) {
    setStatus("Only the manager or that player on their own device can remove this player.");
    return;
  }
  if (state.session.activeGames.some((game) => [...game.teamA, ...game.teamB].includes(playerId))) {
    setStatus("Finish the current game before removing that player.");
    return;
  }
  const wasManager = state.session.managerId === playerId;
  state.session.players = state.session.players.filter((player) => player.id !== playerId);
  if (wasManager) {
    state.session.managerId = "";
    clearManagerClaimForLocation(playerId);
    setStatus("Manager left. Another player can now claim manager.");
  }
  cacheCurrentSession();
  await persistSession();
  render();
}

async function handleSitOutPlayer(playerId) {
  const player = findPlayerById(playerId);
  if (!player) {
    return;
  }
  if (!canControlPlayer(player)) {
    setStatus("Only the manager or that player on their own device can sit them out.");
    return;
  }
  if (state.session.activeGames.some((game) => [...game.teamA, ...game.teamB].includes(playerId))) {
    setStatus("Finish the current game before sitting that player out.");
    return;
  }
  player.paused = true;
  player.queueIds.forEach((queueId) => {
    const queueState = ensureQueueState(player, queueId);
    queueState.queueGamesWaited = 0;
    queueState.gamesPlayedInRow = 0;
  });
  cacheCurrentSession();
  await persistSession();
  render();
}

async function handleReturnPlayer(playerId) {
  const player = findPlayerById(playerId);
  if (!player) {
    return;
  }
  if (!canControlPlayer(player)) {
    setStatus("Only the manager or that player on their own device can return them to the queue.");
    return;
  }
  player.paused = false;
  player.queueIds.forEach((queueId) => {
    resetQueueState(player, queueId);
    markPlayerQueuedAtBottom(player, queueId);
  });
  cacheCurrentSession();
  await persistSession();
  render();
}

async function handleMovePlayerDown(playerId) {
  const player = findPlayerById(playerId);
  if (!player) {
    return;
  }
  if (!canControlPlayer(player)) {
    setStatus("Only the manager or that player on their own device can move them down.");
    return;
  }
  player.queueIds.forEach((queueId) => {
    const queueState = ensureQueueState(player, queueId);
    queueState.queueGamesWaited = Math.max(0, queueState.queueGamesWaited - 1);
  });
  cacheCurrentSession();
  await persistSession();
  render();
}

function handleDocumentClick(event) {
  document.querySelectorAll(".queue-action-menu[open]").forEach((menu) => {
    if (!menu.contains(event.target)) {
      menu.removeAttribute("open");
    }
  });
}

async function handleClaimManager(playerId) {
  const player = findPlayerById(playerId);
  if (!player || state.session.managerId) {
    return;
  }
  state.session.managerId = player.id;
  setManagerClaimForLocation(player.id);
  cacheCurrentSession();
  await persistSession();
  render();
  setStatus(`${player.name} is now the manager for this location.`);
}

async function handleRelinquishManager() {
  if (!state.session?.managerId || !isManagerDevice()) {
    return;
  }
  const currentManager = findPlayerById(state.session.managerId);
  clearManagerClaimForLocation(state.session.managerId);
  state.session.managerId = "";
  cacheCurrentSession();
  await persistSession();
  render();
  setStatus(`${currentManager?.name ?? "The manager"} gave up manager controls. Another player can now claim them.`);
}

async function handleClearHistory() {
  if (!canClearHistory()) {
    setStatus('Only the player named "DougAdmin" can clear history.');
    return;
  }
  state.session.history = [];
  cacheCurrentSession();
  await persistSession();
  renderHistory();
  setStatus(`Cleared game history for ${getSelectedLocation()?.name ?? "this location"}.`);
}

async function handleDeleteAllPlayers() {
  if (!canUseDougAdminTools()) {
    setStatus('Only the player named "DougAdmin" can delete all players.');
    return;
  }
  const previousManagerId = state.session.managerId;
  state.session.players = [];
  state.session.activeGames = [];
  state.session.courtHolds = [];
  state.session.history = [];
  state.session.managerId = "";
  state.editingPlayerQueuesId = "";
  state.editingPlayerProfileId = "";
  state.editingQueueId = "";
  clearManagerClaimForLocation(previousManagerId);
  cacheCurrentSession();
  render();
  try {
    await persistSession();
    setStatus(`Deleted all players for ${getSelectedLocation()?.name ?? "this location"}.`);
  } catch (error) {
    console.error(error);
    setStatus("Deleted all players locally, but syncing the delete failed.");
  }
}

function openPlayerQueuesDialog(playerId) {
  const player = findPlayerById(playerId);
  if (!player) {
    return;
  }
  state.editingPlayerQueuesId = playerId;
  els.playerQueuesTitle.textContent = `Queues for ${player.name}`;
  renderPlayerQueuesEditor(player);
  els.playerQueuesDialog.showModal();
}

function openPlayerProfileDialog(playerId) {
  const player = findPlayerById(playerId);
  if (!player) {
    return;
  }
  if (!canControlPlayer(player)) {
    setStatus("Only the manager or that player on their own device can edit this profile.");
    return;
  }
  state.editingPlayerProfileId = playerId;
  els.playerProfileTitle.textContent = `Edit Profile for ${player.name}`;
  els.profileRating.value = player.rating.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  els.profileGender.value = normalizeGender(player.gender);
  els.playerProfileNotice.textContent = "Changing rating or gender updates which queues this player qualifies for.";
  els.playerProfileDialog.showModal();
}

function renderPlayerQueuesEditor(player) {
  const queues = state.session.queues.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!queues.length) {
    els.playerQueuesOptions.innerHTML = '<div class="empty-inline">No queues exist yet. Ask the manager to create one first.</div>';
    return;
  }
  const inputType = state.session.settings.allowMultiQueue ? "checkbox" : "radio";
  els.playerQueuesOptions.innerHTML = queues.map((queue) => {
    const eligible = canPlayerJoinQueue(player, queue);
    const checked = player.queueIds.includes(queue.id);
    return `
      <label class="checkbox-list-item ${eligible ? "" : "disabled-item"}">
        <input type="${inputType}" name="playerQueueChoice" value="${queue.id}" ${checked ? "checked" : ""} ${eligible ? "" : "disabled"}>
        <span>${queue.name} • ${queue.format} • Courts ${queue.courts.join(",")} • Min ${queue.minRating.toFixed(1)}${queue.format === "mixed-doubles" ? " • Requires M or F" : ""}</span>
      </label>
    `;
  }).join("");
}

async function handleSavePlayerQueues() {
  const player = findPlayerById(state.editingPlayerQueuesId);
  if (!player) {
    return;
  }
  const previousQueueIds = [...player.queueIds];
  const selectedQueueIds = [...els.playerQueuesOptions.querySelectorAll('input[name="playerQueueChoice"]:checked')].map((input) => input.value);
  player.queueIds = state.session.settings.allowMultiQueue ? selectedQueueIds : selectedQueueIds.slice(0, 1);
  previousQueueIds
    .filter((queueId) => !player.queueIds.includes(queueId))
    .forEach((queueId) => delete player.queueStates?.[queueId]);
  player.queueIds.forEach((queueId) => {
    if (!previousQueueIds.includes(queueId)) {
      resetQueueState(player, queueId);
      markPlayerQueuedAtBottom(player, queueId);
      return;
    }
    ensureQueueState(player, queueId);
  });
  cacheCurrentSession();
  await persistSession();
  els.playerQueuesDialog.close();
  render();
  setStatus(`Updated queues for ${player.name}.`);
}

async function handleSavePlayerProfile() {
  const player = findPlayerById(state.editingPlayerProfileId);
  if (!player) {
    return;
  }
  if (!canControlPlayer(player)) {
    setStatus("Only the manager or that player on their own device can edit this profile.");
    return;
  }
  const rating = clamp(Number(els.profileRating.value) || 1, 1, 6);
  const gender = normalizeGender(els.profileGender.value);
  player.rating = rating;
  player.gender = gender;
  player.queueIds = player.queueIds.filter((queueId) => canPlayerJoinQueue(player, findQueueById(queueId)));
  player.queueIds.forEach((queueId) => ensureQueueState(player, queueId));
  if (state.auth?.id && player.accountId === state.auth.id) {
    state.auth.rating = rating;
    state.auth.gender = gender;
    await persistProfile();
    hydrateAuthIntoForm();
  }
  cacheCurrentSession();
  await persistSession();
  els.playerProfileDialog.close();
  render();
  setStatus(`Updated profile for ${player.name}.`);
}

function findBestQueueMatch(queue, reservedPlayers) {
  const playersNeeded = queue.format === "singles" ? 2 : 4;
  const pool = getEligibleQueuePlayers(queue, reservedPlayers);
  if (pool.length < playersNeeded) {
    return null;
  }

  if (queue.format === "singles") {
    let bestSingles = null;
    combinations(pool, 2).forEach(([playerA, playerB]) => {
      const score = scoreMatch(queue, [playerA], [playerB], pool);
      if (!bestSingles || score > bestSingles.score) {
        bestSingles = { teamA: [playerA], teamB: [playerB], score };
      }
    });
    return bestSingles;
  }

  const splitPairs = getSplitPairsForQueue(pool, queue.id);
  for (const pair of splitPairs) {
    const match = findBestDoublesMatch(queue, pool, pair);
    if (match) {
      return match;
    }
  }
  return findBestDoublesMatch(queue, pool, null);
}

function findHeldCourtMatch(queue, hold, reservedPlayers) {
  const heldPlayers = hold.playerIds.map(findPlayerById).filter(Boolean);
  if (!heldPlayers.length || heldPlayers.length !== hold.playerIds.length) {
    return null;
  }
  if (!heldPlayers.every((player) => isPlayerEligibleForHold(player, queue, reservedPlayers))) {
    return null;
  }
  const pool = getEligibleQueuePlayers(queue, reservedPlayers);
  const splitPlayerIds = getHoldSplitPlayerIds(queue, hold, heldPlayers);

  if (queue.format === "singles") {
    if (heldPlayers.length !== 1) {
      return null;
    }
    let bestSingles = null;
    pool
      .filter((player) => player.id !== heldPlayers[0].id)
      .forEach((challenger) => {
        const score = scoreMatch(queue, [heldPlayers[0]], [challenger], pool);
        if (!bestSingles || score > bestSingles.score) {
          bestSingles = { teamA: [heldPlayers[0]], teamB: [challenger], score };
        }
      });
    return bestSingles;
  }

  if (splitPlayerIds.length === 2) {
    const splitPlayers = splitPlayerIds.map(findPlayerById).filter(Boolean);
    if (splitPlayers.length !== 2) {
      return null;
    }
    const challengers = pool.filter((player) => !splitPlayerIds.includes(player.id));
    let bestSplitHold = null;
    combinations(challengers, 2).forEach(([challengerA, challengerB]) => {
      const pairings = [
        { teamA: [splitPlayers[0], challengerA], teamB: [splitPlayers[1], challengerB] },
        { teamA: [splitPlayers[0], challengerB], teamB: [splitPlayers[1], challengerA] }
      ];
      pairings.forEach(({ teamA, teamB }) => {
        if (queue.format === "mixed-doubles" && (!isMixedDoublesTeam(teamA) || !isMixedDoublesTeam(teamB))) {
          return;
        }
        const score = scoreMatch(queue, teamA, teamB, pool);
        if (!bestSplitHold || score > bestSplitHold.score) {
          bestSplitHold = { teamA, teamB, score };
        }
      });
    });
    return bestSplitHold;
  }

  if (heldPlayers.length !== 2) {
    return null;
  }

  let best = null;
  combinations(pool.filter((player) => !hold.playerIds.includes(player.id)), 2).forEach((challengers) => {
    if (queue.format === "mixed-doubles" && !isMixedDoublesTeam(challengers)) {
      return;
    }
    const score = scoreMatch(queue, heldPlayers, challengers, pool);
    if (!best || score > best.score) {
      best = { teamA: heldPlayers, teamB: challengers, score };
    }
  });
  return best;
}

function getHoldSplitPlayerIds(queue, hold, heldPlayers = hold.playerIds.map(findPlayerById).filter(Boolean)) {
  if (queue.format === "singles" || heldPlayers.length !== 2) {
    return [];
  }
  if (Array.isArray(hold.splitPlayerIds) && hold.splitPlayerIds.length === 2) {
    return hold.splitPlayerIds;
  }
  if (!queue.winnersStay || !queue.winnersSplit) {
    return [];
  }
  const [playerA, playerB] = heldPlayers;
  const queueStateA = ensureQueueState(playerA, queue.id);
  const queueStateB = ensureQueueState(playerB, queue.id);
  return (
    queueStateA.splitPartnerId === playerB.id &&
    queueStateB.splitPartnerId === playerA.id &&
    queueStateA.splitRound === state.session.round &&
    queueStateB.splitRound === state.session.round
  ) ? heldPlayers.map((player) => player.id) : [];
}

function findBestDoublesMatch(queue, players, forcedOpponents, requiredPlayers = []) {
  let best = null;
  combinations(players, 4).forEach((group) => {
    if (requiredPlayers.length && !requiredPlayers.every((player) => group.some((member) => member.id === player.id))) {
      return;
    }
    getDoublesPairings(group, forcedOpponents).forEach(({ teamA, teamB }) => {
      if (queue.format === "mixed-doubles" && (!isMixedDoublesTeam(teamA) || !isMixedDoublesTeam(teamB))) {
        return;
      }
      const score = scoreMatch(queue, teamA, teamB, players);
      if (!best || score > best.score) {
        best = { teamA, teamB, score };
      }
    });
  });
  return best;
}

function getEligibleQueuePlayers(queue, reservedPlayers) {
  const activeIds = new Set(state.session.activeGames.flatMap((game) => [...game.teamA, ...game.teamB]));
  return state.session.players.filter((player) => {
    if (player.paused || reservedPlayers.has(player.id) || activeIds.has(player.id)) {
      return false;
    }
    if (!player.queueIds.includes(queue.id) || !canPlayerJoinQueue(player, queue)) {
      return false;
    }
    const queueState = ensureQueueState(player, queue.id);
    if (queueState.mustSitOutUntilRound === state.session.round) {
      return false;
    }
    return queueState.gamesPlayedInRow < queue.maxGamesInRow;
  });
}

function isPlayerEligibleForHold(player, queue, reservedPlayers) {
  if (!player || player.paused || reservedPlayers.has(player.id)) {
    return false;
  }
  if (!player.queueIds.includes(queue.id) || !canPlayerJoinQueue(player, queue)) {
    return false;
  }
  const activeIds = new Set(state.session.activeGames.flatMap((game) => [...game.teamA, ...game.teamB]));
  if (activeIds.has(player.id)) {
    return false;
  }
  const queueState = ensureQueueState(player, queue.id);
  if (queueState.mustSitOutUntilRound === state.session.round) {
    return false;
  }
  return queueState.gamesPlayedInRow < queue.maxGamesInRow;
}

function isCourtHoldStillViable(hold, reservedPlayers) {
  const queue = findQueueById(hold.queueId);
  if (!queue) {
    return false;
  }
  const heldPlayers = hold.playerIds.map(findPlayerById).filter(Boolean);
  return heldPlayers.length === hold.playerIds.length && heldPlayers.every((player) => isPlayerEligibleForHold(player, queue, reservedPlayers));
}

function getOpenCourtsForQueue(queue, occupiedCourts) {
  return queue.courts.filter((courtNumber) => !occupiedCourts.has(courtNumber));
}

function scoreMatch(queue, teamA, teamB, pool) {
  const weights = normalizeWeights(queue.weights);
  const ratingBalance = 1 - boundedDiff(sumRatings(teamA), sumRatings(teamB), 20);
  const winBalance = 1 - boundedDiff(avgWinRate(teamA), avgWinRate(teamB), 1);
  const waitBalance = averageQueueWait(teamA.concat(teamB), queue.id) / Math.max(maxQueueWait(pool, queue.id), 1);
  return (weights.rating * ratingBalance) + (weights.winRate * winBalance) + (weights.wait * waitBalance);
}

function incrementQueueWaitCounts(assignments) {
  const assignmentByQueue = new Map();
  assignments.forEach((game) => {
    assignmentByQueue.set(game.queueId, new Set([...(assignmentByQueue.get(game.queueId) || []), ...game.teamA, ...game.teamB]));
  });
  state.session.players.forEach((player) => {
    if (player.paused) {
      return;
    }
    player.queueIds.forEach((queueId) => {
      const queue = findQueueById(queueId);
      if (!queue || !canPlayerJoinQueue(player, queue)) {
        return;
      }
      const queueState = ensureQueueState(player, queueId);
      if (queueState.mustSitOutUntilRound === state.session.round) {
        return;
      }
      const selectedIds = assignmentByQueue.get(queueId);
      if (selectedIds?.has(player.id)) {
        queueState.queueGamesWaited = 0;
        return;
      }
      if (queueState.gamesPlayedInRow >= queue.maxGamesInRow) {
        queueState.gamesPlayedInRow = 0;
      }
      queueState.queueGamesWaited += 1;
      queueState.gamesPlayedInRow = 0;
    });
  });
}

function getSplitPairsForQueue(players, queueId) {
  const round = state.session.round;
  const seen = new Set();
  const result = [];
  players.forEach((player) => {
    const queueState = ensureQueueState(player, queueId);
    if (!queueState.splitPartnerId || queueState.splitRound !== round || seen.has(player.id)) {
      return;
    }
    const partner = players.find((candidate) => candidate.id === queueState.splitPartnerId);
    if (!partner) {
      return;
    }
    seen.add(player.id);
    seen.add(partner.id);
    result.push([player, partner]);
  });
  return result;
}

function getDoublesPairings(group, forcedOpponents) {
  const [a, b, c, d] = group;
  const pairings = [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] }
  ];
  if (!forcedOpponents) {
    return pairings;
  }
  const forcedIds = forcedOpponents.map((player) => player.id);
  return pairings.filter(({ teamA, teamB }) => {
    const teamAIds = teamA.map((player) => player.id);
    const teamBIds = teamB.map((player) => player.id);
    return forcedIds.some((id) => teamAIds.includes(id)) && forcedIds.some((id) => teamBIds.includes(id));
  });
}

function isMixedDoublesTeam(team) {
  if (!Array.isArray(team) || team.length !== 2) {
    return false;
  }
  const genders = team.map((player) => normalizeGender(player.gender)).sort().join("");
  return genders === "FM";
}

function render() {
  syncAuthDisplay();
  if (!state.auth || !state.session) {
    return;
  }
  syncCollapsibleLabels();
  renderLocationLabels();
  syncQueueFormDisplay();
  renderLocationSettings();
  renderGenerateButton();
  renderQueueOptions();
  renderQueueConfigList();
  renderCurrentGames();
  renderPlayers();
  populateHistoryFilter();
  renderHistory();
  renderRankings();
}

function renderGenerateButton() {
  const assignments = previewAssignments(state.session);
  const waitingCount = assignments.length;
  els.generateButton.textContent = waitingCount ? `Assign Courts (${waitingCount})` : "Assign Courts";
  els.generateButton.classList.toggle("attention", waitingCount > 0);
  els.generateButton.disabled = waitingCount === 0;
  els.deleteAllPlayersButton.hidden = !canUseDougAdminTools();
}

function renderLocationLabels() {
  const locationName = getSelectedLocation()?.name ?? "No location selected";
  els.locationLabels.forEach((label) => {
    label.textContent = `Current location: ${locationName}`;
  });
}

function renderLocationSettings() {
  els.allowMultiQueue.checked = !!state.session.settings.allowMultiQueue;
  const canManage = isManagerDevice();
  const manager = findPlayerById(state.session.managerId);
  if (manager) {
    els.managerStatusText.textContent = canManage
      ? `You are the manager for this location.`
      : `Current manager: ${manager.name}`;
  } else {
    els.managerStatusText.textContent = "No manager assigned. Any available player can become manager.";
  }
  els.relinquishManagerButton.hidden = !canManage;
  els.allowMultiQueue.disabled = !canManage;
  [
    els.queueName,
    els.queueFormat,
    els.queueMinRating,
    els.queueCourtCount,
    els.queueMaxGamesInRow,
    els.queueWinnersStay,
    els.queueWinnerPairing,
    els.queueWeightRating,
    els.queueWeightWinRate,
    els.queueWeightWait
  ].forEach((el) => {
    el.disabled = !canManage;
  });
  const saveButton = document.querySelector("#saveQueueButton");
  if (saveButton) {
    saveButton.disabled = !canManage;
  }
}

function renderQueueOptions() {
  if (!state.session) {
    return;
  }
  const availableQueues = state.session.queues.slice().sort((a, b) => a.name.localeCompare(b.name));
  const currentPlayer = state.auth ? findPlayerByAccountId(state.auth.id) : null;
  els.joinQueueLabel.textContent = state.session.settings.allowMultiQueue ? "Queues (choose one or more)" : "Queue";
  if (!availableQueues.length) {
    els.joinQueueOptions.innerHTML = '<div class="empty-inline">No queues yet. You can still join now and pick queues later after the manager creates them.</div>';
    return;
  }
  const inputType = state.session.settings.allowMultiQueue ? "checkbox" : "radio";
  const draftPlayer = {
    rating: Number(els.playerRating.value) || 0,
    gender: normalizeGender(els.playerGender.value)
  };
  els.joinQueueOptions.innerHTML = availableQueues.map((queue, index) => {
    const eligible = canPlayerJoinQueue(draftPlayer, queue);
    const checked = currentPlayer
      ? currentPlayer.queueIds.includes(queue.id)
      : (index === 0 && eligible && !state.session.settings.allowMultiQueue);
    return `
      <label class="checkbox-list-item ${eligible ? "" : "disabled-item"}">
        <input type="${inputType}" name="joinQueueChoice" value="${queue.id}" ${checked ? "checked" : ""} ${eligible ? "" : "disabled"}>
        <span>${queue.name} • ${queue.format} • Courts ${queue.courts.join(",")} • Min ${queue.minRating.toFixed(1)}${queue.format === "mixed-doubles" ? " • Requires M or F" : ""}</span>
      </label>
    `;
  }).join("");
}

function renderQueueConfigList() {
  if (!state.session) {
    return;
  }
  if (!state.session.queues.length) {
    els.queueConfigList.className = "queue-config-list empty-state";
    els.queueConfigList.textContent = "No queues configured yet.";
    return;
  }
  els.queueConfigList.className = "queue-config-list";
  els.queueConfigList.innerHTML = "";
  state.session.queues.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((queue) => {
    const article = document.createElement("article");
    article.className = "queue-config-card";
    const disabledAttr = isManagerDevice() ? "" : "disabled";
      article.innerHTML = `
        <div class="player-topline">
        <div class="queue-config-title">
          <h3>${queue.name}</h3>
          <div class="action-row">
            <button type="button" class="ghost" data-edit-queue="${queue.id}" ${disabledAttr}>Edit</button>
            <button type="button" class="ghost" data-delete-queue="${queue.id}" ${disabledAttr}>Delete</button>
          </div>
        </div>
        <div>
          <p class="section-kicker">${capitalize(queue.format)} • Courts ${queue.courts.join(", ")}</p>
        </div>
      </div>
      <div class="pill-row">
        <span class="pill">Min rating ${queue.minRating.toFixed(1)}</span>
        <span class="pill">Max streak ${queue.maxGamesInRow}</span>
        <span class="pill">${queue.winnersStay ? "Winners stay" : "Winners sit"}</span>
        ${queue.format !== "singles" && queue.winnersSplit ? '<span class="pill">Winners split</span>' : ""}
      </div>
    `;
    els.queueConfigList.appendChild(article);
  });
}

function handleQueueConfigListClick(event) {
  const editButton = event.target.closest("[data-edit-queue]");
  if (editButton) {
    handleEditQueue(editButton.getAttribute("data-edit-queue"));
    return;
  }
  const deleteButton = event.target.closest("[data-delete-queue]");
  if (deleteButton) {
    handleDeleteQueue(deleteButton.getAttribute("data-delete-queue"));
  }
}

function renderCurrentGames() {
  if (!state.session.activeGames.length) {
    els.courtsBoard.className = "courts-board empty-state";
    els.courtsBoard.textContent = "Generate pairings to populate the courts.";
    return;
  }
  els.courtsBoard.className = "courts-board";
  els.courtsBoard.innerHTML = "";
  state.session.activeGames.slice().sort((a, b) => compareCourtLabels(a.courtNumber, b.courtNumber)).forEach((game) => {
    const queue = findQueueById(game.queueId);
    const teamAText = game.teamA.map((id) => displayPlayerName(id)).join(" & ");
    const teamBText = game.teamB.map((id) => displayPlayerName(id)).join(" & ");
    const article = document.createElement("article");
    article.className = "court-card";
    article.innerHTML = `
      <div class="player-topline">
        <div>
          <p class="section-kicker">${formatCourtLabel(game.courtNumber)} • ${queue?.name ?? "Queue"}</p>
          <h3>${capitalize(game.format)}</h3>
        </div>
        <span class="pill">${formatTimestamp(game.startedAt)}</span>
      </div>
        <div class="compact-match">
          <div class="compact-team-row">
            <span class="team-name">${teamAText}</span>
            <input class="score-inline" type="number" min="0" inputmode="numeric" aria-label="Score for Team A" data-score-a="${game.id}" value="${game.scoreA ?? ""}">
            <span class="compact-vs">vs</span>
            <input class="score-inline" type="number" min="0" inputmode="numeric" aria-label="Score for Team B" data-score-b="${game.id}" value="${game.scoreB ?? ""}">
            <span class="team-name team-name-right">${teamBText}</span>
            <button type="button" class="ghost compact-action score-end-button" data-end-game-no-result="${game.id}" title="End this game without recording the result.">End</button>
          </div>
        </div>
      `;
    els.courtsBoard.appendChild(article);
  });
  els.courtsBoard.querySelectorAll("[data-score-a], [data-score-b]").forEach((input) => {
    input.addEventListener("input", handleDraftScoreChange);
    input.addEventListener("change", handleDraftScoreCommit);
  });
  els.courtsBoard.querySelectorAll("[data-end-game-no-result]").forEach((button) => {
    button.addEventListener("click", () => handleEndGameWithoutResult(button.getAttribute("data-end-game-no-result")));
  });
}

function simulateNextAssignmentsForQueue(sourceSession, queueId, scenario, targetCourtNumber = null) {
  const simSession = cloneSession(sourceSession);
  const previousSession = state.session;
  state.session = simSession;

  try {
    scenario.forEach(({ game, winnerSide }) => {
      const simGame = simSession.activeGames.find((item) => item.id === game.id);
      if (simGame) {
        applySimulatedGameResult(simGame, winnerSide);
      }
    });

    const queue = findQueueById(queueId);
    if (!queue) {
      return [];
    }

    const assignments = [];
    state.session.courtHolds ||= [];
    const reservedPlayers = new Set(simSession.activeGames.flatMap((game) => [...game.teamA, ...game.teamB]));
    const occupiedCourts = new Set(simSession.activeGames.map((game) => game.courtNumber));
    const remainingHolds = [];
    const targetQueue = findQueueById(queueId);

    if (targetCourtNumber != null && targetQueue) {
      const targetHold = state.session.courtHolds.find((hold) => hold.queueId === queueId && hold.courtNumber === targetCourtNumber);
      if (targetHold) {
        const match = findHeldCourtMatch(targetQueue, targetHold, reservedPlayers);
        if (!match) {
          return [];
        }
        return [{
          courtNumber: targetCourtNumber,
          teamA: match.teamA.map((player) => ({ id: player.id, name: player.name })),
          teamB: match.teamB.map((player) => ({ id: player.id, name: player.name }))
        }];
      }
      if (occupiedCourts.has(targetCourtNumber) || !targetQueue.courts.includes(targetCourtNumber)) {
        return [];
      }
      const match = findBestQueueMatch(targetQueue, reservedPlayers);
      if (!match) {
        return [];
      }
      return [{
        courtNumber: targetCourtNumber,
        teamA: match.teamA.map((player) => ({ id: player.id, name: player.name })),
        teamB: match.teamB.map((player) => ({ id: player.id, name: player.name }))
      }];
    }

    state.session.courtHolds
      .slice()
      .sort((a, b) => compareCourtLabels(a.courtNumber, b.courtNumber))
      .forEach((hold) => {
        if (hold.queueId !== queue.id || occupiedCourts.has(hold.courtNumber)) {
          if (isCourtHoldStillViable(hold, reservedPlayers)) {
            remainingHolds.push(hold);
          }
          return;
        }
        const match = findHeldCourtMatch(queue, hold, reservedPlayers);
        if (!match) {
          if (isCourtHoldStillViable(hold, reservedPlayers)) {
            remainingHolds.push(hold);
          }
          return;
        }
        assignments.push({
          courtNumber: hold.courtNumber,
          teamA: match.teamA.map((player) => ({ id: player.id, name: player.name })),
          teamB: match.teamB.map((player) => ({ id: player.id, name: player.name }))
        });
        [...match.teamA, ...match.teamB].forEach((player) => {
          reservedPlayers.add(player.id);
          resetQueueState(player, queue.id);
        });
        occupiedCourts.add(hold.courtNumber);
      });

    getOpenCourtsForQueue(queue, occupiedCourts).forEach((courtNumber) => {
      const match = findBestQueueMatch(queue, reservedPlayers);
      if (!match) {
        return;
      }
      assignments.push({
        courtNumber,
        teamA: match.teamA.map((player) => ({ id: player.id, name: player.name })),
        teamB: match.teamB.map((player) => ({ id: player.id, name: player.name }))
      });
      [...match.teamA, ...match.teamB].forEach((player) => {
        reservedPlayers.add(player.id);
        resetQueueState(player, queue.id);
      });
      occupiedCourts.add(courtNumber);
    });

    state.session.courtHolds = remainingHolds;
    incrementQueueWaitCounts(assignments.map((assignment) => ({
      queueId,
      teamA: assignment.teamA.map((player) => player.id),
      teamB: assignment.teamB.map((player) => player.id)
    })));

    return targetCourtNumber == null
      ? assignments
      : assignments.filter((assignment) => assignment.courtNumber === targetCourtNumber);
  } finally {
    state.session = previousSession;
  }
}

function previewAssignments(session, includeMetadata = false) {
  const previousSession = state.session;
  state.session = session;
  try {
    const assignments = [];
    state.session.courtHolds ||= [];
    const reservedPlayers = new Set(state.session.activeGames.flatMap((game) => [...game.teamA, ...game.teamB]));
    const occupiedCourts = new Set(state.session.activeGames.map((game) => game.courtNumber));
    const remainingHolds = [];

    state.session.courtHolds
      .slice()
      .sort((a, b) => compareCourtLabels(a.courtNumber, b.courtNumber))
      .forEach((hold) => {
        if (occupiedCourts.has(hold.courtNumber)) {
          remainingHolds.push(hold);
          return;
        }
        const queue = findQueueById(hold.queueId);
        if (!queue) {
          return;
        }
        const match = findHeldCourtMatch(queue, hold, reservedPlayers);
        if (!match) {
          if (isCourtHoldStillViable(hold, reservedPlayers)) {
            remainingHolds.push(hold);
          }
          return;
        }
        assignments.push({
          id: crypto.randomUUID(),
          queueId: queue.id,
          courtNumber: hold.courtNumber,
          round: state.session.round,
          startedAt: new Date().toISOString(),
          teamA: match.teamA.map((player) => player.id),
          teamB: match.teamB.map((player) => player.id),
          scoreA: "",
          scoreB: "",
          format: queue.format
        });
        [...match.teamA, ...match.teamB].forEach((player) => {
          reservedPlayers.add(player.id);
          resetQueueState(player, queue.id);
        });
        occupiedCourts.add(hold.courtNumber);
      });

    state.session.queues.forEach((queue) => {
      getOpenCourtsForQueue(queue, occupiedCourts).forEach((courtNumber) => {
        const match = findBestQueueMatch(queue, reservedPlayers);
        if (!match) {
          return;
        }
        assignments.push({
          id: crypto.randomUUID(),
          queueId: queue.id,
          courtNumber,
          round: state.session.round,
          startedAt: new Date().toISOString(),
          teamA: match.teamA.map((player) => player.id),
          teamB: match.teamB.map((player) => player.id),
          scoreA: "",
          scoreB: "",
          format: queue.format
        });
        [...match.teamA, ...match.teamB].forEach((player) => {
          reservedPlayers.add(player.id);
          resetQueueState(player, queue.id);
        });
        occupiedCourts.add(courtNumber);
      });
    });

    return includeMetadata ? { assignments, remainingHolds } : assignments;
  } finally {
    state.session = previousSession;
  }
}

function applySimulatedGameResult(game, winnerSide) {
  const queue = findQueueById(game.queueId);
  const playersA = game.teamA.map(findPlayerById).filter(Boolean);
  const playersB = game.teamB.map(findPlayerById).filter(Boolean);
  const winners = winnerSide === "A" ? playersA : playersB;
  const losers = winnerSide === "A" ? playersB : playersA;
  const nextRound = state.session.round;

  [...playersA, ...playersB].forEach((player) => {
    const queueState = ensureQueueState(player, game.queueId);
    queueState.gamesPlayedInRow += 1;
    queueState.queueGamesWaited = 0;
    markPlayerQueuedAtBottom(player, game.queueId);
  });
  winners.forEach((player) => {
    const queueState = ensureQueueState(player, game.queueId);
    player.wins += 1;
    if (!queue.winnersStay) {
      queueState.mustSitOutUntilRound = nextRound;
    }
  });
  losers.forEach((player) => {
    player.losses += 1;
  });

  if (queue?.format !== "singles" && queue.winnersStay && queue.winnersSplit && winners.length === 2) {
    const queueStateA = ensureQueueState(winners[0], game.queueId);
    const queueStateB = ensureQueueState(winners[1], game.queueId);
    queueStateA.splitPartnerId = winners[1].id;
    queueStateA.splitRound = nextRound;
    queueStateB.splitPartnerId = winners[0].id;
    queueStateB.splitRound = nextRound;
  } else {
    winners.concat(losers).forEach((player) => {
      const queueState = ensureQueueState(player, game.queueId);
      queueState.splitPartnerId = null;
      queueState.splitRound = 0;
    });
  }

  state.session.courtHolds ||= [];
  state.session.courtHolds = state.session.courtHolds.filter((hold) => hold.courtNumber !== game.courtNumber);
  if (queue?.winnersStay && winners.length) {
    state.session.courtHolds.push({
      queueId: game.queueId,
      courtNumber: game.courtNumber,
      playerIds: winners.map((player) => player.id),
      split: Boolean(queue.winnersSplit && winners.length === 2),
      splitPlayerIds: queue.winnersSplit && winners.length === 2 ? winners.map((player) => player.id) : []
    });
  }

  state.session.activeGames = state.session.activeGames.filter((item) => item.id !== game.id);
}

function cloneSession(session) {
  return JSON.parse(JSON.stringify(session));
}

function buildUpNextPanel(queue) {
  const activeGames = state.session.activeGames
    .filter((game) => game.queueId === queue.id)
    .slice()
    .sort((a, b) => compareCourtLabels(a.courtNumber, b.courtNumber));

  let scenarios = [];
  if (activeGames.length) {
    scenarios = buildQueueOutcomeScenarios(queue, activeGames);
  } else {
    const assignments = simulateNextAssignmentsForQueue(state.session, queue.id, []);
    scenarios = [{
      label: "If generated now",
      assignments
    }];
  }

  const scenarioMarkup = scenarios.length
    ? scenarios.map((scenario) => `
        <div class="up-next-scenario">
          <div class="up-next-label">${scenario.label}</div>
          <div class="up-next-lines">
            ${scenario.assignments.length
              ? scenario.assignments.map((assignment) => `<div class="up-next-line">${formatScenarioAssignment(assignment)}</div>`).join("")
              : '<div class="empty-inline">No next matchup is available for this outcome.</div>'}
          </div>
        </div>
      `).join("")
    : '<div class="empty-inline">No next matchup is available right now.</div>';

  return `
    <div class="up-next-panel">
      <div class="up-next-heading">Up next</div>
      <div class="up-next-list">${scenarioMarkup}</div>
    </div>
  `;
}

function buildQueueOutcomeScenarios(queue, games) {
  return games
    .slice()
    .sort((a, b) => compareCourtLabels(a.courtNumber, b.courtNumber))
    .flatMap((game) => ([
    {
      label: `${scenarioWinnerLabel(game, "A")} wins on ${formatCourtLabel(game.courtNumber)}`,
      assignments: buildScenarioAssignments(queue, game, "A")
    },
    {
      label: `${scenarioWinnerLabel(game, "B")} wins on ${formatCourtLabel(game.courtNumber)}`,
      assignments: buildScenarioAssignments(queue, game, "B")
    }
  ]));
}

function buildScenarioAssignments(queue, game, winnerSide) {
  const assignments = simulateNextAssignmentsForQueue(state.session, queue.id, [{ game, winnerSide }], game.courtNumber);
  const winnerIds = winnerSide === "A" ? game.teamA : game.teamB;
  if (
    queue.winnersStay &&
    queue.winnersSplit &&
    winnerIds.length === 2 &&
    (!assignments.length || arePlayersTogether(assignments[0], winnerIds))
  ) {
    const splitAssignment = buildForcedSplitPreview(state.session, queue.id, game, winnerSide);
    return splitAssignment ? [splitAssignment] : assignments;
  }
  return assignments;
}

function arePlayersTogether(assignment, playerIds) {
  if (!assignment) {
    return false;
  }
  const teamAIds = assignment.teamA.map((player) => player.id);
  const teamBIds = assignment.teamB.map((player) => player.id);
  return playerIds.every((id) => teamAIds.includes(id)) || playerIds.every((id) => teamBIds.includes(id));
}

function buildForcedSplitPreview(sourceSession, queueId, game, winnerSide) {
  const simSession = cloneSession(sourceSession);
  const previousSession = state.session;
  state.session = simSession;
  try {
    const simGame = simSession.activeGames.find((item) => item.id === game.id);
    if (!simGame) {
      return null;
    }
    applySimulatedGameResult(simGame, winnerSide);
    const queue = findQueueById(queueId);
    if (!queue) {
      return null;
    }
    const winnerIds = winnerSide === "A" ? game.teamA : game.teamB;
    const splitPlayers = winnerIds.map(findPlayerById).filter(Boolean);
    if (splitPlayers.length !== 2) {
      return null;
    }
    const reservedPlayers = new Set(simSession.activeGames.flatMap((activeGame) => [...activeGame.teamA, ...activeGame.teamB]));
    if (splitPlayers.some((player) => !isPlayerEligibleForHold(player, queue, reservedPlayers))) {
      return null;
    }
    const challengers = getEligibleQueuePlayers(queue, reservedPlayers).filter((player) => !winnerIds.includes(player.id));
    let best = null;
    combinations(challengers, 2).forEach(([challengerA, challengerB]) => {
      const pairings = [
        { teamA: [splitPlayers[0], challengerA], teamB: [splitPlayers[1], challengerB] },
        { teamA: [splitPlayers[0], challengerB], teamB: [splitPlayers[1], challengerA] }
      ];
      pairings.forEach(({ teamA, teamB }) => {
        if (queue.format === "mixed-doubles" && (!isMixedDoublesTeam(teamA) || !isMixedDoublesTeam(teamB))) {
          return;
        }
        const score = scoreMatch(queue, teamA, teamB, getEligibleQueuePlayers(queue, reservedPlayers));
        if (!best || score > best.score) {
          best = { courtNumber: game.courtNumber, teamA, teamB, score };
        }
      });
    });
    if (!best) {
      return null;
    }
    return {
      courtNumber: best.courtNumber,
      teamA: best.teamA.map((player) => ({ id: player.id, name: player.name })),
      teamB: best.teamB.map((player) => ({ id: player.id, name: player.name }))
    };
  } finally {
    state.session = previousSession;
  }
}

function scenarioWinnerLabel(game, winnerSide) {
  return winnerSide === "A"
    ? game.teamA.map((id) => displayPlayerName(id)).join(" & ")
    : game.teamB.map((id) => displayPlayerName(id)).join(" & ");
}

function formatScenarioAssignment(assignment) {
  return `${formatCourtLabel(assignment.courtNumber)}: ${assignment.teamA.map((player) => player.name).join(" & ")} vs ${assignment.teamB.map((player) => player.name).join(" & ")}`;
}

function handleDraftScoreChange(event) {
  const input = event.target;
  const gameId = input.getAttribute("data-score-a") || input.getAttribute("data-score-b");
  const game = state.session.activeGames.find((item) => item.id === gameId);
  if (!game) {
    return;
  }
  if (input.hasAttribute("data-score-a")) {
    game.scoreA = input.value;
  } else {
    game.scoreB = input.value;
  }
  cacheCurrentSession();
}

function handleDraftScoreCommit(event) {
  const input = event.target;
  const gameId = input.getAttribute("data-score-a") || input.getAttribute("data-score-b");
  const game = state.session.activeGames.find((item) => item.id === gameId);
  if (!game) {
    return;
  }
  if (game.scoreA === "" || game.scoreA == null || game.scoreB === "" || game.scoreB == null) {
    return;
  }
  handleCompleteGame(gameId, game.scoreA, game.scoreB);
}

async function handleEndGameWithoutResult(gameId) {
  const game = state.session.activeGames.find((item) => item.id === gameId);
  if (!game) {
    return;
  }
  state.session.activeGames = state.session.activeGames.filter((item) => item.id !== gameId);
  state.session.courtHolds = (state.session.courtHolds || []).filter((hold) => hold.courtNumber !== game.courtNumber);
  cacheCurrentSession();
  await persistSession();
  render();
  setStatus(`Ended ${formatCourtLabel(game.courtNumber)} without recording a result.`);
}

function renderPlayers() {
  const activeIds = new Set(state.session.activeGames.flatMap((game) => [...game.teamA, ...game.teamB]));
  const waitingCount = state.session.players.filter((player) => !player.paused && !activeIds.has(player.id)).length;
  const pausedCount = state.session.players.filter((player) => player.paused).length;
  const manager = findPlayerById(state.session.managerId);
  els.playerSummary.innerHTML = `
    <div class="pill-row">
      <span class="pill">${state.session.players.length} players</span>
      <span class="pill">${state.session.queues.length} queues</span>
      <span class="pill">${state.session.activeGames.length} active games</span>
      <span class="pill">${waitingCount} waiting</span>
      <span class="pill">${pausedCount} sitting out</span>
      <span class="pill">${manager ? `Manager: ${manager.name}` : "No manager assigned"}</span>
    </div>
  `;
  if (!state.session.players.length) {
    els.queueBoard.className = "queue-board empty-state";
    els.queueBoard.textContent = "No players have joined yet.";
    return;
  }
  els.queueBoard.className = "queue-board compact-queue-board";
  els.queueBoard.innerHTML = "";

  state.session.queues
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((queue) => {
      const playersForQueue = state.session.players
        .filter((player) => !player.paused && !activeIds.has(player.id) && player.queueIds.includes(queue.id))
        .slice()
        .sort((a, b) => {
          const timeDelta = ensureQueueState(b, queue.id).queueGamesWaited - ensureQueueState(a, queue.id).queueGamesWaited;
          if (timeDelta) {
            return timeDelta;
          }
          return ensureQueueState(a, queue.id).queueEntryOrder - ensureQueueState(b, queue.id).queueEntryOrder;
        });

      const section = document.createElement("section");
      section.className = "queue-section";
      section.innerHTML = `
        <div class="queue-section-title">
          <strong>${queue.name}</strong>
          <span>${queue.format} • Courts ${queue.courts.join(", ")}</span>
        </div>
        ${buildUpNextPanel(queue)}
        <div class="queue-list-header">
          <span>Name</span>
          <span>Rating</span>
          <span>W/L</span>
          <span>Win%</span>
          <span>TimeInQ</span>
          <span>Actions</span>
        </div>
      `;

      if (!playersForQueue.length) {
        const empty = document.createElement("div");
        empty.className = "empty-inline";
        empty.textContent = "No waiting players in this queue.";
        section.appendChild(empty);
      } else {
        playersForQueue.forEach((player) => {
          section.appendChild(buildQueuePlayerRow(player, queue.id));
        });
      }

      els.queueBoard.appendChild(section);
    });

  const unassignedPlayers = state.session.players
    .filter((player) => !player.paused && !activeIds.has(player.id) && !player.queueIds.length)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  if (unassignedPlayers.length) {
    const unassignedSection = document.createElement("section");
    unassignedSection.className = "queue-section";
    unassignedSection.innerHTML = `
      <div class="queue-section-title">
        <strong>Not Assigned To A Queue</strong>
        <span>Visible here until added to one or more queues</span>
      </div>
      <div class="queue-list-header">
        <span>Name</span>
        <span>Rating</span>
        <span>W/L</span>
        <span>Win%</span>
        <span>TimeInQ</span>
        <span>Actions</span>
      </div>
    `;
    unassignedPlayers.forEach((player) => unassignedSection.appendChild(buildQueuePlayerRow(player, null)));
    els.queueBoard.appendChild(unassignedSection);
  }

  const pausedPlayers = state.session.players
    .filter((player) => player.paused && !activeIds.has(player.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  if (pausedPlayers.length) {
    const pausedSection = document.createElement("section");
    pausedSection.className = "queue-section";
    pausedSection.innerHTML = `
      <div class="queue-section-title">
        <strong>Sitting Out</strong>
        <span>Temporarily removed from pairings</span>
      </div>
      <div class="queue-list-header">
        <span>Name</span>
        <span>Rating</span>
        <span>W/L</span>
        <span>Win%</span>
        <span>TimeInQ</span>
        <span>Actions</span>
      </div>
    `;
    pausedPlayers.forEach((player) => pausedSection.appendChild(buildQueuePlayerRow(player, null)));
    els.queueBoard.appendChild(pausedSection);
  }
  bindPlayerCardActions();
}

function buildQueuePlayerRow(player, queueId) {
  const canControl = canControlPlayer(player);
  const queueScore = queueId ? ensureQueueState(player, queueId).queueGamesWaited : "-";
  const row = document.createElement("div");
  row.className = "queue-list-row";
  row.innerHTML = `
    <span class="queue-name-cell">
      ${state.session.managerId === player.id ? '<span class="manager-mark" title="Manager">*</span>' : ""}
      ${player.name}
    </span>
    <span>${player.rating.toFixed(1)}</span>
    <span>${player.wins}-${player.losses}</span>
    <span>${Math.round(avgWinRate([player]) * 100)}%</span>
    <span>${queueScore}</span>
    <details class="queue-action-menu">
      <summary class="ghost compact-action">Actions</summary>
      <div class="queue-action-panel">
        ${!state.session.managerId ? `
          <div class="queue-action-item">
            <button type="button" class="ghost compact-action" data-claim-manager="${player.id}">Mgr</button>
            <span>Become the manager for this location.</span>
          </div>
        ` : ""}
        ${!player.paused ? `
          <div class="queue-action-item">
            <button type="button" class="ghost compact-action" data-move-player="${player.id}" ${canControl ? "" : "disabled"}>Down</button>
            <span>Moves this player lower in priority so others are chosen first.</span>
          </div>
        ` : ""}
        <div class="queue-action-item">
          ${!player.paused
            ? `<button type="button" class="ghost compact-action" data-sit-player="${player.id}" ${canControl ? "" : "disabled"}>Sit</button>`
            : `<button type="button" class="ghost compact-action" data-return-player="${player.id}" ${canControl ? "" : "disabled"}>Back</button>`}
          <span>${!player.paused ? "Temporarily removes this player from pairings." : "Returns this player to the queue."}</span>
        </div>
        <div class="queue-action-item">
          <button type="button" class="ghost compact-action" data-edit-player-profile="${player.id}" ${canControl ? "" : "disabled"}>Profile</button>
          <span>Update this player's rating or M/F setting.</span>
        </div>
        <div class="queue-action-item">
          <button type="button" class="ghost compact-action" data-edit-player-queues="${player.id}">Queues</button>
          <span>Choose which queues this player is in.</span>
        </div>
        <div class="queue-action-item">
          <button type="button" class="ghost compact-action" data-remove-player="${player.id}" ${canControl ? "" : "disabled"}>Leave</button>
          <span>Removes this player from the location completely.</span>
        </div>
      </div>
    </details>
  `;
  return row;
}

function bindPlayerCardActions() {
  els.queueBoard.querySelectorAll("[data-edit-player-profile]").forEach((button) => {
    button.addEventListener("click", () => openPlayerProfileDialog(button.getAttribute("data-edit-player-profile")));
  });
  els.queueBoard.querySelectorAll("[data-edit-player-queues]").forEach((button) => {
    button.addEventListener("click", () => openPlayerQueuesDialog(button.getAttribute("data-edit-player-queues")));
  });
  els.queueBoard.querySelectorAll("[data-move-player]").forEach((button) => {
    button.addEventListener("click", () => handleMovePlayerDown(button.getAttribute("data-move-player")));
  });
  els.queueBoard.querySelectorAll("[data-claim-manager]").forEach((button) => {
    button.addEventListener("click", () => handleClaimManager(button.getAttribute("data-claim-manager")));
  });
  els.queueBoard.querySelectorAll("[data-remove-player]").forEach((button) => {
    button.addEventListener("click", () => handleRemovePlayer(button.getAttribute("data-remove-player")));
  });
  els.queueBoard.querySelectorAll("[data-sit-player]").forEach((button) => {
    button.addEventListener("click", () => handleSitOutPlayer(button.getAttribute("data-sit-player")));
  });
  els.queueBoard.querySelectorAll("[data-return-player]").forEach((button) => {
    button.addEventListener("click", () => handleReturnPlayer(button.getAttribute("data-return-player")));
  });
}

function populateHistoryFilter() {
  const currentValue = els.historyPlayerFilter.value || els.historyInlinePlayerFilter.value;
  const options = ['<option value="">All players</option>'].concat(
    state.session.players.slice().sort((a, b) => a.name.localeCompare(b.name)).map((player) => `<option value="${player.id}">${player.name}</option>`)
  );
  els.historyPlayerFilter.innerHTML = options.join("");
  els.historyInlinePlayerFilter.innerHTML = options.join("");
  els.historyPlayerFilter.value = currentValue;
  els.historyInlinePlayerFilter.value = currentValue;
}

function renderHistory() {
  els.clearHistoryButton.hidden = !canClearHistory();
  const filterId = els.historyInlinePlayerFilter.value || els.historyPlayerFilter.value;
  els.historyPlayerFilter.value = filterId;
  els.historyInlinePlayerFilter.value = filterId;
  const games = state.session.history.filter((game) => !filterId || [...game.teamA, ...game.teamB].includes(filterId));
  if (!games.length) {
    els.historyList.className = "history-list empty-state";
    els.historyPreview.className = "history-list compact-history empty-state";
    els.historyList.textContent = "No completed games yet.";
    els.historyPreview.textContent = "No completed games yet.";
    return;
  }
  els.historyList.className = "history-list";
  els.historyPreview.className = "history-list compact-history";
  els.historyList.innerHTML = "";
  els.historyPreview.innerHTML = "";
  games.forEach((game) => {
    const teamAText = getHistoryTeamNames(game, "A").join(" & ");
    const teamBText = getHistoryTeamNames(game, "B").join(" & ");
    const markup = `
      <div class="player-topline">
        <div>
          <p class="section-kicker">${game.queueName} • ${formatCourtLabel(game.courtNumber)} • Round ${game.round}</p>
          <h3>${teamAText} ${game.scoreA}-${game.scoreB} ${teamBText}</h3>
        </div>
        <span class="pill">${formatTimestamp(game.completedAt)}</span>
      </div>
    `;
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = markup;
    els.historyList.appendChild(card);
    els.historyPreview.appendChild(card.cloneNode(true));
  });
}

function renderRankings() {
  if (!state.session.queues.length) {
    els.rankingsBoard.className = "rankings-board empty-state";
    els.rankingsBoard.textContent = "Add a queue to see rankings.";
    return;
  }

  const queueCards = state.session.queues.map((queue) => {
    const players = state.session.players
      .filter((player) => player.queueIds.includes(queue.id))
      .map((player) => ({
        player,
        pct: playerWinRate(player),
        totalGames: player.wins + player.losses
      }))
      .sort((a, b) => {
        if (b.pct !== a.pct) {
          return b.pct - a.pct;
        }
        if (b.player.wins !== a.player.wins) {
          return b.player.wins - a.player.wins;
        }
        if (b.totalGames !== a.totalGames) {
          return b.totalGames - a.totalGames;
        }
        return a.player.name.localeCompare(b.player.name);
      });

    const rows = players.length
        ? players.map((entry, index) => `
          <div class="ranking-row">
            <span><strong>${index + 1}.</strong> ${entry.player.name}</span>
            <span>${Math.round(entry.pct * 100)}% | ${entry.player.wins}-${entry.player.losses}</span>
          </div>
        `).join("")
      : '<div class="empty-inline">No players in this queue yet.</div>';

    return `
      <article class="queue-config-card">
        <div class="player-topline">
          <div>
            <h3>${queue.name}</h3>
            <p class="section-kicker">${capitalize(queue.format)} • Courts ${queue.courts.join(", ")}</p>
          </div>
        </div>
        <div class="rankings-list">${rows}</div>
      </article>
    `;
  });

  els.rankingsBoard.className = "rankings-board";
  els.rankingsBoard.innerHTML = queueCards.join("");
}

function setupSharing() {
  els.shareLink.value = window.location.href;
  els.qrCode.dataset.qrIndex = "0";
  els.qrCode.src = getQrSources(window.location.href)[0];
  els.venmoLink.href = config.venmoUrl || "https://venmo.com/";
}

function registerServiceWorker() {
  if (isWebProtocol && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.error("Service worker registration failed", error));
  }
}

async function ensureNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function maybeNotifyAssignedPlayers() {
  if (!("Notification" in window) || Notification.permission !== "granted" || !state.notificationPlayerName) {
    return;
  }
  const game = state.session.activeGames.find((item) => [...item.teamA, ...item.teamB].map(displayPlayerName).map((name) => name.toLowerCase()).includes(state.notificationPlayerName.toLowerCase()));
  if (!game) {
    return;
  }
  const key = `${state.selectedLocationId}:${game.id}:${state.notificationPlayerName.toLowerCase()}`;
  if (key === state.lastNotifiedAssignmentKey) {
    return;
  }
  state.lastNotifiedAssignmentKey = key;
  const body = `${state.notificationPlayerName}, head to ${formatCourtLabel(game.courtNumber)} for ${findQueueById(game.queueId)?.name ?? "your game"}.`;
  navigator.serviceWorker?.getRegistration().then((registration) => {
    if (registration) {
      registration.showNotification("It is your turn to play", { body, tag: key });
    } else {
      new Notification("It is your turn to play", { body });
    }
  });
}

function startPolling() {
  if (state.pollHandle) {
    clearInterval(state.pollHandle);
  }
  state.pollHandle = window.setInterval(async () => {
    if (!config.apiBaseUrl || !state.selectedLocationId) {
      return;
    }
    try {
      const remote = await apiGetSession(state.selectedLocationId);
      if (remote && (!state.session || new Date(remote.updatedAt).getTime() > new Date(state.session.updatedAt).getTime())) {
        state.session = hydrateSession(remote, getSelectedLocation());
        cacheCurrentSession();
        render();
      }
    } catch (error) {
      console.error(error);
    }
  }, config.pollIntervalMs || 15000);
}

function cacheCurrentSession() {
  if (!state.session) {
    return;
  }
  state.session.updatedAt = new Date().toISOString();
  state.sessionsCache[state.selectedLocationId] = state.session;
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(state.sessionsCache));
}

async function persistSession() {
  cacheCurrentSession();
  if (config.apiBaseUrl) {
    const saved = await apiSaveSession(state.selectedLocationId, state.session);
    const returnedSession = saved?.session ?? (saved?.locationId ? saved : null);
    if (returnedSession) {
      state.session = hydrateSession(returnedSession, getSelectedLocation());
      cacheCurrentSession();
    }
  }
}

function hydrateSession(session, location) {
  const deletedQueueIds = Array.isArray(session?.deletedQueueIds) ? session.deletedQueueIds : [];
  const nextSession = {
    locationId: location?.id ?? session?.locationId ?? crypto.randomUUID(),
    locationName: location?.name ?? session?.locationName ?? "Location",
    managerId: session?.managerId ?? "",
    queueEntryCounter: Number.isInteger(session?.queueEntryCounter) ? session.queueEntryCounter : 1,
    deletedQueueIds,
    settings: {
      allowMultiQueue: Boolean(session?.settings?.allowMultiQueue)
    },
    queues: Array.isArray(session?.queues)
      ? dedupeById(
        session.queues
          .filter((queue) => queue && queue.id && !deletedQueueIds.includes(queue.id))
          .map((queue) => ({
            ...DEFAULT_QUEUE,
            ...queue,
            courts: Array.isArray(queue?.courts) ? queue.courts : DEFAULT_QUEUE.courts,
            weights: { ...DEFAULT_QUEUE.weights, ...(queue?.weights ?? {}) }
          }))
      )
      : [],
    players: Array.isArray(session?.players) ? session.players.map((player) => ({
      id: player.id ?? crypto.randomUUID(),
      accountId: player.accountId ?? "",
      email: player.email ?? "",
      name: player.name ?? "Player",
      rating: clamp(Number(player.rating) || 1, 1, 6),
      gender: normalizeGender(player.gender),
      joinedAt: player.joinedAt ?? new Date().toISOString(),
      notifications: Boolean(player.notifications),
      paused: Boolean(player.paused),
      queueIds: Array.isArray(player.queueIds) ? player.queueIds.filter((queueId) => !deletedQueueIds.includes(queueId)) : [],
      wins: Number(player.wins) || 0,
      losses: Number(player.losses) || 0,
      queueStates: player.queueStates && typeof player.queueStates === "object" ? player.queueStates : {}
    })) : [],
    activeGames: Array.isArray(session?.activeGames || session?.activeCourts)
      ? (session?.activeGames || session?.activeCourts).filter((game) => !deletedQueueIds.includes(game?.queueId))
      : [],
    courtHolds: Array.isArray(session?.courtHolds) ? session.courtHolds.filter((hold) => !deletedQueueIds.includes(hold?.queueId)) : [],
    history: Array.isArray(session?.history) ? session.history.filter((game) => !deletedQueueIds.includes(game?.queueId)) : [],
    round: Number.isInteger(session?.round) ? session.round : 1,
    updatedAt: session?.updatedAt ?? new Date().toISOString()
  };

  if (!nextSession.queues.length && session?.settings?.courtsInUse) {
    nextSession.queues.push({
      ...DEFAULT_QUEUE,
      id: "main-queue",
      name: "Main Queue",
      courts: Array.from({ length: session.settings.courtsInUse }, (_, index) => index + 1)
    });
    nextSession.players.forEach((player) => {
      player.queueIds = ["main-queue"];
    });
  }

  nextSession.players.forEach((player) => {
    deletedQueueIds.forEach((queueId) => delete player.queueStates?.[queueId]);
    if (!nextSession.settings.allowMultiQueue && player.queueIds.length > 1) {
      player.queueIds = player.queueIds.slice(0, 1);
    }
    nextSession.queues.forEach((queue) => ensureQueueState(player, queue.id));
  });
  nextSession.queueEntryCounter = Math.max(
    nextSession.queueEntryCounter,
    nextSession.players.flatMap((player) => Object.values(player.queueStates || {})).reduce((max, queueState) => {
      return Math.max(max, Number(queueState?.queueEntryOrder) || 0);
    }, 0) + 1
  );

  nextSession.activeGames = nextSession.activeGames.map((game) => ({
    ...game,
    queueId: game.queueId ?? nextSession.queues[0]?.id ?? "main-queue",
    format: game.format ?? inferFormatFromTeams(game)
  }));
  nextSession.history = nextSession.history.map((game) => {
    const queueId = game.queueId ?? nextSession.queues[0]?.id ?? "main-queue";
    return {
      ...game,
      queueId,
      format: game.format ?? "doubles",
      queueName: game.queueName ?? findQueueName(nextSession.queues, queueId)
    };
  });

  return nextSession;
}

function ensureQueueState(player, queueId) {
  player.queueStates ||= {};
  player.queueStates[queueId] ||= {
    queueGamesWaited: 0,
    queueEntryOrder: 0,
    gamesPlayedInRow: 0,
    mustSitOutUntilRound: 0,
    splitPartnerId: null,
    splitRound: 0
  };
  player.queueStates[queueId].queueEntryOrder ||= 0;
  return player.queueStates[queueId];
}

function resetQueueState(player, queueId) {
  const queueState = ensureQueueState(player, queueId);
  queueState.queueGamesWaited = 0;
  queueState.gamesPlayedInRow = 0;
  queueState.mustSitOutUntilRound = 0;
  queueState.splitPartnerId = null;
  queueState.splitRound = 0;
}

function markPlayerQueuedAtBottom(player, queueId) {
  const queueState = ensureQueueState(player, queueId);
  state.session.queueEntryCounter ||= 1;
  queueState.queueEntryOrder = state.session.queueEntryCounter;
  state.session.queueEntryCounter += 1;
}

function populateLocationSelect() {
  els.locationSelect.innerHTML = state.locations.map((location) => {
    const summary = getLocationSummary(location.id);
    return `<option value="${location.id}">${location.name} (${summary.players} players, ${summary.courts} courts)</option>`;
  }).join("");
  els.locationSelect.value = state.selectedLocationId;
}

async function apiGetLocations() {
  if (!config.apiBaseUrl) {
    return config.locationsFallback ?? [];
  }
  const response = await fetch(`${config.apiBaseUrl}?action=locations`);
  const payload = await response.json();
  return payload.locations ?? [];
}

async function apiAddLocation(location) {
  if (!config.apiBaseUrl) {
    return location;
  }
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    body: new URLSearchParams({ action: "addLocation", payload: JSON.stringify(location) })
  });
  return response.json();
}

async function apiRegister(email) {
  if (!config.apiBaseUrl) {
    throw new Error("Registration requires the shared Apps Script backend.");
  }
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    body: new URLSearchParams({ action: "registerUser", email })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Unable to register.");
  }
  return payload;
}

async function apiLogin(email, pin) {
  if (!config.apiBaseUrl) {
    throw new Error("Login requires the shared Apps Script backend.");
  }
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    body: new URLSearchParams({ action: "loginUser", email, pin })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Unable to sign in.");
  }
  return payload;
}

async function apiGetProfile(token) {
  if (!config.apiBaseUrl || !token) {
    return null;
  }
  const response = await fetch(`${config.apiBaseUrl}?action=profile&token=${encodeURIComponent(token)}`);
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload.user ?? null;
}

async function apiSaveProfile(token, profile) {
  if (!config.apiBaseUrl || !token) {
    return profile;
  }
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    body: new URLSearchParams({ action: "saveProfile", token, payload: JSON.stringify(profile) })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Unable to save profile.");
  }
  return payload.user ?? profile;
}

async function apiGetSession(locationId) {
  if (!config.apiBaseUrl) {
    return state.sessionsCache[locationId] ?? null;
  }
  const response = await fetch(`${config.apiBaseUrl}?action=state&locationId=${encodeURIComponent(locationId)}`);
  const payload = await response.json();
  return payload.session ?? null;
}

async function apiSaveSession(locationId, session) {
  if (!config.apiBaseUrl) {
    return session;
  }
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    body: new URLSearchParams({ action: "saveState", locationId, payload: JSON.stringify(session) })
  });
  return response.json();
}

async function persistProfile() {
  if (!state.auth?.token) {
    return;
  }
  const savedProfile = await apiSaveProfile(state.auth.token, {
    handle: state.auth.handle,
    rating: state.auth.rating,
    gender: state.auth.gender,
    notifications: state.auth.notifications,
    newPin: state.auth.pendingNewPin || ""
  });
  state.auth = {
    ...state.auth,
    ...savedProfile
  };
  saveAuthSession();
}

function getSelectedJoinQueueIds() {
  return [...els.joinQueueOptions.querySelectorAll('input[name="joinQueueChoice"]:checked')].map((input) => input.value);
}

function canPlayerJoinQueue(player, queue) {
  if (!queue || clamp(Number(player?.rating) || 0, 0, 6) < queue.minRating) {
    return false;
  }
  if (queue.format === "mixed-doubles") {
    return hasEligibleMixedGender(player);
  }
  return true;
}

function hasEligibleMixedGender(player) {
  return normalizeGender(player?.gender) === "M" || normalizeGender(player?.gender) === "F";
}

function normalizeGender(value) {
  return value === "M" || value === "F" ? value : "";
}

function syncQueueFormDisplay() {
  if (!state.session) {
    return;
  }
  els.queueWeightRatingValue.textContent = els.queueWeightRating.value;
  els.queueWeightWinRateValue.textContent = els.queueWeightWinRate.value;
  els.queueWeightWaitValue.textContent = els.queueWeightWait.value;
  const showWinnerRules = els.queueWinnersStay.checked;
  els.queueMaxGamesWrap.hidden = !showWinnerRules;
  els.queueWinnerPairingWrap.hidden = !showWinnerRules;
  els.queueWinnerPairing.disabled =
    els.queueFormat.value === "singles" ||
    !els.queueWinnersStay.checked ||
    Number(els.queueMaxGamesInRow.value) <= 1;
  renderCourtNameInputs();
  renderQueueOptions();
}

function resetQueueForm() {
  els.queueForm.reset();
  els.queueFormat.value = "doubles";
  els.queueMinRating.value = "1";
  els.queueCourtCount.value = "1";
  els.queueMaxGamesInRow.value = "2";
  els.queueWeightRating.value = "40";
  els.queueWeightWinRate.value = "30";
  els.queueWeightWait.value = "30";
  els.queueWinnersStay.checked = true;
  els.queueWinnerPairing.value = "split";
  renderCourtNameInputs(["Court 1"]);
  syncQueueFormDisplay();
}

function handleQrImageError() {
  const sources = getQrSources(window.location.href);
  const currentIndex = Number(els.qrCode.dataset.qrIndex || "0");
  const nextIndex = currentIndex + 1;
  if (nextIndex < sources.length) {
    els.qrCode.dataset.qrIndex = String(nextIndex);
    els.qrCode.src = sources[nextIndex];
    return;
  }
  els.qrCode.src = buildQrFallbackSvg(window.location.href);
}

function getQrSources(value) {
  const encoded = encodeURIComponent(value);
  return [
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`,
    `https://quickchart.io/qr?size=220&text=${encoded}`,
    `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encoded}`
  ];
}

function buildQrFallbackSvg(value) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
      <rect width="220" height="220" rx="20" fill="#ffffff"/>
      <rect x="14" y="14" width="192" height="192" rx="16" fill="#f7f4ea" stroke="#184e77" stroke-width="2"/>
      <text x="110" y="95" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" fill="#184e77">Share Link</text>
      <text x="110" y="120" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" fill="#5d6b75">${escapeXml(value.slice(0, 34))}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function findPlayerById(playerId) {
  return state.session.players.find((player) => player.id === playerId);
}

function findPlayerByAccountId(accountId) {
  return state.session.players.find((player) => player.accountId && player.accountId === accountId);
}

function findQueueById(queueId) {
  return state.session.queues.find((queue) => queue.id === queueId);
}

function findQueueName(queues, queueId) {
  return queues.find((queue) => queue.id === queueId)?.name ?? "Queue";
}

function getSelectedLocation() {
  return state.locations.find((location) => location.id === state.selectedLocationId);
}

function getLocationSummary(locationId) {
  const session = locationId === state.selectedLocationId && state.session
    ? state.session
    : state.sessionsCache[locationId];
  if (!session) {
    return { players: 0, courts: 0 };
  }

  const players = Array.isArray(session.players) ? session.players.length : 0;
  const courts = Array.isArray(session.queues)
    ? new Set(session.queues.flatMap((queue) => Array.isArray(queue.courts) ? queue.courts : [])).size
    : 0;

  return { players, courts };
}

function isManagerDevice() {
  if (!state.session?.managerId) {
    return false;
  }
  if (state.managerClaims[state.selectedLocationId] === state.session.managerId) {
    return true;
  }
  const manager = findPlayerById(state.session.managerId);
  return Boolean(manager && state.devicePlayerName && manager.name.toLowerCase() === state.devicePlayerName.toLowerCase());
}

function canUseDougAdminTools() {
  if (!state.session || !state.auth) {
    return false;
  }
  return String(state.auth.handle || "").toLowerCase() === "dougadmin";
}

function canClearHistory() {
  return canUseDougAdminTools();
}

function setManagerClaimForLocation(playerId) {
  state.managerClaims[state.selectedLocationId] = playerId;
  localStorage.setItem(STORAGE_KEYS.managerClaims, JSON.stringify(state.managerClaims));
}

function clearManagerClaimForLocation(playerId) {
  if (state.managerClaims[state.selectedLocationId] === playerId) {
    delete state.managerClaims[state.selectedLocationId];
    localStorage.setItem(STORAGE_KEYS.managerClaims, JSON.stringify(state.managerClaims));
  }
}

function dedupeById(items) {
  const seen = new Map();
  items.forEach((item) => {
    seen.set(item.id, item);
  });
  return [...seen.values()];
}

function displayPlayerName(playerId) {
  return findPlayerById(playerId)?.name ?? "Removed player";
}

function getHistoryTeamNames(game, teamKey) {
  const nameKey = teamKey === "A" ? "teamANames" : "teamBNames";
  const idKey = teamKey === "A" ? "teamA" : "teamB";
  if (Array.isArray(game[nameKey]) && game[nameKey].length) {
    return game[nameKey];
  }
  return (game[idKey] || []).map(displayPlayerName);
}

function canControlPlayer(player) {
  if (!player) {
    return false;
  }
  return isManagerDevice() || (state.auth?.id && player.accountId === state.auth.id);
}

function getPlayerQueueScore(player) {
  if (!player.queueIds.length) {
    return 0;
  }
  return player.queueIds.reduce((max, queueId) => Math.max(max, ensureQueueState(player, queueId).queueGamesWaited), 0);
}

function playerLabel(player) {
  return player ? `${player.name} (${player.rating.toFixed(1)})` : "Removed player";
}

function formatTeamSummary(players) {
  return `Avg win ${Math.round(avgWinRate(players) * 100)}%`;
}

function normalizeWeights(weights) {
  const total = weights.rating + weights.winRate + weights.wait;
  return total ? {
    rating: weights.rating / total,
    winRate: weights.winRate / total,
    wait: weights.wait / total
  } : { rating: 1 / 3, winRate: 1 / 3, wait: 1 / 3 };
}

function sumRatings(players) {
  return players.reduce((sum, player) => sum + player.rating, 0);
}

function avgWinRate(players) {
  return players.reduce((sum, player) => sum + playerWinRate(player), 0) / Math.max(players.length, 1);
}

function playerWinRate(player) {
  const total = player.wins + player.losses;
  return total ? player.wins / total : 0.5;
}

function averageQueueWait(players, queueId) {
  return players.reduce((sum, player) => sum + ensureQueueState(player, queueId).queueGamesWaited, 0) / Math.max(players.length, 1);
}

function maxQueueWait(players, queueId) {
  return players.reduce((max, player) => Math.max(max, ensureQueueState(player, queueId).queueGamesWaited), 0);
}

function boundedDiff(valueA, valueB, divisor) {
  return Math.min(1, Math.abs(valueA - valueB) / divisor);
}

function combinations(items, size) {
  const result = [];
  const current = [];
  function walk(start) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index]);
      walk(index + 1);
      current.pop();
    }
  }
  walk(0);
  return result;
}

function formatTimestamp(isoTime) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoTime));
}

function parseCourtList(value) {
  return [...new Set(
    String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  )];
}

function getQueueCourtNames() {
  return [...els.queueCourtsList.querySelectorAll("input[data-court-name]")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function renderCourtNameInputs(seedCourts) {
  const count = clamp(Number(els.queueCourtCount.value) || 1, 1, 20);
  const currentValues = seedCourts
    ? seedCourts.slice(0, count)
    : [...els.queueCourtsList.querySelectorAll("input[data-court-name]")].map((input) => input.value.trim());
  const values = Array.from({ length: count }, (_, index) => currentValues[index] || `Court ${index + 1}`);
  els.queueCourtsList.innerHTML = values.map((value, index) => `
    <input
      type="text"
      data-court-name="${index + 1}"
      value="${escapeCourtInput(value)}"
      placeholder="Court ${index + 1}"
      required
    >
  `).join("");
}

function escapeCourtInput(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCourtLabel(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "Court";
  }
  return /^court\b/i.test(text) ? text : `Court ${text}`;
}

function compareCourtLabels(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function inferFormatFromTeams(game) {
  return (game.teamA?.length === 1 && game.teamB?.length === 1) ? "singles" : "doubles";
}

function dedupeLocations(locations) {
  const map = new Map();
  locations.forEach((location) => map.set(location.id, location));
  return [...map.values()];
}

function createLocation(name, notes) {
  return { id: slugify(name), name, notes };
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || crypto.randomUUID();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

function setStatus(message) {
  els.syncStatus.textContent = message;
}

function syncCollapsibleLabels() {
  els.collapsibles.forEach((details) => {
    const label = details.querySelector("[data-collapsible-label]");
    if (label) {
      label.textContent = details.open ? "Tap to collapse" : "Tap to expand";
    }
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
