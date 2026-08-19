import { DANGER_LEVELS, EXECUTION_MODES, FAILURE_POLICIES, PROVIDERS } from "../constants.js";

export const INTEGRATION_ACTION_TYPES = Object.freeze([
  {
    id: "sessionflow.trigger",
    provider: PROVIDERS.SESSIONFLOW,
    label: "Trigger SessionFlow content",
    description: "Calls confirmed SessionFlow hooks or presentation socket actions.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { operation: "callHook", hookName: "sessionflow:togglePanel", args: [] }
  },
  {
    id: "sessionflow.open",
    provider: PROVIDERS.SESSIONFLOW,
    label: "Open SessionFlow content for GM",
    description: "Opens or navigates the GM-facing SessionFlow workspace through confirmed hooks.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { operation: "togglePanel", sessionId: "", beatId: "", sceneId: "" }
  },
  {
    id: "exalted-scenes.broadcast",
    provider: PROVIDERS.EXALTED_SCENES,
    label: "Broadcast Exalted Scenes presentation",
    description: "Broadcasts scenes or starts Exalted slideshows/sequences through the confirmed public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", sceneId: "", operation: "broadcast", options: {} }
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
    defaultConfig: { externalId: "", trackId: "", trackName: "", playlistId: "", playlistName: "", tag: "", operation: "playMusic", channel: "music" }
  },
  {
    id: "narrators-jukebox.stopMusic",
    provider: PROVIDERS.NARRATORS_JUKEBOX,
    label: "Stop Narrator's Jukebox music",
    description: "Stops Director-started music where the public API supports it.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { operation: "stopMusic", channel: "music", stopAll: false }
  },
  {
    id: "narrators-jukebox.ambience",
    provider: PROVIDERS.NARRATORS_JUKEBOX,
    label: "Start or stop Narrator's Jukebox ambience",
    description: "Starts or stops an existing ambience preset or layer through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", ambienceTrackId: "", presetId: "", operation: "startAmbience", mode: "layer", volume: 1, stopAll: false }
  },
  {
    id: "narrators-jukebox.soundCue",
    provider: PROVIDERS.NARRATORS_JUKEBOX,
    label: "Play Narrator's Jukebox soundboard cue",
    description: "Plays an existing soundboard cue through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { externalId: "", soundId: "", soundName: "", operation: "playSoundCue", options: {} }
  },
  {
    id: "fxmaster.preset",
    provider: PROVIDERS.FXMASTER,
    label: "Play FXMaster preset",
    description: "Triggers an existing FXMaster preset through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    defaultConfig: { preset: "", operation: "playPreset", options: {} }
  },
  {
    id: "fxmaster.effect",
    provider: PROVIDERS.FXMASTER,
    label: "Start or stop FXMaster effect",
    description: "Starts or stops an existing Director-owned FXMaster particle or filter through a confirmed public API.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    defaultConfig: { operation: "startEffect", effects: [], particles: [], filters: [], skipFading: true }
  },
  {
    id: "fxmaster.clearDirectorEffects",
    provider: PROVIDERS.FXMASTER,
    label: "Clear Director-owned FXMaster effects",
    description: "Clears effects previously started by the Director where the public API supports owner handles.",
    dangerLevel: DANGER_LEVELS.CHANGES_SCENE,
    defaultConfig: { operation: "clearDirectorEffects", skipFading: true }
  },
  {
    id: "fxmaster.clearAll",
    provider: PROVIDERS.FXMASTER,
    label: "Dangerous: clear all FXMaster effects",
    description: "A separately labeled dangerous action requiring explicit API support and GM confirmation.",
    dangerLevel: DANGER_LEVELS.DISRUPTIVE,
    defaultConfig: { operation: "clearAll", skipFading: true, includeRegionEffects: false }
  },
  {
    id: "character-hud.present",
    provider: PROVIDERS.CHARACTER_HUD,
    label: "Trigger COTS Character HUD presentation",
    description: "Requires a confirmed Character HUD public API.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { actorUuid: "", operation: "present", mode: "gm", chatText: "", useGmSpeaker: true }
  },
  {
    id: "character-hud.stop",
    provider: PROVIDERS.CHARACTER_HUD,
    label: "Stop COTS Character HUD presentation",
    description: "Stops a Director-triggered HUD presentation where supported.",
    dangerLevel: DANGER_LEVELS.SAFE,
    defaultConfig: { operation: "stop" }
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
