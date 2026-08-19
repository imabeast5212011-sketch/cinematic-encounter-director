import { DANGER_LEVELS, EXECUTION_MODES, FAILURE_POLICIES, PROVIDERS } from "../constants.js";

export const NATIVE_ACTION_TYPES = Object.freeze([
  {
    id: "native.note",
    provider: PROVIDERS.FOUNDRY,
    label: "GM note or group divider",
    description: "Records an execution-log note without mutating documents.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { message: "" }
  },
  {
    id: "native.chatMessage",
    provider: PROVIDERS.FOUNDRY,
    label: "Display ChatMessage or GM-only note",
    description: "Creates a safe chat message or a GM-only execution-log note.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { message: "", whisperGmOnly: true }
  },
  {
    id: "native.delay",
    provider: PROVIDERS.FOUNDRY,
    label: "Timed delay",
    description: "Waits for a bounded, cancellable duration.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { durationMs: 1000 }
  },
  {
    id: "native.waitForConfirmation",
    provider: PROVIDERS.FOUNDRY,
    label: "Manual Continue wait point",
    description: "Pauses Beat execution until the GM confirms continuation.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { prompt: "Continue this Beat?" }
  },
  {
    id: "native.preloadScene",
    provider: PROVIDERS.FOUNDRY,
    label: "Preload Scene",
    description: "Preloads a Scene without activating it.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { sceneUuid: "" }
  },
  {
    id: "native.viewScene",
    provider: PROVIDERS.FOUNDRY,
    label: "View Scene locally as GM",
    description: "Changes the GM's viewed Scene without player activation.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { sceneUuid: "" }
  },
  {
    id: "native.activateScene",
    provider: PROVIDERS.FOUNDRY,
    label: "Activate Scene for players",
    description: "Activates a Scene and waits for the active canvas to be ready when possible.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: false,
    defaultConfig: { sceneUuid: "" }
  },
  {
    id: "native.setSceneDarkness",
    provider: PROVIDERS.FOUNDRY,
    label: "Set Scene darkness",
    description: "Updates the current darkness value on a Scene.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { sceneUuid: "", darkness: 0.5 }
  },
  {
    id: "native.updateSceneEnvironment",
    provider: PROVIDERS.FOUNDRY,
    label: "Update Scene environment fields",
    description: "Updates explicitly allowlisted Scene environment keys only when they exist.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { sceneUuid: "", updates: {} }
  },
  {
    id: "native.updateAmbientLights",
    provider: PROVIDERS.FOUNDRY,
    label: "Update AmbientLight documents",
    description: "Enables, disables, or safely updates existing AmbientLight documents.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { lightUuids: [], updates: { hidden: false } }
  },
  {
    id: "native.updateWallsDoors",
    provider: PROVIDERS.FOUNDRY,
    label: "Update Wall or Door states",
    description: "Safely updates existing Wall door state or movement/sight/sound restrictions.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { wallUuids: [], updates: {} }
  },
  {
    id: "native.setTokenVisibility",
    provider: PROVIDERS.FOUNDRY,
    label: "Reveal or hide Tokens",
    description: "Updates hidden state on existing Scene Tokens.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { tokenUuids: [], hidden: false }
  },
  {
    id: "native.moveTokens",
    provider: PROVIDERS.FOUNDRY,
    label: "Move Tokens to prepared coordinates",
    description: "Moves existing Scene Tokens to configured x/y coordinates.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { moves: [] }
  },
  {
    id: "native.updateTokenElevation",
    provider: PROVIDERS.FOUNDRY,
    label: "Update Token elevation",
    description: "Updates elevation on existing Scene Tokens where supported.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { tokenUuids: [], elevation: 0 }
  },
  {
    id: "native.updateTokenDisposition",
    provider: PROVIDERS.FOUNDRY,
    label: "Update Token disposition",
    description: "Updates Token disposition only when explicitly configured.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    rollbackSupported: true,
    defaultConfig: { tokenUuids: [], disposition: 0 }
  },
  {
    id: "native.createCombat",
    provider: PROVIDERS.FOUNDRY,
    label: "Create Combat for Scene",
    description: "Creates a Combat document for the Scene when none is active.",
    dangerLevel: DANGER_LEVELS.CHANGES_COMBAT,
    rollbackSupported: false,
    defaultConfig: { sceneUuid: "" }
  },
  {
    id: "native.addTokensToCombat",
    provider: PROVIDERS.FOUNDRY,
    label: "Add Tokens to Combat",
    description: "Adds existing Tokens to the active or newly created Combat.",
    dangerLevel: DANGER_LEVELS.CHANGES_COMBAT,
    rollbackSupported: true,
    defaultConfig: { tokenUuids: [], createCombatIfMissing: true }
  },
  {
    id: "native.removeCombatants",
    provider: PROVIDERS.FOUNDRY,
    label: "Remove selected Combatants from Combat",
    description: "Removes configured Combatants after dangerous-action confirmation.",
    dangerLevel: DANGER_LEVELS.CHANGES_COMBAT,
    rollbackSupported: false,
    defaultConfig: { combatantIds: [], combatUuid: "" }
  },
  {
    id: "native.startCombat",
    provider: PROVIDERS.FOUNDRY,
    label: "Start Combat",
    description: "Starts the active Combat if it has not begun.",
    dangerLevel: DANGER_LEVELS.CHANGES_COMBAT,
    rollbackSupported: false,
    defaultConfig: { combatUuid: "" }
  },
  {
    id: "native.endCombat",
    provider: PROVIDERS.FOUNDRY,
    label: "End Combat",
    description: "Ends a Combat after dangerous-action confirmation.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    rollbackSupported: false,
    defaultConfig: { combatUuid: "" }
  },
  {
    id: "native.setCombatRoundTurn",
    provider: PROVIDERS.FOUNDRY,
    label: "Set Combat round or turn",
    description: "Explicitly dangerous round or turn update.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    rollbackSupported: false,
    defaultConfig: { combatUuid: "", round: null, turn: null }
  },
  {
    id: "native.panCamera",
    provider: PROVIDERS.FOUNDRY,
    label: "Pan camera",
    description: "Pans the GM, selected users, or players to coordinates when permitted.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { scope: "gm", userIds: [], x: 0, y: 0, scale: null, duration: 1000 }
  },
  {
    id: "native.pauseGame",
    provider: PROVIDERS.FOUNDRY,
    label: "Pause or unpause game",
    description: "Pauses or unpauses the game with confirmation.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    rollbackSupported: false,
    defaultConfig: { paused: true }
  },
  {
    id: "native.playlistCue",
    provider: PROVIDERS.FOUNDRY,
    label: "Foundry Playlist cue",
    description: "Optional native Playlist fallback. This is separate from Narrator's Jukebox.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: true,
    requiresSetting: "enableNativePlaylistFallback",
    defaultConfig: { playlistUuid: "", soundId: "", operation: "play" }
  },
  {
    id: "native.giveItemToActor",
    provider: PROVIDERS.FOUNDRY,
    label: "Give Item to Actor",
    description: "Creates or stacks an Item on configured Actor inventories after GM confirmation.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    rollbackSupported: true,
    requiresConfirmation: true,
    defaultConfig: { actorUuids: [], itemUuid: "", quantity: 1, stack: true }
  },
  {
    id: "native.removeItemFromActor",
    provider: PROVIDERS.FOUNDRY,
    label: "Remove Item from Actor",
    description: "Removes or reduces matching Actor Items after GM confirmation.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    rollbackSupported: true,
    requiresConfirmation: true,
    defaultConfig: { actorUuids: [], itemUuid: "", itemId: "", itemName: "", quantity: 1, removeAll: false }
  },
  {
    id: "native.createJournalHandout",
    provider: PROVIDERS.FOUNDRY,
    label: "Create Journal handout",
    description: "Creates a JournalEntry handout with optional player ownership after GM confirmation.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    rollbackSupported: true,
    requiresConfirmation: true,
    defaultConfig: { name: "New Handout", pageName: "Handout", content: "", ownershipLevel: "observer", showToPlayers: false }
  },
  {
    id: "native.showJournalHandout",
    provider: PROVIDERS.FOUNDRY,
    label: "Show Journal handout",
    description: "Shows an existing JournalEntry or page to players where Foundry exposes a show API.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    rollbackSupported: false,
    requiresConfirmation: true,
    defaultConfig: { journalUuid: "", pageId: "", showToPlayers: true, createChatLinkFallback: true }
  },
  {
    id: "native.requestRoll",
    provider: PROVIDERS.FOUNDRY,
    label: "Request player roll",
    description: "Posts a roll request to chat for selected users, all players, or the table.",
    dangerLevel: DANGER_LEVELS.SAFE,
    rollbackSupported: false,
    defaultConfig: { prompt: "Roll when ready.", formula: "1d20", dc: "", rollType: "", actorUuids: [], userIds: [], whisper: false }
  }
]);

export const NATIVE_ACTIONS_BY_ID = new Map(NATIVE_ACTION_TYPES.map((action) => [action.id, action]));

export function getNativeActionType(actionType) {
  return NATIVE_ACTIONS_BY_ID.get(actionType) ?? null;
}

export function defaultActionPatch(actionType) {
  const metadata = getNativeActionType(actionType);
  return {
    type: metadata?.id ?? "native.note",
    adapter: metadata?.provider ?? PROVIDERS.FOUNDRY,
    name: metadata?.label ?? "Action",
    config: structuredClone(metadata?.defaultConfig ?? {}),
    failurePolicy: FAILURE_POLICIES.STOP,
    executionMode: EXECUTION_MODES.SEQUENTIAL,
    requiresConfirmation: Boolean(metadata?.requiresConfirmation),
    rollbackSupported: Boolean(metadata?.rollbackSupported)
  };
}
