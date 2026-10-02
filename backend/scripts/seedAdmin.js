/**
 * Crea el primer usuario administrador (**D002**: no hay registro público).
 *
 * Se corre en el servidor, con acceso a la base. Es el único camino de bootstrap: no
 * existe —ni debe existir— un endpoint público tipo `POST /register-admin`.
 *
 *   # Con una contraseña propia (ojo con el historial del shell)
 *   SEED_ADMIN_EMAIL=ana@ejemplo.com SEED_ADMIN_PASSWORD='...' \
 *   SEED_ADMIN_FIRST_NAME=Ana SEED_ADMIN_LAST_NAME=Pérez npm run seed:admin
 *
 *   # Con una contraseña generada, que se muestra UNA sola vez
 *   SEED_ADMIN_EMAIL=ana@ejemplo.com SEED_ADMIN_FIRST_NAME=Ana \
 *   SEED_ADMIN_LAST_NAME=Pérez npm run seed:admin -- --generate-password
 *
 * Idempotente: si el email ya existe no toca la contraseña. Si ese usuario no era
 * administrador de plataforma, lo promueve y lo informa.
 *
 * La contraseña **nunca** se loguea. La generada se escribe una vez en la salida estándar,
 * que es la terminal del operador, no un archivo de log.
 */
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { loadEnvOrExit } from '../src/config/env.js';
import { createLogger } from '../src/config/logger.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { createAuthService } from '../src/modules/auth/auth.service.js';
import { emailSchema } from '../src/modules/auth/auth.schemas.js';
import { passwordSchema } from '../src/modules/auth/password.js';

const out = (line) => process.stdout.write(`${line}\n`);
const fail = (line) => process.stderr.write(`${line}\n`);

/** Contraseña aleatoria legible, de entropía suficiente (~155 bits). */
function generatePassword() {
  return randomBytes(24).toString('base64url');
}

/** Las variables del seed son del script, no de la aplicación: se validan acá. */
function parseSeedInput(raw, { generate }) {
  const schema = z.object({
    SEED_ADMIN_EMAIL: emailSchema,
    SEED_ADMIN_FIRST_NAME: z
      .string({ error: 'es obligatorio' })
      .trim()
      .min(2, { error: 'debe tener al menos 2 caracteres' })
      .max(80, { error: 'no puede superar 80 caracteres' }),
    SEED_ADMIN_LAST_NAME: z
      .string({ error: 'es obligatorio' })
      .trim()
      .min(2, { error: 'debe tener al menos 2 caracteres' })
      .max(80, { error: 'no puede superar 80 caracteres' }),
    SEED_ADMIN_PASSWORD: generate ? z.undefined().optional() : passwordSchema,
  });

  const result = schema.safeParse({
    SEED_ADMIN_EMAIL: raw.SEED_ADMIN_EMAIL,
    SEED_ADMIN_FIRST_NAME: raw.SEED_ADMIN_FIRST_NAME,
    SEED_ADMIN_LAST_NAME: raw.SEED_ADMIN_LAST_NAME,
    SEED_ADMIN_PASSWORD: generate ? undefined : raw.SEED_ADMIN_PASSWORD,
  });

  if (!result.success) {
    fail('\nNo se puede crear el administrador. Revisá estas variables:\n');
    for (const issue of result.error.issues) {
      // Se nombra la variable y el problema, nunca el valor.
      fail(`  - ${issue.path[0]}: ${issue.message}`);
    }
    fail('');
    return null;
  }
  return result.data;
}

async function main() {
  const generate = process.argv.includes('--generate-password');
  const env = loadEnvOrExit();
  const logger = createLogger(env);

  const input = parseSeedInput(process.env, { generate });
  if (!input) return 1;

  const password = generate ? generatePassword() : input.SEED_ADMIN_PASSWORD;

  await connectDb({
    uri: env.MONGODB_URI,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  });

  try {
    const existing = await User.findOne({ email: input.SEED_ADMIN_EMAIL });

    if (existing) {
      if (existing.isPlatformAdmin) {
        out(`\nEse usuario ya existe y ya es administrador. No se cambió nada.`);
        out(`La contraseña quedó como estaba: este script nunca la sobreescribe.\n`);
        return 0;
      }
      await User.updateOne({ _id: existing._id }, { $set: { isPlatformAdmin: true } });
      logger.info({ userId: existing._id.toString() }, 'Usuario promovido a administrador');
      out(`\nEse usuario ya existía: se lo promovió a administrador de plataforma.`);
      out(`La contraseña quedó como estaba.\n`);
      return 0;
    }

    const authService = createAuthService({ env });
    const user = await authService.createUser({
      email: input.SEED_ADMIN_EMAIL,
      password,
      firstName: input.SEED_ADMIN_FIRST_NAME,
      lastName: input.SEED_ADMIN_LAST_NAME,
      isPlatformAdmin: true,
    });

    // Al log va el id, jamás la contraseña.
    logger.info({ userId: user._id.toString() }, 'Administrador creado');

    out(`\nAdministrador creado.`);
    if (generate) {
      out(`\n  Contraseña generada: ${password}`);
      out(`\n  Se muestra UNA sola vez y no queda en ningún log. Guardala ahora`);
      out(`  en un gestor de contraseñas y cambiala después de entrar.\n`);
    } else {
      out(`Iniciá sesión con la contraseña que pasaste por entorno.\n`);
    }
    return 0;
  } finally {
    await disconnectDb();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    fail(`\nEl seed falló: ${error.message}\n`);
    process.exit(1);
  });
