import { randomInt } from "node:crypto";

// Excludes visually-ambiguous characters (0/O, 1/l/I) since this password is
// meant to be read aloud or typed from a screen/WhatsApp message by someone
// setting up a new device - a typo here just means a failed login, not a
// security issue, but it's an easy usability win to avoid.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Generates a random password for an admin-created or admin-reset account
 * (sections: user management - admins never choose a user's password
 * themselves). Uses `crypto.randomInt`, not `Math.random()`, since this
 * value is a real credential. The caller is responsible for showing it to
 * the admin exactly once (it is hashed immediately and never stored or
 * logged in plaintext) and for setting `mustChangePassword` on the account.
 */
export function generateRandomPassword(length = 10): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += CHARSET[randomInt(0, CHARSET.length)];
  }
  return password;
}
