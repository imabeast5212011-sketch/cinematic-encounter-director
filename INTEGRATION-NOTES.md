# Integration Notes

This file records what was confirmed from non-C local sources and what must be confirmed on the remote Foundry VTT v14 server.

No proprietary third-party source code or assets were copied into Cinematic Encounter Director.

## SessionFlow

- Confirmed module id: `sessionflow`.
- Detected live version: `1.0.2`.
- Public API entry point: `game.modules.get("sessionflow").api`.
- Methods or hooks used: explicit public method calls configured through Action `config.method`, plus known method-name candidates for trigger/open style calls.
- Confirmed capabilities: public API method discovery and guarded method calls.
- Desired capabilities: trigger supported widgets or broadcasts, reference existing content, open or focus GM content where public API supports it.
- Unsupported in this build without API documentation: private canvas state, private widget stores, or DOM manipulation.
- Runtime assumptions: module id candidate `sessionflow`; title search for `SessionFlow`.
- Required live tests: detect installed id/version, inspect Integration Health Public API method list, set `config.method` and `config.args` or `callStyle` as needed, trigger each supported content type, handle inactive or deleted content.

## Exalted Scenes

- Confirmed module id: `exalted-scenes`.
- Detected live version: `7.0.7`.
- Public API entry point: `game.modules.get("exalted-scenes").api`.
- Methods or hooks used: explicit public method calls configured through Action `config.method`, plus known method-name candidates for broadcast/stop/open calls.
- Confirmed capabilities: public API method discovery and guarded method calls.
- Desired capabilities: broadcast existing presentation, present existing cast or character configuration, trigger existing sequence or slideshow, stop Director-triggered presentation where supported.
- Unsupported in this build without API documentation: private scene stores, private broadcast state, DOM manipulation, or private flags.
- Runtime assumptions: module id candidate `exalted-scenes`; title search for `Exalted Scenes`.
- Required live tests: detect installed id/version, inspect Integration Health Public API method list, set `config.method` and `config.args` or `callStyle` as needed, broadcast and stop known content, verify no private flags or UI control are used.

## Narrator's Jukebox

- Confirmed module id: `narrator-jukebox`.
- Detected live version: `5.0.2`.
- Public API entry point: `game.modules.get("narrator-jukebox").api`.
- Methods or hooks used: explicit public method calls configured through Action `config.method`, plus known method-name candidates for music, ambience, and soundboard calls.
- Confirmed capabilities: public API method discovery and guarded method calls.
- Desired capabilities: play music, stop music, fade or transition, start or stop ambience presets or layers, play soundboard cue, stop Director-started loop.
- Unsupported in this build without API documentation: private audio stores, private sockets, or translating Jukebox references into native Foundry Playlists.
- Runtime assumptions: module id candidates `narrator-jukebox`, `narrators-jukebox`, and `narrators_jukebox`; title search for `Narrator's Jukebox`.
- Required live tests: detect installed id/version, inspect Integration Health Public API method list, set `config.method` and `config.args` or `callStyle` as needed, play and stop each supported content kind, confirm Emergency Stop affects only Director-owned audio.

## Gambit's FXMaster

- Confirmed module id: `fxmaster`.
- Detected version: `8.3.5` from local manifest and live world inventory.
- Public API entry point: `FXMASTER.api`.
- Methods or hooks used: `FXMASTER.api.presets.play()`, `stop()`, `toggle()`, `switch()`, `FXMASTER.api.effects.play()`, `stop()`, `toggle()`, `FXMASTER.api.stopSceneEffects()`, and optional `stopRegionEffects()`.
- Confirmed capabilities: preset play, stop, toggle, switch, effect play, stop, toggle, stop scene effects, optional stop region effects.
- Desired capabilities: play existing preset, start and stop particle effect, start and stop filter effect, clear Director-owned effects, dangerous clear-all through separate confirmation.
- Unsupported in this build without API documentation: direct manipulation of FXMaster private flags or UI state.
- Runtime assumptions: module id candidate `fxmaster`; title search for `FXMaster`.
- Required live tests: detect installed id/version, verify public API, trigger a preset, start and stop Director-owned effects, test layers, verify clear-all requires explicit confirmation.

## COTS Character HUD

- Confirmed module id: `cots-character-hud`.
- Detected local version: `0.1.10`.
- Public API entry point: `game.cotsCharacterHud`.
- Methods or hooks used: `game.cotsCharacterHud.socket.emitStart()` and `emitStopAll()`.
- Confirmed capabilities: present Actor through the HUD speaker system, stop all HUD presentations, open GM speaker picker when present.
- Desired capabilities: trigger supported speaker or cinematic presentation, stop Director-triggered presentation where supported.
- Unsupported in this build without API documentation: DOM manipulation, overlay private flags, or non-public presentation state.
- Runtime assumptions: module id candidates `cots-character-hud` and `cots-character-hud-v2`; title search for `COTS Character HUD`.
- Required live tests: detect installed id/version, verify `game.cotsCharacterHud`, trigger and stop a supported presentation, confirm no DOM or private flag manipulation.

## Cinematic Combat Timeline

- Confirmed module id: `cinematic-combat-timeline`.
- Detected local version: `0.1.13`.
- Confirmed public API entry point: `game.modules.get("cinematic-combat-timeline").api`.
- Confirmed public API members in local source: `controller`, `openCountdownConfig()`, and `destroy()`.
- Methods or hooks used: `api.openCountdownConfig()` only for the optional `combat-timeline.openConfig` Action.
- Confirmed capabilities: open countdown configuration, observe controller status.
- Unsupported desired capabilities: create, update, reset, enable, disable, or remove countdown markers through public API.
- Runtime assumptions: no private Combat flag writes are performed by the Director.
- Required live tests: detect installed id/version, verify the API members at runtime, open countdown configuration, confirm countdown mutations report unavailable until a public countdown API exists.

## Encounter Director Bridge Contract

Optional integrations can support the Director without private imports by exposing one of:

```js
game.modules.get(moduleId).api.cinematicEncounterDirector
game.modules.get(moduleId).api.encounterDirector
```

Supported bridge members:

- `getCapabilities()`.
- `validateAction({ providerId, action })`.
- `executeAction({ providerId, action, context })`.
- Optional `rollbackAction({ providerId, action, context })`.
- Optional `emergencyStop({ providerId })`.

The Director sends only ids, action config, and minimal execution context. It does not send proprietary module objects through sockets or adapters.
