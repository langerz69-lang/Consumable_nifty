import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/apiRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Default port is 3030 as specified by user requirements
const PORT = process.env.PORT || 3030;

app.use(express.json());

// Mount the MariaDB REST API endpoints
app.use('/api', apiRouter);

// Serve static assets from compiled React Vite output
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all SPA routes to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=== Consumables Hub Server running on port ${PORT} ===`);
  console.log(`- Web Application: http://0.0.0.0:${PORT}`);
  console.log(`- API Status: http://0.0.0.0:${PORT}/api/health`);
});
