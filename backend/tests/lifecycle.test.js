import { describe, it, expect, vi } from 'vitest';
import { createShutdownHandler } from '../src/lifecycle.js';

function deps(overrides = {}) {
  return {
    server: { close: vi.fn((cb) => cb()) },
    disconnect: vi.fn(async () => {}),
    logger: { info: vi.fn(), error: vi.fn() },
    timeoutMs: 5000,
    exit: vi.fn(),
    ...overrides,
  };
}

describe('createShutdownHandler', () => {
  it('cierra el servidor, desconecta la base y sale con código 0', async () => {
    const d = deps();
    const { shutdown } = createShutdownHandler(d);

    await shutdown('SIGTERM');

    expect(d.server.close).toHaveBeenCalledTimes(1);
    expect(d.disconnect).toHaveBeenCalledTimes(1);
    expect(d.exit).toHaveBeenCalledWith(0);
  });

  it('cierra en orden: primero deja de aceptar conexiones y después suelta la base', async () => {
    const order = [];
    const d = deps({
      server: {
        close: vi.fn((cb) => {
          order.push('server');
          cb();
        }),
      },
      disconnect: vi.fn(async () => {
        order.push('db');
      }),
    });
    const { shutdown } = createShutdownHandler(d);

    await shutdown('SIGTERM');

    expect(order).toEqual(['server', 'db']);
  });

  it('registra la señal que originó el cierre', async () => {
    const d = deps();
    const { shutdown } = createShutdownHandler(d);

    await shutdown('SIGINT');

    expect(d.logger.info).toHaveBeenCalledWith({ signal: 'SIGINT' }, 'Cerrando la API');
  });

  it('es idempotente: una segunda señal no vuelve a cerrar', async () => {
    const d = deps();
    const { shutdown } = createShutdownHandler(d);

    await shutdown('SIGTERM');
    await shutdown('SIGTERM');

    expect(d.server.close).toHaveBeenCalledTimes(1);
    expect(d.disconnect).toHaveBeenCalledTimes(1);
    expect(d.exit).toHaveBeenCalledTimes(1);
  });

  it('expone que está cerrando, para que los reintentos de Mongo se detengan', async () => {
    const d = deps();
    const { shutdown, isShuttingDown } = createShutdownHandler(d);

    expect(isShuttingDown()).toBe(false);
    await shutdown('SIGTERM');
    expect(isShuttingDown()).toBe(true);
  });

  it('sale con código 1 si el servidor falla al cerrar', async () => {
    const d = deps({
      server: { close: vi.fn((cb) => cb(new Error('socket colgado'))) },
    });
    const { shutdown } = createShutdownHandler(d);

    await shutdown('SIGTERM');

    expect(d.exit).toHaveBeenCalledWith(1);
    expect(d.logger.error).toHaveBeenCalled();
    // No se intenta desconectar si el servidor no cerró.
    expect(d.disconnect).not.toHaveBeenCalled();
  });

  it('sale con código 1 si la desconexión de la base falla', async () => {
    const d = deps({
      disconnect: vi.fn(async () => {
        throw new Error('mongo no responde');
      }),
    });
    const { shutdown } = createShutdownHandler(d);

    await shutdown('SIGTERM');

    expect(d.exit).toHaveBeenCalledWith(1);
  });

  it('fuerza la salida si el cierre se cuelga más allá del timeout', async () => {
    vi.useFakeTimers();
    const d = deps({
      // Un cierre que nunca llama al callback.
      server: { close: vi.fn(() => {}) },
      timeoutMs: 1000,
    });
    const { shutdown } = createShutdownHandler(d);

    shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(1000);

    expect(d.exit).toHaveBeenCalledWith(1);
    expect(d.logger.error).toHaveBeenCalledWith('Cierre forzado por timeout');
    vi.useRealTimers();
  });

  it('no fuerza la salida si el cierre termina a tiempo', async () => {
    vi.useFakeTimers();
    const d = deps({ timeoutMs: 1000 });
    const { shutdown } = createShutdownHandler(d);

    await shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(5000);

    expect(d.exit).toHaveBeenCalledTimes(1);
    expect(d.exit).toHaveBeenCalledWith(0);
    vi.useRealTimers();
  });
});
