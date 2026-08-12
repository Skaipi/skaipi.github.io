export const PALETTES = {
  site: {
    id: "site",
    label: "Site",
    colors: {
      BACKGROUND: "#0D1117",
      SURFACE: "#161B22",
      SURFACE_STROKE: "#B2B9BF",
      NODE: "#FFC857",
      PROMOTED_NODE: "#E1E8ED",
      EDGE: "#2CB67D",
      LINK: "#B2B9BF",
      TEXT: "#E1E8ED",
    },
  },
  paper: {
    id: "paper",
    label: "PDF export pallete",
    colors: {
      BACKGROUND: "#FFFFFF",
      SURFACE: "#C8CED8",
      SURFACE_STROKE: "#B8BEC8",
      NODE: "#0072B2",
      PROMOTED_NODE: "#D55E00",
      EDGE: "#3A3A3A",
      LINK: "#8A8F98",
      TEXT: "#1A1A1A",
    },
  },
};

export const DEFAULT_PALETTE_ID = "site";

export function getPalette(id) {
  return PALETTES[id] ?? PALETTES[DEFAULT_PALETTE_ID];
}
