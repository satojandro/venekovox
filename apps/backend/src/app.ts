import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import verifyRoute from './routes/verify';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://venekovox.com', 'https://www.venekovox.com']
    : ['http://localhost:5173', 'http://localhost:3002'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'venekovox-backend',
    version: '1.0.0'
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'VenekoVox Backend',
    description: 'Self.xyz identity verification service for VenekoVox',
    version: '1.0.0',
    endpoints: {
      'POST /verify': 'Verify Self.xyz ZK-proof',
      'GET /health': 'Service health check',
      'GET /': 'This API information'
    },
    documentation: 'See README.md for setup and testing instructions'
  });
});

// Routes
app.use('/verify', verifyRoute);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: ['POST /verify', 'GET /health', 'GET /']
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

export default app;
