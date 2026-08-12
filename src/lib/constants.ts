/** App-wide constants. Defaults per NOVA spec. */
export const APP_NAME = "NOVA";
export const OWNER_NAME = "Señor Carrillo";
export const DEFAULT_TIMEZONE = "Europe/Madrid";
export const DEFAULT_LOCALE = "es-ES";
export const WEEK_STARTS_ON = 1; // Monday
export const TIME_FORMAT_24H = true;

export const DEMO_MODE_PUBLIC =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  process.env.NEXT_PUBLIC_DEMO_MODE === "1" ||
  // default to demo when unset on the client
  process.env.NEXT_PUBLIC_DEMO_MODE === undefined;
