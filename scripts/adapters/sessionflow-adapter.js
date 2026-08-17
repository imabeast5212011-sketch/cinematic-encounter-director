import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { BaseAdapter } from "./base-adapter.js";

export class SessionFlowAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.sessionflow);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = super.getUnsupportedCapabilities(api, bridge);
    if (!bridge) {
      unsupported.push(
        "SessionFlow trigger/open content API was not confirmed from local source.",
        "Expected bridge methods: getCapabilities, validateAction, executeAction, optional rollbackAction."
      );
    }
    return unsupported;
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.SESSIONFLOW
    };
  }
}
