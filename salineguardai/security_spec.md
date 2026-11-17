# SalineGuard AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. Every document in `/patients/{patientId}` MUST belong to a verified authenticated user (`request.auth != null && request.auth.token.email_verified == true`) with `ownerId == request.auth.uid`, valid `createdAt == request.time`, and valid `updatedAt == request.time`.
2. Every document in `/infusionSessions/{sessionId}` MUST reference an existing parent patient document (`exists(/databases/$(database)/documents/patients/$(incoming().patientId))`) whose `ownerId` matches `request.auth.uid`.
3. `patients` updates follow action-based `affectedKeys().hasOnly(...)` allowlists, preserve immutable `ownerId` and `createdAt`, and enforce `updatedAt == request.time`.
4. `infusionSessions` records are immutable clinical audit logs (`allow update: if false;`), only allowing deletion by the owning clinician (`resource.data.ownerId == request.auth.uid`) or verified admin (`neechus89@gmail.com`).
5. All document IDs (`patientId`, `sessionId`, `ownerId`, `patientCode`) match `^[a-zA-Z0-9_\\-]+$` and enforce strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `request.auth == null` reading `/patients` or writing `/infusionSessions` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `request.auth.token.email_verified == false` creating a patient -> `PERMISSION_DENIED`.
3. **Identity Spoofing**: User A creates a patient with `ownerId: "user-B-uid"` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection**: Creating a patient with extra key `isAdmin: true` or `shadowTag: "x"` -> `PERMISSION_DENIED` (`keys().hasOnly(...)`).
5. **Orphaned Session Creation**: Creating an `infusionSession` with non-existent `patientId: "missing-id"` -> `PERMISSION_DENIED` (`exists()`).
6. **Cross-Owner Session Attachment**: User A tries to attach an `infusionSession` to User B's `patientId` -> `PERMISSION_DENIED` (`get().data.ownerId == request.auth.uid`).
7. **Timestamp Forgery**: Client sends `createdAt: "2020-01-01T00:00:00Z"` instead of server `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Updating `ownerId` or `createdAt` on an existing patient -> `PERMISSION_DENIED`.
9. **Value Poisoning on Update**: Updating `prescribedBagMl` to invalid value `9999` or negative `age: -5` -> `PERMISSION_DENIED` (`isValidPatient()` wraps update).
10. **ID Poisoning / Denial of Wallet**: Using a 1.5KB string or invalid characters in `{patientId}` or `fullName` (>100 chars) -> `PERMISSION_DENIED`.
11. **Terminal Audit Tampering**: Attempting to update a logged `infusionSession` (`volumeUsedMl` or `status`) -> `PERMISSION_DENIED`.
12. **Blanket List Query Scraping**: Querying `/patients` or `/infusionSessions` without `where('ownerId', '==', uid)` as a non-admin -> `PERMISSION_DENIED` (`resource.data.ownerId == request.auth.uid` on `allow list`).
