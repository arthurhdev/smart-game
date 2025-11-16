import { v4 as uuidv4 } from 'uuid';

export function shortUUID() {
  const buffer = Buffer.from(uuidv4().replace(/-/g, ''), 'hex')
  return buffer.toString('base64url')
}