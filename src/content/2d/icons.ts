const paths: Record<string, string> = {
  plane:
    '<path d="m12 2 2.5 7 7.5 4v2l-7.5-1-1 5 3 2v1l-4.5-1-4.5 1v-1l3-2-1-5L2 15v-2l7.5-4z"/>',
  crate: '<path d="m3 7 9-4 9 4v12l-9 3-9-3zM3 7l9 4 9-4M12 11v11M7 5l10 4"/>',
  wrench:
    '<path d="M14 6a6 6 0 0 0-7 8l-5 5 3 3 5-5a6 6 0 0 0 8-7l-4 4-4-4z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
  grid: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
  gear: '<path d="m9 3 1-1h4l1 3 3 1 3 2-1 3 1 3-2 3-3 1-1 3h-5l-1-3-3-1-2-3 1-3-1-3 3-2z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10m3-8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9"/>',
  shield:
    '<path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5z"/><path d="m8 12 3 3 5-6"/>',
  bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
  bomb: '<circle cx="11" cy="14" r="7"/><path d="m15 8 3-3 2 1m-2-1 1-3M7 3l1 2m-5 1 2 1m16 4 2-1"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3l-1 2m0 3h.01"/>',
  wings: '<path d="m12 4 3 6 7 3-8 1-2 6-2-6-8-1 7-3z"/>',
};
export const icon = (name: string, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.plane}</svg>`;
const fokkerHighlights: Record<string, string> = {
  quick_feed: '<path d="M35 19v9m10-9v9M32 16l3-3 3 3m4 0 3-3 3 3"/>',
  left_wing_segment: '<path d="M13 40H5v5h8m-4-9v4m4 1 4-7"/>',
  right_wing_segment: '<path d="M67 40h8v5h-8m4-9v4m-4 1-4-7"/>',
  left_engine: '<path d="M22 38v13m-4-8h8"/><circle cx="22" cy="43" r="3"/>',
  right_engine: '<path d="M58 38v13m-4-8h8"/><circle cx="58" cy="43" r="3"/>',
  radiator: '<path d="M29 43v8m-3-8v8m25-8v8m3-8v8"/>',
  cooling_loop: '<path d="M36 55v7m4-7v7m4-7v7"/>',
  ammo: '<rect x="34" y="42" width="12" height="7" rx="1"/><path d="M38 42v7m4-7v7"/>',
  heavy_armor: '<path d="M31 48l9-3 9 3v7l-9 6-9-6z"/>',
  armor_belt: '<rect x="33" y="50" width="14" height="5" rx="1"/>',
  bomb_bay: '<path d="M33 57v7h14v-7m-7 1v9"/>',
};

export const planePreview = (position: string, fokkerUpgrade?: string) => {
  if (fokkerUpgrade && fokkerHighlights[fokkerUpgrade])
    return `<svg class="part-preview" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" opacity=".2" stroke-dasharray="2 4"/>
      <path d="M35 23h10l3 22-4 18 12 5v4H24v-4l12-5-4-18z" fill="currentColor" opacity=".28"/>
      <path d="M12 25h56q4 0 4 3t-4 3H12q-4 0-4-3t4-3Zm4 7h48q4 0 4 3t-4 3H16q-4 0-4-3t4-3Zm4 7h40q4 0 4 3t-4 3H20q-4 0-4-3t4-3Z" fill="currentColor" opacity=".42"/>
      <path d="M23 27v16m34-16v16M28 22h24" fill="none" stroke="currentColor" opacity=".5"/>
      <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${fokkerHighlights[fokkerUpgrade]}</g>
    </svg>`;
  return `<svg class="part-preview" viewBox="0 0 80 80" aria-hidden="true"><path d="M37 10h6l3 23 24 13v7l-24-5-2 16 10 7H26l10-7-2-16-24 5v-7l24-13z" fill="currentColor" opacity=".25"/><path d="${position === "rightWing" ? "M43 31 70 44v11l-26-5z" : position === "leftWing" ? "M37 31 10 44v11l26-5z" : position === "nose" ? "M36 8h8l3 25H33z" : position === "tail" ? "m33 57 14 0 8 16H25z" : position === "wings" || position === "engines" ? "m9 40 26-10 0 23-26 4z m62 0-26-10 0 23 26 4z" : "M31 32h18v23H31z"}" fill="currentColor"/><circle cx="40" cy="42" r="35" fill="none" stroke="currentColor" opacity=".15" stroke-dasharray="2 4"/></svg>`;
};
