import { createHash, randomBytes } from 'node:crypto';
import { wechatMpEncrypt } from './crypto';

function cdataEscape(s: string): string {
  return s.replace(/]]>/g, ']]]]><![CDATA[>');
}

/** 被动回复文本消息内层 XML（明文）。ToUserName / FromUserName 与入站对调。 */
export function buildWechatMpPassiveTextXml(inbound: Record<string, string>, text: string): string {
  const userOpenId = inbound.FromUserName || '';
  const officialId = inbound.ToUserName || '';
  const t = Math.floor(Date.now() / 1000);
  const body = text.trim();
  return `<xml>
<ToUserName><![CDATA[${cdataEscape(userOpenId)}]]></ToUserName>
<FromUserName><![CDATA[${cdataEscape(officialId)}]]></FromUserName>
<CreateTime>${t}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${cdataEscape(body)}]]></Content>
</xml>`;
}

/** 被动回复外层：Encrypt + MsgSignature + TimeStamp + Nonce */
export function buildWechatMpEncryptedPassiveXml(
  plainInnerXml: string,
  token: string,
  encodingAESKey: string,
  appId: string
): string {
  const encrypt = wechatMpEncrypt(plainInnerXml.trim(), encodingAESKey, appId);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(8).toString('hex');
  const msgSig = createHash('sha1')
    .update([token, String(timestamp), nonce, encrypt].sort().join(''))
    .digest('hex');
  return `<xml>
<Encrypt><![CDATA[${encrypt}]]></Encrypt>
<MsgSignature><![CDATA[${msgSig}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;
}
