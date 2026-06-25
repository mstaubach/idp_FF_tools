import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Flat config (ESLint 9+/Next 16). Replaces the legacy .eslintrc.json +
// `next lint`, both removed in Next 16.
const config = [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
];

export default config;
