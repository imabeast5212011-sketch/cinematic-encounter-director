import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "sessionflow.trigger": {
    trigger: ["trigger", "run", "execute", "play", "broadcast", "broadcastScene", "openScene"],
    default: ["trigger", "run", "execute", "broadcast"]
  },
  "sessionflow.open": {
    open: ["open", "openGMPanel", "openPanel", "openWorkspace", "openSession", "openScene", "show", "focus"],
    default: ["open", "openGMPanel", "openPanel", "openWorkspace"]
  }
};

export class SessionFlowAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.sessionflow, METHOD_CANDIDATES);
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.SESSIONFLOW
    };
  }
}
