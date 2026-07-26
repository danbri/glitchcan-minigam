// Signing code gets the gold-standard treatment: AWS publishes a worked
// example with an expected signature, so that is the test. "It looks like
// the spec" is not a standard for crypto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sigv4, awsUriEncode, EMPTY_SHA256, sha256hex, amzDate } from '../src/sigv4.mjs';

test('matches the AWS published test vector (GET Object, byte range)', async () => {
  const v = await sigv4({
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: { range: 'bytes=0-9', 'x-amz-content-sha256': EMPTY_SHA256, 'x-amz-date': '20130524T000000Z' },
    payloadHash: EMPTY_SHA256,
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    amzdate: '20130524T000000Z',
  });
  assert.equal(v.signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  assert.equal(v.signedHeaders, 'host;range;x-amz-content-sha256;x-amz-date');
});

test('the secret key does not appear in what the signer returns', async () => {
  const SK = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const v = await sigv4({
    method: 'PUT', url: 'https://b.s3.amazonaws.com/k', headers: { 'x-amz-date': '20130524T000000Z' },
    payloadHash: EMPTY_SHA256, accessKeyId: 'AKID', secretAccessKey: SK,
    region: 'us-east-1', amzdate: '20130524T000000Z',
  });
  assert.ok(!JSON.stringify(v).includes(SK), 'a signature must not carry the key that made it');
});

test('EMPTY_SHA256 really is the hash of nothing', async () => {
  assert.equal(await sha256hex(''), EMPTY_SHA256);
});

test('awsUriEncode leaves unreserved characters and escapes the rest', () => {
  assert.equal(awsUriEncode('a-b_c.d~e'), 'a-b_c.d~e');
  assert.equal(awsUriEncode('a/b'), 'a%2Fb');
  assert.equal(awsUriEncode('a/b', false), 'a/b');
  assert.equal(awsUriEncode('a b'), 'a%20b');
  assert.equal(awsUriEncode('é'), '%C3%A9', 'UTF-8 bytes, not code units');
});

test('amzDate is the only format SigV4 accepts', () => {
  assert.match(amzDate(new Date('2013-05-24T00:00:00Z')), /^\d{8}T\d{6}Z$/);
  assert.equal(amzDate(new Date('2013-05-24T00:00:00Z')), '20130524T000000Z');
});
