export const MODULE_ID = "cinematic-encounter-director";
export const MODULE_TITLE = "Cinematic Encounter Director";
export const MODULE_VERSION = "0.1.23";
export const SCHEMA_VERSION = 1;

export const TEMPLATE_PATHS = Object.freeze({
  DIRECTOR: `modules/${MODULE_ID}/templates/director.hbs`,
  SEQUENCE_EDITOR: `modules/${MODULE_ID}/templates/sequence-editor.hbs`,
  ACTION_EDITOR: `modules/${MODULE_ID}/templates/action-editor.hbs`,
  INTEGRATION_HEALTH: `modules/${MODULE_ID}/templates/integration-health.hbs`,
  EXECUTION_LOG: `modules/${MODULE_ID}/templates/execution-log.hbs`
});

export const FLAGS = Object.freeze({
  SCENE_SEQUENCES: "sceneSequences",
  EXECUTION_LOCK: "executionLock",
  EXECUTION_LOG: "executionLog",
  ROLLBACK_SNAPSHOTS: "rollbackSnapshots",
  TRIGGER_STATE: "triggerState"
});

export const SETTINGS = Object.freeze({
  ENABLED: "enabled",
  PERMIT_SESSIONFLOW: "permitSessionFlow",
  PERMIT_EXALTED_SCENES: "permitExaltedScenes",
  PERMIT_NARRATORS_JUKEBOX: "permitNarratorsJukebox",
  PERMIT_FXMASTER: "permitFxMaster",
  PERMIT_CHARACTER_HUD: "permitCharacterHud",
  PERMIT_COMBAT_TIMELINE: "permitCombatTimeline",
  REQUIRE_SCENE_ACTIVATION_CONFIRMATION: "requireSceneActivationConfirmation",
  REQUIRE_COMBAT_DANGER_CONFIRMATION: "requireCombatDangerConfirmation",
  DEFAULT_BEAT_FAILURE_POLICY: "defaultBeatFailurePolicy",
  EXECUTION_LOG_RETENTION: "executionLogRetention",
  ENABLE_NATIVE_PLAYLIST_FALLBACK: "enableNativePlaylistFallback",
  WINDOW_POSITION: "windowPosition",
  WINDOW_SIZE: "windowSize",
  COMPACT_MODE: "compactMode",
  SHOW_INTEGRATION_HEALTH: "showIntegrationHealth",
  SHOW_ADVANCED_ACTION_DETAILS: "showAdvancedActionDetails",
  REDUCED_ANIMATION: "reducedAnimation",
  CONFIRM_BEFORE_RUN_BEAT: "confirmBeforeRunBeat",
  AUTO_SELECT_NEXT_BEAT: "autoSelectNextBeat",
  ENABLE_AUTOMATION_TRIGGERS: "enableAutomationTriggers",
  DIRECTOR_MODE: "directorMode"
});

export const PROVIDERS = Object.freeze({
  FOUNDRY: "foundry-native",
  SESSIONFLOW: "sessionflow",
  EXALTED_SCENES: "exalted-scenes",
  NARRATORS_JUKEBOX: "narrators-jukebox",
  FXMASTER: "fxmaster",
  CHARACTER_HUD: "character-hud",
  COMBAT_TIMELINE: "combat-timeline"
});

export const RESULT_STATUS = Object.freeze({
  SUCCESS: "success",
  SKIPPED: "skipped",
  WARNING: "warning",
  UNSUPPORTED: "unsupported",
  FAILURE: "failure",
  CANCELLED: "cancelled",
  ROLLED_BACK: "rolledBack",
  WAITING: "waiting",
  DRY_RUN: "dryRun"
});

export const DANGER_LEVELS = Object.freeze({
  SAFE: "safe",
  CHANGES_SCENE: "changesScene",
  CHANGES_COMBAT: "changesCombat",
  DISRUPTIVE: "disruptive"
});

export const FAILURE_POLICIES = Object.freeze({
  STOP: "stop",
  CONTINUE: "continue",
  SKIP_REMAINING: "skipRemaining"
});

export const EXECUTION_MODES = Object.freeze({
  SEQUENTIAL: "sequential",
  PARALLEL: "parallel"
});

export const TRIGGER_EVENTS = Object.freeze({
  COMBAT_STARTED: "combatStarted",
  COMBAT_ROUND_STARTED: "combatRoundStarted",
  COMBAT_TURN_STARTED: "combatTurnStarted",
  INITIATIVE_REACHED: "initiativeReached",
  COMBAT_ENDED: "combatEnded",
  ENEMY_DEFEATED_COUNT: "enemyDefeatedCount",
  COMBATANT_DEFEATED_COUNT: "combatantDefeatedCount",
  TOKEN_HP_AT_OR_BELOW: "tokenHpAtOrBelow",
  TOKEN_DEFEATED: "tokenDefeated",
  ALLY_DEFEATED: "allyDefeated",
  COMBAT_ROUND_AT_LEAST: "combatRoundAtLeast"
});

export const TRIGGER_ACTIONS = Object.freeze({
  SELECT_BEAT: "selectBeat",
  RUN_BEAT: "runBeat",
  START_SEQUENCE: "startSequence"
});

export const SOCKET_MESSAGES = Object.freeze({
  PLAYER_CAMERA_PAN: "playerCameraPan",
  EXECUTION_STATE: "executionState",
  EMERGENCY_STOP: "emergencyStop"
});

export const HOOKS = Object.freeze({
  BEAT_START: `${MODULE_ID}.beatStart`,
  ACTION_RESULT: `${MODULE_ID}.actionResult`,
  BEAT_FINISH: `${MODULE_ID}.beatFinish`,
  EMERGENCY_STOP: `${MODULE_ID}.emergencyStop`,
  SEQUENCES_CHANGED: `${MODULE_ID}.sequencesChanged`,
  TRIGGER_FIRED: `${MODULE_ID}.triggerFired`
});

export const INTEGRATION_TARGETS = Object.freeze({
  sessionflow: {
    providerId: PROVIDERS.SESSIONFLOW,
    displayName: "SessionFlow",
    setting: SETTINGS.PERMIT_SESSIONFLOW,
    moduleIdCandidates: ["sessionflow"],
    titleMatchers: ["sessionflow"]
  },
  exaltedScenes: {
    providerId: PROVIDERS.EXALTED_SCENES,
    displayName: "Exalted Scenes",
    setting: SETTINGS.PERMIT_EXALTED_SCENES,
    moduleIdCandidates: ["exalted-scenes"],
    titleMatchers: ["exalted scenes", "exalted-scenes"]
  },
  narratorsJukebox: {
    providerId: PROVIDERS.NARRATORS_JUKEBOX,
    displayName: "Narrator's Jukebox",
    setting: SETTINGS.PERMIT_NARRATORS_JUKEBOX,
    moduleIdCandidates: ["narrator-jukebox", "narrators-jukebox", "narrators_jukebox"],
    titleMatchers: ["narrator's jukebox", "narrators jukebox", "narrator jukebox"]
  },
  fxmaster: {
    providerId: PROVIDERS.FXMASTER,
    displayName: "Gambit's FXMaster",
    setting: SETTINGS.PERMIT_FXMASTER,
    moduleIdCandidates: ["fxmaster"],
    titleMatchers: ["fxmaster", "gambit's fxmaster", "gambits fxmaster"]
  },
  characterHud: {
    providerId: PROVIDERS.CHARACTER_HUD,
    displayName: "COTS Character HUD",
    setting: SETTINGS.PERMIT_CHARACTER_HUD,
    moduleIdCandidates: ["cots-character-hud", "cots-character-hud-v2"],
    titleMatchers: ["cots character hud", "character hud"]
  },
  combatTimeline: {
    providerId: PROVIDERS.COMBAT_TIMELINE,
    displayName: "Cinematic Combat Timeline",
    setting: SETTINGS.PERMIT_COMBAT_TIMELINE,
    moduleIdCandidates: ["cinematic-combat-timeline"],
    titleMatchers: ["cinematic combat timeline"]
  }
});

export const MAX_TEXT_LENGTH = 5000;
export const MAX_NAME_LENGTH = 120;
export const MAX_DELAY_MS = 60000;
export const EXECUTION_LOCK_TIMEOUT_MS = 120000;
export const MAX_IMPORT_BYTES = 2_000_000;

export function moduleLog(message, ...args) {
  console.info(`${MODULE_TITLE} | ${message}`, ...args);
}

export function moduleWarn(message, ...args) {
  console.warn(`${MODULE_TITLE} | ${message}`, ...args);
}

export function moduleError(message, error) {
  console.error(`${MODULE_TITLE} | ${message}`, error);
}
