import { DANGER_LEVELS, EXECUTION_MODES, FAILURE_POLICIES, PROVIDERS } from "../constants.js";

export const INTEGRATION_ACTION_TYPES = Object.freeze([
  {
    id: "sessionflow.trigger",
    provider: PROVIDERS.SESSIONFLOW,
    label: "Trigger SessionFlow content",
    description: "Requires a confirmed SessionFlow public API exposed for Encounter Director.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "trigger" }
  },
  {
    id: "sessionflow.open",
    provider: PROVIDERS.SESSIONFLOW,
    label: "Open SessionFlow content for GM",
    description: "Requires a confirmed local GM-facing SessionFlow public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "open" }
  },
  {
    id: "exalted-scenes.broadcast",
    provider: PROVIDERS.EXALTED_SCENES,
    label: "Broadcast Exalted Scenes presentation",
    description: "References existing Exalted Scenes content through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "broadcast" }
  },
  {
    id: "exalted-scenes.stop",
    provider: PROVIDERS.EXALTED_SCENES,
    label: "Stop Exalted Scenes presentation",
    description: "Stops or clears a Director-triggered presentation where the public API supports it.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "stop" }
  },
  {
    id: "narrators-jukebox.playMusic",
    provider: PROVIDERS.NARRATORS_JUKEBOX,
    label: "Play Narrator's Jukebox music",
    description: "Plays an existing Jukebox entry through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "playMusic" }
  },
  {
    id: "narrators-jukebox.stopMusic",
    provider: PROVIDERS.NARRATORS_JUKEBOX,
    label: "Stop Narrator's Jukebox music",
    description: "Stops Director-started music where the public API supports it.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "stopMusic" }
  },
  {
    id: "narrators-jukebox.ambience",
    provider: PROVIDERS.NARRATORS_JUKEBOX,
    label: "Start or stop Narrator's Jukebox ambience",
    description: "Starts or stops an existing ambience preset or layer through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "startAmbience" }
  },
  {
    id: "narrators-jukebox.soundCue",
    provider: PROVIDERS.NARRATORS_JUKEBOX,
    label: "Play Narrator's Jukebox soundboard cue",
    description: "Plays an existing soundboard cue through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "playSoundCue" }
  },
  {
    id: "fxmaster.preset",
    provider: PROVIDERS.FXMASTER,
    label: "Play FXMaster preset",
    description: "Triggers an existing FXMaster preset through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    defaultConfig: { externalId: "", operation: "playPreset" }
  },
  {
    id: "fxmaster.effect",
    provider: PROVIDERS.FXMASTER,
    label: "Start or stop FXMaster effect",
    description: "Starts or stops an existing Director-owned FXMaster particle or filter through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    defaultConfig: { externalId: "", operation: "startEffect" }
  },
  {
    id: "fxmaster.clearDirectorEffects",
    provider: PROVIDERS.FXMASTER,
    label: "Clear Director-owned FXMaster effects",
    description: "Clears effects previously started by the Director where the public API supports owner handles.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    defaultConfig: { operation: "clearDirectorEffects" }
  },
  {
    id: "fxmaster.clearAll",
    provider: PROVIDERS.FXMASTER,
    label: "Dangerous: clear all FXMaster effects",
    description: "A separately labeled dangerous action requiring explicit API support and GM confirmation.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    defaultConfig: { operation: "clearAll" }
  },
  {
    id: "character-hud.present",
    provider: PROVIDERS.CHARACTER_HUD,
    label: "Trigger COTS Character HUD presentation",
    description: "Requires a confirmed Character HUD public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "present" }
  },
  {
    id: "character-hud.stop",
    provider: PROVIDERS.CHARACTER_HUD,
    label: "Stop COTS Character HUD presentation",
    description: "Stops a Director-triggered HUD presentation where supported.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", operation: "stop" }
  },
  {
    id: "combat-timeline.openConfig",
    provider: PROVIDERS.COMBAT_TIMELINE,
    label: "Open Combat Timeline countdown config",
    description: "Uses the confirmed Cinematic Combat Timeline public API in local version 0.1.13.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { operation: "openCountdownConfig" }
  },
  {
    id: "combat-timeline.countdown",
    provider: PROVIDERS.COMBAT_TIMELINE,
    label: "Combat Timeline countdown mutation",
    description: "Requires a future confirmed countdown public API. Local version 0.1.13 does not expose one.",
    dangerLevel: DANGER_LEVELS.CHANGES_COMBAT,
    defaultConfig: { countdownId: "", operation: "create" }
  }
]);

export const INTEGRATION_ACTIONS_BY_ID = new Map(INTEGRATION_ACTION_TYPES.map((action) => [action.id, action]));

export function getIntegrationActionType(actionType) {
  return INTEGRATION_ACTIONS_BY_ID.get(actionType) ?? null;
}

export function defaultIntegrationActionPatch(actionType) {
  const metadata = getIntegrationActionType(actionType);
  return {
    type: metadata?.id ?? "sessionflow.trigger",
    adapter: metadata?.provider ?? PROVIDERS.SESSIONFLOW,
    name: metadata?.label ?? "Integration Action",
    config: structuredClone(metadata?.defaultConfig ?? {}),
    failurePolicy: FAILURE_POLICIES.STOP,
    executionMode: EXECUTION_MODES.SEQUENTIAL,
    rollbackSupported: false
  };
}
