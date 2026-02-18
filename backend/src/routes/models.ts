import { Hono } from 'hono';
import { DEFAULT_MODEL, getModelMetadata } from '../lib/constants.js';
import type { AppVariables } from '../types.js';

export const modelsRouter = new Hono<{ Variables: AppVariables }>();

modelsRouter.get('/models', async (c) => {
  return c.json({
    defaultModel: DEFAULT_MODEL,
    models: getModelMetadata(),
  });
});
