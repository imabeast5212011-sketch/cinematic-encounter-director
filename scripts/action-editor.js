import { EXECUTION_MODES, FAILURE_POLICIES, MODULE_ID, RESULT_STATUS, TEMPLATE_PATHS } from "./constants.js";
import { defaultIntegrationActionPatch } from "./actions/integration-actions.js";
import { defaultActionPatch } from "./actions/native-actions.js";
import { createResult, safeInteger } from "./state/schema.js";
import { keepApplicationWindowScrollable, releaseApplicationWindowScrollable } from "./ui-window.js";

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
    const actionTypes = (await this.services.validation.getActionPickerEntries()).map((entry) => ({ ...entry, selected: entry.id === action?.type }));
    const scenes = Array.from(game.scenes?.contents ?? game.scenes ?? []).map((scene) => ({ id: scene.id, name: scene.name, uuid: scene.uuid }));
    const users = Array.from(game.users?.contents ?? game.users ?? []).map((user) => ({ id: user.id, name: user.name, isGM: user.isGM }));
    const playlists = Array.from(game.playlists?.contents ?? game.playlists ?? []).map((playlist) => ({ id: playlist.id, name: playlist.name, uuid: playlist.uuid }));
    return {
      ...context,
      sequence,
      beat,
      action,
      actionTypes,
      configJson: JSON.stringify(action?.config ?? {}, null, 2),
      preconditionJson: JSON.stringify(action?.precondition ?? {}, null, 2),
      failurePolicies: Object.values(FAILURE_POLICIES).map((value) => ({ value, selected: value === action?.failurePolicy })),
      executionModes: Object.values(EXECUTION_MODES).map((value) => ({ value, selected: value === action?.executionMode })),
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
        case "apply-controlled-lights":
          return this.applyControlledPlaceables("AmbientLight", "lightUuids", canvas?.lighting?.controlled ?? []);
        case "apply-controlled-walls":
          return this.applyControlledPlaceables("Wall", "wallUuids", canvas?.walls?.controlled ?? []);
        case "apply-users":
          return this.applySelectedUsers();
        case "apply-playlist":
          return this.applyPlaylist();
        default:
          return;
      }
    } catch (error) {
      notify(createResult(RESULT_STATUS.FAILURE, error?.message ?? String(error)));
    }
  }

  formData() {
    const form = appElement(this)?.querySelector("[data-form='action']");
    return form ? Object.fromEntries(new FormData(form).entries()) : {};
  }

  async saveAction() {
    const data = this.formData();
    const actionType = data.type;
    const defaults = actionType?.startsWith("native.") ? defaultActionPatch(actionType) : defaultIntegrationActionPatch(actionType);
    const config = JSON.parse(String(data.configJson || "{}"));
    const precondition = JSON.parse(String(data.preconditionJson || "{}"));
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
    } else {
      config.tokenUuids = docs.map((doc) => doc.uuid);
    }
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
    this.writeConfigDraft(config);
  }

  applySelectedUsers() {
    const element = appElement(this);
    const selected = Array.from(element?.querySelector("[data-field='picker-users']")?.selectedOptions ?? []).map((option) => option.value);
    const config = this.readConfigDraft();
    config.userIds = selected;
    config.scope = selected.length ? "selectedUsers" : config.scope;
    this.writeConfigDraft(config);
  }

  applyPlaylist() {
    const element = appElement(this);
    const uuid = element?.querySelector("[data-field='picker-playlist']")?.value;
    if (!uuid) return;
    const config = this.readConfigDraft();
    config.playlistUuid = uuid;
    this.writeConfigDraft(config);
  }

  async close(options) {
    releaseApplicationWindowScrollable(this);
    await super.close(options);
    this.onCloseCallback?.();
  }
}
