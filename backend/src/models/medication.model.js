import mongoose from 'mongoose';

export const DoseUnit = Object.freeze({
  MG: 'MG',
  G: 'G',
  ML: 'ML',
  MCG: 'MCG',
  UI: 'UI',
  GOTAS: 'GOTAS',
  OTRO: 'OTRO',
});

export const QuantityUnit = Object.freeze({
  COMPRIMIDO: 'COMPRIMIDO',
  CAPSULA: 'CAPSULA',
  ML: 'ML',
  GOTAS: 'GOTAS',
  SOBRE: 'SOBRE',
  APLICACION: 'APLICACION',
  OTRO: 'OTRO',
});

const scheduleSchema = new mongoose.Schema(
  {
    times: { type: [String], required: true },
    daysOfWeek: { type: [Number], required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
  },
  { _id: false },
);

const medicationSchema = new mongoose.Schema(
  {
    adultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Adult',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    dose: { type: Number, required: true, min: Number.MIN_VALUE },
    doseUnit: { type: String, enum: Object.values(DoseUnit), required: true },
    quantity: { type: Number, required: true, min: Number.MIN_VALUE },
    quantityUnit: { type: String, enum: Object.values(QuantityUnit), required: true },
    instructions: { type: String, default: null, trim: true, maxlength: 300 },
    schedule: { type: scheduleSchema, required: true },
    graceMinutes: { type: Number, min: 15, max: 720, default: 180 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

medicationSchema.index({ adultId: 1, isActive: 1, deletedAt: 1 });
medicationSchema.index({ isActive: 1, deletedAt: 1 });

medicationSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    adultId: this.adultId.toString(),
    name: this.name,
    dose: this.dose,
    doseUnit: this.doseUnit,
    quantity: this.quantity,
    quantityUnit: this.quantityUnit,
    instructions: this.instructions,
    schedule: {
      times: [...this.schedule.times],
      daysOfWeek: [...this.schedule.daysOfWeek],
      startDate: this.schedule.startDate,
      endDate: this.schedule.endDate,
    },
    graceMinutes: this.graceMinutes,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Medication = mongoose.model('Medication', medicationSchema);
