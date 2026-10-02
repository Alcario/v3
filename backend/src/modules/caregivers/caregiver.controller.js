export function createCaregiverController({ caregiverService }) {
  async function list(req, res, next) {
    try {
      const result = await caregiverService.list({
        adultId: req.validated.params.adultId,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async function grant(req, res, next) {
    try {
      const { email, role } = req.validated.body;
      const access = await caregiverService.grant({
        adultId: req.validated.params.adultId,
        actor: req.actor,
        email,
        role,
      });
      res.status(201).json({ data: access });
    } catch (error) {
      next(error);
    }
  }

  async function changeRole(req, res, next) {
    try {
      const access = await caregiverService.changeRole({
        adultId: req.validated.params.adultId,
        accessId: req.validated.params.accessId,
        actor: req.actor,
        role: req.validated.body.role,
      });
      res.status(200).json({ data: access });
    } catch (error) {
      next(error);
    }
  }

  async function revoke(req, res, next) {
    try {
      const access = await caregiverService.revoke({
        adultId: req.validated.params.adultId,
        accessId: req.validated.params.accessId,
        actor: req.actor,
      });
      res.status(200).json({ data: access });
    } catch (error) {
      next(error);
    }
  }

  return { list, grant, changeRole, revoke };
}
