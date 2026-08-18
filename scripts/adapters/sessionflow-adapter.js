import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "sessionflow.trigger": {
    trigger: ["trigger", "triggerContent", "run", "runContent", "execute", "executeContent", "play", "broadcast", "broadcastContent", "broadcastScene", "openScene"],
    default: ["trigger", "triggerContent", "run", "runContent", "execute", "broadcast", "broadcastContent"]
  },
  "sessionflow.open": {
    open: ["open", "openContent", "openGMPanel", "openPanel", "openWorkspace", "openSession", "openScene", "show", "showContent", "focus"],
    default: ["open", "openContent", "openGMPanel", "openPanel", "openWorkspace"]
  }
};

export class SessionFlowAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.sessionflow, METHOD_CANDIDATES);
  }

  getAdditionalPublicApiCandidates() {
    return [
      { source: "globalThis.SessionFlow.api", api: globalThis.SessionFlow?.api },
      { source: "globalThis.SessionFlow", api: globalThis.SessionFlow },
      { source: "globalThis.sessionFlow.api", api: globalThis.sessionFlow?.api },
      { source: "globalThis.sessionFlow", api: globalThis.sessionFlow },
      { source: "globalThis.sessionflow.api", api: globalThis.sessionflow?.api },
      { source: "globalThis.sessionflow", api: globalThis.sessionflow },
      { source: "game.sessionFlow.api", api: globalThis.game?.sessionFlow?.api },
      { source: "game.sessionFlow", api: globalThis.game?.sessionFlow },
      { source: "game.sessionflow.api", api: globalThis.game?.sessionflow?.api },
      { source: "game.sessionflow", api: globalThis.game?.sessionflow }
    ];
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.SESSIONFLOW
    };
  }
}
