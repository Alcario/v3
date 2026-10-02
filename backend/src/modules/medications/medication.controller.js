export function createMedicationController({ medicationService }) {
  async function list(req, res, next) {
    try {
      const result = await medicationService.list({
        adultId: req.validated.params.adultId,
        includeInactive: req.validated.query.includeInactive,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async function create(req, res, next) {
    try {
      const medication = await medicationService.create({
        adultId: req.validated.params.adultId,
        actor: req.actor,
        input: req.validated.body,
      });
      res.status(201).json({ data: medication });
    } catch (error) {
      next(error);
    }
  }

  async function get(req, res, next) {
    try {
      const medication = await medicationService.get({
        adultId: req.validated.params.adultId,
        medicationId: req.validated.params.medicationId,
      });
      res.status(200).json({ data: medication });
    } catch (error) {
      next(error);
    }
  }

  async function update(req, res, next) {
    try {
      const medication = await medicationService.update({
        adultId: req.validated.params.adultId,
        medicationId: req.validated.params.medicationId,
        actor: req.actor,
        input: req.validated.body,
      });
      res.status(200).json({ data: medication });
    } catch (error) {
      next(error);
    }
  }

  function transition(isActive) {
    return async function transitionMedication(req, res, next) {
      try {
        const medication = await medicationService.setActive({
          adultId: req.validated.params.adultId,
          medicationId: req.validated.params.medicationId,
          actor: req.actor,
          isActive,
        });
        res.status(200).json({ data: medication });
      } catch (error) {
        next(error);
      }
    };
  }

  async function remove(req, res, next) {
    try {
      const medication = await medicationService.remove({
        adultId: req.validated.params.adultId,
        medicationId: req.validated.params.medicationId,
        actor: req.actor,
      });
      res.status(200).json({ data: medication });
    } catch (error) {
      next(error);
    }
  }

  return {
    list,
    create,
    get,
    update,
    activate: transition(true),
    deactivate: transition(false),
    remove,
  };
}
