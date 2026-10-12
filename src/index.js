import { startServer } from './server.js';

startServer().catch(err => {
  console.error('Failed to launch WA-USERAUTH:', err);
  process.exit(1);
});
