const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// 1. Initialize Firebase Admin App
const serviceAccount = require('./serviceAccountKey.json');

const adminApp = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 2. Password Reset Endpoint
app.post('/api/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  try {
    // Fetch user record by email using modular getAuth()
    const userRecord = await auth.getUserByEmail(email);

    // Update password inside Firebase Auth directly
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });

    // Reset lockout counters in Firestore
    const userDocs = await db.collection('users').where('email', '==', email).get();

    const updatePromises = [];
    userDocs.forEach((docSnap) => {
      updatePromises.push(
        docSnap.ref.update({
          isLocked: false,
          failedAttempts: 0
        })
      );
    });
    await Promise.all(updatePromises);

    return res.status(200).json({ success: true, message: 'Password updated successfully in Firebase Auth.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Node backend running on http://localhost:${PORT}`);
});