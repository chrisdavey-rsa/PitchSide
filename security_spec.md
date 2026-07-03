# Security Specification

## 1. Data Invariants
1. **Self-Ownership Constraint**: A player can only look up, edit, or write their own profile where the document ID matches their Firebase Auth UID (`request.auth.uid == playerId`).
2. **Read Restrictiveness**: A player cannot view other players' PII (such as exact email addresses) unless they are logged in, and even then, profile fields like emails are isolated or blocked from public reading if necessary. For this fortress design, read/write is strictly owner-only: `request.auth.uid == playerId`.
3. **Immutability of Key Fields**: Once created, `createdAt` and `email` properties cannot be modified.
4. **Temporal Integrity**: `createdAt` must match `request.time` exactly upon creation.
5. **Private Verification Isolation**: Verification codes are not readable or listable by clients. Only the backend (or write validation flows) can touch them. The code itself stays securely in `/verifications/{email}` which has read/write operations blocked, or strictly validated.

---

## 2. The "Dirty Dozen" Payloads
These 12 scenarios try to bypass security, identity, and integrity rules, and MUST result in `PERMISSION_DENIED`:

1. **Identity Spoofing - Profile Spoof (Create)**: Authenticated user tries to write a player profile using a different user's UID as the document ID.
2. **Identity Spoofing - Profile Spoof (Update)**: Authenticated user tries to update another player's country or name.
3. **Immutability Breach - Email modification**: Authenticated user tries to update their email address inside their player profile.
4. **Immutability Breach - Date modification**: Authenticated user tries to modify their original `createdAt` timestamp.
5. **Unauthenticated Access - Profile Create**: Guest / unauthenticated user tries to write fields to the `/players` collection.
6. **Unauthenticated Access - Profile Read**: Guest / unauthenticated user tries to read any player's profile data.
7. **Temporal Fraud**: Authenticated user tries to create a player profile with a manual/stale client-side `createdAt` timestamp that does not match `request.time`.
8. **Resource Poisoning - Bad Names**: Authenticated user tries to register with a First Name longer than 100 characters.
9. **Resource Poisoning - Ghost Fields**: Authenticated user tries to write unvalidated properties (e.g. `role: "admin"` or `isAdmin: true`) on their player profile.
10. **Activation Pin Theft - Codes Expose**: Authenticated user tries to list/read all entries in `/verifications` to steal another user's activation PIN.
11. **Verification Hijack**: Authenticated user tries to modify/overwrite another user's verification document.
12. **Status Shortcut**: Authenticated user tries to set `isVerified: true` during profile creation without verifying the 6-digit code.

---

## 3. Test Runner Mock (`firestore.rules.test.ts`)
```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "pitchside-sandbox-test",
    firestore: {
      rules: require("fs").readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Firebase Rules Fortress Tests", () => {
  // 1. Identity Spoofing - Create
  it("fails when writing a profile with a mismatched UID", async () => {
    const maliciousDb = testEnv.authenticatedContext("user_hacker").firestore();
    const targetRef = doc(maliciousDb, "players", "user_victim");
    await assertFails(
      setDoc(targetRef, {
        firstName: "Malicious",
        surname: "User",
        username: "haxor",
        country: "New Zealand",
        email: "hacker@test.com",
        createdAt: new Date(), // Mock server time
        isVerified: false,
      })
    );
  });

  // 2. Identity Spoofing - Update
  it("fails when modern user updates another player's country description", async () => {
    // Admin creates seed victim index
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "players", "user_victim"), {
        firstName: "Victim",
        surname: "Name",
        username: "victim1",
        country: "United Kingdom",
        email: "victim@test.com",
        createdAt: new Date(),
        isVerified: true,
      });
    });

    const hackerDb = testEnv.authenticatedContext("user_hacker").firestore();
    await assertFails(
      updateDoc(doc(hackerDb, "players", "user_victim"), {
        country: "France",
      })
    );
  });

  // 3. Immutability violation - Email Change
  it("fails when a player tries to modify their registered email address", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "players", "user_player1"), {
        firstName: "John",
        surname: "Doe",
        username: "jdoe",
        country: "New Zealand",
        email: "john@doe.com",
        createdAt: new Date(),
        isVerified: true,
      });
    });

    const playerDb = testEnv.authenticatedContext("user_player1").firestore();
    await assertFails(
      updateDoc(doc(playerDb, "players", "user_player1"), {
        email: "john_new@doe.com",
      })
    );
  });

  // 4. Verification Pin Theft
  it("denies listing or reading the verifications directory to players", async () => {
    const playerDb = testEnv.authenticatedContext("user_player1").firestore();
    const verifRef = doc(playerDb, "verifications", "victim@test.com");
    await assertFails(getDoc(verifRef));
  });
});
```
