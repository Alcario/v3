/**
 * Cuenta de familiar/cuidador (DATA_MODEL.md §3.1).
 *
 * Reglas que el esquema hace cumplir:
 *  - `passwordHash` tiene `select: false`: no puede filtrarse por un `findOne` distraído.
 *  - No existe ningún campo `password` en texto plano, en ningún punto del esquema.
 *  - El hash se calcula en el servicio de auth, **no** en un hook del modelo, para que
 *    el hasheo sea explícito y testeable.
 *  - `toJSON` quita `passwordHash`, `__v` y `_id`, y expone `id`: ninguna respuesta de la
 *    API puede arrastrar el hash por serialización accidental.
 */
import mongoose from 'mongoose';

export const UserStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

/** Normalización de email: `trim` + `lowercase`, y nada más (DATA_MODEL.md §3.1). */
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      // `unique: true` ya crea el índice único. No se repite con `schema.index()`:
      // Mongoose avisa de índice duplicado y no aporta nada.
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
      index: true,
    },
    /**
     * Rol global de plataforma. NO es un rol de negocio y no da acceso a datos de
     * ningún adulto: sirve para crear usuarios y soporte (SECURITY.md §4).
     * El permiso sobre un adulto concreto vive en `CaregiverAccess` (Iteración 3).
     */
    isPlatformAdmin: { type: Boolean, default: false },
    /**
     * Versión de los tokens del usuario. Incrementarla invalida **todo** lo emitido:
     * los refresh (se revocan además sus sesiones) y los access tokens, porque
     * `requireAuth` compara este número contra el claim `tv` (**D029**).
     */
    tokenVersion: { type: Number, default: 0, min: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        // Cinturón y tirantes: `select: false` ya lo excluye de las consultas, y esto
        // garantiza que tampoco salga si alguien lo pide explícitamente.
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

/** Proyección pública: lo único que la API devuelve de un usuario. */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    status: this.status,
    isPlatformAdmin: this.isPlatformAdmin,
  };
};

export const User = mongoose.model('User', userSchema);
