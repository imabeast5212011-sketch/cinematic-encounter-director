import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "narrators-jukebox.playMusic": {
    playMusic: ["playMusic", "music.play", "playTrack", "tracks.play", "playPlaylist", "playMood", "broadcastMusic", "play"],
    default: ["playMusic", "music.play", "playTrack", "tracks.play", "play"]
  },
  "narrators-jukebox.stopMusic": {
    stopMusic: ["stopMusic", "music.stop", "stopTrack", "tracks.stop", "fadeOut", "stopAll", "stop"],
    default: ["stopMusic", "music.stop", "stopTrack", "tracks.stop", "stop"]
  },
  "narrators-jukebox.ambience": {
    startAmbience: ["startAmbience", "playAmbience", "ambience.play", "loadAmbiencePreset", "playAmbiencePreset", "playPreset", "play"],
    stopAmbience: ["stopAmbience", "ambience.stop", "stopAmbiencePreset", "stopPreset", "stop"],
    default: ["startAmbience", "playAmbience", "ambience.play", "loadAmbiencePreset", "playPreset"]
  },
  "narrators-jukebox.soundCue": {
    playSoundCue: ["playSoundCue", "soundboard.play", "soundBoard.play", "playSound", "playSfx", "playEffect", "playCue", "play"],
    default: ["playSoundCue", "soundboard.play", "playSound", "playCue"]
  }
};

export class NarratorsJukeboxAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.narratorsJukebox, METHOD_CANDIDATES);
  }

  getAdditionalPublicApiCandidates() {
    return [
      { source: "globalThis.NarratorsJukebox.api", api: globalThis.NarratorsJukebox?.api },
      { source: "globalThis.NarratorsJukebox", api: globalThis.NarratorsJukebox },
      { source: "globalThis.NarratorJukebox.api", api: globalThis.NarratorJukebox?.api },
      { source: "globalThis.NarratorJukebox", api: globalThis.NarratorJukebox },
      { source: "globalThis.narratorsJukebox.api", api: globalThis.narratorsJukebox?.api },
      { source: "globalThis.narratorsJukebox", api: globalThis.narratorsJukebox },
      { source: "globalThis.narratorJukebox.api", api: globalThis.narratorJukebox?.api },
      { source: "globalThis.narratorJukebox", api: globalThis.narratorJukebox },
      { source: "game.narratorsJukebox.api", api: globalThis.game?.narratorsJukebox?.api },
      { source: "game.narratorsJukebox", api: globalThis.game?.narratorsJukebox },
      { source: "game.narratorJukebox.api", api: globalThis.game?.narratorJukebox?.api },
      { source: "game.narratorJukebox", api: globalThis.game?.narratorJukebox }
    ];
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.NARRATORS_JUKEBOX
    };
  }
}
