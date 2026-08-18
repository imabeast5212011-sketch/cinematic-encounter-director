import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "exalted-scenes.broadcast": {
    broadcast: ["broadcastScene", "broadcast", "broadcastContent", "playScene", "startScene", "presentScene", "present", "start", "play"],
    open: ["openGMPanel", "openPanel", "open", "openScene", "show"],
    openGMPanel: ["openGMPanel"],
    default: ["broadcastScene", "broadcast", "broadcastContent", "playScene", "presentScene", "present", "openGMPanel"]
  },
  "exalted-scenes.stop": {
    stop: ["stopBroadcast", "stopPresentation", "stopScene", "stop", "clearBroadcast", "clearPresentation", "clear", "end", "close"],
    default: ["stopBroadcast", "stopPresentation", "stopScene", "stop", "clear"]
  }
};

export class ExaltedScenesAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.exaltedScenes, METHOD_CANDIDATES);
  }

  getAdditionalPublicApiCandidates() {
    return [
      { source: "globalThis.ExaltedScenes.api", api: globalThis.ExaltedScenes?.api },
      { source: "globalThis.ExaltedScenes", api: globalThis.ExaltedScenes },
      { source: "globalThis.exaltedScenes.api", api: globalThis.exaltedScenes?.api },
      { source: "globalThis.exaltedScenes", api: globalThis.exaltedScenes },
      { source: "game.exaltedScenes.api", api: globalThis.game?.exaltedScenes?.api },
      { source: "game.exaltedScenes", api: globalThis.game?.exaltedScenes },
      { source: "game.exalted?.scenes?.api", api: globalThis.game?.exalted?.scenes?.api },
      { source: "game.exalted?.scenes", api: globalThis.game?.exalted?.scenes }
    ];
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.EXALTED_SCENES
    };
  }
}
