import type { AircraftReference, ReferencePhoto } from "./types";

export const commons = "https://commons.wikimedia.org/wiki/";

export const photo = (src: string, source: string, alt: string, caption: string, credit = "Wikimedia Commons"): ReferencePhoto => ({
  src, source, alt, caption, credit,
});

type PioneerReference = Omit<AircraftReference, "era" | "match" | "matchLabel">;

export const pioneer = (reference: PioneerReference): AircraftReference => ({
  ...reference,
  era: "pioneer",
  match: null,
  matchLabel: "参考素材已录入，三视图待审核",
});
