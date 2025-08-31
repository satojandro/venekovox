import express from 'express';
import { SelfBackendVerifier } from '@selfxyz/core';
import { UserIdType } from '@selfxyz/common';

const router = express.Router();

// Configure allowed document types
const allowedIds = new Map<1 | 2, boolean>();
allowedIds.set(1, true); // 1 = passport
allowedIds.set(2, true); // 2 = EU ID card (optional)

// Configuration storage for verification rules
const configStorage = new (class {
  private configs = new Map<string, any>();

  async getConfig(configId?: string) {
    if (configId && this.configs.has(configId)) {
      return this.configs.get(configId);
    }
    return {
      olderThan: 18,           // Minimum age requirement
      excludedCountries: [],   // ISO 3-letter country codes to exclude
      ofac: false,             // Enable OFAC sanctions checking
    };
  }

  async setConfig(configId: string, config: any): Promise<boolean> {
    this.configs.set(configId, config);
    return true;
  }

  async getActionId(_userIdentifier: string, _userDefinedData: any) {
    return 'default'; // Return configuration ID
  }
})();

// Initialize the Self backend verifier
const isProduction = process.env.NODE_ENV === 'production';
const verifier = new SelfBackendVerifier(
  process.env.VITE_SELF_SCOPE || 'venekovox-trust-ritual', // Must match frontend scope
  process.env.SELF_ENDPOINT || 'https://api.self.xyz',     // Frontend endpoint URL
  !isProduction,                                           // Mock mode for development, production for mainnet
  allowedIds,                                              // Allowed document types
  configStorage,                                           // Verification configuration
  'hex'                                                    // User ID type (matches frontend)
);

// POST /verify - Verify Self.xyz zero-knowledge proof
router.post('/', async (req, res) => {
  try {
    const { attestationId, proof, pubSignals, userContextData } = req.body;

    // Validate required fields
    if (!proof || !pubSignals || !attestationId || !userContextData) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: proof, pubSignals, attestationId, userContextData'
      });
    }

    console.log('🔍 Verifying Self.xyz proof...');

    // Verify the zero-knowledge proof
    const result = await verifier.verify(attestationId, proof, pubSignals, userContextData);

    console.log('✅ Verification result:', result.isValidDetails);

    // Return verification result
    if (result.isValidDetails.isValid) {
      res.status(200).json({
        status: 'success',
        message: 'Identity verified successfully',
        verifyOutput: result.discloseOutput,
        verificationDetails: {
          isValid: result.isValidDetails.isValid,
          isMinimumAgeValid: result.isValidDetails.isMinimumAgeValid,
          isOfacValid: result.isValidDetails.isOfacValid,
          attestationId: result.attestationId
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Verification failed',
        details: result.isValidDetails
      });
    }

  } catch (error: any) {
    console.error('❌ Verification error:', error);

    // Handle specific Self.xyz errors
    if (error.name === 'ConfigMismatchError') {
      return res.status(400).json({
        status: 'error',
        message: 'Configuration mismatch',
        details: error.issues
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Internal server error during verification'
    });
  }
});

// GET /verify - Health check for verification endpoint
router.get('/', (_, res) => {
  res.json({
    status: 'healthy',
    message: 'Self.xyz verification endpoint is ready',
    scope: process.env.VITE_SELF_SCOPE || 'venekovox-trust-ritual',
    endpoint: process.env.SELF_ENDPOINT || 'https://api.self.xyz'
  });
});

export default router;
