import type { Config } from "jest";

const config: Config = {
  verbose: true,
  collectCoverage: true,
  coverageReporters: ["json-summary", "text"],
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
};

export default config;
