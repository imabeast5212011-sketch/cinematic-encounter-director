import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { BaseAdapter } from "./base-adapter.js";

export class NarratorsJukeboxAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.narratorsJukebox);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = super.getUnsupportedCapabilities(api, bridge);
    if (!bridge) {
      unsupported.push(
        "Narrator's Jukebox play/stop/fade/ambience/soundboard API was not confirmed from local source.",
        "The Director does not translate Jukebox references into native Playlists."
      );
    }
    return unsupported;
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.NARRATORS_JUKEBOX
    };
  }
}
