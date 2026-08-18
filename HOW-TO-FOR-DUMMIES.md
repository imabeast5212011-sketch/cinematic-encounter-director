# Cinematic Encounter Director: How To For Dummies

This is the simple version. You are the GM. You want to prep an encounter, press buttons during play, and maybe let a few things advance automatically.

## The Basic Idea

Think of the module like this:

- Sequence: the whole encounter.
- Beat: one phase of the encounter.
- Action: one thing that happens during that phase.
- Trigger: a rule that notices something in combat and jumps to or runs a Beat.

Example:

- Sequence: Bandit ambush.
- Beat 1: Start the fight.
- Beat 2: Reinforcements arrive.
- Beat 3: Boss monologue.
- Trigger: when 2 enemies are defeated, jump to Beat 2.

## Install Or Update

1. Put the module folder in Foundry's `Data/modules/` folder.
2. Restart Foundry if it does not notice the new version.
3. Enable **Cinematic Encounter Director** in Manage Modules.
4. Do a full browser reload after updating.
5. Confirm the Director title shows the expected version.

For v0.1.17, the manifest should load:

```text
scripts/runtime-0.1.17/main.js
```

## Open The Director

As GM:

1. Open your Scene.
2. Use the Director button in Scene controls.
3. Or run this in the browser console:

```js
game.modules.get("cinematic-encounter-director").api.openDirector()
```

## Make Your First Combat

1. Put the enemy Tokens on the Scene.
2. Hide them if they should start hidden.
3. Select the enemy Tokens on the canvas.
4. Open the Director.
5. Click the plus button to create a Sequence.
6. Open the Sequence editor.
7. Click **Bind Current Scene**.
8. Rename the Sequence.
9. Select Beat 1.
10. Click **Add Combat Setup From Selected Tokens**.
11. Click **Save Beat**.
12. Close the editor.
13. In the Director, click **Validate**.
14. If validation looks okay, click **Run Selected Beat**.

That gives you a working first Beat that can activate the Scene, reveal Tokens, create Combat, add Tokens, and start Combat.

## Add Reinforcements

1. Put reinforcement Tokens on the Scene.
2. Hide them.
3. Select those reinforcement Tokens.
4. Open the Sequence editor.
5. Add a new Beat.
6. Click **Add Reinforcement Wave**.
7. Save the Beat.

During the session, run that Beat when you want the wave to appear.

## Add A Normal Action

1. Open the Sequence editor.
2. Pick the Beat.
3. In the Actions section, choose an Action type from the dropdown.
4. Click **Add Action**.
5. Fill out the Action editor.
6. Save it.
7. Validate the Beat before using it live.

## Use The Director During Play

The main Director window is for the session.

Common buttons:

- Left arrow: previous Beat.
- Right arrow: next Beat.
- Validate: check the selected Beat.
- Run Selected Beat: execute the whole selected Beat.
- Stop: stop the currently running Beat on your client.
- Emergency Stop: cancel Director timers and notify supported integrations.
- Roll Back: undo the last supported Action if rollback exists.
- Reset State: clear stored Action results and Trigger fire-state for this Sequence.

## Add A Trigger

Important trick: add the Trigger to the Beat you want to happen next.

Example: You want Beat 2 to become active after two enemies die.

1. Open the Sequence editor.
2. Select Beat 2.
3. Click **Add Enemy Count Trigger**.
4. In **Triggers JSON**, change `"count": 1` to `"count": 2`.
5. Click **Save Beat**.

Now, when two hostile combatants are defeated, the Director selects Beat 2.

## Make A Trigger Run The Beat

By default, Triggers only jump/select the Beat.

To make it actually run the Beat, edit the Trigger JSON:

```json
[
  {
    "name": "Wave two after two enemies fall",
    "event": "enemyDefeatedCount",
    "count": 2,
    "action": "runBeat",
    "once": true,
    "enabled": true
  }
]
```

`runBeat` asks for GM confirmation by default.

To make it fully automatic:

```json
[
  {
    "name": "Wave two after two enemies fall",
    "event": "enemyDefeatedCount",
    "count": 2,
    "action": "runBeat",
    "requiresConfirmation": false,
    "once": true,
    "enabled": true
  }
]
```

Use fully automatic runs carefully.

## Trigger: Enemy Defeated Count

Use this when you want the encounter to advance after enemies drop.

```json
[
  {
    "name": "After three enemies fall",
    "event": "enemyDefeatedCount",
    "count": 3,
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

## Trigger: Any Defeated Combatant Count

Use this when you do not care if the defeated combatants are enemies, allies, or neutral.

```json
[
  {
    "name": "After four combatants fall",
    "event": "combatantDefeatedCount",
    "count": 4,
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

## Trigger: Selected Token HP At 50 Percent

Easy way:

1. Select the Token to watch.
2. Select the Beat you want to happen.
3. Click **Add HP 50% Trigger**.
4. Save the Beat.

The JSON will look roughly like:

```json
[
  {
    "name": "Selected Token HP at 50%",
    "event": "tokenHpAtOrBelow",
    "threshold": 50,
    "thresholdType": "percent",
    "comparison": "lte",
    "tokenUuids": ["Scene.example.Token.example"],
    "actorUuids": ["Actor.example"],
    "action": "selectBeat",
    "once": true,
    "enabled": true
  }
]
```

## Trigger: Token HP At A Number

Use this for "when this boss reaches 20 HP."

```json
[
  {
    "name": "Boss bloodied at 20 HP",
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

## Trigger: Ally Death

Easy way:

1. Select the ally Token.
2. Select the Beat you want to happen.
3. Click **Add Ally Death Trigger**.
4. Save the Beat.

Without selected Tokens, the quick button creates a general ally defeated Trigger.

## Trigger: Combat Round

Use this for timed encounter changes.

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

## Make A Trigger Start Another Sequence

Use this when a Scene has multiple Sequences and one should hand off to another.

```json
[
  {
    "name": "Start escape phase",
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

If you do not set `targetBeatId`, the target Sequence starts at its starting Beat or first Beat.

## Make A Trigger Repeat

Most of the time, do not do this.

If you need a repeating Trigger:

```json
[
  {
    "name": "Every time another enemy count update qualifies",
    "event": "enemyDefeatedCount",
    "count": 1,
    "action": "selectBeat",
    "once": false,
    "cooldownMs": 10000,
    "enabled": true
  }
]
```

`cooldownMs` prevents rapid refiring.

## Keep Triggers From Surprising You

Safe defaults:

- Leave `"once": true`.
- Leave `"action": "selectBeat"` until you trust the setup.
- Use **Validate** before the session.
- Use **Reset State** only when you intentionally want once-only Triggers to be able to fire again.
- Do not add a new Trigger while its condition is already true unless you want it to fire soon.

## Use Other Modules

If an integration shows **Ready**, its Actions should be available in the Action dropdown.

Basic flow:

1. Open the Sequence editor.
2. Select a Beat.
3. Pick the integration Action from the Action dropdown.
4. Click **Add Action**.
5. Fill out the Action config.
6. Save.
7. Validate the Beat.

If an integration says **Detected only**, the Director can see the module but did not confirm a usable public API for the Action you want.

If an integration says **Config only**, it exposes status or configuration APIs, but not enough to safely drive encounter Actions.

## If Something Does Not Work

Check these in order:

1. Are you logged in as GM?
2. Is the module enabled in Manage Modules?
3. Does the Director show the expected version?
4. Did you do a full browser reload after updating?
5. Is the Sequence bound to the current Scene?
6. Did you select the right Beat?
7. Did you save the Beat after changing Trigger JSON?
8. Does **Validate** show warnings?
9. Are the target Tokens actually in Combat?
10. Are enemies marked hostile?
11. Are defeated combatants marked defeated or at 0 HP?
12. Is the world setting **Enable automation Triggers** on?

## Good First Test

Use this test before trusting Triggers in a real session:

1. Make a tiny test Scene.
2. Add two enemy Tokens.
3. Create a Sequence.
4. Beat 1: combat setup.
5. Beat 2: GM note that says "Trigger worked."
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

7. Start combat.
8. Defeat one enemy.
9. Confirm the Director jumps to Beat 2.

After that works, change `selectBeat` to `runBeat` if you want the Beat to execute.
