import {
  DANGER_LEVELS,
  MAX_DELAY_MS,
  MODULE_ID,
  PROVIDERS,
  RESULT_STATUS,
  SETTINGS,
  SOCKET_MESSAGES
} from "../constants.js";
import { getNativeActionType } from "../actions/native-actions.js";
import { cloneData, createResult, makeId, safeBoolean, safeInteger, safeNumber, safeString } from "../state/schema.js";
import { getSetting } from "../settings.js";

const SCENE_ENVIRONMENT_ALLOWLIST = new Set([
  "darkness",
  "globalLight",
  "environment.darknessLevel",
  "environment.globalLight",
  "environment.cycle",
  "environment.weather",
  "fog.exploration"
]);

const LIGHT_ALLOWLIST = new Set([
  "hidden",
  "x",
  "y",
  "rotation",
  "elevation",
  "config.dim",
  "config.bright",
  "config.color",
  "config.alpha",
  "config.angle",
  "config.luminosity",
  "config.animation.type",
  "config.animation.speed",
  "config.animation.intensity",
  "config.darkness.min",
  "config.darkness.max"
]);

const WALL_ALLOWLIST = new Set(["door", "ds", "move", "sight", "sound", "dir"]);
const TOKEN_ALLOWLIST = new Set(["hidden", "x", "y", "elevation", "disposition"]);
const QUANTITY_PATH = "system.quantity";

function activeScene() {
  return canvas?.scene ?? game.scenes?.viewed ?? game.scenes?.active ?? game.scenes?.current ?? null;
}

function getProperty(object, path) {
  if (globalThis.foundry?.utils?.getProperty) return foundry.utils.getProperty(object, path);
  return String(path).split(".").reduce((value, key) => value?.[key], object);
}

function setProperty(object, path, value) {
  if (globalThis.foundry?.utils?.setProperty) return foundry.utils.setProperty(object, path, value);
  const parts = String(path).split(".");
  let current = object;
  while (parts.length > 1) {
    const key = parts.shift();
    current[key] = current[key] && typeof current[key] === "object" ? current[key] : {};
    current = current[key];
  }
  current[parts[0]] = value;
  return true;
}

function escapeHtml(value) {
  if (globalThis.foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeHandoutHtml(value) {
  return String(value ?? "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
}

function safeRollFormula(value) {
  const formula = safeString(value, 160, "1d20");
  if (!/^[0-9dDkKlLhH+\-*/ ().@_A-Za-z]+$/.test(formula)) return "1d20";
  return formula;
}

async function resolveUuid(uuid) {
  const text = safeString(uuid, 200);
  if (!text) return null;
  if (typeof globalThis.fromUuid === "function") return fromUuid(text);
  if (typeof globalThis.fromUuidSync === "function") return fromUuidSync(text);
  return null;
}

async function resolveScene(sceneUuid = "") {
  if (!sceneUuid) return activeScene();
  const doc = await resolveUuid(sceneUuid);
  if (doc?.documentName === "Scene") return doc;
  if (doc?.constructor?.name === "Scene") return doc;
  return null;
}

async function resolveDocuments(uuids = [], expectedDocumentName = "") {
  const resolved = [];
  for (const uuid of Array.isArray(uuids) ? uuids : []) {
    const doc = await resolveUuid(uuid);
    if (!doc) {
      resolved.push({ uuid, doc: null, error: "Document missing." });
      continue;
    }
    if (expectedDocumentName && doc.documentName !== expectedDocumentName) {
      resolved.push({ uuid, doc, error: `Expected ${expectedDocumentName}; found ${doc.documentName ?? "unknown"}.` });
      continue;
    }
    resolved.push({ uuid, doc, error: "" });
  }
  return resolved;
}

async function resolveActorRefs(uuids = []) {
  const resolved = [];
  for (const uuid of Array.isArray(uuids) ? uuids : []) {
    const doc = await resolveUuid(uuid);
    if (!doc) {
      resolved.push({ uuid, actor: null, error: "Actor reference missing." });
      continue;
    }
    const actor = doc.documentName === "Actor" ? doc : doc.documentName === "Token" ? doc.actor : null;
    if (!actor) {
      resolved.push({ uuid, actor: null, error: `Expected Actor or Token; found ${doc.documentName ?? "unknown"}.` });
      continue;
    }
    resolved.push({ uuid, actor, error: "" });
  }
  return resolved;
}

function collectionContents(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (collection.contents) return Array.from(collection.contents);
  return Array.from(collection);
}

function itemToData(item, quantity = null) {
  const data = typeof item?.toObject === "function" ? item.toObject() : cloneData(item ?? {});
  delete data._id;
  if (quantity !== null && quantity !== undefined) setProperty(data, QUANTITY_PATH, quantity);
  return data;
}

async function resolveItemData(config = {}) {
  const quantity = safeInteger(config.quantity, 1, 9999, 1);
  if (config.itemUuid) {
    const item = await resolveUuid(config.itemUuid);
    if (!item || item.documentName !== "Item") throw new Error("Item reference could not be resolved.");
    return { sourceItem: item, data: itemToData(item, quantity) };
  }
  if (config.itemData && typeof config.itemData === "object" && !Array.isArray(config.itemData)) {
    const data = cloneData(config.itemData);
    delete data._id;
    if (!data.name) throw new Error("Configured itemData requires a name.");
    if (!data.type) throw new Error("Configured itemData requires a type.");
    setProperty(data, QUANTITY_PATH, quantity);
    return { sourceItem: null, data };
  }
  throw new Error("Give Item requires itemUuid or itemData.");
}

function itemQuantity(item) {
  const value = Number(getProperty(item, QUANTITY_PATH));
  return Number.isFinite(value) ? value : null;
}

function findActorItem(actor, config = {}, sourceItem = null) {
  const items = collectionContents(actor?.items);
  const itemId = safeString(config.itemId, 80);
  if (itemId) return actor.items?.get?.(itemId) ?? items.find((item) => item.id === itemId) ?? null;

  if (config.itemUuid) {
    const match = items.find((item) => item.uuid === config.itemUuid);
    if (match) return match;
  }

  const itemName = safeString(config.itemName || sourceItem?.name, 160);
  const itemType = safeString(config.itemType || sourceItem?.type, 80);
  if (!itemName) return null;
  return items.find((item) => item.name === itemName && (!itemType || item.type === itemType)) ?? null;
}

function ownershipLevel(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const levels = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS ?? {};
  const aliases = {
    none: levels.NONE ?? 0,
    limited: levels.LIMITED ?? 1,
    observer: levels.OBSERVER ?? 2,
    owner: levels.OWNER ?? 3
  };
  return aliases[String(value || "observer").toLocaleLowerCase()] ?? aliases.observer;
}

function activePlayerUserIds() {
  return collectionContents(game.users).filter((user) => !user.isGM && user.active).map((user) => user.id);
}

function parentScene(doc) {
  if (doc?.documentName === "Scene") return doc;
  if (doc?.parent?.documentName === "Scene") return doc.parent;
  return doc?.parent ?? null;
}

function ensureGm() {
  if (!game.user?.isGM) throw new Error("Only a GM may execute native Director actions.");
}

function makeSnapshot(action, kind, docs, paths) {
  return {
    id: makeId("rollback"),
    adapter: PROVIDERS.FOUNDRY,
    kind,
    actionId: action.id,
    actionType: action.type,
    createdAt: new Date().toISOString(),
    targets: docs.map((doc) => ({
      uuid: doc.uuid,
      documentName: doc.documentName,
      parentUuid: parentScene(doc)?.uuid ?? "",
      values: Object.fromEntries(paths.map((path) => [path, getProperty(doc, path)]))
    }))
  };
}

function allowlistedUpdates(rawUpdates, allowlist) {
  const updates = {};
  const source = rawUpdates && typeof rawUpdates === "object" ? rawUpdates : {};
  for (const [path, value] of Object.entries(source)) {
    if (!allowlist.has(path)) continue;
    setProperty(updates, path, value);
  }
  return updates;
}

function flattenKeys(rawUpdates, prefix = "") {
  if (!rawUpdates || typeof rawUpdates !== "object" || Array.isArray(rawUpdates)) return [];
  const keys = [];
  for (const [key, value] of Object.entries(rawUpdates)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) keys.push(...flattenKeys(value, path));
    else keys.push(path);
  }
  return keys;
}

async function updateEmbeddedDocuments(docs, updatesForDoc) {
  const groups = new Map();
  for (const doc of docs) {
    const scene = parentScene(doc);
    const documentName = doc.documentName;
    if (!scene || !documentName) {
      await doc.update(updatesForDoc(doc));
      continue;
    }
    const key = `${scene.uuid}:${documentName}`;
    if (!groups.has(key)) groups.set(key, { scene, documentName, updates: [] });
    groups.get(key).updates.push({ _id: doc.id, ...updatesForDoc(doc) });
  }

  for (const group of groups.values()) {
    await group.scene.updateEmbeddedDocuments(group.documentName, group.updates);
  }
}

async function getActiveCombat(scene = activeScene()) {
  const viewed = game.combats?.viewed ?? game.combat ?? game.combats?.active ?? null;
  if (viewed && (!scene || viewed.scene?.id === scene.id || viewed.scene?.id === scene._id || viewed.scene === scene.id)) return viewed;
  const combats = Array.from(game.combats?.contents ?? game.combats ?? []);
  return combats.find((combat) => combat.scene?.id === scene?.id || combat.scene === scene?.id) ?? viewed;
}

async function resolveCombat(combatUuid = "", scene = activeScene()) {
  if (combatUuid) {
    const doc = await resolveUuid(combatUuid);
    if (doc?.documentName === "Combat") return doc;
  }
  return getActiveCombat(scene);
}

async function createCombatForScene(scene) {
  if (!scene) throw new Error("No Scene is available for Combat creation.");
  const existing = await getActiveCombat(scene);
  if (existing) return existing;
  return Combat.create({ scene: scene.id, active: true });
}

async function waitForSceneCanvas(scene, timeoutMs = 10000) {
  if (!scene) return false;
  if (canvas?.ready && canvas?.scene?.id === scene.id) return true;
  return new Promise((resolve) => {
    const timeout = globalThis.setTimeout(() => {
      Hooks.off("canvasReady", onCanvasReady);
      resolve(false);
    }, timeoutMs);
    const onCanvasReady = (canvasScene) => {
      const readyScene = canvasScene?.id ? canvasScene : canvas?.scene;
      if (readyScene?.id !== scene.id) return;
      globalThis.clearTimeout(timeout);
      Hooks.off("canvasReady", onCanvasReady);
      resolve(true);
    };
    Hooks.on("canvasReady", onCanvasReady);
  });
}

function socketTargets(scope, userIds = []) {
  const users = Array.from(game.users?.contents ?? game.users ?? []);
  if (scope === "allPlayers") return users.filter((user) => !user.isGM && user.active).map((user) => user.id);
  if (scope === "selectedUsers") {
    const allowed = new Set(Array.isArray(userIds) ? userIds.map(String) : []);
    return users.filter((user) => user.active && allowed.has(user.id)).map((user) => user.id);
  }
  return [];
}

export class FoundryNativeAdapter {
  constructor() {
    this.providerId = PROVIDERS.FOUNDRY;
    this.displayName = "Foundry Native";
    this.lastError = "";
  }

  async getStatus() {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      moduleId: "foundry",
      installed: true,
      active: true,
      version: game.version ?? "",
      apiDetected: true,
      status: game.user?.isGM ? "Ready" : "GM only",
      capabilities: [
        "scenes",
        "tokens",
        "ambientLights",
        "wallsDoors",
        "combat",
        "camera",
        "chat",
        "items",
        "journals",
        "rollRequests",
        "pause",
        "dryRun",
        "rollback"
      ],
      unsupported: game.user?.isGM ? [] : ["Only GMs may execute actions."],
      lastError: this.lastError,
      liveVerificationRequired: true
    };
  }

  async validate(action) {
    const metadata = getNativeActionType(action.type);
    if (!metadata) return createResult(RESULT_STATUS.UNSUPPORTED, `Unknown native Action type: ${action.type}`);
    if (!game.user?.isGM) return createResult(RESULT_STATUS.FAILURE, "Only a GM may validate native Actions.");
    if (metadata.requiresSetting === SETTINGS.ENABLE_NATIVE_PLAYLIST_FALLBACK && !getSetting(SETTINGS.ENABLE_NATIVE_PLAYLIST_FALLBACK)) {
      return createResult(RESULT_STATUS.UNSUPPORTED, "Native Playlist fallback is disabled in world settings.");
    }

    try {
      await this.validateConfig(action);
      return createResult(RESULT_STATUS.SUCCESS, `${metadata.label} is valid.`, {
        provider: PROVIDERS.FOUNDRY,
        dangerLevel: metadata.dangerLevel,
        rollbackSupported: metadata.rollbackSupported
      });
    } catch (error) {
      return createResult(RESULT_STATUS.FAILURE, error?.message ?? String(error));
    }
  }

  async validateConfig(action) {
    const config = action.config ?? {};
    switch (action.type) {
      case "native.note":
      case "native.chatMessage":
        safeString(config.message, 2000);
        return;
      case "native.delay":
        safeInteger(config.durationMs, 0, MAX_DELAY_MS, 0);
        return;
      case "native.waitForConfirmation":
        safeString(config.prompt, 500, "Continue?");
        return;
      case "native.preloadScene":
      case "native.viewScene":
      case "native.activateScene":
      case "native.setSceneDarkness":
      case "native.updateSceneEnvironment": {
        const scene = await resolveScene(config.sceneUuid);
        if (!scene) throw new Error("Scene reference could not be resolved.");
        if (action.type === "native.setSceneDarkness") safeNumber(config.darkness, 0, 1, 0);
        if (action.type === "native.updateSceneEnvironment") {
          const keys = flattenKeys(config.updates);
          const bad = keys.filter((key) => !SCENE_ENVIRONMENT_ALLOWLIST.has(key));
          if (bad.length) throw new Error(`Scene environment fields are not allowlisted: ${bad.join(", ")}`);
        }
        return;
      }
      case "native.updateAmbientLights":
        await this.validateDocuments(config.lightUuids, "AmbientLight");
        this.validateAllowlist(config.updates, LIGHT_ALLOWLIST, "AmbientLight");
        return;
      case "native.updateWallsDoors":
        await this.validateDocuments(config.wallUuids, "Wall");
        this.validateAllowlist(config.updates, WALL_ALLOWLIST, "Wall");
        return;
      case "native.setTokenVisibility":
      case "native.updateTokenElevation":
      case "native.updateTokenDisposition":
        await this.validateDocuments(config.tokenUuids, "Token");
        return;
      case "native.moveTokens": {
        if (!Array.isArray(config.moves) || !config.moves.length) throw new Error("No Token moves are configured.");
        for (const move of config.moves) {
          const token = await resolveUuid(move.tokenUuid);
          if (!token || token.documentName !== "Token") throw new Error("A configured Token move has a missing or invalid Token.");
          safeNumber(move.x, -1000000, 1000000, 0);
          safeNumber(move.y, -1000000, 1000000, 0);
        }
        return;
      }
      case "native.createCombat":
        if (config.sceneUuid && !(await resolveScene(config.sceneUuid))) throw new Error("Combat Scene reference could not be resolved.");
        return;
      case "native.addTokensToCombat":
        await this.validateDocuments(config.tokenUuids, "Token");
        return;
      case "native.removeCombatants":
      case "native.startCombat":
      case "native.endCombat":
      case "native.setCombatRoundTurn":
        return;
      case "native.panCamera":
        safeNumber(config.x, -1000000, 1000000, 0);
        safeNumber(config.y, -1000000, 1000000, 0);
        safeInteger(config.duration, 0, 10000, 1000);
        return;
      case "native.pauseGame":
        safeBoolean(config.paused, true);
        return;
      case "native.playlistCue":
        if (!getSetting(SETTINGS.ENABLE_NATIVE_PLAYLIST_FALLBACK)) throw new Error("Native Playlist fallback is disabled.");
        if (config.playlistUuid && !(await resolveUuid(config.playlistUuid))) throw new Error("Playlist reference could not be resolved.");
        return;
      case "native.giveItemToActor":
        await this.validateActorRefs(config.actorUuids);
        await resolveItemData(config);
        safeInteger(config.quantity, 1, 9999, 1);
        return;
      case "native.removeItemFromActor": {
        const actors = await this.validateActorRefs(config.actorUuids);
        const sourceItem = config.itemUuid ? await resolveUuid(config.itemUuid) : null;
        if (config.itemUuid && (!sourceItem || sourceItem.documentName !== "Item")) throw new Error("Item reference could not be resolved.");
        if (!config.itemUuid && !config.itemId && !config.itemName) throw new Error("Remove Item requires itemUuid, itemId, or itemName.");
        const missing = actors.filter((actor) => !findActorItem(actor, config, sourceItem));
        if (missing.length) throw new Error(`No matching Item found on ${missing.length} Actor(s).`);
        safeInteger(config.quantity, 1, 9999, 1);
        return;
      }
      case "native.createJournalHandout":
        safeString(config.name, 120, "New Handout");
        safeString(config.pageName, 120, "Handout");
        sanitizeHandoutHtml(config.content);
        return;
      case "native.showJournalHandout": {
        const doc = await resolveUuid(config.journalUuid);
        if (!doc || !["JournalEntry", "JournalEntryPage"].includes(doc.documentName)) throw new Error("JournalEntry or JournalEntryPage reference could not be resolved.");
        return;
      }
      case "native.requestRoll":
        safeRollFormula(config.formula);
        safeString(config.prompt, 1000, "Roll when ready.");
        return;
      default:
        throw new Error(`Unsupported native Action type: ${action.type}`);
    }
  }

  validateAllowlist(updates, allowlist, label) {
    const keys = flattenKeys(updates);
    if (!keys.length) throw new Error(`No ${label} update fields are configured.`);
    const bad = keys.filter((key) => !allowlist.has(key));
    if (bad.length) throw new Error(`${label} fields are not allowlisted: ${bad.join(", ")}`);
  }

  async validateDocuments(uuids, documentName) {
    const resolved = await resolveDocuments(uuids, documentName);
    if (!resolved.length) throw new Error(`No ${documentName} documents are configured.`);
    const errors = resolved.filter((entry) => entry.error);
    if (errors.length) throw new Error(errors.map((entry) => `${entry.uuid}: ${entry.error}`).join(" "));
  }

  async validateActorRefs(uuids) {
    const resolved = await resolveActorRefs(uuids);
    if (!resolved.length) throw new Error("No Actor references are configured.");
    const errors = resolved.filter((entry) => entry.error);
    if (errors.length) throw new Error(errors.map((entry) => `${entry.uuid}: ${entry.error}`).join(" "));
    return resolved.map((entry) => entry.actor);
  }

  async execute(action, context = {}) {
    ensureGm();
    if (context.dryRun) return createResult(RESULT_STATUS.DRY_RUN, `Dry run: ${action.name}`, { actionType: action.type });

    try {
      switch (action.type) {
        case "native.note":
          return this.note(action);
        case "native.chatMessage":
          return this.chatMessage(action);
        case "native.delay":
        case "native.waitForConfirmation":
          return createResult(RESULT_STATUS.SKIPPED, "Delay and wait Actions are handled by the execution controller.");
        case "native.preloadScene":
          return this.preloadScene(action);
        case "native.viewScene":
          return this.viewScene(action);
        case "native.activateScene":
          return this.activateScene(action);
        case "native.setSceneDarkness":
          return this.setSceneDarkness(action);
        case "native.updateSceneEnvironment":
          return this.updateSceneEnvironment(action);
        case "native.updateAmbientLights":
          return this.updateAmbientLights(action);
        case "native.updateWallsDoors":
          return this.updateWallsDoors(action);
        case "native.setTokenVisibility":
          return this.setTokenVisibility(action);
        case "native.moveTokens":
          return this.moveTokens(action);
        case "native.updateTokenElevation":
          return this.updateTokenElevation(action);
        case "native.updateTokenDisposition":
          return this.updateTokenDisposition(action);
        case "native.createCombat":
          return this.createCombat(action);
        case "native.addTokensToCombat":
          return this.addTokensToCombat(action);
        case "native.removeCombatants":
          return this.removeCombatants(action);
        case "native.startCombat":
          return this.startCombat(action);
        case "native.endCombat":
          return this.endCombat(action);
        case "native.setCombatRoundTurn":
          return this.setCombatRoundTurn(action);
        case "native.panCamera":
          return this.panCamera(action);
        case "native.pauseGame":
          return this.pauseGame(action);
        case "native.playlistCue":
          return this.playlistCue(action);
        case "native.giveItemToActor":
          return this.giveItemToActor(action);
        case "native.removeItemFromActor":
          return this.removeItemFromActor(action);
        case "native.createJournalHandout":
          return this.createJournalHandout(action);
        case "native.showJournalHandout":
          return this.showJournalHandout(action);
        case "native.requestRoll":
          return this.requestRoll(action);
        default:
          return createResult(RESULT_STATUS.UNSUPPORTED, `Unsupported native Action type: ${action.type}`);
      }
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.FAILURE, this.lastError);
    }
  }

  note(action) {
    return createResult(RESULT_STATUS.SUCCESS, safeString(action.config?.message, 1000, "GM note recorded."), { mutation: false });
  }

  async chatMessage(action) {
    const message = safeString(action.config?.message, 2000, "");
    if (!message) return createResult(RESULT_STATUS.WARNING, "Chat message was empty.");
    if (safeBoolean(action.config?.whisperGmOnly, true)) {
      return createResult(RESULT_STATUS.SUCCESS, message, { gmOnly: true, mutation: false });
    }
    await ChatMessage.create({
      content: `<p>${escapeHtml(message)}</p>`,
      speaker: ChatMessage.getSpeaker?.({ user: game.user }) ?? {}
    });
    return createResult(RESULT_STATUS.SUCCESS, "Chat message created.");
  }

  async preloadScene(action) {
    const scene = await resolveScene(action.config?.sceneUuid);
    if (!scene) return createResult(RESULT_STATUS.FAILURE, "Scene could not be resolved.");
    if (typeof game.scenes?.preload === "function") await game.scenes.preload(scene.id, true);
    else if (typeof scene.preload === "function") await scene.preload();
    else return createResult(RESULT_STATUS.UNSUPPORTED, "No supported Scene preload API was detected.");
    return createResult(RESULT_STATUS.SUCCESS, `Preloaded Scene: ${scene.name}`, { sceneUuid: scene.uuid });
  }

  async viewScene(action) {
    const scene = await resolveScene(action.config?.sceneUuid);
    if (!scene) return createResult(RESULT_STATUS.FAILURE, "Scene could not be resolved.");
    if (typeof scene.view !== "function") return createResult(RESULT_STATUS.UNSUPPORTED, "Scene.view() is not available.");
    await scene.view();
    return createResult(RESULT_STATUS.SUCCESS, `Viewing Scene locally: ${scene.name}`, { sceneUuid: scene.uuid });
  }

  async activateScene(action) {
    const scene = await resolveScene(action.config?.sceneUuid);
    if (!scene) return createResult(RESULT_STATUS.FAILURE, "Scene could not be resolved.");
    if (typeof scene.activate !== "function") return createResult(RESULT_STATUS.UNSUPPORTED, "Scene.activate() is not available.");
    await scene.activate();
    const ready = await waitForSceneCanvas(scene);
    return createResult(ready ? RESULT_STATUS.SUCCESS : RESULT_STATUS.WARNING, ready ? `Activated Scene: ${scene.name}` : `Activated Scene, but canvas readiness was not confirmed: ${scene.name}`, {
      sceneUuid: scene.uuid,
      canvasReady: ready
    });
  }

  async setSceneDarkness(action) {
    const scene = await resolveScene(action.config?.sceneUuid);
    if (!scene) return createResult(RESULT_STATUS.FAILURE, "Scene could not be resolved.");
    const darkness = safeNumber(action.config?.darkness, 0, 1, 0);
    const path = scene.darkness !== undefined ? "darkness" : "environment.darknessLevel";
    const snapshot = makeSnapshot(action, "scene-fields", [scene], [path]);
    await scene.update({ [path]: darkness });
    return createResult(RESULT_STATUS.SUCCESS, `Set darkness to ${darkness}.`, { rollbackSnapshot: snapshot });
  }

  async updateSceneEnvironment(action) {
    const scene = await resolveScene(action.config?.sceneUuid);
    if (!scene) return createResult(RESULT_STATUS.FAILURE, "Scene could not be resolved.");
    const updates = allowlistedUpdates(action.config?.updates, SCENE_ENVIRONMENT_ALLOWLIST);
    const paths = flattenKeys(updates).filter((path) => SCENE_ENVIRONMENT_ALLOWLIST.has(path));
    if (!paths.length) return createResult(RESULT_STATUS.WARNING, "No allowlisted Scene environment updates were supplied.");
    const snapshot = makeSnapshot(action, "scene-fields", [scene], paths);
    await scene.update(updates);
    return createResult(RESULT_STATUS.SUCCESS, "Scene environment updated.", { updatedFields: paths, rollbackSnapshot: snapshot });
  }

  async updateAmbientLights(action) {
    const resolved = await resolveDocuments(action.config?.lightUuids, "AmbientLight");
    const docs = resolved.map((entry) => entry.doc).filter(Boolean);
    const updates = allowlistedUpdates(action.config?.updates, LIGHT_ALLOWLIST);
    const paths = flattenKeys(updates).filter((path) => LIGHT_ALLOWLIST.has(path));
    if (!docs.length) return createResult(RESULT_STATUS.FAILURE, "No AmbientLight documents resolved.");
    const snapshot = makeSnapshot(action, "embedded-fields", docs, paths);
    await updateEmbeddedDocuments(docs, () => updates);
    return createResult(RESULT_STATUS.SUCCESS, `Updated ${docs.length} AmbientLight document(s).`, { rollbackSnapshot: snapshot });
  }

  async updateWallsDoors(action) {
    const resolved = await resolveDocuments(action.config?.wallUuids, "Wall");
    const docs = resolved.map((entry) => entry.doc).filter(Boolean);
    const updates = allowlistedUpdates(action.config?.updates, WALL_ALLOWLIST);
    const paths = flattenKeys(updates).filter((path) => WALL_ALLOWLIST.has(path));
    if (!docs.length) return createResult(RESULT_STATUS.FAILURE, "No Wall documents resolved.");
    const snapshot = makeSnapshot(action, "embedded-fields", docs, paths);
    await updateEmbeddedDocuments(docs, () => updates);
    return createResult(RESULT_STATUS.SUCCESS, `Updated ${docs.length} Wall document(s).`, { rollbackSnapshot: snapshot });
  }

  async setTokenVisibility(action) {
    const resolved = await resolveDocuments(action.config?.tokenUuids, "Token");
    const docs = resolved.map((entry) => entry.doc).filter(Boolean);
    if (!docs.length) return createResult(RESULT_STATUS.FAILURE, "No Token documents resolved.");
    const hidden = safeBoolean(action.config?.hidden, false);
    const snapshot = makeSnapshot(action, "embedded-fields", docs, ["hidden"]);
    await updateEmbeddedDocuments(docs, () => ({ hidden }));
    return createResult(RESULT_STATUS.SUCCESS, `${hidden ? "Hid" : "Revealed"} ${docs.length} Token(s).`, { rollbackSnapshot: snapshot });
  }

  async moveTokens(action) {
    const moves = Array.isArray(action.config?.moves) ? action.config.moves : [];
    const docs = [];
    const updateByUuid = new Map();
    for (const move of moves) {
      const doc = await resolveUuid(move.tokenUuid);
      if (!doc || doc.documentName !== "Token") continue;
      docs.push(doc);
      updateByUuid.set(doc.uuid, {
        x: safeNumber(move.x, -1000000, 1000000, doc.x ?? 0),
        y: safeNumber(move.y, -1000000, 1000000, doc.y ?? 0)
      });
    }
    if (!docs.length) return createResult(RESULT_STATUS.FAILURE, "No Token move targets resolved.");
    const snapshot = makeSnapshot(action, "embedded-fields", docs, ["x", "y"]);
    await updateEmbeddedDocuments(docs, (doc) => updateByUuid.get(doc.uuid));
    return createResult(RESULT_STATUS.SUCCESS, `Moved ${docs.length} Token(s).`, { rollbackSnapshot: snapshot });
  }

  async updateTokenElevation(action) {
    return this.updateTokensSingleField(action, "elevation", safeNumber(action.config?.elevation, -100000, 100000, 0), "Updated Token elevation.");
  }

  async updateTokenDisposition(action) {
    return this.updateTokensSingleField(action, "disposition", safeInteger(action.config?.disposition, -2, 2, 0), "Updated Token disposition.");
  }

  async updateTokensSingleField(action, field, value, message) {
    if (!TOKEN_ALLOWLIST.has(field)) return createResult(RESULT_STATUS.UNSUPPORTED, `Token field is not allowlisted: ${field}`);
    const resolved = await resolveDocuments(action.config?.tokenUuids, "Token");
    const docs = resolved.map((entry) => entry.doc).filter(Boolean);
    if (!docs.length) return createResult(RESULT_STATUS.FAILURE, "No Token documents resolved.");
    const snapshot = makeSnapshot(action, "embedded-fields", docs, [field]);
    await updateEmbeddedDocuments(docs, () => ({ [field]: value }));
    return createResult(RESULT_STATUS.SUCCESS, message, { rollbackSnapshot: snapshot });
  }

  async createCombat(action) {
    const scene = await resolveScene(action.config?.sceneUuid);
    const combat = await createCombatForScene(scene);
    return createResult(RESULT_STATUS.SUCCESS, `Combat is available for Scene: ${scene?.name ?? "active Scene"}.`, { combatUuid: combat.uuid });
  }

  async addTokensToCombat(action) {
    const resolved = await resolveDocuments(action.config?.tokenUuids, "Token");
    const docs = resolved.map((entry) => entry.doc).filter(Boolean);
    if (!docs.length) return createResult(RESULT_STATUS.FAILURE, "No Token documents resolved.");
    const scene = parentScene(docs[0]) ?? activeScene();
    const combat = await getActiveCombat(scene) ?? (safeBoolean(action.config?.createCombatIfMissing, true) ? await createCombatForScene(scene) : null);
    if (!combat) return createResult(RESULT_STATUS.FAILURE, "No Combat is available.");
    const existingTokenIds = new Set(Array.from(combat.combatants ?? []).map((combatant) => combatant.tokenId));
    const creates = docs
      .filter((token) => !existingTokenIds.has(token.id))
      .map((token) => ({ tokenId: token.id, sceneId: parentScene(token)?.id ?? scene?.id }));
    if (!creates.length) return createResult(RESULT_STATUS.SKIPPED, "All configured Tokens are already in Combat.", { combatUuid: combat.uuid });
    const combatants = await combat.createEmbeddedDocuments("Combatant", creates);
    return createResult(RESULT_STATUS.SUCCESS, `Added ${combatants.length} Token(s) to Combat.`, {
      combatUuid: combat.uuid,
      combatantIds: combatants.map((combatant) => combatant.id),
      rollbackSnapshot: {
        id: makeId("rollback"),
        adapter: PROVIDERS.FOUNDRY,
        kind: "combatants-created",
        actionId: action.id,
        combatUuid: combat.uuid,
        combatantIds: combatants.map((combatant) => combatant.id)
      }
    });
  }

  async removeCombatants(action) {
    const scene = activeScene();
    const combat = await resolveCombat(action.config?.combatUuid, scene);
    if (!combat) return createResult(RESULT_STATUS.FAILURE, "Combat could not be resolved.");
    const ids = Array.isArray(action.config?.combatantIds) ? action.config.combatantIds.map(String).filter(Boolean) : [];
    if (!ids.length) return createResult(RESULT_STATUS.WARNING, "No Combatants were configured for removal.");
    await combat.deleteEmbeddedDocuments("Combatant", ids);
    return createResult(RESULT_STATUS.SUCCESS, `Removed ${ids.length} Combatant(s).`, { combatUuid: combat.uuid });
  }

  async startCombat(action) {
    const combat = await resolveCombat(action.config?.combatUuid, activeScene());
    if (!combat) return createResult(RESULT_STATUS.FAILURE, "Combat could not be resolved.");
    if (typeof combat.startCombat === "function") await combat.startCombat();
    else await combat.update({ round: Math.max(1, combat.round || 1), turn: Math.max(0, combat.turn || 0) });
    return createResult(RESULT_STATUS.SUCCESS, "Combat started.", { combatUuid: combat.uuid });
  }

  async endCombat(action) {
    const combat = await resolveCombat(action.config?.combatUuid, activeScene());
    if (!combat) return createResult(RESULT_STATUS.FAILURE, "Combat could not be resolved.");
    if (typeof combat.endCombat === "function") await combat.endCombat();
    else await combat.delete();
    return createResult(RESULT_STATUS.SUCCESS, "Combat ended.", { combatUuid: combat.uuid });
  }

  async setCombatRoundTurn(action) {
    const combat = await resolveCombat(action.config?.combatUuid, activeScene());
    if (!combat) return createResult(RESULT_STATUS.FAILURE, "Combat could not be resolved.");
    const updates = {};
    if (action.config?.round !== null && action.config?.round !== undefined && action.config?.round !== "") {
      updates.round = safeInteger(action.config.round, 0, 9999, combat.round ?? 0);
    }
    if (action.config?.turn !== null && action.config?.turn !== undefined && action.config?.turn !== "") {
      updates.turn = safeInteger(action.config.turn, 0, 9999, combat.turn ?? 0);
    }
    if (!Object.keys(updates).length) return createResult(RESULT_STATUS.WARNING, "No Combat round or turn update was configured.");
    await combat.update(updates);
    return createResult(RESULT_STATUS.SUCCESS, "Combat round or turn updated.", { combatUuid: combat.uuid, updates });
  }

  async panCamera(action) {
    const config = action.config ?? {};
    const x = safeNumber(config.x, -1000000, 1000000, 0);
    const y = safeNumber(config.y, -1000000, 1000000, 0);
    const duration = safeInteger(config.duration, 0, 10000, 1000);
    const scale = config.scale === null || config.scale === undefined || config.scale === "" ? undefined : safeNumber(config.scale, 0.1, 5, 1);
    const payload = { x, y, duration };
    if (scale !== undefined) payload.scale = scale;

    if (config.scope === "gm" || !config.scope) {
      if (!canvas?.animatePan) return createResult(RESULT_STATUS.UNSUPPORTED, "canvas.animatePan is unavailable.");
      await canvas.animatePan(payload);
      return createResult(RESULT_STATUS.SUCCESS, "Panned GM camera.", { scope: "gm" });
    }

    const targetUserIds = socketTargets(config.scope, config.userIds);
    if (!targetUserIds.length) return createResult(RESULT_STATUS.WARNING, "No active player camera targets were found.");
    game.socket.emit(`module.${MODULE_ID}`, {
      type: SOCKET_MESSAGES.PLAYER_CAMERA_PAN,
      requestId: makeId("pan"),
      senderId: game.user.id,
      targetUserIds,
      sceneId: canvas?.scene?.id ?? "",
      payload
    });
    return createResult(RESULT_STATUS.SUCCESS, `Requested camera pan for ${targetUserIds.length} user(s).`, { targetUserIds });
  }

  async pauseGame(action) {
    const paused = safeBoolean(action.config?.paused, true);
    if (typeof game.togglePause !== "function") return createResult(RESULT_STATUS.UNSUPPORTED, "game.togglePause is unavailable.");
    await game.togglePause(paused, true);
    return createResult(RESULT_STATUS.SUCCESS, paused ? "Game paused." : "Game unpaused.");
  }

  async playlistCue(action) {
    if (!getSetting(SETTINGS.ENABLE_NATIVE_PLAYLIST_FALLBACK)) return createResult(RESULT_STATUS.UNSUPPORTED, "Native Playlist fallback is disabled.");
    const playlist = await resolveUuid(action.config?.playlistUuid);
    if (!playlist || playlist.documentName !== "Playlist") return createResult(RESULT_STATUS.FAILURE, "Playlist could not be resolved.");
    const operation = safeString(action.config?.operation, 40, "play");
    const sound = action.config?.soundId ? playlist.sounds?.get?.(action.config.soundId) : null;
    if (operation === "stop") {
      if (sound && typeof playlist.stopSound === "function") await playlist.stopSound(sound);
      else if (typeof playlist.stopAll === "function") await playlist.stopAll();
      else return createResult(RESULT_STATUS.UNSUPPORTED, "Playlist stop API is unavailable.");
      return createResult(RESULT_STATUS.SUCCESS, "Playlist cue stopped.");
    }
    if (sound && typeof playlist.playSound === "function") await playlist.playSound(sound);
    else if (typeof playlist.playAll === "function") await playlist.playAll();
    else return createResult(RESULT_STATUS.UNSUPPORTED, "Playlist play API is unavailable.");
    return createResult(RESULT_STATUS.SUCCESS, "Playlist cue started.", {
      rollbackSnapshot: {
        id: makeId("rollback"),
        adapter: PROVIDERS.FOUNDRY,
        kind: "playlist-cue",
        actionId: action.id,
        playlistUuid: playlist.uuid,
        soundId: action.config?.soundId ?? ""
      }
    });
  }

  async giveItemToActor(action) {
    const actors = await this.validateActorRefs(action.config?.actorUuids);
    const quantity = safeInteger(action.config?.quantity, 1, 9999, 1);
    const stack = safeBoolean(action.config?.stack, true);
    const { sourceItem, data } = await resolveItemData({ ...(action.config ?? {}), quantity });
    const targets = [];

    for (const actor of actors) {
      const target = { actorUuid: actor.uuid, createdItemIds: [], quantityUpdates: [], deletedItems: [] };
      const existing = stack ? findActorItem(actor, action.config, sourceItem) : null;
      const existingQuantity = existing ? itemQuantity(existing) : null;
      if (existing && existingQuantity !== null) {
        target.quantityUpdates.push({ itemId: existing.id, before: existingQuantity });
        await existing.update({ [QUANTITY_PATH]: existingQuantity + quantity });
      } else {
        const created = await actor.createEmbeddedDocuments("Item", [cloneData(data)]);
        target.createdItemIds = created.map((item) => item.id);
      }
      targets.push(target);
    }

    return createResult(RESULT_STATUS.SUCCESS, `Gave ${data.name ?? "Item"} to ${actors.length} Actor(s).`, {
      itemName: data.name ?? "",
      actorUuids: actors.map((actor) => actor.uuid),
      rollbackSnapshot: {
        id: makeId("rollback"),
        adapter: PROVIDERS.FOUNDRY,
        kind: "actor-items",
        actionId: action.id,
        targets
      }
    });
  }

  async removeItemFromActor(action) {
    const actors = await this.validateActorRefs(action.config?.actorUuids);
    const quantity = safeInteger(action.config?.quantity, 1, 9999, 1);
    const removeAll = safeBoolean(action.config?.removeAll, false);
    const sourceItem = action.config?.itemUuid ? await resolveUuid(action.config.itemUuid) : null;
    const targets = [];
    let changed = 0;

    for (const actor of actors) {
      const item = findActorItem(actor, action.config, sourceItem);
      if (!item) continue;
      const target = { actorUuid: actor.uuid, createdItemIds: [], quantityUpdates: [], deletedItems: [] };
      const currentQuantity = itemQuantity(item);
      if (!removeAll && currentQuantity !== null && currentQuantity > quantity) {
        target.quantityUpdates.push({ itemId: item.id, before: currentQuantity });
        await item.update({ [QUANTITY_PATH]: currentQuantity - quantity });
      } else {
        const data = typeof item.toObject === "function" ? item.toObject() : cloneData(item);
        target.deletedItems.push({ itemId: item.id, data });
        await actor.deleteEmbeddedDocuments("Item", [item.id]);
      }
      targets.push(target);
      changed += 1;
    }

    if (!changed) return createResult(RESULT_STATUS.WARNING, "No matching Actor Items were removed.");
    return createResult(RESULT_STATUS.SUCCESS, `Removed Item from ${changed} Actor(s).`, {
      actorUuids: actors.map((actor) => actor.uuid),
      rollbackSnapshot: {
        id: makeId("rollback"),
        adapter: PROVIDERS.FOUNDRY,
        kind: "actor-items",
        actionId: action.id,
        targets
      }
    });
  }

  async createJournalHandout(action) {
    const config = action.config ?? {};
    const name = safeString(config.name, 120, "New Handout");
    const pageName = safeString(config.pageName, 120, name);
    const content = sanitizeHandoutHtml(config.content || `<p>${escapeHtml(name)}</p>`);
    const ownership = { default: ownershipLevel(config.ownershipLevel) };
    const pageFormat = globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1;
    const journal = await JournalEntry.create({
      name,
      ownership,
      pages: [{
        name: pageName,
        type: "text",
        text: { content, format: pageFormat }
      }]
    });

    let showResult = null;
    if (safeBoolean(config.showToPlayers, false)) {
      showResult = await this.showJournalDocument(journal, true, true);
    }

    return createResult(RESULT_STATUS.SUCCESS, `Created Journal handout: ${journal.name}`, {
      journalUuid: journal.uuid,
      shown: showResult?.shown ?? false,
      rollbackSnapshot: {
        id: makeId("rollback"),
        adapter: PROVIDERS.FOUNDRY,
        kind: "journal-created",
        actionId: action.id,
        journalUuid: journal.uuid
      }
    });
  }

  async showJournalHandout(action) {
    const config = action.config ?? {};
    const doc = await resolveUuid(config.journalUuid);
    if (!doc || !["JournalEntry", "JournalEntryPage"].includes(doc.documentName)) {
      return createResult(RESULT_STATUS.FAILURE, "JournalEntry or JournalEntryPage could not be resolved.");
    }
    const page = config.pageId && doc.documentName === "JournalEntry" ? doc.pages?.get?.(config.pageId) : doc;
    const result = await this.showJournalDocument(page ?? doc, safeBoolean(config.showToPlayers, true), safeBoolean(config.createChatLinkFallback, true));
    return createResult(result.shown ? RESULT_STATUS.SUCCESS : RESULT_STATUS.WARNING, result.message, result.details);
  }

  async showJournalDocument(doc, showToPlayers = true, createChatLinkFallback = true) {
    const mode = showToPlayers ? "players" : "text";
    if (typeof doc?.show === "function") {
      await doc.show(mode);
      return { shown: true, message: `Showed Journal handout: ${doc.name}`, details: { journalUuid: doc.uuid, mode } };
    }
    if (doc?.parent && typeof doc.parent.show === "function") {
      await doc.parent.show(mode);
      return { shown: true, message: `Showed Journal handout: ${doc.parent.name}`, details: { journalUuid: doc.parent.uuid, pageUuid: doc.uuid, mode } };
    }
    if (createChatLinkFallback) {
      await ChatMessage.create({
        content: `<p><strong>Handout:</strong> @UUID[${doc.uuid}]{${escapeHtml(doc.name)}}</p>`,
        speaker: ChatMessage.getSpeaker?.({ user: game.user }) ?? {}
      });
      return { shown: false, message: "Journal show API was unavailable; posted a chat link instead.", details: { journalUuid: doc.uuid, fallback: "chatLink" } };
    }
    return { shown: false, message: "Journal show API was unavailable.", details: { journalUuid: doc.uuid } };
  }

  async requestRoll(action) {
    const config = action.config ?? {};
    const prompt = safeString(config.prompt, 1000, "Roll when ready.");
    const formula = safeRollFormula(config.formula);
    const dc = safeString(config.dc, 40);
    const rollType = safeString(config.rollType, 120);
    const actors = await resolveActorRefs(config.actorUuids ?? []);
    const actorLinks = actors
      .filter((entry) => entry.actor)
      .map((entry) => `@UUID[${entry.actor.uuid}]{${escapeHtml(entry.actor.name)}}`);
    const content = [
      `<h3>Roll Request</h3>`,
      `<p>${escapeHtml(prompt)}</p>`,
      `<p><strong>Formula:</strong> <code>${escapeHtml(formula)}</code>${dc ? ` <strong>DC:</strong> ${escapeHtml(dc)}` : ""}${rollType ? ` <strong>Type:</strong> ${escapeHtml(rollType)}` : ""}</p>`,
      actorLinks.length ? `<p><strong>For:</strong> ${actorLinks.join(", ")}</p>` : ""
    ].filter(Boolean).join("");
    const whisper = safeBoolean(config.whisper, false);
    const userIds = Array.isArray(config.userIds) ? config.userIds.map(String).filter(Boolean) : [];
    await ChatMessage.create({
      content,
      whisper: whisper ? (userIds.length ? userIds : activePlayerUserIds()) : undefined,
      speaker: ChatMessage.getSpeaker?.({ user: game.user }) ?? {}
    });
    return createResult(RESULT_STATUS.SUCCESS, "Roll request posted to chat.", { formula, dc, rollType, whisper });
  }

  async rollback(_action, context = {}) {
    const snapshot = context.snapshot ?? context.rollbackSnapshot;
    if (!snapshot || snapshot.adapter !== PROVIDERS.FOUNDRY) return createResult(RESULT_STATUS.UNSUPPORTED, "No native rollback snapshot was supplied.");
    try {
      switch (snapshot.kind) {
        case "scene-fields":
          return this.rollbackFields(snapshot, false);
        case "embedded-fields":
          return this.rollbackFields(snapshot, true);
        case "combatants-created":
          return this.rollbackCombatants(snapshot);
        case "playlist-cue":
          return this.rollbackPlaylist(snapshot);
        case "actor-items":
          return this.rollbackActorItems(snapshot);
        case "journal-created":
          return this.rollbackCreatedJournal(snapshot);
        default:
          return createResult(RESULT_STATUS.UNSUPPORTED, `Unsupported rollback snapshot kind: ${snapshot.kind}`);
      }
    } catch (error) {
      return createResult(RESULT_STATUS.FAILURE, error?.message ?? String(error));
    }
  }

  async rollbackFields(snapshot, embedded) {
    const docs = [];
    const updates = new Map();
    for (const target of snapshot.targets ?? []) {
      const doc = await resolveUuid(target.uuid);
      if (!doc) continue;
      docs.push(doc);
      updates.set(doc.uuid, target.values ?? {});
    }
    if (!docs.length) return createResult(RESULT_STATUS.FAILURE, "No rollback targets could be resolved.");
    if (embedded) await updateEmbeddedDocuments(docs, (doc) => updates.get(doc.uuid));
    else {
      for (const doc of docs) await doc.update(updates.get(doc.uuid));
    }
    return createResult(RESULT_STATUS.ROLLED_BACK, `Rolled back ${docs.length} native document(s).`);
  }

  async rollbackCombatants(snapshot) {
    const combat = await resolveUuid(snapshot.combatUuid);
    if (!combat || combat.documentName !== "Combat") return createResult(RESULT_STATUS.FAILURE, "Rollback Combat could not be resolved.");
    const ids = Array.isArray(snapshot.combatantIds) ? snapshot.combatantIds : [];
    const existing = ids.filter((id) => combat.combatants?.get?.(id));
    if (!existing.length) return createResult(RESULT_STATUS.SKIPPED, "No Director-created Combatants remain to remove.");
    await combat.deleteEmbeddedDocuments("Combatant", existing);
    return createResult(RESULT_STATUS.ROLLED_BACK, `Removed ${existing.length} Director-created Combatant(s).`);
  }

  async rollbackPlaylist(snapshot) {
    const playlist = await resolveUuid(snapshot.playlistUuid);
    if (!playlist || playlist.documentName !== "Playlist") return createResult(RESULT_STATUS.FAILURE, "Rollback Playlist could not be resolved.");
    const sound = snapshot.soundId ? playlist.sounds?.get?.(snapshot.soundId) : null;
    if (sound && typeof playlist.stopSound === "function") await playlist.stopSound(sound);
    else if (typeof playlist.stopAll === "function") await playlist.stopAll();
    else return createResult(RESULT_STATUS.UNSUPPORTED, "Playlist stop API is unavailable.");
    return createResult(RESULT_STATUS.ROLLED_BACK, "Stopped Director-started native Playlist cue.");
  }

  async rollbackActorItems(snapshot) {
    let changed = 0;
    for (const target of snapshot.targets ?? []) {
      const actor = await resolveUuid(target.actorUuid);
      if (!actor || actor.documentName !== "Actor") continue;
      const createdIds = (target.createdItemIds ?? []).filter((id) => actor.items?.get?.(id));
      if (createdIds.length) {
        await actor.deleteEmbeddedDocuments("Item", createdIds);
        changed += createdIds.length;
      }
      for (const update of target.quantityUpdates ?? []) {
        const item = actor.items?.get?.(update.itemId);
        if (!item) continue;
        await item.update({ [QUANTITY_PATH]: update.before });
        changed += 1;
      }
      for (const deleted of target.deletedItems ?? []) {
        if (actor.items?.get?.(deleted.itemId)) continue;
        await actor.createEmbeddedDocuments("Item", [cloneData(deleted.data)]);
        changed += 1;
      }
    }
    return changed
      ? createResult(RESULT_STATUS.ROLLED_BACK, `Rolled back ${changed} Actor Item change(s).`)
      : createResult(RESULT_STATUS.SKIPPED, "No Actor Item changes remained to roll back.");
  }

  async rollbackCreatedJournal(snapshot) {
    const journal = await resolveUuid(snapshot.journalUuid);
    if (!journal || journal.documentName !== "JournalEntry") return createResult(RESULT_STATUS.SKIPPED, "Created Journal handout was already gone.");
    await journal.delete();
    return createResult(RESULT_STATUS.ROLLED_BACK, "Deleted Director-created Journal handout.");
  }

  async emergencyStop() {
    return createResult(RESULT_STATUS.SKIPPED, "Native emergency stop cancels Director timers; it does not indiscriminately change Foundry documents.");
  }

  static handleSocketMessage(payload) {
    if (!payload || payload.type !== SOCKET_MESSAGES.PLAYER_CAMERA_PAN) return;
    const sender = game.users?.get?.(payload.senderId);
    if (!sender?.isGM) return;
    if (!Array.isArray(payload.targetUserIds) || !payload.targetUserIds.includes(game.user?.id)) return;
    if (payload.sceneId && canvas?.scene?.id !== payload.sceneId) return;
    const pan = payload.payload ?? {};
    const x = Number(pan.x);
    const y = Number(pan.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const duration = safeInteger(pan.duration, 0, 10000, 1000);
    const scale = pan.scale === undefined ? undefined : safeNumber(pan.scale, 0.1, 5, 1);
    const request = { x, y, duration };
    if (scale !== undefined) request.scale = scale;
    void canvas?.animatePan?.(request);
  }
}
