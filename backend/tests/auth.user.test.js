import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createTestApp } from './helpers/createTestApp.js';
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo.js';
import { makeUser, VALID_PASSWORD } from './helpers/authFixtures.js';
import { User, normalizeEmail, UserStatus } from '../src/models/user.model.js';
import { createAuthService } from '../src/modules/auth/auth.service.js';
import { verifyPassword, validatePasswordPolicy } from '../src/modules/auth/password.js';

describe('modelo User', () => {
  let env;

  beforeAll(async () => {
    await startMemoryMongo();
    // Los índices se crean al arrancar: sin esto, el índice único de email no existe
    // todavía cuando el primer test lo necesita.
    await User.syncIndexes();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    env = createTestApp().env;
  });

  describe('email', () => {
    it('normaliza a minúsculas y sin espacios al guardar', async () => {
      const user = await makeUser({ env, overrides: { email: '  Ana.Perez@Ejemplo.COM  ' } });

      expect(user.email).toBe('ana.perez@ejemplo.com');
    });

    it('normalizeEmail hace trim y lowercase, y nada más', () => {
      expect(normalizeEmail('  ANA@Ejemplo.com ')).toBe('ana@ejemplo.com');
      // No se intenta canonicalización por proveedor: los puntos de Gmail se conservan.
      expect(normalizeEmail('a.n.a@gmail.com')).toBe('a.n.a@gmail.com');
      expect(normalizeEmail('ana+chatio@ejemplo.com')).toBe('ana+chatio@ejemplo.com');
    });

    it('es único, y la unicidad la impone la base', async () => {
      await makeUser({ env, overrides: { email: 'duplicada@ejemplo.com' } });

      await expect(
        makeUser({ env, overrides: { email: 'duplicada@ejemplo.com' } }),
      ).rejects.toThrow(/Ya existe un usuario con ese email/);
    });

    it('la unicidad ignora mayúsculas, porque se normaliza antes de guardar', async () => {
      await makeUser({ env, overrides: { email: 'ana@ejemplo.com' } });

      await expect(makeUser({ env, overrides: { email: 'ANA@Ejemplo.com' } })).rejects.toThrow(
        /Ya existe un usuario con ese email/,
      );
    });
  });

  describe('contraseña', () => {
    it('persiste solo el hash bcrypt, nunca el texto plano', async () => {
      const user = await makeUser({ env, password: VALID_PASSWORD });

      // Se lee el documento crudo, salteando toda la capa de serialización.
      const raw = await mongoose.connection.collection('users').findOne({ _id: user._id });

      expect(raw.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(raw.password).toBeUndefined();
      expect(raw.plainPassword).toBeUndefined();
      // La contraseña no aparece en ningún campo del documento.
      expect(JSON.stringify(raw)).not.toContain(VALID_PASSWORD);
    });

    it('el hash verifica contra la contraseña original', async () => {
      const user = await makeUser({ env, password: VALID_PASSWORD });
      const withHash = await User.findById(user._id).select('+passwordHash');

      await expect(verifyPassword(VALID_PASSWORD, withHash.passwordHash)).resolves.toBe(true);
      await expect(verifyPassword('otra-cosa-distinta', withHash.passwordHash)).resolves.toBe(
        false,
      );
    });

    it('dos usuarios con la misma contraseña tienen hashes distintos (salt)', async () => {
      const a = await makeUser({ env, overrides: { email: 'a@ejemplo.com' } });
      const b = await makeUser({ env, overrides: { email: 'b@ejemplo.com' } });

      const [ha, hb] = await Promise.all([
        User.findById(a._id).select('+passwordHash'),
        User.findById(b._id).select('+passwordHash'),
      ]);

      expect(ha.passwordHash).not.toBe(hb.passwordHash);
    });
  });

  describe('passwordHash no se expone', () => {
    it('no viene en una consulta normal', async () => {
      const user = await makeUser({ env });

      const found = await User.findById(user._id);

      expect(found.passwordHash).toBeUndefined();
    });

    it('toJSON lo quita incluso si se lo pidió explícitamente', async () => {
      const user = await makeUser({ env });
      const withHash = await User.findById(user._id).select('+passwordHash');

      const serialized = JSON.parse(JSON.stringify(withHash));

      expect(serialized.passwordHash).toBeUndefined();
      expect(serialized.__v).toBeUndefined();
      expect(serialized._id).toBeUndefined();
      expect(serialized.id).toBe(user._id.toString());
    });

    it('toPublicJSON expone solo los campos previstos', async () => {
      const user = await makeUser({ env });

      expect(Object.keys(user.toPublicJSON()).sort()).toEqual([
        'email',
        'firstName',
        'id',
        'isPlatformAdmin',
        'lastName',
        'status',
      ]);
    });
  });

  describe('valores por defecto', () => {
    it('un usuario nuevo queda activo, sin privilegios y con tokenVersion 0', async () => {
      const user = await makeUser({ env });

      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.isPlatformAdmin).toBe(false);
      expect(user.tokenVersion).toBe(0);
      expect(user.lastLoginAt).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('política de contraseñas (SECURITY.md §3)', () => {
    it('exige al menos 10 caracteres', () => {
      expect(validatePasswordPolicy('corta123')).not.toHaveLength(0);
      expect(validatePasswordPolicy('diez-chars')).toHaveLength(0);
    });

    it('rechaza las contraseñas más comunes', () => {
      expect(validatePasswordPolicy('password123')).not.toHaveLength(0);
      expect(validatePasswordPolicy('PASSWORD123')).not.toHaveLength(0);
      expect(validatePasswordPolicy('contrasena123')).not.toHaveLength(0);
    });

    it('no impone reglas de composición: una frase larga es válida', () => {
      expect(validatePasswordPolicy('mi abuela toma losartan a las nueve')).toHaveLength(0);
      expect(validatePasswordPolicy('caballo batería grapadora correcto')).toHaveLength(0);
    });

    it('rechaza una contraseña absurdamente larga', () => {
      expect(validatePasswordPolicy('a'.repeat(300))).not.toHaveLength(0);
    });
  });

  describe('createUser', () => {
    it('rechaza el email duplicado con 409 CONFLICT', async () => {
      const authService = createAuthService({ env });
      await authService.createUser({
        email: 'ana@ejemplo.com',
        password: VALID_PASSWORD,
        firstName: 'Ana',
        lastName: 'Pérez',
      });

      await expect(
        authService.createUser({
          email: 'ana@ejemplo.com',
          password: VALID_PASSWORD,
          firstName: 'Otra',
          lastName: 'Persona',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
    });
  });
});
