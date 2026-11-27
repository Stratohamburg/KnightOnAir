---
name: ui-navigation-system
description: Apply KnightOnAir's information architecture rules when creating or changing pages, first-level navigation, second-level tabs, buttons, menu copy, shop, activities, equipment, sortie, or debug showroom flows.
---

# UI Navigation System

Use this skill whenever a task adds, removes, renames, reorders, hides, or changes the responsibility of a menu, page, tab, button, modal, shop section, activity entry, equipment flow, sortie flow, or debug showroom control.

## Read before editing

Read these files in this order.

1. `README.md`
2. `docs/README.md`
3. `openspec/specs/app/navigation-and-menu-architecture/spec.md`
4. `docs/UI_NAVIGATION_SPEC.md`
5. `src/content/2d/HangarView.ts`
6. `src/content/2d/ShowroomView.ts`
7. `src/content/2d/ModalViews.ts`
8. `src/app/GameApp.ts`
9. Related styles in `src/styles/`
10. Related tests and the affected OpenSpec scenarios

Treat the OpenSpec as the behavioral contract, the UI navigation document as the product information architecture, and this skill as the change procedure. When they disagree, record the discrepancy and update the contract and product document before changing the implementation.

## Canonical responsibilities

- `sortie` is the default player page. It owns campaign and free patrol selection, the current sortie briefing and environment, a compact aircraft and mission loadout confirmation, rewards placeholders, and launch. Full aircraft data and configuration belong in equipment.
- `equipment` owns aircraft selection, aircraft data, part inspection, weapon configuration, and out-of-battle upgrades. Previewing an aircraft does not equip it. Equipping or applying an upgrade requires an explicit action.
- `shop` owns lottery draws and direct currency purchases. It does not equip aircraft or apply upgrades.
- The future activity entry owns event cards, rules, progress, and reward claims. Until implemented, it is a safe placeholder with a return path.
- `showroom` is the debug showroom. It owns aircraft inspection, build previews, test fire, reset, undo, and reference validation. It must be gated from production and must not write player progression.
- The showroom's `校验` action opens the workbench with persistent `原型` and `特效` tabs. Keep the explicit `?reference=1` and `#reference` links and the return path to the showroom.

## First-level menu rules

1. Keep the production navigation to at most five stable slots.
2. Keep one active first-level item and provide a path back to `sortie` from every page.
3. Put cross-page destinations in first-level navigation. Put filters, eras, rosters, parts, shop modes, and build views in the current page.
4. Do not make a tab change silently equip, purchase, claim, upgrade, or change the selected mission.
5. Keep `reservedA` and `reservedB` compatibility aliases documented when they map to future activities or `showroom`.
6. Use a dedicated bottom navigation region with a visible icon and short accessible label per destination. Update its icon asset, active state and compact portrait layout together. See the ticket dimensions and source art in `docs/UI_NAVIGATION_SPEC.md`.
7. Gate debug-only entries by the existing development or explicit debug condition. Do not solve this by adding a player-facing placeholder that looks like a normal feature.

## Second-level tab rules

1. Each tab group controls one dimension and contains mutually comparable options.
2. Keep nesting to one level. Use a list, modal, or detail panel for further detail.
3. Use `aria-selected` for tab semantics or `aria-pressed` for toggle and chip semantics.
4. Separate preview controls from commit buttons. Use action labels such as `装备此机体`, `应用升级`, `抽取一次`, and `确认购买` for state-changing actions.
5. Preserve focus, scroll position, and local button state during partial updates. Avoid replacing the page container for a chip, era, upgrade-card, or shop-mode change.
6. Keep modal overlays for settings, help, mission selection, upgrade selection, and confirmation. Do not add these actions to the global navigation.

## Page checklist

For every changed page, write down the answers before editing code.

- Page responsibility in one sentence
- Data the page owns
- Data it only displays
- Buttons and their commit semantics
- Second-level controls and their single dimension
- Return path to `sortie`
- Persistence and currency impact
- Production visibility or debug gating
- Empty, locked, loading, error, and success copy
- Related OpenSpec scenarios and tests

Reject a change that cannot state its page responsibility or that adds a control belonging to another page.

## Implementation traceability

After changing a menu or page, inspect every item in this list.

| Area | Files |
| --- | --- |
| Contract | `openspec/specs/app/navigation-and-menu-architecture/spec.md`, `openspec/specs/app/out-of-battle-hangar/spec.md`, `openspec/specs/app/shell-routing/spec.md`, plus affected persistence, economy, mission, and progression specs |
| Product documentation | `docs/UI_NAVIGATION_SPEC.md`, `docs/README.md` |
| Navigation and views | `src/content/2d/HangarView.ts`, `src/content/2d/ShowroomView.ts`, `src/content/2d/ModalViews.ts` |
| Routing and actions | `src/app/GameApp.ts` |
| Presentation | `src/styles/base.css`, `tokens.css`, `hangar.css`, `showroom.css`, `modals.css`, `src/styles/ticket.css`, `src/assets/ui/ticket/` |
| Verification | `tests/mobile-ui.test.ts`, `tests/aircraft-showroom.test.ts`, mission and persistence tests, related browser acceptance steps |
| Collaboration guidance | `AGENTS.md` and this skill |

Search the repository for these identifiers and labels after the edit.

```text
META_TABS
reservedA
reservedB
showroom
shop
equipment
sortie
活动
展厅
展台
升级
```

If the change adds currencies, rewards, activities, purchases, or saved equipment, inspect and update the matching persistence and economy specifications too. A changed navigation label is complete only after route aliases, accessible labels, empty states, tests, and documentation use the same terminology.

## Validation

Run the smallest relevant checks first, then the repository checks required by the task.

```text
npm run check
npm test -- tests/mobile-ui.test.ts tests/aircraft-showroom.test.ts
npm test
npm run build
```

For UI changes, inspect a 360×640 portrait view and a 390×844 portrait view. Verify default entry, every visible first-level item, the return path, keyboard focus, touch targets, locked and empty states, and that debug-only controls are absent from production configuration.

