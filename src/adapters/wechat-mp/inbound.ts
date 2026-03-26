import { parseWechatMpXml, wechatMpVerifySignature } from './xml';
import { wechatMpDecrypt, wechatMpVerifyMsgSignature } from './crypto';

export type WechatMpInboundResult =
  | { ok: true; fields: Record<string, string> }
  | { ok: false };

/**
 * 校验 POST 签名并解析消息：明文 XML，或安全/兼容模式外层 Encrypt 解密后再解析内层 XML。
 */
export function processWechatMpWebhook(
  bodyText: string,
  config: Record<string, unknown>,
  query: Record<string, string>
): WechatMpInboundResult {
  const token = String(config.token || '').trim();
  const appId = String(config.appId || '').trim();
  const aesKey = String(config.encodingAESKey || '').trim();
  const timestamp = query.timestamp || '';
  const nonce = query.nonce || '';

  if (!token || !timestamp || !nonce) {
    return { ok: false };
  }

  const outer = parseWechatMpXml(bodyText);
  const encryptCipher = (outer.Encrypt || '').trim();

  if (encryptCipher && aesKey) {
    const msgSig = (query.msg_signature || query.signature || '').trim();
    if (!msgSig || !wechatMpVerifyMsgSignature(token, timestamp, nonce, encryptCipher, msgSig)) {
      return { ok: false };
    }
    if (!appId) {
      return { ok: false };
    }
    let innerXml: string;
    try {
      innerXml = wechatMpDecrypt(encryptCipher, aesKey, appId);
    } catch {
      return { ok: false };
    }
    return { ok: true, fields: parseWechatMpXml(innerXml) };
  }

  if (encryptCipher && !aesKey) {
    return { ok: false };
  }

  const sig = (query.signature || '').trim();
  if (!sig || !wechatMpVerifySignature(token, timestamp, nonce, sig)) {
    return { ok: false };
  }

  return { ok: true, fields: parseWechatMpXml(bodyText) };
}
