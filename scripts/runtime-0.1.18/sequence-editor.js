import { DANGER_LEVELS, MODULE_ID, MODULE_VERSION, RESULT_STATUS, TEMPLATE_PATHS, TRIGGER_ACTIONS, TRIGGER_EVENTS } from "./constants.js";
import { defaultIntegrationActionPatch } from "./actions/integration-actions.js";
import { defaultActionPatch } from "./actions/native-actions.js";
import { ActionEditor } from "./action-editor.js";
import { createResult, normalizeTrigger, safeBoolean } from "./state/schema.js";
import { keepApplicationWindowScrollable, releaseApplicationWindowScrollable } from "./ui-window.js";
import { decorateAction, decorateBeat, triggerEditorModel } from "./ui-presenters.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function appElement(app) {
  return app.element instanceof HTMLElement ? app.element : app.element?.[0] ?? null;
}

function applyEditorLayoutMode(element) {
  const layout = element?.querySelector?.(".ced-editor-layout");
  if (!layout) return;
  const width = layout.getBoundingClientRect?.().width || layout.clientWidth || 0;
  const useGrid = width >= 480;
  layout.classList.toggle("is-stack", !useGrid);
  layout.classList.toggle("is-compact-grid", useGrid);
}

function orderedBeats(sequence) {
  const byId = new Map((sequence?.beats ?? []).map((beat) => [beat.id, beat]));
  const ordered = (sequence?.beatIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  const missing = (sequence?.beats ?? []).filter((beat) => !(sequence?.beatIds ?? []).includes(beat.id));
  return [...ordered, ...missing];
}

function notify(result) {
  if (result.status === RESULT_STATUS.FAILURE) ui.notifications?.error(result.message);
  else if (result.status === RESULT_STATUS.WARNING) ui.notifications?.warn(result.message);
  else ui.notifications?.info(result.message);
}

function activeScene() {
  return canvas?.scene ?? game.scenes?.viewed ?? game.scenes?.active ?? game.scenes?.current ?? null;
}

function controlledTokenDocuments() {
  return (canvas?.tokens?.controlled ?? []).map((token) => token.document).filter(Boolean);
}

function selectedTokenTriggerRefs() {
  const tokens = controlledTokenDocuments();
  return {
    tokenUuids: tokens.map((token) => token.uuid).filter(Boolean),
    actorUuids: tokens.map((token) => token.actor?.uuid).filter(Boolean)
  };
}

function parseListField(value) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function confirmText(title, content) {
  if (globalThis.Dialog?.confirm) {
    return Dialog.confirm({ title, content: `<p>${foundry.utils.escapeHTML(content)}</p>`, defaultYes: false });
  }
  return globalThis.confirm?.(`${title}\n\n${content}`) ?? false;
}

export class SequenceEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-sequence-editor`,
    classes: [MODULE_ID, "ced-sequence-editor"],
    tag: "section",
    window: {
      title: "Encounter Sequence Editor",
      icon: "fa-solid fa-list-check",
      resizable: true
    },
    position: {
      width: 1180,
      height: 720
    }
  };

  static PARTS = {
    main: {
      template: TEMPLATE_PATHS.SEQUENCE_EDITOR
    }
  };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
    this.selectedSequenceId = options.selectedSequenceId ?? "";
    this.selectedBeatId = options.selectedBeatId ?? "";
    this.onCloseCallback = options.onClose;
    this._cedLayoutObserver = null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beats = orderedBeats(sequence);
    if (!this.selectedBeatId && beats.length) this.selectedBeatId = beats[0].id;
    const selectedBeat = beats.find((beat) => beat.id === this.selectedBeatId) ?? beats[0] ?? null;
    const actions = selectedBeat ? this.services.validation.getOrderedActions(selectedBeat) : [];
    const actionDisplays = actions.map((action, index) => decorateAction(action, index, this.services.validation.getActionMetadata(action.type)));
    const beatDisplays = beats.map((beat, index) => {
      const beatActions = this.services.validation.getOrderedActions(beat)
        .map((action, actionIndex) => decorateAction(action, actionIndex, this.services.validation.getActionMetadata(action.type)));
      return {
        ...decorateBeat(beat, index, beatActions, [sequence]),
        selected: beat.id === selectedBeat?.id
      };
    });
    const triggerDisplays = (selectedBeat?.triggers ?? []).map((trigger, index) => triggerEditorModel(trigger, index, beats, [sequence]));
    const actionTypes = (await this.services.validation.getActionPickerEntries()).map((entry) => ({
      ...entry,
      disabled: !entry.available
    }));

    return {
      ...context,
      sequence,
      moduleVersion: MODULE_VERSION,
      beats: beats.map((beat, index) => ({ ...beat, index: index + 1, selected: beat.id === selectedBeat?.id })),
      beatDisplays,
      selectedBeat,
      actions,
      actionDisplays,
      triggerDisplays,
      actionTypes,
      dangerLevels: Object.values(DANGER_LEVELS).map((value) => ({ value, selected: value === selectedBeat?.dangerLevel })),
      triggersJson: JSON.stringify(selectedBeat?.triggers ?? [], null, 2),
      activeSceneName: activeScene()?.name ?? "No active Scene",
      selectedTokenCount: controlledTokenDocuments().length,
      isGM: Boolean(game.user?.isGM)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    keepApplicationWindowScrollable(this, { minWidth: 760, minHeight: 420, fillWidth: true, fillHeight: true });
    const element = appElement(this);
    if (!element) return;
    this._cedLayoutObserver?.disconnect();
    applyEditorLayoutMode(element);
    globalThis.requestAnimationFrame?.(() => applyEditorLayoutMode(element));
    const layout = element.querySelector(".ced-editor-layout");
    if (layout && globalThis.ResizeObserver) {
      this._cedLayoutObserver = new ResizeObserver(() => applyEditorLayoutMode(element));
      this._cedLayoutObserver.observe(layout);
    }
    element.querySelectorAll("[data-action]").forEach((control) => {
      control.addEventListener("click", (event) => {
        event.preventDefault();
        void this.handleAction(event.currentTarget.dataset);
      });
    });
  }

  async handleAction(dataset) {
    try {
      switch (dataset.action) {
        case "save-sequence":
          return this.saveSequence();
        case "bind-current-scene":
          return this.bindCurrentScene();
        case "add-combat-setup":
          return this.addCombatSetup();
        case "add-reinforcement-wave":
          return this.addReinforcementWave();
        case "add-enemy-count-trigger":
          return this.addEnemyCountTrigger();
        case "add-hp-threshold-trigger":
          return this.addHpThresholdTrigger();
        case "add-ally-death-trigger":
          return this.addAllyDeathTrigger();
        case "add-beat":
          return this.addBeat();
        case "select-beat":
          this.selectedBeatId = dataset.beatId;
          return this.render({ force: true });
        case "save-beat":
          return this.saveBeat();
        case "duplicate-beat":
          return this.duplicateBeat(dataset.beatId);
        case "delete-beat":
          return this.deleteBeat(dataset.beatId);
        case "move-beat":
          await this.services.store.moveBeat(this.selectedSequenceId, dataset.beatId, dataset.direction);
          return this.render({ force: true });
        case "add-action":
          return this.addAction();
        case "edit-action":
          return this.openActionEditor(dataset.actionId);
        case "duplicate-action":
          await this.services.store.duplicateAction(this.selectedSequenceId, this.selectedBeatId, dataset.actionId);
          return this.render({ force: true });
        case "delete-action":
          return this.deleteAction(dataset.actionId);
        case "move-action":
          await this.services.store.moveAction(this.selectedSequenceId, this.selectedBeatId, dataset.actionId, dataset.direction);
          return this.render({ force: true });
        case "toggle-action":
          return this.toggleAction(dataset.actionId);
        case "validate-sequence":
          return this.validateSelectedBeat();
        default:
          return;
      }
    } catch (error) {
      notify(createResult(RESULT_STATUS.FAILURE, error?.message ?? String(error)));
      this.render({ force: true });
    }
  }

  formData(selector) {
    const form = appElement(this)?.querySelector(selector);
    return form ? Object.fromEntries(new FormData(form).entries()) : {};
  }

  async saveSequence() {
    const data = this.formData("[data-form='sequence']");
    await this.services.store.updateSequence(this.selectedSequenceId, {
      name: data.name,
      description: data.description,
      gmNotes: data.gmNotes,
      enabled: safeBoolean(data.enabled === "on", false),
      archived: safeBoolean(data.archived === "on", false),
      tags: String(data.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean)
    });
    notify(createResult(RESULT_STATUS.SUCCESS, "Sequence saved."));
    this.render({ force: true });
  }

  async bindCurrentScene() {
    const scene = activeScene();
    if (!scene) {
      notify(createResult(RESULT_STATUS.WARNING, "No active Scene is available to bind."));
      return;
    }
    await this.services.store.updateSequence(this.selectedSequenceId, { sceneUuid: scene.uuid });
    notify(createResult(RESULT_STATUS.SUCCESS, `Sequence bound to Scene: ${scene.name}`));
    this.render({ force: true });
  }

  async appendConfiguredAction(type, name, config, extra = {}) {
    const defaults = type.startsWith("native.") ? defaultActionPatch(type) : defaultIntegrationActionPatch(type);
    const action = await this.services.store.createAction(this.selectedSequenceId, this.selectedBeatId, defaults.type, defaults.adapter);
    await this.services.store.updateAction(this.selectedSequenceId, this.selectedBeatId, action.id, {
      ...defaults,
      ...extra,
      name,
      config: {
        ...(defaults.config ?? {}),
        ...(config ?? {})
      }
    });
    return action;
  }

  async ensureSelectedBeat() {
    if (this.selectedBeatId) return this.selectedBeatId;
    const beat = await this.services.store.createBeat(this.selectedSequenceId);
    this.selectedBeatId = beat.id;
    return beat.id;
  }

  async addCombatSetup() {
    const scene = activeScene();
    const tokens = controlledTokenDocuments();
    if (!scene) {
      notify(createResult(RESULT_STATUS.WARNING, "No active Scene is available."));
      return;
    }
    if (!tokens.length) {
      notify(createResult(RESULT_STATUS.WARNING, "Select the encounter Tokens on the canvas first."));
      return;
    }
    await this.ensureSelectedBeat();
    await this.services.store.updateSequence(this.selectedSequenceId, { sceneUuid: scene.uuid });
    const tokenUuids = tokens.map((token) => token.uuid);
    await this.appendConfiguredAction("native.activateScene", `Activate ${scene.name}`, { sceneUuid: scene.uuid }, { requiresConfirmation: true });
    await this.appendConfiguredAction("native.setTokenVisibility", `Reveal ${tokens.length} encounter Token(s)`, { tokenUuids, hidden: false });
    await this.appendConfiguredAction("native.createCombat", `Create Combat for ${scene.name}`, { sceneUuid: scene.uuid });
    await this.appendConfiguredAction("native.addTokensToCombat", `Add ${tokens.length} Token(s) to Combat`, { tokenUuids, createCombatIfMissing: true });
    await this.appendConfiguredAction("native.startCombat", "Start Combat", {});
    notify(createResult(RESULT_STATUS.SUCCESS, `Added combat setup for ${tokens.length} selected Token(s).`));
    this.render({ force: true });
  }

  async addReinforcementWave() {
    const tokens = controlledTokenDocuments();
    if (!tokens.length) {
      notify(createResult(RESULT_STATUS.WARNING, "Select the reinforcement Tokens on the canvas first."));
      return;
    }
    await this.ensureSelectedBeat();
    const tokenUuids = tokens.map((token) => token.uuid);
    await this.appendConfiguredAction("native.setTokenVisibility", `Reveal reinforcement Token(s)`, { tokenUuids, hidden: false });
    await this.appendConfiguredAction("native.addTokensToCombat", `Add reinforcement Token(s) to Combat`, { tokenUuids, createCombatIfMissing: false });
    notify(createResult(RESULT_STATUS.SUCCESS, `Added reinforcement wave for ${tokens.length} selected Token(s).`));
    this.render({ force: true });
  }

  async addBeat() {
    const beat = await this.services.store.createBeat(this.selectedSequenceId);
    this.selectedBeatId = beat.id;
    this.render({ force: true });
  }

  async saveBeat() {
    const data = this.formData("[data-form='beat']");
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beat = orderedBeats(sequence).find((entry) => entry.id === this.selectedBeatId);
    const triggers = data.useTriggersJson === "on"
      ? this.parseTriggersJson(data.triggersJson)
      : this.collectTriggerFormData(data, beat?.triggers ?? []);
    await this.services.store.updateBeat(this.selectedSequenceId, this.selectedBeatId, {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      gmNotes: data.gmNotes,
      triggers,
      requiresConfirmation: data.requiresConfirmation === "on",
      stopPointAfter: data.stopPointAfter === "on",
      continueOnActionFailure: data.continueOnActionFailure === "on",
      dangerLevel: data.dangerLevel
    });
    notify(createResult(RESULT_STATUS.SUCCESS, "Beat saved."));
    this.render({ force: true });
  }

  parseTriggersJson(source) {
    const text = String(source ?? "").trim();
    if (!text) return [];
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Beat Triggers must be a JSON array.");
    return parsed.map((trigger, index) => normalizeTrigger(trigger, index));
  }

  collectTriggerFormData(data, existingTriggers) {
    return existingTriggers.map((trigger, index) => {
      const prefix = `trigger-${trigger.id}`;
      const nextAction = data[`${prefix}-action`] ?? trigger.action;
      const autoExecution = [TRIGGER_ACTIONS.RUN_BEAT, TRIGGER_ACTIONS.START_SEQUENCE].includes(nextAction);
      return normalizeTrigger({
        ...trigger,
        name: data[`${prefix}-name`] ?? trigger.name,
        enabled: data[`${prefix}-enabled`] === "on",
        event: data[`${prefix}-event`] ?? trigger.event,
        action: nextAction,
        targetSequenceId: data[`${prefix}-targetSequenceId`] ?? trigger.targetSequenceId,
        targetBeatId: data[`${prefix}-targetBeatId`] ?? trigger.targetBeatId,
        count: data[`${prefix}-count`] ?? trigger.count,
        round: data[`${prefix}-round`] ?? trigger.round,
        threshold: data[`${prefix}-threshold`] ?? trigger.threshold,
        thresholdType: data[`${prefix}-thresholdType`] ?? trigger.thresholdType,
        tokenUuids: parseListField(data[`${prefix}-tokenUuids`] ?? trigger.tokenUuids),
        actorUuids: parseListField(data[`${prefix}-actorUuids`] ?? trigger.actorUuids),
        dispositions: parseListField(data[`${prefix}-dispositions`] ?? trigger.dispositions),
        once: data[`${prefix}-once`] === "on",
        cooldownMs: data[`${prefix}-cooldownMs`] ?? trigger.cooldownMs,
        requiresConfirmation: data[`${prefix}-requiresConfirmation`] === "on" || (autoExecution && trigger.requiresConfirmation !== false),
        continueAfterValidationWarnings: data[`${prefix}-continueAfterValidationWarnings`] === "on"
      }, index);
    });
  }

  async appendTrigger(trigger) {
    await this.ensureSelectedBeat();
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beat = orderedBeats(sequence).find((entry) => entry.id === this.selectedBeatId);
    const next = [...(beat?.triggers ?? []), normalizeTrigger(trigger, beat?.triggers?.length ?? 0)];
    await this.services.store.updateBeat(this.selectedSequenceId, this.selectedBeatId, { triggers: next });
    notify(createResult(RESULT_STATUS.SUCCESS, "Trigger added."));
    this.render({ force: true });
  }

  async addEnemyCountTrigger() {
    await this.appendTrigger({
      name: "Enemy defeated count",
      event: TRIGGER_EVENTS.ENEMY_DEFEATED_COUNT,
      action: TRIGGER_ACTIONS.SELECT_BEAT,
      count: 1,
      once: true,
      enabled: true
    });
  }

  async addHpThresholdTrigger() {
    const refs = selectedTokenTriggerRefs();
    if (!refs.tokenUuids.length && !refs.actorUuids.length) {
      notify(createResult(RESULT_STATUS.WARNING, "Select the Token(s) to watch first."));
      return;
    }
    await this.appendTrigger({
      name: "Selected Token HP at 50%",
      event: TRIGGER_EVENTS.TOKEN_HP_AT_OR_BELOW,
      action: TRIGGER_ACTIONS.SELECT_BEAT,
      threshold: 50,
      thresholdType: "percent",
      comparison: "lte",
      tokenUuids: refs.tokenUuids,
      actorUuids: refs.actorUuids,
      once: true,
      enabled: true
    });
  }

  async addAllyDeathTrigger() {
    const refs = selectedTokenTriggerRefs();
    const hasSelection = refs.tokenUuids.length || refs.actorUuids.length;
    await this.appendTrigger({
      name: hasSelection ? "Selected ally defeated" : "Ally defeated",
      event: hasSelection ? TRIGGER_EVENTS.TOKEN_DEFEATED : TRIGGER_EVENTS.ALLY_DEFEATED,
      action: TRIGGER_ACTIONS.SELECT_BEAT,
      count: 1,
      tokenUuids: refs.tokenUuids,
      actorUuids: refs.actorUuids,
      dispositions: hasSelection ? [] : [1],
      once: true,
      enabled: true
    });
  }

  async duplicateBeat(beatId) {
    const beat = await this.services.store.duplicateBeat(this.selectedSequenceId, beatId);
    this.selectedBeatId = beat.id;
    this.render({ force: true });
  }

  async deleteBeat(beatId) {
    if (!(await confirmText("Delete Beat", "Delete this Beat and its Actions?"))) return;
    await this.services.store.deleteBeat(this.selectedSequenceId, beatId);
    this.selectedBeatId = "";
    this.render({ force: true });
  }

  async addAction() {
    const element = appElement(this);
    const actionType = element?.querySelector("[data-field='new-action-type']")?.value ?? "native.note";
    const patch = actionType.startsWith("native.") ? defaultActionPatch(actionType) : defaultIntegrationActionPatch(actionType);
    const action = await this.services.store.createAction(this.selectedSequenceId, this.selectedBeatId, patch.type, patch.adapter);
    await this.services.store.updateAction(this.selectedSequenceId, this.selectedBeatId, action.id, patch);
    this.openActionEditor(action.id);
    this.render({ force: true });
  }

  async openActionEditor(actionId) {
    new ActionEditor(this.services, {
      selectedSequenceId: this.selectedSequenceId,
      selectedBeatId: this.selectedBeatId,
      selectedActionId: actionId,
      onClose: () => this.render({ force: true })
    }).render({ force: true });
  }

  async deleteAction(actionId) {
    if (!(await confirmText("Delete Action", "Delete this Action from the Beat?"))) return;
    await this.services.store.deleteAction(this.selectedSequenceId, this.selectedBeatId, actionId);
    this.render({ force: true });
  }

  async toggleAction(actionId) {
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beat = orderedBeats(sequence).find((entry) => entry.id === this.selectedBeatId);
    const action = this.services.validation.getOrderedActions(beat).find((entry) => entry.id === actionId);
    if (!action) return;
    await this.services.store.updateAction(this.selectedSequenceId, this.selectedBeatId, actionId, { enabled: !action.enabled });
    this.render({ force: true });
  }

  async validateSelectedBeat() {
    const result = await this.services.controller.dryRunBeat(this.selectedSequenceId, this.selectedBeatId);
    notify(createResult(result.status, result.message));
  }

  async close(options) {
    this._cedLayoutObserver?.disconnect();
    this._cedLayoutObserver = null;
    releaseApplicationWindowScrollable(this);
    await super.close(options);
    this.onCloseCallback?.();
  }
}
