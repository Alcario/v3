import mongoose from 'mongoose';

export const ActivityEventType = Object.freeze({
  ADULT_UPDATED: 'ADULT_UPDATED',
  CAREGIVER_GRANTED: 'CAREGIVER_GRANTED',
  CAREGIVER_REVOKED: 'CAREGIVER_REVOKED',
  CAREGIVER_ROLE_CHANGED: 'CAREGIVER_ROLE_CHANGED',
  MEDICATION_CREATED: 'MEDICATION_CREATED',
  MEDICATION_UPDATED: 'MEDICATION_UPDATED',
  MEDICATION_ACTIVATED: 'MEDICATION_ACTIVATED',
  MEDICATION_DEACTIVATED: 'MEDICATION_DEACTIVATED',
  MEDICATION_CONFIRMED: 'MEDICATION_CONFIRMED',
  MEDICATION_SKIPPED: 'MEDICATION_SKIPPED',
  MEDICATION_MISSED: 'MEDICATION_MISSED',
});

export const ActivitySource = Object.freeze({
  WEB: 'WEB',
  ALEXA: 'ALEXA',
  SYSTEM: 'SYSTEM',
});

export const ActivityActorType = Object.freeze({
  ADULT: 'ADULT',
  CAREGIVER: 'CAREGIVER',
  SYSTEM: 'SYSTEM',
});

const activityEventSchema = new mongoose.Schema(
  {
    adultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Adult',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ActivityEventType),
      required: true,
    },
    occurredAt: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: Object.values(ActivitySource), required: true },
    actorType: { type: String, enum: Object.values(ActivityActorType), required: true },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    summary: { type: String, required: true, maxlength: 300 },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    relatedModel: { type: String, default: null, maxlength: 80 },
  },
  { timestamps: true },
);

activityEventSchema.index({ adultId: 1, occurredAt: -1 });
activityEventSchema.index({ adultId: 1, type: 1, occurredAt: -1 });

export const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema);
