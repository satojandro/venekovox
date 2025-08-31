import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import verifyRoute from './routes/verify';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/verify', verifyRoute);

// Root health check
app.get('/', (_, res) => {
  res.json({
    message: 'VenekoVox backend is live.',
    endpoints: {
      verify: '/verify (POST)',
      health: '/health'
    }
  });
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'VenekoVox Backend'
  });
});

export default app;
