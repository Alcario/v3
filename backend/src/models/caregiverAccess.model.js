import mongoose from 'mongoose';

export const CaregiverRole = Object.freeze({
  OWNER: 'OWNER',
  CAREGIVER: 'CAREGIVER',
});

export const CaregiverAccessStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
});

const caregiverAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Adult',
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(CaregiverRole),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CaregiverAccessStatus),
      default: CaregiverAccessStatus.ACTIVE,
    },
    grantedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

caregiverAccessSchema.index({ userId: 1, adultId: 1 }, { unique: true });
caregiverAccessSchema.index({ userId: 1, status: 1 });
caregiverAccessSchema.index({ adultId: 1, status: 1 });

export const CaregiverAccess = mongoose.model('CaregiverAccess', caregiverAccessSchema);
