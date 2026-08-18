import { INTEGRATION_TARGETS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { BaseAdapter } from "./base-adapter.js";

const COTS_HUD_MODULE_ID = "cots-character-hud";

async function resolveActorUuid(uuid) {
  if (!uuid) return null;
  if (typeof fromUuid !== "function") return null;
  const document = await fromUuid(uuid);
  if (document?.documentName === "Actor") return document;
  if (document?.documentName === "Token" || document?.actor) return document.actor ?? null;
  return null;
}

function canPresent(api) {
  return typeof api?.socket?.emitStart === "function";
}

function canStopAll(api) {
  return typeof api?.socket?.emitStopAll === "function";
}

export class CharacterHudAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.characterHud);
  }

  getPublicApi(module) {
    const moduleApi = module?.api && typeof module.api === "object" ? module.api : null;
    const globalApi = game?.cotsCharacterHud && typeof game.cotsCharacterHud === "object" ? game.cotsCharacterHud : null;
    if (canPresent(globalApi) || canStopAll(globalApi)) return globalApi;
    return moduleApi ?? globalApi;
  }

  getDirectorBridge(api) {
    return api?.cinematicEncounterDirector ?? api?.encounterDirector ?? null;
  }

  getNativeCapabilities(api, bridge) {
    const capabilities = super.getNativeCapabilities(api, bridge);
    if (canPresent(api)) capabilities.push("presentActor");
    if (typeof api?.socket?.emitStop === "function") capabilities.push("stopActor");
    if (canStopAll(api)) capabilities.push("stopAll");
    if (typeof api?.openGmSpeakerPicker === "function") capabilities.push("openGmSpeakerPicker");
    return capabilities;
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (!api) return "API not detected";
    if (capabilities.includes("presentActor") && capabilities.includes("stopAll")) return "Ready";
    return super.statusFromDetection(module, api, bridge, capabilities);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = [];
    if (!api) return ["No COTS Character HUD API object detected."];
    if (!api.socket?.emitStart) unsupported.push("Speaker presentation start API was not detected.");
    if (!api.socket?.emitStopAll) unsupported.push("Speaker presentation stop-all API was not detected.");
    if (!bridge) unsupported.push("No Encounter Director bridge was detected; using confirmed game.cotsCharacterHud socket API.");
    return unsupported;
  }

  async resolveActor(action, context = {}) {
    const config = action.config ?? {};
    const explicitUuid = config.actorUuid || config.externalId || config.speakerActorUuid;
    const actor = await resolveActorUuid(explicitUuid);
    if (actor) return actor;

    const tokenUuid = config.tokenUuid;
    const tokenActor = await resolveActorUuid(tokenUuid);
    if (tokenActor) return tokenActor;

    if (config.useGmSpeaker !== false) {
      let gmSpeakerUuid = "";
      try {
        gmSpeakerUuid = game.settings?.get?.(COTS_HUD_MODULE_ID, "gmSpeakerActorUuid");
      } catch (_error) {
        gmSpeakerUuid = "";
      }
      const gmActor = await resolveActorUuid(gmSpeakerUuid);
      if (gmActor) return gmActor;
    }

    const controlled = canvas?.tokens?.controlled?.find((token) => token.actor)?.actor;
    if (controlled) return controlled;
    const contextTokenUuid = context?.action?.config?.tokenUuid || context?.tokenUuid;
    return resolveActorUuid(contextTokenUuid);
  }

  async validate(action, context = {}) {
    const status = await this.getStatus();
    if (status.status === "Disabled by setting") return createResult(RESULT_STATUS.UNSUPPORTED, "COTS Character HUD integration is disabled by setting.", { status });
    if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, "COTS Character HUD is not installed or could not be detected.", { status });
    if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, "COTS Character HUD is installed but inactive.", { status });
    if (action.type === "character-hud.stop") {
      if (!status.capabilities.includes("stopAll")) return createResult(RESULT_STATUS.UNSUPPORTED, "COTS Character HUD stop-all API is unavailable.", { status });
      return createResult(RESULT_STATUS.SUCCESS, "COTS Character HUD stop-all API is available.", { status });
    }
    if (!status.capabilities.includes("presentActor")) return createResult(RESULT_STATUS.UNSUPPORTED, "COTS Character HUD speaker presentation API is unavailable.", { status });
    const actor = await this.resolveActor(action, context);
    if (!actor) return createResult(RESULT_STATUS.WARNING, "No COTS Character HUD speaker Actor is configured. Set actorUuid/externalId, pick a GM speaker, or control a Token.", { status });
    return createResult(RESULT_STATUS.SUCCESS, `COTS Character HUD can present ${actor.name}.`, { status, actorUuid: actor.uuid });
  }

  async execute(action, context = {}) {
    const status = await this.getStatus();
    const api = this.getPublicApi(this.detectModule());
    if (status.status !== "Ready") return createResult(RESULT_STATUS.UNSUPPORTED, `COTS Character HUD action is unavailable: ${status.status}.`, { status });
    if (context?.dryRun) return createResult(RESULT_STATUS.DRY_RUN, `Dry run: would run COTS Character HUD action ${action.name}.`, { status });

    if (action.type === "character-hud.stop") {
      if (!canStopAll(api)) return createResult(RESULT_STATUS.UNSUPPORTED, "COTS Character HUD stop-all API is unavailable.", { status });
      const ok = api.socket.emitStopAll();
      return createResult(ok ? RESULT_STATUS.SUCCESS : RESULT_STATUS.WARNING, ok ? "Stopped COTS Character HUD presentations." : "COTS Character HUD did not stop presentations.", { status });
    }

    if (!canPresent(api)) return createResult(RESULT_STATUS.UNSUPPORTED, "COTS Character HUD speaker presentation API is unavailable.", { status });
    const actor = await this.resolveActor(action, context);
    if (!actor) return createResult(RESULT_STATUS.WARNING, "No COTS Character HUD speaker Actor was available.", { status });

    const config = action.config ?? {};
    const mode = config.mode || "gm";
    const linger = Number.isFinite(Number(config.lingerMs)) ? Number(config.lingerMs) : undefined;
    const ok = await api.socket.emitStart(actor, {
      mode,
      source: "encounter-director",
      chatText: config.chatText || config.text || "",
      ...(linger !== undefined ? { linger } : {})
    });
    return createResult(ok ? RESULT_STATUS.SUCCESS : RESULT_STATUS.WARNING, ok ? `Presented ${actor.name} in COTS Character HUD.` : `COTS Character HUD did not present ${actor.name}.`, {
      status,
      actorUuid: actor.uuid
    });
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.CHARACTER_HUD
    };
  }
}
