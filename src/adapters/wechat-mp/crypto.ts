import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * 微信公众平台消息加解密（安全模式 / 兼容模式）
 * @see https://developers.weixin.qq.com/doc/offiaccount/Message_Messages/Message_encryption_and_decryption.html
 */

export function wechatMpVerifyMsgSignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
  msgSignature: string
): boolean {
  if (!token || !timestamp || !nonce || !encrypt || !msgSignature) return false;
  const sorted = [token, timestamp, nonce, encrypt].sort().join('');
  const hash = createHash('sha1').update(sorted).digest('hex');
  return hash === msgSignature;
}

function wechatMpAesKeyIv(encodingAESKey: string): { key: Buffer; iv: Buffer } {
  const key = Buffer.from(encodingAESKey + '=', 'base64');
  if (key.length !== 32) {
    throw new Error('Invalid EncodingAESKey');
  }
  return { key, iv: key.subarray(0, 16) };
}

/**
 * 解密 Encrypt / URL 验证参数 echostr 的 Base64 密文，得到内层文本（XML 或纯文本 challenge）。
 */
export function wechatMpDecrypt(encryptBase64: string, encodingAESKey: string, appId: string): string {
  const { key, iv } = wechatMpAesKeyIv(encodingAESKey);
  const cipherBuf = Buffer.from(encryptBase64, 'base64');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  let decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);

  const padLen = decrypted[decrypted.length - 1]!;
  if (padLen < 1 || padLen > 32) {
    throw new Error('Invalid padding');
  }
  decrypted = decrypted.subarray(0, decrypted.length - padLen);
  if (decrypted.length < 20) {
    throw new Error('Invalid packet');
  }

  const body = decrypted.subarray(16);
  const msgLen = body.readUInt32BE(0);
  if (msgLen < 0 || 4 + msgLen > body.length) {
    throw new Error('Invalid msg length');
  }
  const msg = body.subarray(4, 4 + msgLen).toString('utf8');
  const idTail = body.subarray(4 + msgLen).toString('utf8');
  if (idTail !== appId) {
    throw new Error('AppId mismatch');
  }
  return msg;
}

const AES_BLOCK = 16;

/**
 * 被动回复内层明文 → Base64 密文（与解密对称，PKCS#7，块长 16）。
 */
export function wechatMpEncrypt(plainUtf8: string, encodingAESKey: string, appId: string): string {
  const { key, iv } = wechatMpAesKeyIv(encodingAESKey);
  const randomPart = randomBytes(16);
  const msgBuf = Buffer.from(plainUtf8, 'utf8');
  const msgLenBuf = Buffer.alloc(4);
  msgLenBuf.writeUInt32BE(msgBuf.length, 0);
  const appBuf = Buffer.from(appId, 'utf8');
  let plainBuf = Buffer.concat([randomPart, msgLenBuf, msgBuf, appBuf]);
  const pad = AES_BLOCK - (plainBuf.length % AES_BLOCK);
  const padBuf = Buffer.alloc(pad, pad);
  plainBuf = Buffer.concat([plainBuf, padBuf]);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  return encrypted.toString('base64');
}
