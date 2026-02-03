import type { AuthUser } from './middleware/auth.js';

// Hono context variables type
export interface AppVariables {
  user: AuthUser;
}
