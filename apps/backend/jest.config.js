// Configuración de Jest para el workspace del backend NestJS (con soporte fast-check)
/** @type {import('jest').Config} */
module.exports = {
  displayName: 'backend',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',

  // Patrón de archivos de prueba
  testRegex: '.*\\.spec\\.ts$',

  // Transformación de TypeScript
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },

  // Resolución de módulos internos del monorepo
  moduleNameMapper: {
    '^@mindflow/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    // Point @prisma/client to the workspace-root generated client (npm workspaces hoist deps to root)
    '^@prisma/client$': '<rootDir>/../../node_modules/.prisma/client',
  },

  // Extensiones de módulo soportadas
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Cobertura de código del backend
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!**/*.d.ts',
  ],

  // Tiempo máximo por test (las pruebas PBT con fast-check pueden tomar más tiempo)
  testTimeout: 60000,
};
