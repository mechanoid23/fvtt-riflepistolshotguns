# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a FoundryVTT module (id: `rockpaperscissors`) that lets two players play Rifle, Pistol, Shotguns — a thematic variant of Rock-Paper-Scissors. There is no build system; `rps.js` is loaded directly by Foundry. The `vectors/` folder contains `Rock.png`, `Paper.png`, and `Scissors.png` — but the code references `Rifle.png`, `Pistol.png`, and `Shotgun.png`, which do not exist (known discrepancy from the original RPS theme).

Win conditions: Rifle beats Shotgun, Shotgun beats Pistol, Pistol beats Rifle.

## Development

Install directly into a FoundryVTT `Data/modules/rockpaperscissors/` directory. There is no build step, package manager, or test suite — edit `rps.js` and reload Foundry.

Requires the `socketlib` module and an active GM session to function.

## Architecture

All logic lives in `rps.js`. The game flows through FoundryVTT's hook system and `socketlib` to route execution to the correct user client.

**Game flow:**
1. A player types `rps` in chat → `createChatMessage` hook fires on all clients, but only the sender's client acts.
2. If a GM is online, the sender's client calls `socket.executeAsUser("startRPS", ...)` (runs on the initiator's client) to show the opponent-selection UI as a whispered chat message, then `socket.executeAsGM("deleteMessageRPS", ...)` to remove the raw `rps` message.
3. When the initiator picks an opponent and clicks Start, their client calls `socket.executeAsGM("updateMessageRPS", ...)` to replace their message with the weapon-choice buttons, then `socket.executeAsUser("otherUserRPS", selectedUserId, ...)` to send the challenged player their own whispered button message.
4. Each private message carries a `flags.rockpaperscissors` object: `{ linkedMessage: <other player's message id>, ready: false, choice: null }`.
5. When a player clicks Shoot, their client updates their own message's flags via `socket.executeAsGM("updateMessageRPS", ...)` setting `ready: true` and recording `choice`.
6. The second player to shoot checks `linkedMessage.flags.rockpaperscissors.ready` — if already `true`, they compute the winner client-side, post a public result `ChatMessage`, and delete both private messages via GM.

**Key functions:**
- `startRPS(message)` — executed on initiator's client; renders opponent dropdown
- `otherUserRPS(userid, message)` — executed on challenged user's client; creates their whispered button message; hooks `createChatMessage` once to capture the new message id and link it back to the initiator's message
- `addSelectionListeners(messageid, html)` — attaches weapon-button and Shoot-button DOM listeners; called from `renderChatMessage` hooks
- `generateRPSButtons(width)` — returns HTML string for the three weapon buttons + Shoot button
- `updateMessageRPS` / `deleteMessageRPS` — thin GM-executed wrappers around `message.update()` / `message.delete()`

**Socketlib registration** (`socketlib.ready` hook):
- `startRPS` — runs as a named user
- `otherUserRPS` — runs as a named user
- `deleteMessageRPS` — runs as GM
- `updateMessageRPS` — runs as GM
