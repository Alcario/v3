import {
  ActivityActorType,
  ActivityEvent,
  ActivitySource,
} from '../../models/activityEvent.model.js';

export function createActivityService() {
  async function record(
    {
      adultId,
      type,
      summary,
      actorUserId,
      payload = {},
      relatedId = null,
      relatedModel = null,
      source = ActivitySource.WEB,
      actorType = ActivityActorType.CAREGIVER,
      occurredAt = new Date(),
    },
    { session } = {},
  ) {
    const [event] = await ActivityEvent.create(
      [
        {
          adultId,
          type,
          occurredAt,
          source,
          actorType,
          actorUserId,
          summary,
          payload,
          relatedId,
          relatedModel,
        },
      ],
      { session },
    );
    return event;
  }

  return { record };
}
