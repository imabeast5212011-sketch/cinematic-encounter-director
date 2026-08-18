import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "exalted-scenes.broadcast": {
    broadcast: ["broadcastScene", "broadcast", "playScene", "startScene", "presentScene", "start", "play"],
    open: ["openGMPanel", "openPanel", "open", "show"],
    openGMPanel: ["openGMPanel"],
    default: ["broadcastScene", "broadcast", "playScene", "openGMPanel"]
  },
  "exalted-scenes.stop": {
    stop: ["stopBroadcast", "stopScene", "stop", "clearBroadcast", "clear", "end", "close"],
    default: ["stopBroadcast", "stopScene", "stop", "clear"]
  }
};

export class ExaltedScenesAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.exaltedScenes, METHOD_CANDIDATES);
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.EXALTED_SCENES
    };
  }
}
