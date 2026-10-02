export function createOccurrenceController({ occurrenceService }) {
  async function list(req, res, next) {
    try {
      res.status(200).json(
        await occurrenceService.list({
          adultId: req.validated.params.adultId,
          query: req.validated.query,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async function get(req, res, next) {
    try {
      res.status(200).json({
        data: await occurrenceService.get({
          adultId: req.validated.params.adultId,
          occurrenceId: req.validated.params.occurrenceId,
        }),
      });
    } catch (error) {
      next(error);
    }
  }

  async function confirm(req, res, next) {
    try {
      res.status(200).json({
        data: await occurrenceService.confirm({
          adultId: req.validated.params.adultId,
          occurrenceId: req.validated.params.occurrenceId,
          actor: req.actor,
          source: 'WEB',
          note: req.validated.body.note,
        }),
      });
    } catch (error) {
      next(error);
    }
  }

  async function skip(req, res, next) {
    try {
      res.status(200).json({
        data: await occurrenceService.skip({
          adultId: req.validated.params.adultId,
          occurrenceId: req.validated.params.occurrenceId,
          actor: req.actor,
          note: req.validated.body.note,
        }),
      });
    } catch (error) {
      next(error);
    }
  }

  return { list, get, confirm, skip };
}
