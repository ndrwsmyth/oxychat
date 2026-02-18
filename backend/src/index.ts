import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { conversationsRouter } from './routes/conversations.js';
import { chatRouter } from './routes/chat.js';
import { transcriptsRouter } from './routes/transcripts.js';
import { webhooksRouter } from './routes/webhooks.js';
import { feedbackRouter } from './routes/feedback.js';
import { modelsRouter } from './routes/models.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

// Request logging
app.use('*', logger());

// Global error handler
app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err.message);
  console.error(err.stack);
  return c.json({ error: err.message }, 500);
});

// CORS
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth middleware for protected routes (excludes webhooks)
app.use('/api/conversations/*', authMiddleware);
app.use('/api/transcripts/*', authMiddleware);
app.use('/api/messages/*', authMiddleware);
app.use('/api/search/*', authMiddleware);
app.use('/api/models/*', authMiddleware);

// Routes
app.route('/api', conversationsRouter);
app.route('/api', chatRouter);
app.route('/api', transcriptsRouter);
app.route('/api', feedbackRouter);
app.route('/api', modelsRouter);
app.route('/api/webhooks', webhooksRouter);

const port = Number(process.env.PORT) || 8000;
console.log(`OxyChat backend starting on port ${port}`);

serve({ fetch: app.fetch, port });
