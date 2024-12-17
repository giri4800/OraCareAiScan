import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function validateServiceAccount(serviceAccount: any): serviceAccount is ServiceAccount {
  const requiredFields = [
    "type",
    "project_id",
    "private_key_id",
    "private_key",
    "client_email",
    "client_id",
  ];

  const missingFields = requiredFields.filter(field => !serviceAccount[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Invalid service account: Missing required fields: ${missingFields.join(", ")}`);
  }

  return true;
}

function initializeFirebase() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT environment variable is required. Please provide a valid Firebase service account JSON."
    );
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    validateServiceAccount(serviceAccount);

    initializeApp({
      credential: cert(serviceAccount),
    });

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "Failed to parse FIREBASE_SERVICE_ACCOUNT. Please ensure it contains valid JSON."
      );
    }
    throw error;
  }
}

// Initialize Firebase with error handling
try {
  initializeFirebase();
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
  throw error;
}

export const auth = getAuth();
