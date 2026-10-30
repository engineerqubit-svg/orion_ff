import next from "eslint-config-next";

/** eslint-config-next v16 ships a flat config directly — no eslintrc compat needed. */
const config = [
  { ignores: [".next/**", "node_modules/**", "scripts/**"] },
  ...next,
];

export default config;
