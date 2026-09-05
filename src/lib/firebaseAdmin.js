import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "./firebase.js";

let services;

export function getFirebaseAdminServices() {
  if (!services) {
    const app = getFirebaseApp();
    services = { auth: getAuth(app), db: getFirestore(app) };
  }
  return services;
}
