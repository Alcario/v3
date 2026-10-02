import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseEnv,
  secretSchema,
  EnvValidationError,
  loadEnvOrExit,
  resetEnvCache,
} from '../src/config/env.js';

// Entorno mínimo válido: las cuatro variables que no tienen default.
const valid = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/chatio_test',
  JWT_ACCESS_SECRET: 'secreto-de-acceso-solo-para-tests-0123456789',
  JWT_REFRESH_SECRET: 'secreto-de-refresh-solo-para-tests-9876543210',
};

describe('parseEnv', () => {
  it('aplica los valores por defecto cuando solo están las variables obligatorias', () => {
    const env = parseEnv(valid);

    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.BODY_LIMIT).toBe('32kb');
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.RATE_LIMIT_MAX).toBe(300);
    expect(env.SHUTDOWN_TIMEOUT_MS).toBe(10_000);
  });

  it('respeta los valores del entorno cuando están definidos', () => {
    const env = parseEnv({ ...valid, PORT: '8080', LOG_LEVEL: 'warn', TRUST_PROXY: 'true' });

    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe('warn');
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('convierte CORS_ORIGINS en una lista y descarta espacios y vacíos', () => {
    const env = parseEnv({
      ...valid,
      CORS_ORIGINS: 'http://localhost:5173, https://panel.chatio.app ,,',
    });

    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://panel.chatio.app']);
  });

  it('falla cuando falta una variable obligatoria', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(EnvValidationError);
  });

  it('nombra la variable que falta sin revelar ningún valor', () => {
    let error;
    try {
      parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://oculto:secreto@host/db',
        JWT_ACCESS_SECRET: 'a'.repeat(40),
        JWT_REFRESH_SECRET: 'b'.repeat(40),
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error.issues.map((issue) => issue.variable)).toContain('CORS_ORIGINS');
    // El mensaje sirve para diagnosticar sin filtrar credenciales.
    expect(error.message).not.toContain('secreto');
    expect(error.message).not.toContain('oculto');
  });

  it('trata una variable vacía como ausente', () => {
    expect(() => parseEnv({ ...valid, MONGODB_URI: '' })).toThrow(EnvValidationError);
  });

  it('rechaza una MONGODB_URI que no sea de Mongo', () => {
    let error;
    try {
      parseEnv({ ...valid, MONGODB_URI: 'postgres://localhost/chatio' });
    } catch (caught) {
      error = caught;
    }

    expect(error.issues[0]).toMatchObject({ variable: 'MONGODB_URI' });
    expect(error.issues[0].message).toMatch(/mongodb:\/\//);
  });

  it('rechaza un PORT fuera de rango', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...valid, PORT: 'ocho mil' })).toThrow(EnvValidationError);
  });

  it('rechaza un LOG_LEVEL desconocido', () => {
    expect(() => parseEnv({ ...valid, LOG_LEVEL: 'verboso' })).toThrow(EnvValidationError);
  });

  it('devuelve un objeto inmutable', () => {
    const env = parseEnv(valid);
    expect(Object.isFrozen(env)).toBe(true);
  });

  describe('reglas exclusivas de producción', () => {
    const prod = {
      NODE_ENV: 'production',
      MONGODB_URI: valid.MONGODB_URI,
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
    };

    it('exige CORS_ORIGINS', () => {
      let error;
      try {
        parseEnv(prod);
      } catch (caught) {
        error = caught;
      }
      expect(error.issues.map((issue) => issue.variable)).toContain('CORS_ORIGINS');
    });

    it('rechaza el comodín * en CORS_ORIGINS', () => {
      let error;
      try {
        parseEnv({ ...prod, CORS_ORIGINS: '*' });
      } catch (caught) {
        error = caught;
      }
      expect(error.issues[0].message).toMatch(/comodín/);
    });

    it('rechaza LOG_LEVEL debug o trace, para no loguear de más', () => {
      const origins = 'https://panel.chatio.app';
      expect(() => parseEnv({ ...prod, CORS_ORIGINS: origins, LOG_LEVEL: 'debug' })).toThrow(
        EnvValidationError,
      );
      expect(() => parseEnv({ ...prod, CORS_ORIGINS: origins, LOG_LEVEL: 'trace' })).toThrow(
        EnvValidationError,
      );
    });

    it('acepta una configuración de producción completa', () => {
      const env = parseEnv({
        ...prod,
        CORS_ORIGINS: 'https://panel.chatio.app',
        LOG_LEVEL: 'info',
        TRUST_PROXY: 'true',
      });
      expect(env.NODE_ENV).toBe('production');
      expect(env.CORS_ORIGINS).toEqual(['https://panel.chatio.app']);
    });
  });
});

describe('secretSchema', () => {
  // Todavía no hay variables de secreto (llegan en la Iteración 2 con JWT), pero la
  // regla de longitud mínima se testea ahora para que exista una sola implementación.
  it('rechaza un secreto más corto que el mínimo', () => {
    const result = secretSchema(32).safeParse('corto');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toMatch(/al menos 32/);
  });

  it('acepta un secreto de longitud suficiente', () => {
    expect(secretSchema(32).safeParse('a'.repeat(32)).success).toBe(true);
  });

  it('rechaza un secreto ausente', () => {
    expect(secretSchema(32).safeParse(undefined).success).toBe(false);
  });
});

describe('loadEnvOrExit', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('devuelve la configuración cuando el entorno es válido', () => {
    const saved = { ...process.env };
    Object.assign(process.env, valid);
    const exit = vi.fn();

    const env = loadEnvOrExit({ exit, stderr: { write: vi.fn() } });

    expect(exit).not.toHaveBeenCalled();
    expect(env.NODE_ENV).toBe('test');
    process.env = saved;
  });

  it('escribe el motivo y sale con código 1 si el entorno es inválido', () => {
    const saved = { ...process.env };
    // Sin MONGODB_URI y con un LOG_LEVEL inexistente.
    delete process.env.MONGODB_URI;
    process.env.LOG_LEVEL = 'inventado';
    const exit = vi.fn();
    const write = vi.fn();

    loadEnvOrExit({ exit, stderr: { write } });

    expect(exit).toHaveBeenCalledWith(1);
    const message = write.mock.calls.flat().join('');
    expect(message).toMatch(/MONGODB_URI/);
    expect(message).toMatch(/LOG_LEVEL/);
    // El mensaje orienta sin exponer valores.
    expect(message).toMatch(/\.env\.example/);
    expect(message).not.toMatch(/inventado/);
    process.env = saved;
  });
});
