import { HOOKS, MODULE_ID, MODULE_TITLE, PROVIDERS, SOCKET_MESSAGES, TEMPLATE_PATHS, moduleError, moduleLog } from "./constants.js";
import { registerSettings, getSetting } from "./settings.js";
import { FoundryNativeAdapter } from "./adapters/foundry-native-adapter.js";
import { SessionFlowAdapter } from "./adapters/sessionflow-adapter.js";
import { ExaltedScenesAdapter } from "./adapters/exalted-scenes-adapter.js";
import { NarratorsJukeboxAdapter } from "./adapters/narrators-jukebox-adapter.js";
import { FXMasterAdapter } from "./adapters/fxmaster-adapter.js";
import { CharacterHudAdapter } from "./adapters/character-hud-adapter.js";
import { CombatTimelineAdapter } from "./adapters/combat-timeline-adapter.js";
import { DirectorApplication } from "./director-app.js";
import { SequenceStore } from "./state/sequence-store.js";
import { ImportExportService } from "./state/import-export.js";
import { ValidationService } from "./execution/validation-service.js";
import { ExecutionLog } from "./execution/execution-log.js";
import { ExecutionAuthority } from "./execution/execution-authority.js";
import { RollbackService } from "./execution/rollback-service.js";
import { ExecutionController } from "./execution/execution-controller.js";
import { assertGm } from "./state/schema.js";

let services = null;
let directorApp = null;

function createAdapters() {
  return new Map([
    [PROVIDERS.FOUNDRY, new FoundryNativeAdapter()],
    [PROVIDERS.SESSIONFLOW, new SessionFlowAdapter()],
    [PROVIDERS.EXALTED_SCENES, new ExaltedScenesAdapter()],
    [PROVIDERS.NARRATORS_JUKEBOX, new NarratorsJukeboxAdapter()],
    [PROVIDERS.FXMASTER, new FXMasterAdapter()],
    [PROVIDERS.CHARACTER_HUD, new CharacterHudAdapter()],
    [PROVIDERS.COMBAT_TIMELINE, new CombatTimelineAdapter()]
  ]);
}

function createServices() {
  const adapters = createAdapters();
  const store = new SequenceStore();
  const validation = new ValidationService(adapters);
  const log = new ExecutionLog();
  const authority = new ExecutionAuthority();
  const rollback = new RollbackService(adapters);
  const importExport = new ImportExportService(store);
  const controller = new ExecutionController({ store, validation, authority, log, rollback, adapters });
  return { adapters, store, validation, log, authority, rollback, importExport, controller };
}

function preloadTemplates() {
  return loadTemplates([
    TEMPLATE_PATHS.DIRECTOR,
    TEMPLATE_PATHS.SEQUENCE_EDITOR,
    TEMPLATE_PATHS.ACTION_EDITOR,
    TEMPLATE_PATHS.INTEGRATION_HEALTH,
    TEMPLATE_PATHS.EXECUTION_LOG
  ]);
}

function ensureServices() {
  if (!services) services = createServices();
  return services;
}

function openDirector(options = {}) {
  assertGm();
  if (!getSetting("enabled")) throw new Error("Cinematic Encounter Director is disabled.");
  const activeServices = ensureServices();
  if (!directorApp) directorApp = new DirectorApplication(activeServices, options);
  directorApp.render({ force: true });
  return directorApp;
}

function registerKeybindings() {
  game.keybindings?.register?.(MODULE_ID, "openDirector", {
    name: "CED.OpenDirector",
    editable: [{ key: "KeyE", modifiers: ["Alt"] }],
    restricted: true,
    onDown: () => {
      if (game.user?.isGM) openDirector();
      return true;
    }
  });
}

function addSceneControlButton(controls) {
  if (!game.user?.isGM) return;
  const controlList = Array.isArray(controls) ? controls : Object.values(controls ?? {});
  const target = controlList.find((control) => ["token", "tokens", "scene"].includes(control.name)) ?? controlList[0];
  if (!target?.tools) return;
  const tools = Array.isArray(target.tools) ? target.tools : Object.values(target.tools);
  if (tools.some((tool) => tool.name === "cinematic-encounter-director")) return;
  const tool = {
    name: "cinematic-encounter-director",
    title: MODULE_TITLE,
    icon: "fa-solid fa-clapperboard",
    button: true,
    visible: true,
    onClick: () => openDirector()
  };
  if (Array.isArray(target.tools)) target.tools.push(tool);
  else target.tools[tool.name] = tool;
}

function makePublicApi() {
  return {
    openDirector,
    get services() {
      return ensureServices();
    },
    registerActionProvider(provider) {
      assertGm();
      if (!provider?.id || !provider?.displayName) throw new Error("Action providers require id and displayName.");
      if (ensureServices().adapters.has(provider.id)) throw new Error(`Action provider already exists: ${provider.id}`);
      if (typeof provider.validate !== "function" || typeof provider.execute !== "function") {
        throw new Error("Action providers require validate and execute functions.");
      }
      const adapter = {
        providerId: provider.id,
        displayName: provider.displayName,
        getStatus: provider.getStatus ?? (async () => ({
          providerId: provider.id,
          displayName: provider.displayName,
          moduleId: provider.id,
          installed: true,
          active: true,
          version: provider.version ?? "",
          apiDetected: true,
          status: "Ready",
          capabilities: provider.capabilities ?? [],
          unsupported: [],
          lastError: "",
          liveVerificationRequired: true
        })),
        validate: provider.validate,
        execute: provider.execute,
        rollback: provider.rollback,
        emergencyStop: provider.emergencyStop
      };
      ensureServices().adapters.set(provider.id, adapter);
      return adapter;
    },
    registerActionType(actionType) {
      assertGm();
      return ensureServices().validation.registerActionType(actionType);
    },
    validateActionConfig(action, context = {}) {
      assertGm();
      return ensureServices().validation.validateAction(action, context);
    },
    requestExecution({ sequenceId, beatId, actionId = "", dryRun = false, scene = null } = {}) {
      assertGm();
      if (dryRun) return ensureServices().controller.dryRunBeat(sequenceId, beatId, scene ?? undefined);
      if (actionId) return ensureServices().controller.runAction(sequenceId, beatId, actionId, { scene: scene ?? undefined });
      return ensureServices().controller.runBeat(sequenceId, beatId, { scene: scene ?? undefined });
    },
    async readSequenceMetadata(scene = ensureServices().store.getActiveScene()) {
      if (!game.user?.isGM) return [];
      const sequences = await ensureServices().store.listSequences(scene, { includeArchived: true });
      return sequences.map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        description: sequence.description,
        sceneUuid: sequence.sceneUuid,
        beatCount: sequence.beats.length,
        archived: sequence.archived,
        enabled: sequence.enabled,
        modifiedAt: sequence.modifiedAt
      }));
    },
    subscribe(eventName, callback) {
      const allowed = new Set(Object.values(HOOKS));
      if (!allowed.has(eventName)) throw new Error(`Unsupported Director hook: ${eventName}`);
      Hooks.on(eventName, callback);
      return () => Hooks.off(eventName, callback);
    }
  };
}

Hooks.once("init", () => {
  services = createServices();
  registerSettings(() => directorApp?.render({ force: true }));
  registerKeybindings();
  void preloadTemplates().catch((error) => moduleError("Template preload failed.", error));
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = makePublicApi();
  moduleLog("Initialized.");
});

Hooks.once("ready", () => {
  ensureServices();
  game.socket?.on?.(`module.${MODULE_ID}`, (payload) => {
    if (payload?.type === SOCKET_MESSAGES.PLAYER_CAMERA_PAN) FoundryNativeAdapter.handleSocketMessage(payload);
  });
  moduleLog("Ready.");
});

Hooks.on("getSceneControlButtons", addSceneControlButton);

Hooks.on("canvasReady", () => {
  directorApp?.render({ force: false });
});

Hooks.on("closeApplication", (app) => {
  if (app === directorApp) directorApp = null;
});

Hooks.once("hotReload", () => {
  void directorApp?.close?.();
  directorApp = null;
  services = null;
});
