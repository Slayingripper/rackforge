# RackForge

A browser-based 3D/2.5D server-rack and data-center planning workspace. RackForge combines an interactive React Three Fiber cabinet with a precision SVG elevation editor, a reusable hardware catalog, and a deterministic power/thermal/structural simulation engine.

## Run locally

Requires Node 22.12+ (see `.nvmrc`; the npm scripts also invoke a Node 22 runtime through `npx`).

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

```bash
npm run typecheck   # strict TypeScript check
npm test            # simulation and placement regression tests
npm run build       # production build in dist/
npm run preview     # serve the production build
```

## Included workflows

- **Enclosure planning:** 12U, 24U, 42U, and 48U racks; 600/800mm widths; 800/1000/1200mm depths; enclosed, open 4-post, and open 2-post frames; perforated doors, side panels, cutaway, and X-ray modes.
- **Hardware placement:** click-to-place, library drag-and-drop, draggable SVG devices, collision checks, front/rear depth-overlap checks, cable-clearance checks, 0U vertical PDUs, and configurable reserved/blocked zones.
- **Catalog and custom profiles:** compute, rack PCs/workstations, SBC/edge clusters, storage, networking, power, thermal, and accessory equipment with dimensions, weight, typical/peak/rated power, airflow, and port metadata. Includes dedicated filters for fans, switches, PCs, SBCs, and more. Custom profiles persist and are reusable.
- **Thermal modeling:** ambient temperature, cooling capacity, Eco/Balanced/Max fan profiles, airflow vectors, intake/exhaust gradients, local hotspot estimates, reverse/side airflow advisories, and unblanked-gap recirculation warnings.
- **Animated airflow mode:** dedicated 3D particle streamlines with intake-to-exhaust color gradients, rotating fan-tray rotors, thermal exhaust plumes, recirculation loops, bypass paths, and matching animated SVG flow diagrams. Playback can be paused and cycled through 0.5×–2× speed.
- **Power modeling:** typical/peak/rated totals, BTU/hr, monthly/annual energy and cost, PDU A/B loading, single/three-phase current, breaker warnings, and N/N+1/2N checks.
- **Structural modeling:** static/rolling load ratings, U-space utilization, weight distribution, center of gravity, and high-mounted heavy-equipment warnings.
- **Workspace tools:** status-first health ribbon, bento telemetry cards, `Ctrl/Cmd + K` command palette, contextual device HUD, collapsible library/inspector/telemetry panels, device overrides, duplicate/remove/move/flip, four scenarios (including an SBC/Edge Lab), local autosave, 80-step undo/redo, JSON import/export, and a printable/downloadable capacity report.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo |
| `Delete` / `Backspace` | Remove selected device (when not editing a field) |
| `Escape` | Cancel pending placement / close dialog |

## Engineering model

Calculations are deterministic estimates intended for planning and comparison:

- Electrical draw is assumed to dissipate as rack heat; `BTU/hr = typical W × 3.412142`.
- Energy uses 730 hours/month and 8,760 hours/year at the configured electricity rate.
- Usable rack depth reserves 80mm for rails, plugs, and cable bend radius.
- Front/rear devices may share U-space only when their combined chassis depth fits usable depth.
- Three-phase current is reported as balanced amperes per phase.
- Continuous-load guidance warns at 80% of breaker rating and becomes critical at 100%.
- Fan profiles scale facility cooling to 82% (Eco), 100% (Balanced), or 118% (Max).
- Local temperature is an advisory estimate based on rack exhaust, nearby vertical heat density, and cooling headroom. It is **not** a CFD result.
- N+1 and 2N checks evaluate feed capacity; actual redundancy also depends on device PSU topology and A/B cord assignment.

Do not use these estimates as a substitute for site-specific electrical, structural, cooling, or safety validation.

## Project structure

```text
src/
  components/       UI panels, viewports, airflow visualizations, dialogs, and report
  data/             Hardware catalog and scenario presets
  hooks/            Persistent state with undo/redo history
  lib/
    simulation.ts   Placement, power, thermal, airflow, and structural engine
    simulation.test.ts
  types.ts          Shared domain contracts
  App.tsx           Workspace actions and responsive layout
```

All workspace data stays in the browser. There is no backend, account system, or telemetry upload.
