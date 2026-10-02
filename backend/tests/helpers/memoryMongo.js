/**
 * MongoDB real, en memoria, para los tests que necesitan la base de verdad
 * (TESTING.md §1: los índices únicos, los TTL y los operadores se comportan como
 * en producción, cosa que un mock de Mongoose no garantiza).
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../src/config/db.js';

let server = null;

/** Levanta el servidor en memoria y conecta Mongoose. Devuelve la URI. */
export async function startMemoryMongo() {
  // Iteration 3 uses real Mongo transactions for Adult + OWNER consistency.
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = server.getUri();
  await connectDb({ uri, serverSelectionTimeoutMS: 10_000 });
  return uri;
}

/** Desconecta Mongoose y apaga el servidor. Idempotente. */
export async function stopMemoryMongo() {
  await disconnectDb();
  if (server) {
    await server.stop();
    server = null;
  }
}
