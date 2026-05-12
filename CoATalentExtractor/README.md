# CoA Talent Extractor

Runtime talent topology and lattice extraction toolkit for **Conquest of Azeroth** talent trees.

Captures node positions, connection frames, advancement IDs, tooltips, and derives canonical row/column lattice coordinates from live frame geometry — all without modifying any game state.

---

## Quick Start

```
1. Copy the CoATalentExtractor/ folder into your WoW AddOns directory:
   <WoW>/Interface/AddOns/CoATalentExtractor/

2. Launch the game and open the CoA talent window.

3. In chat:
   /coax scan       (captures all nodes + connections)
   /coax lattice    (derives row/col grid from positions)

4. /reload          (writes SavedVariables to disk)

5. Upload your file:
   WTF/Account/<ACCOUNT>/SavedVariables/CoATalentExtractor.lua
```

---

## Installation

1. Download or clone the `CoATalentExtractor/` folder.
2. Place it in your WoW AddOns directory:
   ```
   <WoW Installation>/Interface/AddOns/CoATalentExtractor/
   ```
3. Ensure the folder contains at minimum:
   - `CoATalentExtractor.toc`
   - `CoATalentExtractor.lua`
4. Restart WoW or `/reload` if already running.
5. Confirm the addon loaded: you should see `[CoAX] CoA Talent Extractor v1.0.0 loaded` in chat.

---

## Commands

All commands use the `/coax` prefix (or `/coatalent` as an alias).

| Command | Description |
|---|---|
| `/coax scan` | Full node + connection scan of the open talent tree |
| `/coax lattice` | Derive canonical row/col grid from visible node positions |
| `/coax inspect` | Inspect the hovered frame's full topology |
| `/coax hover` | Capture the hovered node (tooltip, icon, position) |
| `/coax export` | Build a simplified flat export table |
| `/coax discover` | Probe hidden data providers, pools, and objects |
| `/coax dump` | Print a summary of the latest capture |
| `/coax roots` | Check status of known CoA root frames |
| `/coax clear` | Clear all saved captures |
| `/coax debug` | Toggle verbose debug output |
| `/coax help` | Show help in chat |

---

## Contribution Workflow

We need captures from **every class/spec combination** to build a complete talent database.

### How to generate a proper capture:

1. **Install** the addon (see above).
2. **Log in** on a character (any level).
3. **Open the CoA talent window** (press the talent keybind or open from the character menu).
4. Run these commands in order:
   ```
   /coax scan
   /coax lattice
   /coax export
   ```
5. **Type `/reload`** — this forces SavedVariables to disk.
6. Navigate to your SavedVariables file:
   ```
   WTF/Account/<YOUR_ACCOUNT>/SavedVariables/CoATalentExtractor.lua
   ```
7. **Upload** the file to the project repository (create an issue or pull request).

### What to include when submitting:

- Your character's **class** and **specialization** (if applicable)
- The **spec tree name** (visible at the top of the right panel)
- Whether you had any points allocated or it was a fresh tree
- Any anomalies you noticed (missing nodes, incorrect layout, etc.)

### Pro tips:

- Run captures with a **fresh/unspent tree** when possible for clean topology.
- If you have access to multiple specs, capture each one separately.
- Re-run `/coax clear` between captures of different classes to keep files small.

---

## Where SavedVariables Are Stored

After `/reload` or logout, all captured data is persisted to:

```
WTF/Account/<ACCOUNT_NAME>/SavedVariables/CoATalentExtractor.lua
```

On Ascension (typical path):
```
<Ascension Launcher>/resources/ascension/WTF/Account/<ACCOUNT>/SavedVariables/CoATalentExtractor.lua
```

This single file contains all captures, inspects, lattice derivations, exports, and discovery records.

---

## What the Addon Captures

### Per-Node Data
- Frame name and template type
- CharacterAdvancementID (canonical node identity)
- Spell ID
- Tooltip text (name, description, rank)
- Icon texture path
- Position (absolute + relative to tree root)
- Anchor chain
- Node shape/type (square=active, circle=passive, octagon=choice)
- Rank, max rank, lock state
- Visibility state

### Per-Connection Data
- Source/target node frame references
- Source/target node IDs
- Position and anchors
- Texture paths and rotation (for directional inference)
- Frame strata/level

### Lattice Derivation
- Automatic row/column clustering from frame center positions
- 1-based row/col assignments per node
- Cluster centers and per-row occupancy counts
- Validates against expected 10-row × 7-column maximum

---

## Known Limitations

- **Tooltip scraping** may fail for some nodes if the talent UI has custom tooltip handling that blocks programmatic `OnEnter` invocation.
- **Connection topology** is still best-effort — some connector frames may not expose source/target references directly.
- **Hidden/inactive nodes** are captured but may lack position data if they haven't been laid out by the pool system.
- **Lattice derivation** uses a fixed 28px clustering tolerance; unusual UI scale settings could cause misclassification (adjustable in source).
- **Choice nodes** are compound containers — their sub-options may not be fully exposed as separate frames in all cases.
- **Path of Ascension** (sidebar) nodes use different frame hierarchies and may not appear in the standard scan; use `/coax discover` for deeper probing.
- The addon is **read-only** — it never modifies talent selections, frame state, or game data.

---

## Architecture

See [ADDON_ARCHITECTURE.md](ADDON_ARCHITECTURE.md) for internal design details.

See [COMMANDS.md](COMMANDS.md) for detailed command reference with all output schemas.

See [FRAME_TOPOLOGY.md](FRAME_TOPOLOGY.md) for observed frame hierarchy and topology notes.

See [EXPORT_SCHEMA.md](EXPORT_SCHEMA.md) for complete SavedVariables data structure reference.

---

## Authors

**Tygoro | Denobulus**

---

## License

This addon is provided as-is for community data collection purposes. No warranty expressed or implied.
