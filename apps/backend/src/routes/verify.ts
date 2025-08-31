import express, { Request, Response } from 'express';
// import { SelfBackendVerifier } from '@selfxyz/core'; // Will be uncommented when SDK is properly configured

const router = express.Router();

// Initialize Self.xyz verifier
// const verifier = new SelfBackendVerifier({
//   // Configuration will be loaded from environment variables
//   // Add your Self.xyz configuration here
// });

// Mock passport mode for development
const isDevelopment = process.env.NODE_ENV !== 'production';
const mockPassportEnabled = process.env.MOCK_PASSPORT === 'true' || isDevelopment;

// POST /verify - Verify Self.xyz ZK-proof
router.post('/', async (req, res) => {
  try {
    console.log('🔍 Verifying Self.xyz proof...');

    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both proof and publicSignals are required',
        received: { proof: !!proof, publicSignals: !!publicSignals }
      });
    }

    // In development with mock passports, accept test proofs
    if (mockPassportEnabled && isDevelopment) {
      console.log('🧪 Mock passport mode enabled - accepting test proof');

      // Simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock successful verification response
      const mockResult = {
        status: 'verified',
        verifiedAt: new Date().toISOString(),
        userId: 'mock-user-' + Date.now(),
        country: 'US', // Mock country
        age: 25,       // Mock age
        gender: 'M',   // Mock gender
        mockMode: true,
        message: 'Mock verification successful - use playground for real testing'
      };

      console.log('✅ Mock verification result:', mockResult);
      return res.json(mockResult);
    }

    // Production verification with real Self.xyz
    console.log('🔐 Production verification not yet configured');
    console.log('📝 Received proof data:', { proofLength: proof.length, signalsCount: publicSignals.length });

    // TODO: Uncomment when Self.xyz SDK is properly configured
    // const verificationResult = await verifier.verify({
    //   proof,
    //   publicSignals,
    //   // Add additional verification parameters as needed
    // });

    // For now, return mock result in all cases
    const result = {
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      userId: 'temp-user-' + Date.now(),
      country: 'US',
      age: 25,
      gender: 'M',
      mockMode: true,
      message: 'Temporary mock verification - configure Self.xyz SDK for production'
    };

    console.log('✅ Temporary verification result:', result);
    res.json(result);

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      error: 'Verification Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      status: 'error'
    });
  }
});

// GET /verify - Health check for verification endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Self.xyz Verification',
    mockMode: mockPassportEnabled && isDevelopment,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    instructions: mockPassportEnabled && isDevelopment
      ? 'Mock passport mode enabled. Use Self Playground for testing.'
      : 'Production mode. Requires valid Self.xyz proofs.'
  });
});

export default router;
