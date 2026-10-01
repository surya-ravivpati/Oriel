import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "public/mediapipe/**", "data/**", "playwright-report/**", "test-results/**"] },
];

export default config;
