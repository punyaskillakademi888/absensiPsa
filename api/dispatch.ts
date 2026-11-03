import app from '../server/index.js';
import { createVercelHandler } from '../server/vercelHandler.js';

export const config = {
  maxDuration: 30,
};

export default createVercelHandler(app as any);
