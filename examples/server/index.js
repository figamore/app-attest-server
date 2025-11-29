const express = require('express');
const path = require('path');

// Import the app-attest-server package
const AppAttestKit = require('app-attest-server');

const app = express();
const PORT = 3001;
const localIpAddress = Object.values(require('os').networkInterfaces()).flat().find(i => i.family==='IPv4' && !i.internal).address;


// Middleware
app.use(express.json());

// Configuration - Update these with your actual Apple Developer values
const TEAM_ID = process.env.APPLE_TEAM_ID || 'YOUR_TEAM_ID'; // Replace with your 10-char team ID
const BUNDLE_ID = process.env.BUNDLE_IDENTIFIER || 'com.demo.AppAttestKit'; // Replace with your bundle ID
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

console.log(' ++ AppAttestKit Demo Server Starting... ++');
console.log(`   - Team ID: ${TEAM_ID}`);
console.log(`   - Bundle ID: ${BUNDLE_ID}`);
console.log(`   - Mode: ${IS_DEVELOPMENT ? 'Development' : 'Production'}`);
console.log('');

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'AppAttestKit Demo Server is running!',
    timestamp: new Date().toISOString(),
    config: {
      teamId: TEAM_ID,
      bundleId: BUNDLE_ID,
      isDevelopment: IS_DEVELOPMENT
    }
  });
});

// Get challenge nonce for attestation
app.get('/api/nonce', async (req, res) => {
  try {
    console.log('📞 Nonce request from device:', req.headers['device-id']?.substring(0, 8) + '...');
    
    const randomNonce = await AppAttestKit.getNonce(req);
    if (randomNonce?.error) {
      console.error('❌ Nonce generation failed:', randomNonce.error);
      return res.status(400).json({ error: 'Failed to generate nonce' });
    }
    
    console.log('✅ Nonce generated successfully');
    return res.status(200).json({ nonce: randomNonce });
  } catch (error) {
    console.error('❌ Nonce endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Register device attestation
app.post('/api/registerattestation', async (req, res) => {
  try {
    const deviceId = req.headers['device-id']?.substring(0, 8) + '...';
    console.log('📱 Attestation registration from device:', deviceId);
    
    const result = await AppAttestKit.registerAttestation(req, TEAM_ID, BUNDLE_ID, IS_DEVELOPMENT);
    if (result?.error) {
      console.error('❌ Attestation registration failed:', result.error);
      return res.status(400).json({ error: 'Attestation registration failed' });
    }
    
    console.log('✅ Attestation registered successfully for device:', deviceId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Attestation registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected route - validates App Attest assertion
app.post('/api/protectedroute', async (req, res) => {
  try {
    const deviceId = req.headers['device-id']?.substring(0, 8) + '...';
    console.log('🔒 Protected route access from device:', deviceId);
    
    const assertionResult = await AppAttestKit.validateAssertion(req, TEAM_ID, BUNDLE_ID);

    if (assertionResult?.error) {
      // Important: If 'nokey' error, return 422 to trigger client re-attestation
      if (assertionResult.error === 'nokey') {
        console.log('🔄 Device needs re-attestation:', deviceId);
        return res.status(422).json({ error: 'Device not registered. Please re-attest.' });
      }
      console.error('❌ Assertion validation failed:', assertionResult.error);
      return res.status(400).json({ error: 'Assertion validation failed' });
    }

    console.log(`✅ Assertion validated for device: ${deviceId}, Count: ${assertionResult}`);
    return res.status(200).json({ 
      assertionsCount: assertionResult,
      message: 'Protected resource accessed successfully!',
      timestamp: new Date().toISOString(),
      deviceId: deviceId
    });
  } catch (error) {
    console.error('❌ Protected route error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Additional demo endpoint
app.post('/api/user-data', async (req, res) => {
  try {
    const deviceId = req.headers['device-id']?.substring(0, 8) + '...';
    console.log('👤 User data request from device:', deviceId);
    
    const assertionResult = await AppAttestKit.validateAssertion(req, TEAM_ID, BUNDLE_ID);

    if (assertionResult?.error) {
      if (assertionResult.error === 'nokey') {
        return res.status(422).json({ error: 'Device not registered. Please re-attest.' });
      }
      return res.status(400).json({ error: 'Assertion validation failed' });
    }

    // Simulate user data
    const userData = {
      userId: req.headers['user-id'] || 'demo-user',
      accountType: 'Premium',
      lastLogin: new Date().toISOString(),
      preferences: {
        notifications: true,
        darkMode: true
      },
      assertionCount: assertionResult
    };

    console.log(`✅ User data served to device: ${deviceId}`);
    return res.status(200).json(userData);
  } catch (error) {
    console.error('❌ User data endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 AppAttestKit Demo Server is running!`);
  console.log('');
  console.log('📋 Endpoints:');
  console.log(`   GET  /api/nonce - Generate challenge nonce`);
  console.log(`   POST /api/registerattestation - Register device`);
  console.log(`   POST /api/protectedroute - Protected resource`);
  console.log(`   POST /api/user-data - Demo user data`);
  console.log('');
  console.log(`🔗 Access from iOS client app: http://${localIpAddress}:${PORT}`);
});