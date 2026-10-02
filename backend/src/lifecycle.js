/**
 * Ciclo de vida del proceso: cierre ordenado.
 *
 * Vive fuera de `server.js` para poder testearse: en Windows no se puede entregar
 * un SIGTERM real a un proceso hijo (se termina forzosamente), así que la única
 * forma de verificar esta lógica en el entorno de desarrollo es como unidad.
 * La entrega real de la señal se verifica en Linux (CI y despliegue, Iteración 19).
 */

/**
 * @param {{
 *   server: { close: (cb: (err?: Error) => void) => void },
 *   disconnect: () => Promise<void>,
 *   stopSchedulers?: () => void,
 *   logger: { info: Function, error: Function },
 *   timeoutMs: number,
 *   exit?: (code: number) => void,
 * }} deps
 * @returns {{ shutdown: (signal: string) => Promise<void>, isShuttingDown: () => boolean }}
 */
export function createShutdownHandler({
  server,
  disconnect,
  stopSchedulers = () => {},
  logger,
  timeoutMs,
  exit = process.exit,
}) {
  let shuttingDown = false;

  async function shutdown(signal) {
    // Idempotente: dos señales seguidas no disparan dos cierres.
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Cerrando la API');

    // Red de seguridad: si algo queda colgado, se fuerza la salida.
    const force = setTimeout(() => {
      logger.error('Cierre forzado por timeout');
      exit(1);
    }, timeoutMs);
    force.unref?.();

    try {
      stopSchedulers();
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnect();
      clearTimeout(force);
      logger.info('Cierre ordenado completo');
      exit(0);
    } catch (error) {
      clearTimeout(force);
      logger.error({ err: error }, 'Error durante el cierre');
      exit(1);
    }
  }

  return { shutdown, isShuttingDown: () => shuttingDown };
}
