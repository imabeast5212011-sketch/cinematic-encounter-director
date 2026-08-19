# AI Encounter JSON Guide

This file is the contract for another AI, MCP bridge, or Foundry-side helper that wants to author encounters for Cinematic Encounter Director.

The best source is the live Foundry API, because it includes the current action catalog and any custom MCP providers registered in that world:

```js
const api = game.modules.get("cinematic-encounter-director").api;
const context = await api.getEncounterAuthoringContext();
```

If the other AI only has repository access, read these files:

- `schemas/encounter-package.schema.json`
- `scripts/actions/native-actions.js`
- `scripts/actions/integration-actions.js`
- `scripts/constants.js`

The live API is still preferred because repository files cannot know which integrations are installed, enabled, or custom-registered in the current Foundry world.

## Runtime Workflow

Use this flow from Shadowbridge, another browser MCP, or a small Foundry bridge module:

```js
const api = game.modules.get("cinematic-encounter-director").api;

const context = await api.getEncounterAuthoringContext();
const packageJson = await someAiGenerateEncounter(context, gmBrief);

const validation = api.validateEncounterJson(packageJson);
console.log(validation);

const result = await api.importEncounterJson(packageJson, { mode: "duplicate" });
console.log(result.imported);
```

To export existing material for another AI to study:

```js
const api = game.modules.get("cinematic-encounter-director").api;
const currentScenePackage = await api.exportEncounterJson();
const oneSequencePackage = await api.exportEncounterJson({ sequenceId: "sequence-id-here" });
```

To create or replace a single Sequence by id:

```js
const api = game.modules.get("cinematic-encounter-director").api;
const saved = await api.upsertSequence(sequenceObject, { replace: true });
```

To run a Beat after import and GM review:

```js
await api.requestExecution({
  sequenceId: "sequence-id-here",
  beatId: "beat-id-here",
  dryRun: true
});
```

## Public API Added For AI And MCP Tools

- `getJsonSchema()` returns the encounter package JSON schema.
- `getEncounterAuthoringContext()` returns the schema, runtime action catalog, trigger enums, provider ids, limits, forbidden fields, and an example package.
- `readActionTypeCatalog()` returns the runtime action picker entries.
- `exportEncounterJson(options)` returns one Sequence package or the current Scene package.
- `validateEncounterJson(input)` parses and normalizes a package without saving it.
- `importEncounterJson(input, options)` imports a package into the current Scene. Default mode is `duplicate`.
- `upsertSequence(sequence, options)` creates or replaces one Sequence object by id.

All mutating methods require a GM user.

## What The Other AI Needs From The GM

The AI can write structure, pacing, notes, triggers, and generic Foundry-native actions from the schema alone.

It should ask the GM, or read from a live Foundry bridge, for real references:

- Scene UUIDs.
- Token UUIDs.
- Actor UUIDs.
- Wall UUIDs.
- Ambient Light UUIDs.
- Playlist UUIDs and sound ids.
- External ids for SessionFlow, Exalted Scenes, Narrator's Jukebox, FXMaster, Character HUD, or custom providers.

If a real UUID or external id is not available, leave that field blank and add a clear GM note explaining what must be remapped.

## JSON Rules

- Return JSON only when asked for an import package.
- Use `moduleId: "cinematic-encounter-director"`.
- Use `schemaVersion: 1`.
- Put encounters in `sequences`.
- Every Sequence needs an `id`, `name`, `beatIds`, and `beats`.
- Every Beat needs an `id`, `name`, `actionIds`, and `actions`.
- `beatIds` must match and order the Beat ids.
- `actionIds` must match and order the Action ids.
- Imported data never executes immediately. The GM imports, reviews, validates, then runs it.
- Do not invent UUIDs unless a live Foundry tool supplied them.
- Do not include Windows absolute file paths.
- Do not include fields named `script`, `macro`, `command`, `code`, `function`, `handler`, or `callback`; imports reject them.

## Minimal Package Shape

```json
{
  "moduleId": "cinematic-encounter-director",
  "schemaVersion": 1,
  "scope": "ai-generated",
  "sequences": [
    {
      "id": "sequence-example",
      "name": "Example Encounter",
      "description": "Short GM-facing summary.",
      "sceneUuid": "",
      "startingBeatId": "beat-opening",
      "beatIds": ["beat-opening"],
      "beats": [
        {
          "id": "beat-opening",
          "name": "Opening Cue",
          "description": "What happens first.",
          "actionIds": ["action-note"],
          "actions": [
            {
              "id": "action-note",
              "type": "native.chatMessage",
              "adapter": "foundry-native",
              "name": "GM note",
              "enabled": true,
              "config": {
                "message": "The encounter begins.",
                "whisperGmOnly": true
              },
              "order": 0,
              "executionMode": "sequential",
              "failurePolicy": "stop"
            }
          ],
          "triggers": [],
          "dangerLevel": "safe"
        }
      ],
      "tags": ["ai-authored"],
      "enabled": true,
      "archived": false
    }
  ],
  "referenceMetadata": []
}
```

## Trigger Examples

Enemy count trigger:

```json
{
  "id": "trigger-two-enemies-down",
  "name": "Two enemies defeated",
  "enabled": true,
  "event": "enemyDefeatedCount",
  "action": "runBeat",
  "targetBeatId": "beat-reinforcements",
  "count": 2,
  "once": true,
  "cooldownMs": 10000,
  "requiresConfirmation": true
}
```

HP threshold trigger:

```json
{
  "id": "trigger-boss-bloodied",
  "name": "Boss bloodied",
  "enabled": true,
  "event": "tokenHpAtOrBelow",
  "action": "selectBeat",
  "targetBeatId": "beat-boss-phase-two",
  "threshold": 50,
  "thresholdType": "percent",
  "comparison": "lte",
  "tokenUuids": [],
  "once": true,
  "requiresConfirmation": false
}
```

## Item, Handout, And Roll Examples

Give an Item to Actors or selected Token actors. This action remains GM-confirmed at execution time:

```json
{
  "id": "action-give-silver-key",
  "type": "native.giveItemToActor",
  "adapter": "foundry-native",
  "name": "Give Silver Key",
  "enabled": true,
  "config": {
    "actorUuids": [],
    "itemUuid": "",
    "quantity": 1,
    "stack": true
  },
  "order": 0,
  "executionMode": "sequential",
  "failurePolicy": "stop",
  "requiresConfirmation": true
}
```

Create a Journal handout. This action remains GM-confirmed at execution time:

```json
{
  "id": "action-create-letter-handout",
  "type": "native.createJournalHandout",
  "adapter": "foundry-native",
  "name": "Create Cult Letter handout",
  "enabled": true,
  "config": {
    "name": "Cult Letter",
    "pageName": "Letter",
    "content": "<p>The letter bears a broken black seal.</p>",
    "ownershipLevel": "observer",
    "showToPlayers": false
  },
  "order": 1,
  "executionMode": "sequential",
  "failurePolicy": "stop",
  "requiresConfirmation": true
}
```

Request a roll in chat. This asks; it does not force a player sheet to roll:

```json
{
  "id": "action-request-arcana",
  "type": "native.requestRoll",
  "adapter": "foundry-native",
  "name": "Request Arcana check",
  "enabled": true,
  "config": {
    "prompt": "The symbols pulse with old magic. Roll Arcana.",
    "formula": "1d20",
    "dc": "15",
    "rollType": "Arcana",
    "actorUuids": [],
    "userIds": [],
    "whisper": false
  },
  "order": 2,
  "executionMode": "sequential",
  "failurePolicy": "stop"
}
```

## Custom MCP Provider Pattern

A Foundry-side bridge can register its own provider and action type:

```js
const api = game.modules.get("cinematic-encounter-director").api;

api.registerActionProvider({
  id: "my-mcp",
  displayName: "My MCP",
  capabilities: ["generateEncounter", "summarizeBeat"],
  validate: async (action) => ({ status: "success", message: `${action.name} is ready.`, details: {} }),
  execute: async (action, context) => {
    const result = await window.myMcpBridge.call(action.config.operation, {
      action,
      sequence: context.sequence,
      beat: context.beat
    });
    return { status: "success", message: "MCP action completed.", details: { result } };
  }
});

api.registerActionType({
  id: "my-mcp.generateEncounter",
  provider: "my-mcp",
  label: "Generate encounter with My MCP",
  description: "Asks a local MCP bridge to prepare encounter material.",
  dangerLevel: "safe",
  defaultConfig: { operation: "generateEncounter", prompt: "" }
});
```

After registration, `getEncounterAuthoringContext()` will include the custom action type so an outside AI can use it without reading source files.
