import test from 'node:test';
import assert from 'node:assert/strict';
import { seal, unseal, equal } from '../lib/security';
import { emailSchema, sheetSchema, validateAction } from '../lib/tools';

test('encrypted capabilities round-trip without exposing plaintext', () => {
  const value = { email: 'person@example.com', secret: 'super-secret-api-key', amount: 42 };
  const token = seal(value);
  assert.deepEqual(unseal(token), value);
  assert.ok(!Buffer.from(token, 'base64url').toString().includes(value.secret));
});
test('rejects tampered, malformed and expired approval capabilities', () => {
  const original = seal({ name: 'send_email' });
  const buffer = Buffer.from(original, 'base64url');
  buffer[35] ^= 1;
  assert.equal(unseal(buffer.toString('base64url')), null);
  assert.equal(unseal('not-a-token'), null);
  assert.equal(unseal(seal({ id: 'expired' }, -1)), null);
});
test('constant-length comparisons handle mismatched inputs', () => {
  assert.equal(equal('correct', 'correct'), true);
  assert.equal(equal('correct', 'incorrect'), false);
  assert.equal(equal('', 'a'), false);
});
test('email validation rejects header injection and invalid recipients', () => {
  assert.equal(
    emailSchema.safeParse({ to: 'alice@example.com', subject: 'Hello', body: 'A real message.' })
      .success,
    true,
  );
  for (const subject of ['Hello\r\nBcc: eve@example.com', 'Hello\nBcc: eve@example.com', '']) {
    assert.equal(
      emailSchema.safeParse({ to: 'alice@example.com', subject, body: 'Message' }).success,
      false,
    );
  }
  assert.equal(
    emailSchema.safeParse({ to: 'not an email', subject: 'Hello', body: 'Message' }).success,
    false,
  );
  assert.equal(
    emailSchema.safeParse({
      to: 'a@example.com\r\nBcc:b@example.com',
      subject: 'Hello',
      body: 'Message',
    }).success,
    false,
  );
});
test('spreadsheet schema limits action size and accepts structured rows', () => {
  const data = {
    spreadsheetId: 'a-valid-spreadsheet-id-12345',
    range: 'Sheet1!A:C',
    values: [
      ['Name', 'Value', 'Approved'],
      ['Alice', 42, true],
      ['Bob', null, false],
    ],
  };
  assert.equal(sheetSchema.safeParse(data).success, true);
  assert.equal(sheetSchema.safeParse({ ...data, spreadsheetId: '../../unsafe' }).success, false);
  assert.equal(
    sheetSchema.safeParse({ ...data, values: Array.from({ length: 201 }, () => ['x']) }).success,
    false,
  );
  assert.equal(sheetSchema.safeParse({ ...data, values: [[]] }).success, false);
});
test('only allowlisted write actions are accepted', () => {
  assert.throws(() => validateAction('run_shell', { command: 'rm -rf /' }));
  assert.throws(() => validateAction('delete_spreadsheet', {}));
  assert.equal(
    validateAction('send_email', { to: 'a@example.com', subject: 'Hello', body: 'World' }).name,
    'send_email',
  );
});
