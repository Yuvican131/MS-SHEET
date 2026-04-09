
'use client';
import {
  Auth,
  signInAnonymously,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** 
 * Initiate Phone Number Sign-in.
 * Note: This returns a Promise because the ConfirmationResult is required for the next step.
 */
export async function initiatePhoneSignIn(
  authInstance: Auth, 
  phoneNumber: string, 
  recaptchaVerifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  // We must return this promise so the UI can handle the next step (OTP input)
  return signInWithPhoneNumber(authInstance, phoneNumber, recaptchaVerifier);
}
