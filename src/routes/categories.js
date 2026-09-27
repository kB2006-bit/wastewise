import { Router } from 'express';

export function createCategoriesRouter(repo) {
  const router = Router();

  router.get('/categories', (req, res, next) => {
    try {
      const categories = repo.getCategories();
      res.json(categories);
    } catch (err) {
      next(err);
    }
  });

  router.get('/categories/:id/prep-rules', (req, res, next) => {
    try {
      const rules = repo.getPrepRulesByCategoryId(req.params.id);
      res.json(rules);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
