
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { setupSwagger } from './_extras/api-docs/swagger.js';
import { errorHandler } from './src/utils/_errors.js';

//My import
import { authRouter } from './src/routes/authRoutes.js';
import { userRouter } from './src/routes/userRoutes.js';
import { rosterRouter } from './src/routes/rosterRoutes.js';
import { userCharacterRouter } from './src/routes/userCharacterRoutes.js';
import { shopRouter } from './src/routes/shopRoutes.js';
import { inventoryRouter } from './src/routes/inventoryRoutes.js';
import { questRouter } from './src/routes/questRoutes.js';
import { duelRouter } from './src/routes/duelRoutes.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('src/frontend'));

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// app.use('/api/your-resource', yourRoutes);
// Elemental Companion Quest routes
app.use('/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/roster', rosterRouter);
app.use('/api/user-characters', userCharacterRouter);
app.use('/api/shop', shopRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/quests', questRouter);
app.use('/api/duels', duelRouter);

// Swagger API docs
await setupSwagger(app);

// Global error handler (must be last)
app.use(errorHandler);

// Only listen when run directly (not imported for testing)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Teyvat Bonds`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API docs at http://localhost:${PORT}/api-docs`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port by setting the PORT environment variable.`);
    process.exit(1);
  }
  throw err;
});

export default app;
