# Cinematic Encounter Director: Simple GM Guide

This guide is for using Cinematic Encounter Director at the table without needing to understand the code.

The short version:

- Build the encounter before the session.
- Validate before you run anything.
- During play, use the Director like a cue list.
- Let Triggers select the next Beat first; only make them auto-run after you trust them.

## What The Words Mean

Sequence:

The whole encounter plan.

Example: `Goblin Ambush`

Beat:

One phase, reveal, wave, turn, cutaway, or important moment inside the encounter.

Example: `Beat 1: Start combat`, `Beat 2: Reinforcements`, `Beat 3: Boss flees`

Action:

One thing the module does when a Beat runs.

Example: reveal Tokens, start Combat, play music, show a HUD card, wait for GM confirmation.

Trigger:

A rule that watches the fight and moves to, runs, or starts a Beat when something happens.

Example: when 2 enemies are defeated, select the reinforcement Beat.

## The Safest Workflow

Use this order almost every time:

1. Prepare the Scene.
2. Create a Sequence.
3. Add Beats.
4. Add Actions to each Beat.
5. Add Triggers only where useful.
6. Validate every Beat.
7. Run the encounter from the Director.

Do not start with automation. Get the manual version working first, then add Triggers.

## First-Time Setup

1. Install or update the module in Foundry.
2. Enable **Cinematic Encounter Director** in Manage Modules.
3. Reload the browser after updating.
4. Open your world as a GM.
5. Open the Scene you want to run.

For v0.1.17, the module should load this runtime:

```text
scripts/runtime-0.1.17/main.js
```

If Foundry still shows an older version, reload the browser fully.

## Open The Director

As GM, use the Director button in the Scene controls.

You can also run this in the browser console:

```js
game.modules.get("cinematic-encounter-director").api.openDirector()
```

The main Director window is for running the encounter.

The Sequence editor is for building or changing the encounter.

## Build A Basic Combat

This is the best first thing to test.

1. Open the battle Scene.
2. Place the enemy Tokens.
3. Hide the enemy Tokens if they should not be visible yet.
4. Select the enemy Tokens on the canvas.
5. Open the Director.
6. Click the plus button to create a Sequence.
7. Open the Sequence editor.
8. Click **Bind Current Scene**.
9. Rename the Sequence.
10. Select Beat 1.
11. Click **Add Combat Setup From Selected Tokens**.
12. Click **Save Beat**.
13. Close the editor.
14. Click **Validate** in the Director.
15. If validation is okay, click **Run Selected Beat**.

That shortcut can create Actions for:

- Activating or binding the Scene.
- Revealing selected Tokens.
- Creating Combat.
- Adding selected Tokens to Combat.
- Starting Combat.

## Add A Reinforcement Beat

Use this when enemies or allies enter later.

1. Put the reinforcement Tokens on the Scene.
2. Hide them.
3. Select those Tokens.
4. Open the Sequence editor.
5. Add a new Beat.
6. Name it something clear, like `Wave 2 Reinforcements`.
7. Click **Add Reinforcement Wave**.
8. Click **Save Beat**.
9. Validate the Beat from the Director.

When you run this Beat, it can reveal those Tokens and add them to the current Combat.

## Add A Normal Action

1. Open the Sequence editor.
2. Select the Beat.
3. In the Actions section, pick an Action type.
4. Click **Add Action**.
5. Fill in the Action editor.
6. Save.
7. Validate the Beat.

Keep Action names plain and table-facing.

Good names:

- `Reveal rooftop archers`
- `Start phase two music`
- `Wait for villain speech`
- `Set darkness to 80%`

Bad names:

- `Action 4`
- `native.setTokenVisibility`
- `Stuff happens`

## Recommended Beat Structure

A clean encounter might look like this:

1. `Setup and start combat`
2. `First enemy drop`
3. `Reinforcements arrive`
4. `Boss bloodied`
5. `Escape or surrender`
6. `Cleanup`

Each Beat should be something you can understand at a glance while players are talking.

## Running The Encounter

Use the main Director window during play.

Common controls:

- Previous Beat: move selection backward.
- Next Beat: move selection forward.
- Validate: check the selected Beat.
- Run Selected Beat: execute the selected Beat.
- Stop: stop the running Beat on your client.
- Emergency Stop: cancel active Director timers and supported Director-owned output.
- Roll Back: undo the last supported Action if rollback exists.
- Reset State: clear stored Action results and Trigger fire-state for this Sequence.

Important: Next and Previous only change the selected Beat. They do not run it.

## Validate Before Running

Use **Validate** before you run a Beat.

Validation helps catch:

- Missing Tokens.
- Missing Scenes.
- Unsupported integrations.
- Disabled integrations.
- Risky combat changes.
- Bad references.

If validation warns you, read it before running.

## What Rollback Does

Rollback can undo some things, but not everything.

Rollback can help with:

- Token hidden state.
- Token position.
- Token elevation.
- Token disposition.
- Scene darkness.
- Some Scene environment fields.
- Some light, wall, and door changes.
- Combatants added by the Director.

Rollback does not promise to undo:

- Scene activation.
- Chat messages.
- Combat start/end.
- Combat round/turn changes.
- Pause state.
- External module effects without a confirmed rollback API.

Treat rollback as a safety net, not a time machine.

## What Emergency Stop Does

Emergency Stop:

- Stops active Director timers.
- Cancels current Director execution on your GM client.
- Releases locks where possible.
- Asks supported adapters to stop Director-owned work.

Emergency Stop does not undo completed changes. Use rollback separately when rollback is available.

## Add Triggers Safely

The safest Trigger setup is:

- Trigger selects the Beat.
- GM sees the Beat.
- GM chooses whether to run it.

That means most Triggers should start with:

```json
"action": "selectBeat"
```

Only change a Trigger to `runBeat` after you have tested it.

## Where To Put A Trigger

Put the Trigger on the Beat you want to happen.

Example:

You want Beat 2 to become selected after two enemies die.

Put the enemy-count Trigger on Beat 2.

Not Beat 1. Beat 2.

## Trigger: Enemy Defeated Count

Use this for waves, phase changes, or morale breaks.

1. Open the Sequence editor.
2. Select the Beat you want to happen.
3. Click **Add Enemy Count Trigger**.
4. In **Triggers JSON**, change the count.
5. Save the Beat.

Example:

```json
[
  {
    "name": "Wave two after two enemies fall",
    "event": "enemyDefeatedCount",
    "count": 2,
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

This selects the Beat when two hostile combatants are defeated.

## Trigger: Boss HP Threshold

Use this for phase changes.

Easy version:

1. Select the boss Token.
2. Open the Sequence editor.
3. Select the phase-change Beat.
4. Click **Add HP 50% Trigger**.
5. Save the Beat.

Example for 25 percent instead:

```json
[
  {
    "name": "Boss phase change at 25 percent",
    "event": "tokenHpAtOrBelow",
    "threshold": 25,
    "thresholdType": "percent",
    "comparison": "lte",
    "tokenUuids": ["Scene.example.Token.boss"],
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

Example for exact HP:

```json
[
  {
    "name": "Boss phase change at 20 HP",
    "event": "tokenHpAtOrBelow",
    "threshold": 20,
    "thresholdType": "hp",
    "comparison": "lte",
    "tokenUuids": ["Scene.example.Token.boss"],
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

## Trigger: Ally Defeated

Use this for rescues, panic moments, villain reactions, or fail-forward scenes.

Easy version:

1. Select the ally Token.
2. Select the Beat you want.
3. Click **Add Ally Death Trigger**.
4. Save the Beat.

If no Token is selected, the quick button creates a general ally defeated Trigger.

## Trigger: Combat Round

Use this for timed events.

Example:

```json
[
  {
    "name": "Round three escalation",
    "event": "combatRoundAtLeast",
    "round": 3,
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

This selects the Beat when Combat reaches round 3 or later.

## Make A Trigger Run A Beat

Change:

```json
"action": "selectBeat"
```

to:

```json
"action": "runBeat"
```

By default, `runBeat` asks the GM for confirmation.

If you want it fully automatic, add:

```json
"requiresConfirmation": false
```

Example:

```json
[
  {
    "name": "Auto-run wave two",
    "event": "enemyDefeatedCount",
    "count": 2,
    "action": "runBeat",
    "requiresConfirmation": false,
    "once": true,
    "enabled": true
  }
]
```

Use full automation only after testing it in a dummy fight.

## Make A Trigger Start Another Sequence

Use this when one encounter phase should hand off to another Sequence.

```json
[
  {
    "name": "Start escape sequence",
    "event": "enemyDefeatedCount",
    "count": 5,
    "action": "startSequence",
    "targetSequenceId": "sequence-id-here",
    "requiresConfirmation": true,
    "once": true,
    "enabled": true
  }
]
```

If `targetBeatId` is blank, the target Sequence uses its starting Beat or first Beat.

## Prevent Trigger Accidents

Use these defaults:

- Keep `"once": true`.
- Keep `"action": "selectBeat"` while testing.
- Keep GM confirmation on for `runBeat`.
- Validate the Beat before the session.
- Do not add a new Trigger while its condition is already true unless you want it to fire soon.
- Do not press **Reset State** unless you want once-only Triggers to be able to fire again.

Once a once-only Trigger fires, the module records that in the Scene. Foundry can send more combat or HP updates, but the same Trigger should not fire again unless its state is reset or the Trigger is replaced.

## Use Integrations

Look at Integration Health.

Ready:

The Director found enough public API to use the module.

Detected only:

The Director sees the module, but did not confirm a safe usable API for the Action.

Config only:

The module exposes status or configuration behavior, but not enough to drive encounter cues.

To add an integration Action:

1. Open the Sequence editor.
2. Select a Beat.
3. Choose the integration Action from the Action dropdown.
4. Click **Add Action**.
5. Fill in the config.
6. Save.
7. Validate.

## Good First Trigger Test

Do this before using Triggers in a real session.

1. Make a test Scene.
2. Add two hostile enemy Tokens.
3. Create a Sequence.
4. Beat 1: add combat setup.
5. Beat 2: add a GM note Action named `Trigger worked`.
6. Put this Trigger on Beat 2:

```json
[
  {
    "name": "One enemy down",
    "event": "enemyDefeatedCount",
    "count": 1,
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

7. Run Beat 1.
8. Defeat one enemy.
9. Confirm the Director selects Beat 2.
10. Manually run Beat 2.

After that works, test `runBeat` with confirmation on.

## Common Problems

The Director does not open:

- Make sure you are GM.
- Make sure the module is enabled.
- Reload the browser.

My Beat will not run:

- Click **Validate**.
- Check the execution log.
- Check missing Token, Scene, or integration references.

My Trigger does not fire:

- Make sure automation Triggers are enabled in module settings.
- Make sure the Beat was saved after editing Trigger JSON.
- Make sure the Sequence is bound to the current Scene.
- Make sure the enemy Token is hostile if using `enemyDefeatedCount`.
- Make sure the Token is in Combat.
- Make sure the combatant is marked defeated or at 0 HP.
- Make sure the Trigger has not already fired once.

My Trigger fired too early:

- The condition may already have been true when you saved it.
- Use **Reset State** only when you want it armed again.
- Prefer `selectBeat` before using `runBeat`.

An integration Action is missing:

- Check Integration Health.
- Make sure the other module is active.
- If it says **Detected only**, the Director may not have a confirmed public API for that module feature.

The UI still shows an old version:

- Do a full browser reload.
- Restart Foundry if needed.
- Confirm the module manifest points at the current runtime folder.

## Best Habits

- Name every Beat clearly.
- Name every Action like a cue.
- Keep Beats short.
- Validate before the session.
- Use Triggers to select Beats before using them to run Beats.
- Put dangerous effects behind confirmation.
- Test integrations before game night.
- Keep the execution log visible when debugging.
- Make one small dummy encounter to test big automation ideas.

## Tiny Example Encounter

Sequence: `Bridge Ambush`

Beat 1: `Start the ambush`

- Reveal hidden bandits.
- Create Combat.
- Add bandits to Combat.
- Start Combat.

Beat 2: `Archers join`

- Reveal rooftop archers.
- Add archers to Combat.
- Pan GM camera to rooftops.

Trigger on Beat 2:

```json
[
  {
    "name": "Archers after two bandits fall",
    "event": "enemyDefeatedCount",
    "count": 2,
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

Beat 3: `Boss flees`

- Show GM note.
- Set boss Token destination.
- Play escape music or ambience if configured.

Trigger on Beat 3:

```json
[
  {
    "name": "Boss flees at 25 percent",
    "event": "tokenHpAtOrBelow",
    "threshold": 25,
    "thresholdType": "percent",
    "comparison": "lte",
    "tokenUuids": ["Scene.example.Token.boss"],
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

That is enough to run a staged tactical encounter without letting automation take the wheel away from the GM.
