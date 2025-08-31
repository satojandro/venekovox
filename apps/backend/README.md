# VenekoVox Backend - Self.xyz Verification Service

Express.js backend service that handles Self.xyz zero-knowledge proof verification for VenekoVox.

## Features

- ✅ **Self.xyz Integration**: Backend verification of ZK-proofs
- ✅ **Age Verification**: Ensures users are 18+ for voting
- ✅ **Document Support**: Passport and EU ID card verification
- ✅ **OFAC Compliance**: Optional sanctions screening
- ✅ **TypeScript**: Full type safety and development experience
- ✅ **Health Checks**: API health monitoring endpoints

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
cd apps/backend
npm install
```

### Configuration

Create a `.env` file in the backend directory:

```env
# Self.xyz Configuration
VITE_SELF_SCOPE=venekovox-trust-ritual
SELF_ENDPOINT=https://api.self.xyz

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Running the Backend

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm run serve
```

The server will start on `http://localhost:3001`

## Testing with Self Playground

### Enable Mock Passports

1. **Download Self App**: Get the Self mobile app on iOS/Android
2. **Enable Debug Mode**: Tap the Self card **5 times with 2 fingers** to unlock debug menu
3. **Use Playground**: Visit https://playground.staging.self.xyz for testing

### Test the Integration

1. **Start Backend**: `npm run dev` (runs on port 3001)
2. **Start Frontend**: `cd ../front-end && pnpm dev` (runs on port 5173)
3. **Navigate**: Go to `http://localhost:5173/trust-ritual`
4. **Scan QR**: Use Self app in debug mode to scan the QR code
5. **Verify**: Check backend logs and frontend success state

### Mock Passport Flow

- ✅ **Development**: `mockPassport: true` (accepts test documents)
- ✅ **Production**: `mockPassport: false` (requires real documents)
- ✅ **Testing**: Use playground to simulate different demographics

## API Endpoints

### POST `/verify`

Verifies a Self.xyz zero-knowledge proof.

**Request Body:**
```json
{
  "attestationId": 1,
  "proof": [...],
  "pubSignals": [...],
  "userContextData": "..."
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Identity verified successfully",
  "verifyOutput": {
    "nationality": "USA",
    "gender": "F",
    "olderThan": "18"
  },
  "verificationDetails": {
    "isValid": true,
    "isOlderThan": true,
    "isOfacValid": true,
    "attestationId": 1
  }
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Verification failed",
  "details": {...}
}
```

### GET `/verify`

Health check for the verification endpoint.

### GET `/health`

General health check for the backend service.

### GET `/`

API information and available endpoints.

## Configuration Options

### Verification Rules

Modify the `configStorage` in `routes/verify.ts`:

```typescript
const configStorage = new (class {
  async getConfig() {
    return {
      olderThan: 18,           // Minimum age
      excludedCountries: [],   // Countries to exclude
      ofac: false,             // Enable OFAC checking
    };
  }
})();
```

### Document Types

Configure allowed document types in `routes/verify.ts`:

```typescript
const allowedIds = new Map<number, boolean>();
allowedIds.set(1, true); // Passport
allowedIds.set(2, true); // EU ID card
```

## Development

### Project Structure

```
apps/backend/
├── index.ts          # Server entry point
├── app.ts           # Express app configuration
├── routes/
│   └── verify.ts    # Self.xyz verification endpoint
├── package.json     # Dependencies and scripts
├── tsconfig.json    # TypeScript configuration
└── .env            # Environment variables
```

### Scripts

- `npm run dev` - Development with hot reload
- `npm run build` - Production build
- `npm run serve` - Serve production build

## Deployment

### Environment Variables for Production

```env
VITE_SELF_SCOPE=venekovox-trust-ritual
SELF_ENDPOINT=https://your-production-domain.com
PORT=3001
NODE_ENV=production
```

### Deployment Options

- **Railway**: `npm run build && npm run serve`
- **Vercel**: Use their Node.js runtime
- **Fly.io**: `fly deploy`
- **Docker**: Build from the included Dockerfile

## Integration with Frontend

The backend works seamlessly with the VenekoVox frontend:

1. Frontend generates QR code via `SelfAppBuilder`
2. User scans with Self mobile app
3. App generates ZK-proof and sends to backend
4. Backend verifies proof and returns result
5. Frontend stores verification status

## Error Handling

The backend handles various verification errors:

- **ConfigMismatchError**: Frontend/backend configuration mismatch
- **InvalidId**: Unsupported document type
- **InvalidScope**: Scope mismatch
- **InvalidRoot**: Blockchain root not found

## Security Notes

- All verification happens server-side
- No personal data is stored
- ZK-proofs ensure privacy
- HTTPS required for production
- Rate limiting recommended

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**: Run `npm install`
2. **Port already in use**: Change PORT in `.env`
3. **CORS errors**: Backend includes CORS middleware
4. **Verification failures**: Check scope matches between frontend/backend

### Logs

The backend provides detailed logging:
- ✅ Successful verifications
- ❌ Failed verifications with error details
- 🔍 Configuration mismatches

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Use conventional commits

## License

MIT License - see LICENSE file for details.
