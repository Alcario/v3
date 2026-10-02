import { AdultStatus } from '../../models/adult.model.js';

export function createAdultController({ adultService }) {
  async function list(req, res, next) {
    try {
      res.status(200).json(await adultService.list({ userId: req.actor.userId }));
    } catch (error) {
      next(error);
    }
  }

  async function create(req, res, next) {
    try {
      const adult = await adultService.create({ actor: req.actor, input: req.validated.body });
      res.status(201).json({ data: adult });
    } catch (error) {
      next(error);
    }
  }

  async function get(req, res, next) {
    try {
      const adult = await adultService.get({ adultId: req.validated.params.adultId });
      res.status(200).json({ data: adult });
    } catch (error) {
      next(error);
    }
  }

  async function update(req, res, next) {
    try {
      const adult = await adultService.update({
        adultId: req.validated.params.adultId,
        actor: req.actor,
        input: req.validated.body,
      });
      res.status(200).json({ data: adult });
    } catch (error) {
      next(error);
    }
  }

  function transition(status) {
    return async function transitionAdult(req, res, next) {
      try {
        const adult = await adultService.setStatus({
          adultId: req.validated.params.adultId,
          actor: req.actor,
          status,
        });
        res.status(200).json({ data: adult });
      } catch (error) {
        next(error);
      }
    };
  }

  return {
    list,
    create,
    get,
    update,
    deactivate: transition(AdultStatus.INACTIVE),
    activate: transition(AdultStatus.ACTIVE),
  };
}
