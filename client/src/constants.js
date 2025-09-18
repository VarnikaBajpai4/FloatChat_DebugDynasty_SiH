// Shared constants for Chat page components
export const API_BASE =
  (import.meta.env.MODE === "production" && import.meta.env.VITE_API_DOMAIN)
    ? import.meta.env.VITE_API_DOMAIN
    : "";

export const ROLES = ["Default", "Researcher", "Policy-Maker", "Student"];

export const MODES = ["Chat", "GeoMap", "Prediction"];

// Shared class for collapsed icon tiles (ensures identical size and alignment)
export const TILE_BASE =
  "h-11 w-11 rounded-xl flex items-center justify-center select-none";