import { DANGER_LEVELS, MODULE_ID, RESULT_STATUS, TEMPLATE_PATHS } from "./constants.js";
import { defaultIntegrationActionPatch } from "./actions/integration-actions.js";
import { defaultActionPatch } from "./actions/native-actions.js";
import { ActionEditor } from "./action-editor.js";
import { createResult, safeBoolean } from "./state/schema.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function appElement(app) {
  return app.element instanceof HTMLElement ? app.element : app.element?.[0] ?? null;
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
      width: 940,
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
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beats = orderedBeats(sequence);
    if (!this.selectedBeatId && beats.length) this.selectedBeatId = beats[0].id;
    const selectedBeat = beats.find((beat) => beat.id === this.selectedBeatId) ?? beats[0] ?? null;
    const actions = selectedBeat ? this.services.validation.getOrderedActions(selectedBeat) : [];
    const actionTypes = (await this.services.validation.getActionPickerEntries()).map((entry) => ({
      ...entry,
      disabled: !entry.available
    }));

    return {
      ...context,
      sequence,
      beats: beats.map((beat, index) => ({ ...beat, index: index + 1, selected: beat.id === selectedBeat?.id })),
      selectedBeat,
      actions,
      actionTypes,
      dangerLevels: Object.values(DANGER_LEVELS).map((value) => ({ value, selected: value === selectedBeat?.dangerLevel })),
      isGM: Boolean(game.user?.isGM)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = appElement(this);
    if (!element) return;
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

  async addBeat() {
    const beat = await this.services.store.createBeat(this.selectedSequenceId);
    this.selectedBeatId = beat.id;
    this.render({ force: true });
  }

  async saveBeat() {
    const data = this.formData("[data-form='beat']");
    await this.services.store.updateBeat(this.selectedSequenceId, this.selectedBeatId, {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      gmNotes: data.gmNotes,
      requiresConfirmation: data.requiresConfirmation === "on",
      stopPointAfter: data.stopPointAfter === "on",
      continueOnActionFailure: data.continueOnActionFailure === "on",
      dangerLevel: data.dangerLevel
    });
    notify(createResult(RESULT_STATUS.SUCCESS, "Beat saved."));
    this.render({ force: true });
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
    await super.close(options);
    this.onCloseCallback?.();
  }
}
