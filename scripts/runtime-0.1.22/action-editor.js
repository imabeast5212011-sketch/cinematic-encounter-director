import { MODULE_ID, MODULE_VERSION, RESULT_STATUS, TEMPLATE_PATHS } from "./constants.js";
import { defaultIntegrationActionPatch } from "./actions/integration-actions.js";
import { defaultActionPatch } from "./actions/native-actions.js";
import { createResult, safeInteger } from "./state/schema.js";
import { keepApplicationWindowScrollable, releaseApplicationWindowScrollable } from "./ui-window.js";
import { actionEditorModel, executionModeOptions, failurePolicyOptions } from "./ui-presenters.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function appElement(app) {
  return app.element instanceof HTMLElement ? app.element : app.element?.[0] ?? null;
}

function notify(result) {
  if (result.status === RESULT_STATUS.FAILURE) ui.notifications?.error(result.message);
  else if ([RESULT_STATUS.WARNING, RESULT_STATUS.UNSUPPORTED].includes(result.status)) ui.notifications?.warn(result.message);
  else ui.notifications?.info(result.message);
}

function orderedBeats(sequence) {
  const byId = new Map((sequence?.beats ?? []).map((beat) => [beat.id, beat]));
  const ordered = (sequence?.beatIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  const missing = (sequence?.beats ?? []).filter((beat) => !(sequence?.beatIds ?? []).includes(beat.id));
  return [...ordered, ...missing];
}

function parseListField(value) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJsonField(value, fallback) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return JSON.parse(text);
}

function setInputValue(element, selector, value) {
  const input = element?.querySelector(selector);
  if (input) input.value = value;
}

export class ActionEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-action-editor`,
    classes: [MODULE_ID, "ced-action-editor"],
    tag: "section",
    window: {
      title: "Encounter Action Editor",
      icon: "fa-solid fa-bolt",
      resizable: true
    },
    position: {
      width: 760,
      height: 680
    }
  };

  static PARTS = {
    main: {
      template: TEMPLATE_PATHS.ACTION_EDITOR
    }
  };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
    this.selectedSequenceId = options.selectedSequenceId;
    this.selectedBeatId = options.selectedBeatId;
    this.selectedActionId = options.selectedActionId;
    this.onCloseCallback = options.onClose;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beat = orderedBeats(sequence).find((entry) => entry.id === this.selectedBeatId);
    const action = this.services.validation.getOrderedActions(beat).find((entry) => entry.id === this.selectedActionId);
    const metadata = this.services.validation.getActionMetadata(action?.type);
    const form = actionEditorModel(action, metadata);
    const actionTypes = (await this.services.validation.getActionPickerEntries()).map((entry) => {
      const selected = entry.id === action?.type;
      return { ...entry, selected, disabled: !entry.available && !selected };
    });
    const selectedSceneUuid = action?.config?.sceneUuid ?? "";
    const selectedUsers = new Set(action?.config?.userIds ?? []);
    const selectedPlaylistUuid = action?.config?.playlistUuid ?? "";
    const scenes = Array.from(game.scenes?.contents ?? game.scenes ?? []).map((scene) => ({ id: scene.id, name: scene.name, uuid: scene.uuid, selected: scene.uuid === selectedSceneUuid }));
    const users = Array.from(game.users?.contents ?? game.users ?? []).map((user) => ({ id: user.id, name: user.name, isGM: user.isGM, selected: selectedUsers.has(user.id) }));
    const playlists = Array.from(game.playlists?.contents ?? game.playlists ?? []).map((playlist) => ({ id: playlist.id, name: playlist.name, uuid: playlist.uuid, selected: playlist.uuid === selectedPlaylistUuid }));
    return {
      ...context,
      sequence,
      moduleVersion: MODULE_VERSION,
      beat,
      action,
      form,
      actionTypes,
      configJson: JSON.stringify(action?.config ?? {}, null, 2),
      preconditionJson: JSON.stringify(action?.precondition ?? {}, null, 2),
      failurePolicies: failurePolicyOptions(action?.failurePolicy),
      executionModes: executionModeOptions(action?.executionMode),
      scenes,
      users,
      playlists,
      isGM: Boolean(game.user?.isGM)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    keepApplicationWindowScrollable(this, { minWidth: 420, minHeight: 340 });
    const element = appElement(this);
    if (!element) return;
    element.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        void this.handleAction(event.currentTarget.dataset);
      });
    });
  }

  async handleAction(dataset) {
    try {
      switch (dataset.action) {
        case "save-action":
          return this.saveAction();
        case "reset-default-config":
          return this.resetDefaultConfig();
        case "validate-action":
          return this.validateAction();
        case "apply-scene":
          return this.applySceneUuid();
        case "apply-controlled-tokens":
          return this.applyControlledTokens();
        case "apply-controlled-actors":
          return this.applyControlledActors();
        case "apply-controlled-lights":
          return this.applyControlledPlaceables("AmbientLight", "lightUuids", canvas?.lighting?.controlled ?? []);
        case "apply-controlled-walls":
          return this.applyControlledPlaceables("Wall", "wallUuids", canvas?.walls?.controlled ?? []);
        case "apply-users":
          return this.applySelectedUsers();
        case "apply-playlist":
          return this.applyPlaylist();
        case "apply-current-camera":
          return this.applyCurrentCamera();
        default:
          return;
      }
    } catch (error) {
      notify(createResult(RESULT_STATUS.FAILURE, error?.message ?? String(error)));
    }
  }

  formData() {
    const form = appElement(this)?.querySelector("[data-form='action']");
    if (!form) return {};
    const fd = new FormData(form);
    const data = {};
    for (const key of new Set(fd.keys())) {
      const values = fd.getAll(key);
      data[key] = values.length > 1 ? values : values[0];
    }
    return data;
  }

  async saveAction() {
    const data = this.formData();
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beat = orderedBeats(sequence).find((entry) => entry.id === this.selectedBeatId);
    const action = this.services.validation.getOrderedActions(beat).find((entry) => entry.id === this.selectedActionId);
    const actionType = data.type;
    const defaults = actionType?.startsWith("native.") ? defaultActionPatch(actionType) : defaultIntegrationActionPatch(actionType);
    const baseConfig = action?.type === actionType ? action?.config ?? {} : defaults.config ?? {};
    const config = data.useAdvancedConfig === "on"
      ? parseJsonField(data.configJson, {})
      : this.buildConfigFromForm(actionType, baseConfig, data);
    const precondition = parseJsonField(data.preconditionJson, {});
    await this.services.store.updateAction(this.selectedSequenceId, this.selectedBeatId, this.selectedActionId, {
      type: actionType,
      adapter: defaults.adapter,
      name: data.name,
      enabled: data.enabled === "on",
      requiresConfirmation: data.requiresConfirmation === "on",
      failurePolicy: data.failurePolicy,
      executionMode: data.executionMode,
      parallelGroup: data.parallelGroup,
      delayAfterMs: safeInteger(data.delayAfterMs, 0, 60000, 0),
      config,
      precondition,
      rollbackSupported: defaults.rollbackSupported
    });
    notify(createResult(RESULT_STATUS.SUCCESS, "Action saved."));
    this.render({ force: true });
  }

  buildConfigFromForm(actionType, baseConfig, data) {
    const config = { ...(baseConfig ?? {}) };
    const setIfPresent = (field, key = field) => {
      if (Object.hasOwn(data, field)) config[key] = data[field];
    };
    const setNumberIfPresent = (field, key = field, fallback = 0) => {
      if (Object.hasOwn(data, field)) config[key] = Number.isFinite(Number(data[field])) ? Number(data[field]) : fallback;
    };
    const setBoolIfPresent = (field, key = field) => {
      if (Object.hasOwn(data, field)) config[key] = data[field] === "true" || data[field] === "on";
    };
    const setListIfPresent = (field, key = field) => {
      if (Object.hasOwn(data, field)) config[key] = parseListField(data[field]);
    };

    if (["native.note", "native.chatMessage"].includes(actionType)) {
      setIfPresent("message");
      if (actionType === "native.chatMessage") config.whisperGmOnly = data.whisperGmOnly === "on";
    }
    if (actionType === "native.waitForConfirmation") setIfPresent("message", "prompt");
    if (actionType === "native.delay") setNumberIfPresent("durationMs", "durationMs", 1000);
    if (["native.preloadScene", "native.viewScene", "native.activateScene", "native.setSceneDarkness", "native.updateSceneEnvironment", "native.createCombat"].includes(actionType)) {
      setIfPresent("sceneUuid");
    }
    if (actionType === "native.setSceneDarkness") setNumberIfPresent("darkness", "darkness", 0.5);
    if (actionType === "native.updateSceneEnvironment") config.updates = parseJsonField(data.updatesJson, config.updates ?? {});
    if (actionType === "native.updateAmbientLights") {
      setListIfPresent("lightUuids");
      config.updates = parseJsonField(data.updatesJson, config.updates ?? {});
    }
    if (actionType === "native.updateWallsDoors") {
      setListIfPresent("wallUuids");
      config.updates = parseJsonField(data.updatesJson, config.updates ?? {});
    }
    if (["native.setTokenVisibility", "native.updateTokenElevation", "native.updateTokenDisposition", "native.addTokensToCombat"].includes(actionType)) {
      setListIfPresent("tokenUuids");
    }
    if (actionType === "native.setTokenVisibility") config.hidden = data.hidden === "true";
    if (actionType === "native.moveTokens") config.moves = parseJsonField(data.movesJson, config.moves ?? []);
    if (actionType === "native.updateTokenElevation") setNumberIfPresent("elevation", "elevation", 0);
    if (actionType === "native.updateTokenDisposition") setNumberIfPresent("disposition", "disposition", 0);
    if (actionType === "native.addTokensToCombat") config.createCombatIfMissing = data.createCombatIfMissing === "on";
    if (["native.removeCombatants", "native.startCombat", "native.endCombat", "native.setCombatRoundTurn"].includes(actionType)) {
      setIfPresent("combatUuid");
    }
    if (actionType === "native.removeCombatants") setListIfPresent("combatantIds");
    if (actionType === "native.setCombatRoundTurn") {
      config.round = data.round === "" || data.round === undefined ? null : Number(data.round);
      config.turn = data.turn === "" || data.turn === undefined ? null : Number(data.turn);
    }
    if (actionType === "native.panCamera") {
      setIfPresent("scope");
      config.userIds = Array.isArray(data.userIds) ? data.userIds : parseListField(data.userIds);
      setNumberIfPresent("x", "x", 0);
      setNumberIfPresent("y", "y", 0);
      config.scale = data.scale === "" || data.scale === undefined ? null : Number(data.scale);
      setNumberIfPresent("duration", "duration", 1000);
    }
    if (actionType === "native.pauseGame") setBoolIfPresent("paused");
    if (actionType === "native.playlistCue") {
      setIfPresent("playlistUuid");
      setIfPresent("soundId");
      setIfPresent("operation");
    }
    if (["native.giveItemToActor", "native.removeItemFromActor", "native.requestRoll"].includes(actionType)) {
      setListIfPresent("actorUuids");
    }
    if (["native.giveItemToActor", "native.removeItemFromActor"].includes(actionType)) {
      setIfPresent("itemUuid");
      setNumberIfPresent("quantity", "quantity", 1);
    }
    if (actionType === "native.giveItemToActor") {
      config.itemData = parseJsonField(data.itemDataJson, config.itemData ?? {});
      config.stack = data.stack === "on";
    }
    if (actionType === "native.removeItemFromActor") {
      setIfPresent("itemId");
      setIfPresent("itemName");
      config.removeAll = data.removeAll === "on";
    }
    if (actionType === "native.createJournalHandout") {
      setIfPresent("journalName", "name");
      setIfPresent("pageName");
      setIfPresent("journalContent", "content");
      setIfPresent("ownershipLevel");
      config.showToPlayers = data.showToPlayers === "on";
    }
    if (actionType === "native.showJournalHandout") {
      setIfPresent("journalUuid");
      setIfPresent("pageId");
      setListIfPresent("userIds");
      config.showToPlayers = data.showToPlayers === "on";
      config.createChatLinkFallback = data.createChatLinkFallback === "on";
    }
    if (actionType === "native.requestRoll") {
      setIfPresent("rollPrompt", "prompt");
      setIfPresent("formula");
      setIfPresent("dc");
      setIfPresent("rollType");
      setListIfPresent("userIds");
      config.whisper = data.whisper === "on";
    }
    if (!actionType?.startsWith("native.")) {
      for (const field of [
        "operation",
        "externalId",
        "sessionId",
        "beatId",
        "sceneId",
        "hookName",
        "trackId",
        "trackName",
        "playlistId",
        "playlistName",
        "ambienceTrackId",
        "presetId",
        "soundId",
        "soundName",
        "tag",
        "channel",
        "preset",
        "actorUuid",
        "mode",
        "chatText",
        "countdownId"
      ]) {
        setIfPresent(field);
      }
      if (Object.hasOwn(data, "volume")) setNumberIfPresent("volume", "volume", 1);
      if (Object.hasOwn(data, "argsJson")) config.args = parseJsonField(data.argsJson, config.args ?? []);
      if (Object.hasOwn(data, "optionsJson")) config.options = parseJsonField(data.optionsJson, config.options ?? {});
      if (Object.hasOwn(data, "effectsJson")) config.effects = parseJsonField(data.effectsJson, config.effects ?? []);
      if (Object.hasOwn(data, "particlesJson")) config.particles = parseJsonField(data.particlesJson, config.particles ?? []);
      if (Object.hasOwn(data, "filtersJson")) config.filters = parseJsonField(data.filtersJson, config.filters ?? []);
      config.stopAll = data.stopAll === "on";
      config.skipFading = data.skipFading === "on";
      config.useGmSpeaker = data.useGmSpeaker === "on";
      config.includeRegionEffects = data.includeRegionEffects === "on";
    }
    return config;
  }

  async resetDefaultConfig() {
    const data = this.formData();
    const defaults = data.type?.startsWith("native.") ? defaultActionPatch(data.type) : defaultIntegrationActionPatch(data.type);
    await this.services.store.updateAction(this.selectedSequenceId, this.selectedBeatId, this.selectedActionId, defaults);
    this.render({ force: true });
  }

  async validateAction() {
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beat = orderedBeats(sequence).find((entry) => entry.id === this.selectedBeatId);
    const action = this.services.validation.getOrderedActions(beat).find((entry) => entry.id === this.selectedActionId);
    const result = await this.services.validation.validateAction(action, { sequence, beat });
    await this.services.store.recordActionValidation(sequence.id, beat.id, action.id, result);
    notify(result);
    this.render({ force: true });
  }

  configTextarea() {
    return appElement(this)?.querySelector("[name='configJson']");
  }

  readConfigDraft() {
    return JSON.parse(String(this.configTextarea()?.value || "{}"));
  }

  writeConfigDraft(config) {
    const textarea = this.configTextarea();
    if (textarea) textarea.value = JSON.stringify(config, null, 2);
  }

  applySceneUuid() {
    const element = appElement(this);
    const uuid = element?.querySelector("[data-field='picker-scene']")?.value;
    if (!uuid) return;
    setInputValue(element, "[name='sceneUuid']", uuid);
    const config = this.readConfigDraft();
    config.sceneUuid = uuid;
    this.writeConfigDraft(config);
  }

  applyControlledTokens() {
    const tokens = canvas?.tokens?.controlled ?? [];
    const docs = tokens.map((token) => token.document).filter(Boolean);
    if (!docs.length) {
      notify(createResult(RESULT_STATUS.WARNING, "No controlled Tokens are selected."));
      return;
    }
    const config = this.readConfigDraft();
    if (String(this.formData().type) === "native.moveTokens") {
      config.moves = docs.map((doc) => ({ tokenUuid: doc.uuid, x: doc.x ?? 0, y: doc.y ?? 0 }));
      setInputValue(appElement(this), "[name='movesJson']", JSON.stringify(config.moves, null, 2));
    } else {
      config.tokenUuids = docs.map((doc) => doc.uuid);
      setInputValue(appElement(this), "[name='tokenUuids']", config.tokenUuids.join(", "));
    }
    this.writeConfigDraft(config);
  }

  applyControlledActors() {
    const tokens = canvas?.tokens?.controlled ?? [];
    const docs = tokens.map((token) => token.document).filter(Boolean);
    if (!docs.length) {
      notify(createResult(RESULT_STATUS.WARNING, "No controlled Tokens are selected."));
      return;
    }
    const config = this.readConfigDraft();
    config.actorUuids = docs.map((doc) => doc.uuid);
    setInputValue(appElement(this), "[name='actorUuids']", config.actorUuids.join(", "));
    this.writeConfigDraft(config);
  }

  applyControlledPlaceables(documentName, field, placeables) {
    const docs = Array.from(placeables ?? []).map((placeable) => placeable.document).filter((doc) => doc?.documentName === documentName);
    if (!docs.length) {
      notify(createResult(RESULT_STATUS.WARNING, `No controlled ${documentName} documents are selected.`));
      return;
    }
    const config = this.readConfigDraft();
    config[field] = docs.map((doc) => doc.uuid);
    setInputValue(appElement(this), `[name='${field}']`, config[field].join(", "));
    this.writeConfigDraft(config);
  }

  applySelectedUsers() {
    const element = appElement(this);
    const selected = Array.from(element?.querySelector("[data-field='picker-users']")?.selectedOptions ?? []).map((option) => option.value);
    const config = this.readConfigDraft();
    config.userIds = selected;
    config.scope = selected.length ? "selectedUsers" : config.scope;
    setInputValue(element, "[name='scope']", config.scope);
    this.writeConfigDraft(config);
  }

  applyPlaylist() {
    const element = appElement(this);
    const uuid = element?.querySelector("[data-field='picker-playlist']")?.value;
    if (!uuid) return;
    const config = this.readConfigDraft();
    config.playlistUuid = uuid;
    setInputValue(element, "[name='playlistUuid']", uuid);
    this.writeConfigDraft(config);
  }

  applyCurrentCamera() {
    const element = appElement(this);
    const pivot = canvas?.stage?.pivot ?? canvas?.scene?._viewPosition ?? {};
    const scale = canvas?.stage?.scale?.x ?? canvas?.scene?._viewPosition?.scale ?? "";
    const x = Math.round(Number(pivot.x ?? 0));
    const y = Math.round(Number(pivot.y ?? 0));
    setInputValue(element, "[name='x']", x);
    setInputValue(element, "[name='y']", y);
    if (scale) setInputValue(element, "[name='scale']", Number(scale).toFixed(2));
    const config = this.readConfigDraft();
    config.x = x;
    config.y = y;
    if (scale) config.scale = Number(scale);
    this.writeConfigDraft(config);
  }

  async close(options) {
    releaseApplicationWindowScrollable(this);
    await super.close(options);
    this.onCloseCallback?.();
  }
}
