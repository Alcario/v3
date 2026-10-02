import mongoose from 'mongoose';
import { DEFAULT_TIMEZONE, dateToDateOnly } from '../lib/time.js';

export const AdultStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    relationship: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const adultSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    birthDate: { type: Date, default: null },
    timezone: { type: String, required: true, default: DEFAULT_TIMEZONE },
    status: {
      type: String,
      enum: Object.values(AdultStatus),
      default: AdultStatus.ACTIVE,
    },
    notes: { type: String, default: null, trim: true, maxlength: 1000 },
    contacts: { type: [contactSchema], default: [] },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    consentRecordedAt: { type: Date, required: true },
    consentRecordedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    consentStatementVersion: { type: String, required: true, default: 'v1' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.createdByUserId;
        delete ret.consentRecordedAt;
        delete ret.consentRecordedByUserId;
        delete ret.consentStatementVersion;
        delete ret.deletedAt;
        if (ret.birthDate) ret.birthDate = dateToDateOnly(ret.birthDate);
        return ret;
      },
    },
  },
);

adultSchema.index({ status: 1 });
adultSchema.index({ createdByUserId: 1 });

adultSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    firstName: this.firstName,
    lastName: this.lastName,
    birthDate: dateToDateOnly(this.birthDate),
    timezone: this.timezone,
    status: this.status,
    notes: this.notes,
    contacts: this.contacts.map((contact) => ({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      isPrimary: contact.isPrimary,
    })),
  };
};

export const Adult = mongoose.model('Adult', adultSchema);
