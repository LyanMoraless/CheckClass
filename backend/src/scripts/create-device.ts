import 'dotenv/config';
import { createHash, randomBytes } from 'crypto';
import dataSource from '../database/data-source';

// Dev-only utility to get a device + API key to test the Ingestion Gateway
// against. Not a substitute for real device provisioning (that belongs to
// institutional management, priority 2, not yet built).
async function main() {
  const [tenantName, roomName, deviceType, externalIdentifier] = process.argv.slice(2);
  if (!tenantName || !roomName || !deviceType || !externalIdentifier) {
    console.error('Usage: npm run device:create -- <tenantName> <roomName> <deviceType> <externalIdentifier>');
    process.exitCode = 1;
    return;
  }

  await dataSource.initialize();

  const [tenant] = await dataSource.query('INSERT INTO tenant (name, institution_type) VALUES ($1, $2) RETURNING id', [
    tenantName,
    'school',
  ]);
  const [room] = await dataSource.query('INSERT INTO room (tenant_id, name) VALUES ($1, $2) RETURNING id', [
    tenant.id,
    roomName,
  ]);

  const apiKeyId = randomBytes(16).toString('hex');
  const secret = randomBytes(32).toString('hex');
  const secretHash = createHash('sha256').update(secret).digest('hex');

  const [device] = await dataSource.query(
    `INSERT INTO device (tenant_id, room_id, device_type, external_identifier, api_key_id, api_key_secret_hash)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenant.id, room.id, deviceType, externalIdentifier, apiKeyId, secretHash],
  );

  console.log('tenantId:', tenant.id);
  console.log('roomId:', room.id);
  console.log('deviceId:', device.id);
  console.log('apiKey (save now, cannot be recovered):', `${apiKeyId}.${secret}`);

  await dataSource.destroy();
}

main();
