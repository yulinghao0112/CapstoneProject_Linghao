#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Jest configuration  
const jestConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js'
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|ts|tsx)$',
    '^.+\\.module\\.(css|sass|scss)$'
  ],
  testMatch: [
    '<rootDir>/../tests/unit/frontend/**/*.test.{js,jsx}',
    '<rootDir>/../tests/integration/**/*.test.{js,jsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/serviceWorker.js',
    '!src/reportWebVitals.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 65,
      statements: 65
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: [
    'web.js',
    'js',
    'web.ts',
    'ts',
    'web.tsx',
    'tsx',
    'json',
    'web.jsx',
    'jsx'
  ],
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy'
  },
  roots: ['<rootDir>/src', '<rootDir>/../tests'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/'
  ],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  resetMocks: true
};

// Get command line arguments
const args = process.argv.slice(2);

// Build Jest command
const jestArgs = [
  'jest',
  '--config',
  JSON.stringify(jestConfig),
  ...args
];

console.log('🧪 Starting custom Jest test runner...');
console.log('📁 Test directories: ../tests/unit/frontend/, ../tests/integration/');

// Run Jest with our custom configuration
const jestProcess = spawn('npx', jestArgs, {
  stdio: 'inherit',
  cwd: process.cwd()
});

jestProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Tests completed successfully!');
  } else {
    console.log(`❌ Tests failed with exit code ${code}`);
  }
  process.exit(code);
});

jestProcess.on('error', (error) => {
  console.error('Error starting Jest:', error);
  process.exit(1);
});