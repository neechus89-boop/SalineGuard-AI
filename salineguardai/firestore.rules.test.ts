import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesContent = fs.readFileSync(
  path.resolve(process.cwd(), 'firestore.rules'),
  'utf8'
);

test('firestore.rules enforces rules_version 2 and global default-deny catch-all', () => {
  assert.ok(rulesContent.includes("rules_version = '2';"));
  assert.ok(
    rulesContent.includes('match /{document=**} {\n      allow read, write: if false;\n    }')
  );
});

test('firestore.rules secures both /patients/{patientId} and /infusionSessions/{sessionId}', () => {
  assert.ok(rulesContent.includes('match /patients/{patientId}'));
  assert.ok(rulesContent.includes('match /infusionSessions/{sessionId}'));
  assert.ok(rulesContent.includes('isValidPatient(incoming())'));
  assert.ok(rulesContent.includes('isValidInfusionSession(incoming())'));
  assert.ok(rulesContent.includes('request.auth.token.email_verified == true'));
});

test('firestore.rules enforces Dirty Dozen anti-spoofing, relational sync, and immutable session audit logs', () => {
  // Identity spoofing & immutable ownerId/createdAt
  assert.ok(rulesContent.includes('incoming().ownerId == request.auth.uid'));
  assert.ok(rulesContent.includes('incoming().ownerId == existing().ownerId'));
  assert.ok(rulesContent.includes('incoming().createdAt == existing().createdAt'));
  // Relational parent existence check on infusionSessions create
  assert.ok(
    rulesContent.includes(
      'exists(/databases/$(database)/documents/patients/$(incoming().patientId))'
    )
  );
  // Terminal locking on logged infusionSessions
  assert.ok(rulesContent.includes('allow update: if false;'));
  // List queries enforce resource.data.ownerId without get()/exists()
  assert.ok(
    rulesContent.includes(
      'allow list: if isVerifiedUser() && (resource.data.ownerId == request.auth.uid || isAdmin());'
    )
  );
});
