import { FAILURE_POLICIES, MODULE_ID, MODULE_TITLE, SETTINGS } from "./constants.js";

function registerWorldSetting(key, data) {
  game.settings.register(MODULE_ID, key, {
    scope: "world",
    config: true,
    ...data
  });
}

function registerClientSetting(key, data) {
  game.settings.register(MODULE_ID, key, {
    scope: "client",
    config: true,
    ...data
  });
}

export function registerSettings(onChange) {
  const rerender = () => {
    if (typeof onChange === "function") onChange();
  };

  registerWorldSetting(SETTINGS.ENABLED, {
    name: `${MODULE_TITLE}: Enable Director`,
    hint: "Controls whether the GM Director interface and execution controls are available.",
    type: Boolean,
    default: true,
    onChange: rerender
  });

  for (const [key, label] of [
    [SETTINGS.PERMIT_SESSIONFLOW, "Permit SessionFlow integration"],
    [SETTINGS.PERMIT_EXALTED_SCENES, "Permit Exalted Scenes integration"],
    [SETTINGS.PERMIT_NARRATORS_JUKEBOX, "Permit Narrator's Jukebox integration"],
    [SETTINGS.PERMIT_FXMASTER, "Permit FXMaster integration"],
    [SETTINGS.PERMIT_CHARACTER_HUD, "Permit COTS Character HUD integration"],
    [SETTINGS.PERMIT_COMBAT_TIMELINE, "Permit Cinematic Combat Timeline integration"]
  ]) {
    registerWorldSetting(key, {
      name: `${MODULE_TITLE}: ${label}`,
      type: Boolean,
      default: true,
      onChange: rerender
    });
  }

  registerWorldSetting(SETTINGS.REQUIRE_SCENE_ACTIVATION_CONFIRMATION, {
    name: `${MODULE_TITLE}: Confirm Scene activation`,
    type: Boolean,
    default: true
  });

  registerWorldSetting(SETTINGS.REQUIRE_COMBAT_DANGER_CONFIRMATION, {
    name: `${MODULE_TITLE}: Confirm combat-ending and turn-changing actions`,
    type: Boolean,
    default: true
  });

  registerWorldSetting(SETTINGS.DEFAULT_BEAT_FAILURE_POLICY, {
    name: `${MODULE_TITLE}: Default Beat failure policy`,
    type: String,
    choices: {
      [FAILURE_POLICIES.STOP]: "Stop on failure",
      [FAILURE_POLICIES.CONTINUE]: "Continue past noncritical failures",
      [FAILURE_POLICIES.SKIP_REMAINING]: "Skip remaining actions"
    },
    default: FAILURE_POLICIES.STOP
  });

  registerWorldSetting(SETTINGS.EXECUTION_LOG_RETENTION, {
    name: `${MODULE_TITLE}: Execution-log retention limit`,
    hint: "Number of execution log entries retained per Scene.",
    type: Number,
    range: { min: 25, max: 1000, step: 25 },
    default: 200
  });

  registerWorldSetting(SETTINGS.ENABLE_NATIVE_PLAYLIST_FALLBACK, {
    name: `${MODULE_TITLE}: Enable native Playlist fallback actions`,
    hint: "This does not translate Narrator's Jukebox entries. It only enables distinct Foundry Playlist actions.",
    type: Boolean,
    default: false,
    onChange: rerender
  });

  registerClientSetting(SETTINGS.WINDOW_POSITION, {
    name: `${MODULE_TITLE}: Director window position`,
    type: Object,
    config: false,
    default: {}
  });

  registerClientSetting(SETTINGS.WINDOW_SIZE, {
    name: `${MODULE_TITLE}: Director window size`,
    type: Object,
    config: false,
    default: { width: 900, height: 700 }
  });

  registerClientSetting(SETTINGS.COMPACT_MODE, {
    name: `${MODULE_TITLE}: Compact mode`,
    type: Boolean,
    default: false,
    onChange: rerender
  });

  registerClientSetting(SETTINGS.SHOW_INTEGRATION_HEALTH, {
    name: `${MODULE_TITLE}: Show integration health indicators`,
    type: Boolean,
    default: true,
    onChange: rerender
  });

  registerClientSetting(SETTINGS.SHOW_ADVANCED_ACTION_DETAILS, {
    name: `${MODULE_TITLE}: Show advanced Action details`,
    type: Boolean,
    default: false,
    onChange: rerender
  });

  registerClientSetting(SETTINGS.REDUCED_ANIMATION, {
    name: `${MODULE_TITLE}: Reduced animation`,
    type: Boolean,
    default: false,
    onChange: rerender
  });

  registerClientSetting(SETTINGS.CONFIRM_BEFORE_RUN_BEAT, {
    name: `${MODULE_TITLE}: Confirm before running an entire Beat`,
    type: Boolean,
    default: true
  });

  registerClientSetting(SETTINGS.AUTO_SELECT_NEXT_BEAT, {
    name: `${MODULE_TITLE}: Automatically select next Beat after successful completion`,
    type: Boolean,
    default: false
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

export function isIntegrationPermitted(settingKey) {
  if (!settingKey) return true;
  return Boolean(getSetting(settingKey));
}
