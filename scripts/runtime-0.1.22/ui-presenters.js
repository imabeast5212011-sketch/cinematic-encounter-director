import {
  DANGER_LEVELS,
  EXECUTION_MODES,
  FAILURE_POLICIES,
  PROVIDERS,
  RESULT_STATUS,
  TRIGGER_ACTIONS,
  TRIGGER_EVENTS
} from "./constants.js";

const PROVIDER_LABELS = Object.freeze({
  [PROVIDERS.FOUNDRY]: "Foundry",
  [PROVIDERS.SESSIONFLOW]: "SessionFlow",
  [PROVIDERS.EXALTED_SCENES]: "Exalted Scenes",
  [PROVIDERS.NARRATORS_JUKEBOX]: "Narrator's Jukebox",
  [PROVIDERS.FXMASTER]: "FXMaster",
  [PROVIDERS.CHARACTER_HUD]: "Character HUD",
  [PROVIDERS.COMBAT_TIMELINE]: "Combat Timeline"
});

const PROVIDER_ICONS = Object.freeze({
  [PROVIDERS.FOUNDRY]: "fa-solid fa-dice-d20",
  [PROVIDERS.SESSIONFLOW]: "fa-solid fa-diagram-project",
  [PROVIDERS.EXALTED_SCENES]: "fa-solid fa-masks-theater",
  [PROVIDERS.NARRATORS_JUKEBOX]: "fa-solid fa-music",
  [PROVIDERS.FXMASTER]: "fa-solid fa-wand-magic-sparkles",
  [PROVIDERS.CHARACTER_HUD]: "fa-solid fa-id-card",
  [PROVIDERS.COMBAT_TIMELINE]: "fa-solid fa-hourglass-half"
});

const DANGER_LABELS = Object.freeze({
  [DANGER_LEVELS.SAFE]: "Safe",
  [DANGER_LEVELS.CHANGES_SCENE]: "Scene",
  [DANGER_LEVELS.CHANGES_COMBAT]: "Combat",
  [DANGER_LEVELS.DISRUPTIVE]: "Disruptive"
});

const STATE_LABELS = Object.freeze({
  notRun: "Not run",
  running: "Running",
  completed: "Complete",
  failed: "Failed",
  skipped: "Skipped"
});

const FAILURE_LABELS = Object.freeze({
  [FAILURE_POLICIES.STOP]: "Stop on failure",
  [FAILURE_POLICIES.CONTINUE]: "Continue",
  [FAILURE_POLICIES.SKIP_REMAINING]: "Skip remaining"
});

const MODE_LABELS = Object.freeze({
  [EXECUTION_MODES.SEQUENTIAL]: "Sequential",
  [EXECUTION_MODES.PARALLEL]: "Run together"
});

const TRIGGER_EVENT_LABELS = Object.freeze({
  [TRIGGER_EVENTS.ENEMY_DEFEATED_COUNT]: "Enemy defeated count",
  [TRIGGER_EVENTS.COMBATANT_DEFEATED_COUNT]: "Combatant defeated count",
  [TRIGGER_EVENTS.TOKEN_HP_AT_OR_BELOW]: "HP threshold",
  [TRIGGER_EVENTS.TOKEN_DEFEATED]: "Token defeated",
  [TRIGGER_EVENTS.ALLY_DEFEATED]: "Ally defeated",
  [TRIGGER_EVENTS.COMBAT_ROUND_AT_LEAST]: "Combat round"
});

const TRIGGER_ACTION_LABELS = Object.freeze({
  [TRIGGER_ACTIONS.SELECT_BEAT]: "Select Beat",
  [TRIGGER_ACTIONS.RUN_BEAT]: "Run Beat",
  [TRIGGER_ACTIONS.START_SEQUENCE]: "Start Sequence"
});

function classToken(value, fallback = "unknown") {
  return String(value ?? fallback)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;
}

function countLabel(count, singular, plural = `${singular}s`) {
  const number = Number(count) || 0;
  return `${number} ${number === 1 ? singular : plural}`;
}

function listCount(value) {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return `${Math.round(number * 100)}%`;
}

function textOrNone(value, fallback = "Not set") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstDefined(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

export function displayChoice(value, selectedValue, label = value) {
  return { value, label, selected: value === selectedValue };
}

export function enumOptions(values, selectedValue, labels = {}) {
  return values.map((value) => displayChoice(value, selectedValue, labels[value] ?? value));
}

export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] ?? textOrNone(provider, "Provider");
}

export function providerIcon(provider) {
  return PROVIDER_ICONS[provider] ?? "fa-solid fa-plug";
}

export function dangerLabel(value) {
  return DANGER_LABELS[value] ?? textOrNone(value, "Safe");
}

export function statusClass(status) {
  return classToken(status);
}

export function stateLabel(state) {
  return STATE_LABELS[state] ?? textOrNone(state, "Not run");
}

export function triggerEventOptions(selectedValue) {
  return enumOptions(Object.values(TRIGGER_EVENTS), selectedValue, TRIGGER_EVENT_LABELS);
}

export function triggerActionOptions(selectedValue) {
  return enumOptions(Object.values(TRIGGER_ACTIONS), selectedValue, TRIGGER_ACTION_LABELS);
}

export function failurePolicyOptions(selectedValue) {
  return enumOptions(Object.values(FAILURE_POLICIES), selectedValue, FAILURE_LABELS);
}

export function executionModeOptions(selectedValue) {
  return enumOptions(Object.values(EXECUTION_MODES), selectedValue, MODE_LABELS);
}

export function summarizeTrigger(trigger = {}, targetBeat = null, targetSequence = null) {
  const action = TRIGGER_ACTION_LABELS[trigger.action] ?? "Select Beat";
  const target = targetBeat?.name || targetSequence?.name || "this Beat";
  switch (trigger.event) {
    case TRIGGER_EVENTS.ENEMY_DEFEATED_COUNT:
      return `When ${countLabel(trigger.count, "enemy")} are defeated, ${action.toLocaleLowerCase()} ${target}.`;
    case TRIGGER_EVENTS.COMBATANT_DEFEATED_COUNT:
      return `When ${countLabel(trigger.count, "combatant")} are defeated, ${action.toLocaleLowerCase()} ${target}.`;
    case TRIGGER_EVENTS.TOKEN_HP_AT_OR_BELOW:
      return `When watched HP is ${trigger.thresholdType === "hp" ? `${trigger.threshold} HP` : `${trigger.threshold}%`} or lower, ${action.toLocaleLowerCase()} ${target}.`;
    case TRIGGER_EVENTS.TOKEN_DEFEATED:
      return `When a watched Token is defeated, ${action.toLocaleLowerCase()} ${target}.`;
    case TRIGGER_EVENTS.ALLY_DEFEATED:
      return `When an ally is defeated, ${action.toLocaleLowerCase()} ${target}.`;
    case TRIGGER_EVENTS.COMBAT_ROUND_AT_LEAST:
      return `When combat reaches round ${trigger.round}, ${action.toLocaleLowerCase()} ${target}.`;
    default:
      return `${TRIGGER_EVENT_LABELS[trigger.event] ?? "Trigger"} will ${action.toLocaleLowerCase()} ${target}.`;
  }
}

export function triggerEditorModel(trigger = {}, index = 0, beats = [], sequences = []) {
  const targetSequenceId = trigger.targetSequenceId ?? "";
  const targetBeatId = trigger.targetBeatId ?? "";
  const targetSequence = sequences.find((sequence) => sequence.id === targetSequenceId) ?? null;
  const targetBeat = beats.find((beat) => beat.id === targetBeatId) ?? null;
  return {
    ...trigger,
    index: index + 1,
    statusClass: trigger.enabled === false ? "disabled" : "ready",
    eventLabel: TRIGGER_EVENT_LABELS[trigger.event] ?? trigger.event,
    actionLabel: TRIGGER_ACTION_LABELS[trigger.action] ?? trigger.action,
    summary: summarizeTrigger(trigger, targetBeat, targetSequence),
    eventOptions: triggerEventOptions(trigger.event),
    actionOptions: triggerActionOptions(trigger.action),
    targetBeatOptions: [
      displayChoice("", targetBeatId, "This Beat"),
      ...beats.map((beat) => displayChoice(beat.id, targetBeatId, beat.name))
    ],
    targetSequenceOptions: [
      displayChoice("", targetSequenceId, "This Sequence"),
      ...sequences.map((sequence) => displayChoice(sequence.id, targetSequenceId, sequence.name))
    ],
    thresholdTypeOptions: [
      displayChoice("percent", trigger.thresholdType, "Percent"),
      displayChoice("hp", trigger.thresholdType, "Hit points")
    ],
    tokenRefs: (trigger.tokenUuids ?? []).join(", "),
    actorRefs: (trigger.actorUuids ?? []).join(", "),
    dispositionRefs: (trigger.dispositions ?? []).join(", ")
  };
}

export function summarizeAction(action = {}, metadata = null) {
  const config = action.config ?? {};
  switch (action.type) {
    case "native.note":
      return textOrNone(config.message, "Record a GM-facing cue note.");
    case "native.chatMessage":
      return config.whisperGmOnly === false ? "Send a public chat message." : "Record a GM-only chat note.";
    case "native.delay":
      return `Wait ${Number(config.durationMs ?? 0)} ms before continuing.`;
    case "native.waitForConfirmation":
      return `Pause for GM confirmation: ${textOrNone(config.prompt, "Continue this Beat?")}`;
    case "native.preloadScene":
      return `Preload Scene ${textOrNone(config.sceneUuid)}.`;
    case "native.viewScene":
      return `View Scene locally as GM: ${textOrNone(config.sceneUuid)}.`;
    case "native.activateScene":
      return `Activate Scene for players: ${textOrNone(config.sceneUuid)}.`;
    case "native.setSceneDarkness":
      return `Set Scene darkness to ${percent(config.darkness ?? 0)}.`;
    case "native.updateSceneEnvironment":
      return `Update ${countLabel(Object.keys(config.updates ?? {}).length, "Scene field")}.`;
    case "native.updateAmbientLights":
      return `Update ${countLabel(listCount(config.lightUuids), "AmbientLight")}.`;
    case "native.updateWallsDoors":
      return `Update ${countLabel(listCount(config.wallUuids), "Wall or Door")}.`;
    case "native.setTokenVisibility":
      return `${config.hidden ? "Hide" : "Reveal"} ${countLabel(listCount(config.tokenUuids), "Token")}.`;
    case "native.moveTokens":
      return `Move ${countLabel(listCount(config.moves), "Token")} to prepared coordinates.`;
    case "native.updateTokenElevation":
      return `Set ${countLabel(listCount(config.tokenUuids), "Token")} to elevation ${firstDefined(config.elevation, 0)}.`;
    case "native.updateTokenDisposition":
      return `Set ${countLabel(listCount(config.tokenUuids), "Token")} disposition to ${firstDefined(config.disposition, 0)}.`;
    case "native.createCombat":
      return `Create or locate Combat for ${textOrNone(config.sceneUuid, "the active Scene")}.`;
    case "native.addTokensToCombat":
      return `Add ${countLabel(listCount(config.tokenUuids), "Token")} to Combat.`;
    case "native.removeCombatants":
      return `Remove ${countLabel(listCount(config.combatantIds), "Combatant")} from Combat.`;
    case "native.startCombat":
      return "Start the active or configured Combat.";
    case "native.endCombat":
      return "End the active or configured Combat.";
    case "native.setCombatRoundTurn":
      return `Set Combat ${config.round !== null && config.round !== undefined ? `round ${config.round}` : ""}${config.turn !== null && config.turn !== undefined ? ` turn ${config.turn}` : ""}.`.replace(/\s+\./, ".");
    case "native.panCamera":
      return `Pan ${config.scope ?? "gm"} camera to ${Number(config.x ?? 0)}, ${Number(config.y ?? 0)}.`;
    case "native.pauseGame":
      return config.paused === false ? "Unpause the game." : "Pause the game.";
    case "native.playlistCue":
      return `${config.operation === "stop" ? "Stop" : "Play"} native Playlist cue ${textOrNone(config.playlistUuid)}.`;
    case "native.giveItemToActor":
      return `Give ${textOrNone(config.itemUuid || config.itemData?.name, "an Item")} to ${countLabel(listCount(config.actorUuids), "Actor")}.`;
    case "native.removeItemFromActor":
      return `Remove ${textOrNone(config.itemName || config.itemId || config.itemUuid, "an Item")} from ${countLabel(listCount(config.actorUuids), "Actor")}.`;
    case "native.createJournalHandout":
      return `Create Journal handout: ${textOrNone(config.name, "New Handout")}.`;
    case "native.showJournalHandout":
      return `Show Journal handout ${textOrNone(config.journalUuid)} to ${config.userIds?.length ? countLabel(config.userIds.length, "selected player") : "all players"}.`;
    case "native.requestRoll":
      return `Request ${textOrNone(config.formula, "1d20")} roll${config.dc ? ` vs DC ${config.dc}` : ""}.`;
    case "sessionflow.trigger":
    case "sessionflow.open":
      return `SessionFlow ${config.operation ?? "operation"} ${textOrNone(config.sessionId || config.hookName || config.beatId, "configured content")}.`;
    case "exalted-scenes.broadcast":
    case "exalted-scenes.stop":
      return `Exalted Scenes ${config.operation ?? "presentation"} ${textOrNone(config.externalId || config.sceneId, "configured content")}.`;
    case "narrators-jukebox.playMusic":
    case "narrators-jukebox.stopMusic":
    case "narrators-jukebox.ambience":
    case "narrators-jukebox.soundCue":
      return `Narrator's Jukebox ${config.operation ?? "cue"} ${textOrNone(config.trackName || config.soundName || config.externalId || config.presetId, "configured audio")}.`;
    case "fxmaster.preset":
    case "fxmaster.effect":
    case "fxmaster.clearDirectorEffects":
    case "fxmaster.clearAll":
      return `FXMaster ${config.operation ?? "effect"} ${textOrNone(config.preset || config.externalId, "configured effect")}.`;
    case "character-hud.present":
    case "character-hud.stop":
      return `Character HUD ${config.operation ?? "presentation"} ${textOrNone(config.actorUuid, "configured actor")}.`;
    case "combat-timeline.openConfig":
    case "combat-timeline.countdown":
      return `Combat Timeline ${config.operation ?? "configuration"}.`;
    default:
      return metadata?.description ?? "Configured custom Action.";
  }
}

export function actionEditorModel(action = {}, metadata = null) {
  const type = action.type ?? "";
  const config = action.config ?? {};
  const provider = metadata?.provider ?? action.adapter ?? PROVIDERS.FOUNDRY;
  const isNative = provider === PROVIDERS.FOUNDRY;
  const isScene = ["native.preloadScene", "native.viewScene", "native.activateScene", "native.setSceneDarkness", "native.updateSceneEnvironment", "native.createCombat"].includes(type);
  const isToken = ["native.setTokenVisibility", "native.moveTokens", "native.updateTokenElevation", "native.updateTokenDisposition", "native.addTokensToCombat"].includes(type);
  const isLight = type === "native.updateAmbientLights";
  const isWall = type === "native.updateWallsDoors";
  const isCombat = ["native.createCombat", "native.addTokensToCombat", "native.removeCombatants", "native.startCombat", "native.endCombat", "native.setCombatRoundTurn"].includes(type);
  const isItem = ["native.giveItemToActor", "native.removeItemFromActor"].includes(type);
  const isGiveItem = type === "native.giveItemToActor";
  const isRemoveItem = type === "native.removeItemFromActor";
  const isJournal = ["native.createJournalHandout", "native.showJournalHandout"].includes(type);
  const isCreateJournal = type === "native.createJournalHandout";
  const isShowJournal = type === "native.showJournalHandout";
  const isRollRequest = type === "native.requestRoll";
  return {
    provider,
    providerLabel: providerLabel(provider),
    providerIcon: providerIcon(provider),
    typeLabel: metadata?.label ?? type,
    description: metadata?.description ?? "",
    dangerLabel: dangerLabel(metadata?.dangerLevel),
    dangerClass: classToken(metadata?.dangerLevel ?? DANGER_LEVELS.SAFE),
    rollbackLabel: metadata?.rollbackSupported || action.rollbackSupported ? "Rollback snapshot" : "No rollback",
    summary: summarizeAction(action, metadata),
    isNative,
    isIntegration: !isNative,
    isMessage: ["native.note", "native.chatMessage", "native.waitForConfirmation"].includes(type),
    isChatMessage: type === "native.chatMessage",
    isWait: type === "native.waitForConfirmation",
    isDelay: type === "native.delay",
    isScene,
    isDarkness: type === "native.setSceneDarkness",
    isSceneEnvironment: type === "native.updateSceneEnvironment",
    isToken,
    isTokenVisibility: type === "native.setTokenVisibility",
    isMoveTokens: type === "native.moveTokens",
    isElevation: type === "native.updateTokenElevation",
    isDisposition: type === "native.updateTokenDisposition",
    isLight,
    isWall,
    isCombat,
    isItem,
    isGiveItem,
    isRemoveItem,
    isJournal,
    isCreateJournal,
    isShowJournal,
    isRollRequest,
    isCamera: type === "native.panCamera",
    isPause: type === "native.pauseGame",
    isPlaylist: type === "native.playlistCue",
    config,
    message: firstDefined(config.message, config.prompt, ""),
    tokenRefs: (config.tokenUuids ?? []).join(", "),
    actorRefs: (config.actorUuids ?? []).join(", "),
    userRefs: (config.userIds ?? []).join(", "),
    itemDataJson: JSON.stringify(config.itemData ?? {}, null, 2),
    lightRefs: (config.lightUuids ?? []).join(", "),
    wallRefs: (config.wallUuids ?? []).join(", "),
    combatantRefs: (config.combatantIds ?? []).join(", "),
    movesJson: JSON.stringify(config.moves ?? [], null, 2),
    updatesJson: JSON.stringify(config.updates ?? {}, null, 2),
    argsJson: JSON.stringify(config.args ?? [], null, 2),
    optionsJson: JSON.stringify(config.options ?? {}, null, 2),
    effectsJson: JSON.stringify(config.effects ?? [], null, 2),
    particlesJson: JSON.stringify(config.particles ?? [], null, 2),
    filtersJson: JSON.stringify(config.filters ?? [], null, 2),
    hiddenOptions: [
      displayChoice("false", String(Boolean(config.hidden)), "Reveal Tokens"),
      displayChoice("true", String(Boolean(config.hidden)), "Hide Tokens")
    ],
    dispositionOptions: [
      displayChoice("-1", String(config.disposition ?? 0), "Hostile"),
      displayChoice("0", String(config.disposition ?? 0), "Neutral"),
      displayChoice("1", String(config.disposition ?? 0), "Friendly")
    ],
    cameraScopeOptions: [
      displayChoice("gm", config.scope ?? "gm", "GM only"),
      displayChoice("selectedUsers", config.scope ?? "gm", "Selected users"),
      displayChoice("allPlayers", config.scope ?? "gm", "All active players")
    ],
    playlistOperationOptions: [
      displayChoice("play", config.operation ?? "play", "Play"),
      displayChoice("stop", config.operation ?? "play", "Stop")
    ],
    ownershipLevelOptions: [
      displayChoice("limited", config.ownershipLevel ?? "observer", "Limited"),
      displayChoice("observer", config.ownershipLevel ?? "observer", "Observer"),
      displayChoice("owner", config.ownershipLevel ?? "observer", "Owner")
    ],
    pauseOptions: [
      displayChoice("true", String(config.paused !== false), "Pause"),
      displayChoice("false", String(config.paused !== false), "Unpause")
    ]
  };
}

export function decorateAction(action = {}, index = 0, metadata = null) {
  const provider = metadata?.provider ?? action.adapter ?? PROVIDERS.FOUNDRY;
  const lastStatus = action.lastResult?.status ?? action.lastValidation?.status ?? (action.enabled === false ? "disabled" : "pending");
  return {
    ...action,
    index: index + 1,
    provider,
    providerLabel: providerLabel(provider),
    providerIcon: providerIcon(provider),
    typeLabel: metadata?.label ?? action.type,
    dangerLabel: dangerLabel(metadata?.dangerLevel),
    dangerClass: classToken(metadata?.dangerLevel ?? DANGER_LEVELS.SAFE),
    summary: summarizeAction(action, metadata),
    statusClass: statusClass(lastStatus),
    statusLabel: action.lastResult?.status ?? action.lastValidation?.status ?? (action.enabled === false ? "Disabled" : "Pending"),
    modeLabel: MODE_LABELS[action.executionMode] ?? "Sequential",
    failureLabel: FAILURE_LABELS[action.failurePolicy] ?? action.failurePolicy,
    parallelLabel: action.executionMode === EXECUTION_MODES.PARALLEL ? textOrNone(action.parallelGroup, "Parallel group") : "",
    delayLabel: Number(action.delayAfterMs) > 0 ? `${action.delayAfterMs} ms delay` : "",
    confirmationLabel: action.requiresConfirmation ? "Confirms" : "",
    rollbackLabel: metadata?.rollbackSupported || action.rollbackSupported ? "Rollback" : "",
    disabled: action.enabled === false
  };
}

export function decorateBeat(beat = {}, index = 0, actions = [], triggerSequences = []) {
  const enabledActions = actions.filter((action) => action.enabled !== false);
  const failures = actions.filter((action) => action.lastResult?.status === RESULT_STATUS.FAILURE);
  const warnings = actions.filter((action) => [RESULT_STATUS.WARNING, RESULT_STATUS.UNSUPPORTED].includes(action.lastResult?.status ?? action.lastValidation?.status));
  const status = failures.length ? "failed" : warnings.length ? "warning" : beat.manualState ?? "notRun";
  const triggerSummaries = (beat.triggers ?? []).map((trigger) => summarizeTrigger(trigger, null, triggerSequences.find((sequence) => sequence.id === trigger.targetSequenceId))).slice(0, 2);
  return {
    ...beat,
    index: index + 1,
    iconDisplay: beat.icon || "fa-solid fa-circle-dot",
    stateLabel: stateLabel(beat.manualState),
    stateClass: classToken(status),
    dangerLabel: dangerLabel(beat.dangerLevel),
    dangerClass: classToken(beat.dangerLevel),
    actionCount: actions.length,
    enabledActionCount: enabledActions.length,
    actionCountLabel: countLabel(enabledActions.length, "Action"),
    triggerCount: (beat.triggers ?? []).length,
    triggerLabel: countLabel((beat.triggers ?? []).length, "Trigger"),
    triggerSummary: triggerSummaries.join(" "),
    hasTriggers: Boolean((beat.triggers ?? []).length),
    hasActions: Boolean(actions.length)
  };
}

export function decorateSequence(sequence = {}, selectedId = "") {
  return {
    ...sequence,
    selected: sequence.id === selectedId,
    statusLabel: sequence.archived ? "Archived" : sequence.enabled === false ? "Disabled" : "Enabled",
    statusClass: sequence.archived ? "archived" : sequence.enabled === false ? "disabled" : "ready",
    beatCountLabel: countLabel(sequence.beats?.length ?? 0, "Beat")
  };
}

export function healthSummary(statuses = []) {
  const ready = statuses.filter((status) => status.status === "Ready").length;
  const limited = statuses.filter((status) => status.status && status.status !== "Ready").length;
  const errors = statuses.filter((status) => status.lastError).length;
  return {
    ready,
    limited,
    errors,
    total: statuses.length,
    label: `${ready}/${statuses.length} ready`,
    tone: errors ? "failure" : limited ? "warning" : "success"
  };
}

export function decorateLog(entry = {}) {
  const created = String(entry.createdAt ?? "");
  const time = created.includes("T") ? created.split("T").at(-1)?.replace("Z", "").slice(0, 8) : created;
  const isTrigger = String(entry.message ?? "").toLocaleLowerCase().includes("trigger");
  return {
    ...entry,
    timeLabel: time || created,
    statusClass: statusClass(entry.status),
    filterType: isTrigger ? "trigger" : statusClass(entry.status),
    isTrigger
  };
}
