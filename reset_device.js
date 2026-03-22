const admin = require('firebase-admin');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(\{[\s\S]*?\})\n/);
const key = JSON.parse(match[1]);

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

db.collection('devices').doc('bin_1_green').update({
  status: 'factory_pending',
  orgId: null,
  claimNonce: null,
  claimNonceExpiry: null,
  claimRequestedAt: null,
  claimVerifiedAt: null,
  claimConfirmedAt: null,
}).then(() => {
  console.log('✅ Device bin_1_green reset to factory_pending');
  process.exit(0);
}).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
