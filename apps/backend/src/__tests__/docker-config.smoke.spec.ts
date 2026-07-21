/**
 * Smoke tests for Docker configuration files.
 * Validates compose.yml statically to ensure:
 *  - Required services are defined
 *  - No secrets are hardcoded
 *  - Persistent volume is declared
 *
 * Validates: Requirements 8.1, 8.3, 8.4
 */
import * as fs from 'fs';
import * as path from 'path';

describe('Docker Configuration Smoke Tests', () => {
  // Resolve from __tests__/ → src/ → backend/ → apps/ → root
  const rootDir = path.resolve(__dirname, '../../../..');
  const composeContent = fs.readFileSync(
    path.join(rootDir, 'compose.yml'),
    'utf-8',
  );

  it('should define backend and db services', () => {
    expect(composeContent).toContain('backend:');
    expect(composeContent).toContain('db:');
  });

  it('should not contain hardcoded JWT_SECRET value', () => {
    // Must use ${JWT_SECRET} interpolation, not a literal secret
    expect(composeContent).not.toMatch(/JWT_SECRET:\s*[^$\s{]/);
  });

  it('should not contain hardcoded AI_SERVICE_API_KEY value', () => {
    expect(composeContent).not.toMatch(/AI_SERVICE_API_KEY:\s*[^$\s{]/);
  });

  it('should not contain hardcoded DATABASE_URL value', () => {
    expect(composeContent).not.toMatch(/DATABASE_URL:\s*[^$\s{]/);
  });

  it('should declare mindflow_pgdata volume', () => {
    expect(composeContent).toContain('mindflow_pgdata');
  });

  it('should mount PostgreSQL 18 data at its supported parent path', () => {
    expect(composeContent).toContain('mindflow_pgdata:/var/lib/postgresql');
    expect(composeContent).not.toContain(
      'mindflow_pgdata:/var/lib/postgresql/data',
    );
  });
});
