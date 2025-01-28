import type { Config } from "jest";

const config: Config = {
  verbose: true,
  collectCoverage: true,
  coverageReporters: ["json-summary", "text"],
  preset: "ts-jest",
  setupFilesAfterEnv: ["<rootDir>/test/setupTests.ts"],
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
};

export default config;
