import { MODULE_ID, MODULE_TITLE, MODULE_VERSION, RESULT_STATUS, SETTINGS, TEMPLATE_PATHS } from "./constants.js";
import { getSetting } from "./settings.js";
import { createResult } from "./state/schema.js";
import { SequenceEditor } from "./sequence-editor.js";
import { keepApplicationWindowScrollable, releaseApplicationWindowScrollable } from "./ui-window.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function appElement(app) {
  return app.element instanceof HTMLElement ? app.element : app.element?.[0] ?? null;
}

function notify(result) {
  const message = result?.message ?? String(result ?? "");
  if (result?.status === RESULT_STATUS.FAILURE) ui.notifications?.error(message);
  else if ([RESULT_STATUS.WARNING, RESULT_STATUS.UNSUPPORTED, RESULT_STATUS.CANCELLED].includes(result?.status)) ui.notifications?.warn(message);
  else ui.notifications?.info(message);
}

function orderedBeats(sequence) {
  const byId = new Map((sequence?.beats ?? []).map((beat) => [beat.id, beat]));
  const ordered = (sequence?.beatIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  const missing = (sequence?.beats ?? []).filter((beat) => !(sequence?.beatIds ?? []).includes(beat.id));
  return [...ordered, ...missing];
}

function statusClass(status) {
  return String(status ?? "unknown").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function confirmText(title, content) {
  if (globalThis.Dialog?.confirm) {
    return Dialog.confirm({
      title,
      content: `<p>${foundry.utils.escapeHTML(content)}</p>`,
      defaultYes: false
    });
  }
  return globalThis.confirm?.(`${title}\n\n${content}`) ?? false;
}

export class DirectorApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-director`,
    classes: [MODULE_ID, "ced-director"],
    tag: "section",
    window: {
      title: MODULE_TITLE,
      icon: "fa-solid fa-clapperboard",
      resizable: true
    },
    position: {
      width: 900,
      height: 700
    }
  };

  static PARTS = {
    main: {
      template: TEMPLATE_PATHS.DIRECTOR
    }
  };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
    this.selectedSequenceId = options.selectedSequenceId ?? "";
    this.selectedBeatId = options.selectedBeatId ?? "";
    this.preview = null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const scene = this.services.store.getActiveScene();
    const isGM = Boolean(game.user?.isGM);
    const sequences = isGM ? await this.services.store.listSequences(scene, { includeArchived: true }) : [];
    if (!this.selectedSequenceId && sequences.length) this.selectedSequenceId = sequences.find((sequence) => !sequence.archived)?.id ?? sequences[0].id;
    const selectedSequence = sequences.find((sequence) => sequence.id === this.selectedSequenceId) ?? null;
    const beats = orderedBeats(selectedSequence);
    if (!this.selectedBeatId && beats.length) this.selectedBeatId = selectedSequence.startingBeatId || beats[0].id;
    const selectedBeat = beats.find((beat) => beat.id === this.selectedBeatId) ?? beats[0] ?? null;
    const actions = selectedBeat ? this.services.validation.getOrderedActions(selectedBeat) : [];
    const statuses = (await this.services.validation.getIntegrationStatuses()).map((status) => ({
      ...status,
      statusClass: statusClass(status.status),
      capabilitiesText: status.capabilities?.join(", ") || "None",
      unsupportedText: status.unsupported?.join(" ") || ""
    }));
    const logs = (await this.services.log.list(scene)).slice().reverse().slice(0, 80);

    return {
      ...context,
      isGM,
      moduleVersion: MODULE_VERSION,
      enabled: getSetting(SETTINGS.ENABLED),
      compactMode: getSetting(SETTINGS.COMPACT_MODE),
      showIntegrationHealth: getSetting(SETTINGS.SHOW_INTEGRATION_HEALTH),
      showAdvancedActionDetails: getSetting(SETTINGS.SHOW_ADVANCED_ACTION_DETAILS),
      activeSceneName: scene?.name ?? "No active Scene",
      sequences: sequences.map((sequence) => ({ ...sequence, selected: sequence.id === this.selectedSequenceId })),
      selectedSequence,
      beats: beats.map((beat, index) => ({ ...beat, index: index + 1, selected: beat.id === selectedBeat?.id })),
      selectedBeat,
      actions,
      statuses,
      logs,
      preview: this.preview,
      hasSequence: Boolean(selectedSequence),
      hasBeat: Boolean(selectedBeat)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    keepApplicationWindowScrollable(this, { minWidth: 420, minHeight: 360 });
    const element = appElement(this);
    if (!element) return;
    element.querySelector("[data-field='sequence-select']")?.addEventListener("change", (event) => {
      this.selectedSequenceId = event.currentTarget.value;
      this.selectedBeatId = "";
      this.render({ force: true });
    });
    element.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        void this.handleAction(event.currentTarget.dataset);
      });
    });
    element.querySelector("[data-field='import-file']")?.addEventListener("change", (event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) void this.importFile(file);
    });
  }

  async handleAction(dataset) {
    if (!game.user?.isGM) return;
    try {
      switch (dataset.action) {
        case "create-sequence":
          return this.createSequence();
        case "edit-sequence":
          return this.openSequenceEditor();
        case "duplicate-sequence":
          return this.duplicateSequence();
        case "archive-sequence":
          return this.archiveSequence();
        case "delete-sequence":
          return this.deleteSequence();
        case "export-sequence":
          return this.exportSequence();
        case "export-scene":
          return this.exportScene();
        case "select-beat":
          this.selectedBeatId = dataset.beatId;
          return this.render({ force: true });
        case "previous-beat":
          return this.selectRelativeBeat(-1);
        case "next-beat":
          return this.selectRelativeBeat(1);
        case "validate-beat":
          return this.validateBeat();
        case "run-beat":
          return this.runBeat();
        case "run-action":
          return this.runAction(dataset.actionId);
        case "retry-action":
          return this.runAction(dataset.actionId, { retry: true });
        case "skip-action":
          return this.skipAction(dataset.actionId);
        case "stop-beat":
          return this.stopBeat();
        case "emergency-stop":
          return this.emergencyStop();
        case "rollback-last":
          return this.rollbackLast();
        case "reset-state":
          return this.resetExecutionState();
        case "clear-log":
          await this.services.log.clear();
          return this.render({ force: true });
        case "open-import":
          appElement(this)?.querySelector("[data-field='import-file']")?.click();
          return;
        default:
          return;
      }
    } catch (error) {
      notify(createResult(RESULT_STATUS.FAILURE, error?.message ?? String(error)));
      this.render({ force: true });
    }
  }

  async createSequence() {
    const sequence = await this.services.store.createSequence();
    this.selectedSequenceId = sequence.id;
    this.selectedBeatId = "";
    this.openSequenceEditor();
    this.render({ force: true });
  }

  openSequenceEditor() {
    if (!this.selectedSequenceId) return;
    new SequenceEditor(this.services, {
      selectedSequenceId: this.selectedSequenceId,
      selectedBeatId: this.selectedBeatId,
      onClose: () => this.render({ force: true })
    }).render({ force: true });
  }

  async duplicateSequence() {
    if (!this.selectedSequenceId) return;
    const copy = await this.services.store.duplicateSequence(this.selectedSequenceId);
    this.selectedSequenceId = copy.id;
    this.selectedBeatId = copy.beatIds[0] ?? "";
    this.render({ force: true });
  }

  async archiveSequence() {
    if (!this.selectedSequenceId) return;
    if (!(await confirmText("Archive Sequence", "Archive this Sequence without deleting it?"))) return;
    await this.services.store.archiveSequence(this.selectedSequenceId);
    this.render({ force: true });
  }

  async deleteSequence() {
    if (!this.selectedSequenceId) return;
    if (!(await confirmText("Delete Sequence", "Delete this Sequence from the Scene flags? This cannot be undone."))) return;
    await this.services.store.deleteSequence(this.selectedSequenceId);
    this.selectedSequenceId = "";
    this.selectedBeatId = "";
    this.render({ force: true });
  }

  async exportSequence() {
    if (!this.selectedSequenceId) return;
    const payload = await this.services.importExport.buildSequencePackage(this.selectedSequenceId);
    await this.services.importExport.downloadPackage(payload, `${MODULE_ID}-sequence.json`);
  }

  async exportScene() {
    const payload = await this.services.importExport.buildScenePackage();
    await this.services.importExport.downloadPackage(payload, `${MODULE_ID}-scene-sequences.json`);
  }

  async importFile(file) {
    const text = await this.services.importExport.readFile(file);
    const result = await this.services.importExport.importText(text, { mode: "duplicate" });
    notify(createResult(RESULT_STATUS.SUCCESS, `Imported ${result.imported.length} Sequence(s).`));
    this.selectedSequenceId = result.imported[0]?.id ?? this.selectedSequenceId;
    this.selectedBeatId = result.imported[0]?.beatIds?.[0] ?? this.selectedBeatId;
    this.render({ force: true });
  }

  async selectRelativeBeat(delta) {
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    const beats = orderedBeats(sequence);
    if (!beats.length) return;
    const current = Math.max(0, beats.findIndex((beat) => beat.id === this.selectedBeatId));
    const next = Math.min(beats.length - 1, Math.max(0, current + delta));
    this.selectedBeatId = beats[next].id;
    this.render({ force: true });
  }

  async validateBeat() {
    if (!this.selectedSequenceId || !this.selectedBeatId) return;
    this.preview = await this.services.controller.dryRunBeat(this.selectedSequenceId, this.selectedBeatId);
    notify(createResult(this.preview.status, this.preview.message));
    this.render({ force: true });
  }

  async runBeat() {
    if (!this.selectedSequenceId || !this.selectedBeatId) return;
    if (getSetting(SETTINGS.CONFIRM_BEFORE_RUN_BEAT)) {
      const ok = await confirmText("Run Beat", "Run the selected Beat now?");
      if (!ok) return;
    }
    const preview = await this.services.controller.dryRunBeat(this.selectedSequenceId, this.selectedBeatId);
    if (preview.status !== RESULT_STATUS.SUCCESS) {
      const ok = await confirmText("Validation Warnings", `${preview.message} Continue anyway?`);
      if (!ok) {
        this.preview = preview;
        this.render({ force: true });
        return;
      }
    }
    const result = await this.services.controller.runBeat(this.selectedSequenceId, this.selectedBeatId, {
      continueAfterValidationWarnings: true
    });
    notify(result);
    if (result.status === RESULT_STATUS.SUCCESS && getSetting(SETTINGS.AUTO_SELECT_NEXT_BEAT)) await this.selectRelativeBeat(1);
    else this.render({ force: true });
  }

  async runAction(actionId) {
    if (!this.selectedSequenceId || !this.selectedBeatId || !actionId) return;
    const result = await this.services.controller.runAction(this.selectedSequenceId, this.selectedBeatId, actionId);
    notify(result);
    this.render({ force: true });
  }

  async skipAction(actionId) {
    const result = createResult(RESULT_STATUS.SKIPPED, "Action skipped by GM.");
    await this.services.store.recordActionResult(this.selectedSequenceId, this.selectedBeatId, actionId, result);
    notify(result);
    this.render({ force: true });
  }

  async stopBeat() {
    const result = await this.services.controller.stopRunningBeat(this.selectedSequenceId, this.selectedBeatId);
    notify(result);
    this.render({ force: true });
  }

  async emergencyStop() {
    if (!(await confirmText("Emergency Stop", "Cancel all Director timers and active Director execution on this client?"))) return;
    const result = await this.services.controller.emergencyStop();
    notify(result);
    this.render({ force: true });
  }

  async rollbackLast() {
    if (!(await confirmText("Roll Back Last Supported Action", "Apply the most recent unused rollback snapshot?"))) return;
    const result = await this.services.rollback.rollbackLast();
    notify(result);
    this.render({ force: true });
  }

  async resetExecutionState() {
    if (!(await confirmText("Reset Execution State", "Clear stored validation and execution results for the selected Sequence?"))) return;
    const sequence = await this.services.store.getSequence(this.selectedSequenceId);
    for (const beat of orderedBeats(sequence)) {
      for (const action of this.services.validation.getOrderedActions(beat)) {
        await this.services.store.updateAction(sequence.id, beat.id, action.id, {
          lastValidation: null,
          lastResult: null,
          rollbackSnapshotRef: ""
        });
      }
      await this.services.store.updateBeat(sequence.id, beat.id, { manualState: "notRun" });
    }
    notify(createResult(RESULT_STATUS.SUCCESS, "Execution state reset."));
    this.render({ force: true });
  }

  async close(options) {
    releaseApplicationWindowScrollable(this);
    await super.close(options);
  }
}
