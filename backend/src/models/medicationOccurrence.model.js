import mongoose from 'mongoose';

export const MedicationOccurrenceStatus = Object.freeze({
  PENDING: 'PENDING',
  TAKEN: 'TAKEN',
  SKIPPED: 'SKIPPED',
  MISSED: 'MISSED',
});

export const MedicationOccurrenceSource = Object.freeze({
  ALEXA: 'ALEXA',
  WEB: 'WEB',
  SYSTEM: 'SYSTEM',
});

const snapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    dose: { type: Number, required: true, min: Number.MIN_VALUE },
    doseUnit: { type: String, required: true },
    quantity: { type: Number, required: true, min: Number.MIN_VALUE },
    quantityUnit: { type: String, required: true },
    instructions: { type: String, default: null, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const medicationOccurrenceSchema = new mongoose.Schema(
  {
    adultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Adult', required: true },
    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medication', required: true },
    scheduledAt: { type: Date, required: true },
    localDate: { type: String, required: true },
    localTime: { type: String, required: true },
    timezone: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(MedicationOccurrenceStatus),
      default: MedicationOccurrenceStatus.PENDING,
      required: true,
    },
    confirmedAt: { type: Date, default: null },
    source: { type: String, enum: Object.values(MedicationOccurrenceSource), default: null },
    confirmedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedOutOfWindow: { type: Boolean, default: false },
    snapshot: { type: snapshotSchema, required: true },
    graceMinutes: { type: Number, required: true, min: 15, max: 720 },
    note: { type: String, default: null, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

medicationOccurrenceSchema.index({ medicationId: 1, scheduledAt: 1 }, { unique: true });
medicationOccurrenceSchema.index({ adultId: 1, localDate: 1, localTime: 1 });
medicationOccurrenceSchema.index({ adultId: 1, status: 1, scheduledAt: 1 });
medicationOccurrenceSchema.index({ status: 1, scheduledAt: 1 });

medicationOccurrenceSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    adultId: this.adultId.toString(),
    medicationId: this.medicationId.toString(),
    scheduledAt: this.scheduledAt,
    localDate: this.localDate,
    localTime: this.localTime,
    timezone: this.timezone,
    status: this.status,
    confirmedAt: this.confirmedAt,
    source: this.source,
    confirmedByUserId: this.confirmedByUserId?.toString() ?? null,
    confirmedOutOfWindow: this.confirmedOutOfWindow,
    medication: {
      name: this.snapshot.name,
      dose: this.snapshot.dose,
      doseUnit: this.snapshot.doseUnit,
      quantity: this.snapshot.quantity,
      quantityUnit: this.snapshot.quantityUnit,
      instructions: this.snapshot.instructions,
    },
    graceMinutes: this.graceMinutes,
    note: this.note,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const MedicationOccurrence = mongoose.model(
  'MedicationOccurrence',
  medicationOccurrenceSchema,
);
