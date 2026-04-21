import { auth } from "../firebase/firebaseAuth";
import { db } from "../firebase/firestore";
import { storage } from "../firebase/firebaseStorage";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Upload liveness photo to Firebase Storage and return the download URL
const uploadLivenessPhoto = async (uid, uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `liveness-photos/residents/${uid}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn("Liveness photo upload failed:", err);
    return null;
  }
};

export const registerResident = async (data) => {
  const { email, password, selfieUri, ...profile } = data;

  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCred.user.uid;

  // Upload liveness photo if provided
  const livenessPhotoURL = selfieUri ? await uploadLivenessPhoto(uid, selfieUri) : null;

  await setDoc(doc(db, "users", uid), {
    email,
    role: "resident",
    status: "approved",
    createdAt: new Date(),
  });

  await setDoc(doc(db, "resident_profiles", uid), {
    ...profile,
    livenessPhotoURL,
    livenessVerified: !!livenessPhotoURL,
  });
};

export const registerPolice = async (data) => {
  const { email, password, ...profile } = data;

  const userCred = await createUserWithEmailAndPassword(auth, email, password);

  const uid = userCred.user.uid;

  await setDoc(doc(db, "users", uid), {
    email,
    role: "police",
    status: "pending",
    createdAt: new Date(),
  });

  await setDoc(doc(db, "police_profiles", uid), profile);
};

export const loginUser = async (email, password) => {
  const userCred = await signInWithEmailAndPassword(auth, email, password);

  const uid = userCred.user.uid;

  const userDoc = await getDoc(doc(db, "users", uid));
  const userData = userDoc.data();

  return userData;
};
