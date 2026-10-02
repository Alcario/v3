import { describe, it, expect, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  connectDbWithRetry,
  disconnectDb,
  isConnected,
  pingDb,
  getConnectionState,
  ConnectionState,
} from '../src/config/db.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';

/** Logger mínimo que solo registra las llamadas, para afirmar sobre lo que se loguea. */
function spyLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('conexión a MongoDB', () => {
  afterEach(async () => {
    await stopMemoryMongo();
  });

  it('conecta contra una base real y queda en estado conectado', async () => {
    await startMemoryMongo();

    expect(isConnected()).toBe(true);
    expect(getConnectionState()).toBe(ConnectionState.connected);
  });

  it('aplica sanitizeFilter globalmente (defensa contra inyección NoSQL)', () => {
    expect(mongoose.get('sanitizeFilter')).toBe(true);
  });

  it('el cierre es idempotente', async () => {
    await startMemoryMongo();

    await disconnectDb();
    await disconnectDb();

    expect(getConnectionState()).toBe(ConnectionState.disconnected);
  });
});

describe('connectDbWithRetry', () => {
  afterEach(async () => {
    await stopMemoryMongo();
  });

  it('devuelve true y lo registra cuando logra conectar', async () => {
    const uri = await startMemoryMongo();
    await disconnectDb();
    const logger = spyLogger();

    const connected = await connectDbWithRetry({ uri, logger, maxAttempts: 1 });

    expect(connected).toBe(true);
    expect(logger.info).toHaveBeenCalled();
    expect(isConnected()).toBe(true);
  });

  it('reintenta y devuelve false cuando la base no está disponible', async () => {
    const logger = spyLogger();

    const connected = await connectDbWithRetry({
      // Puerto sin nada escuchando.
      uri: 'mongodb://127.0.0.1:65533/chatio_inexistente',
      logger,
      serverSelectionTimeoutMS: 300,
      maxAttempts: 2,
      baseDelayMs: 1,
    });

    expect(connected).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('nunca loguea la URI, que puede llevar credenciales', async () => {
    const logger = spyLogger();
    const uri = 'mongodb://usuario:clave-secreta@127.0.0.1:65533/chatio';

    await connectDbWithRetry({
      uri,
      logger,
      serverSelectionTimeoutMS: 300,
      maxAttempts: 1,
      baseDelayMs: 1,
    });

    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toMatch(/clave-secreta/);
    expect(logged).not.toMatch(/usuario/);
  });

  it('deja de intentar si el proceso está cerrando', async () => {
    const logger = spyLogger();

    const connected = await connectDbWithRetry({
      uri: 'mongodb://127.0.0.1:65533/chatio',
      logger,
      maxAttempts: 5,
      shouldStop: () => true,
    });

    expect(connected).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('pingDb', () => {
  afterEach(async () => {
    await stopMemoryMongo();
  });

  it('devuelve false sin conexión, sin lanzar', async () => {
    await disconnectDb();

    await expect(pingDb()).resolves.toBe(false);
  });

  it('devuelve true contra una base real', async () => {
    await startMemoryMongo();

    await expect(pingDb()).resolves.toBe(true);
  });
});
