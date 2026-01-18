import { ed25519 } from '@noble/curves/ed25519.js';

/**
 * Discord Ed25519 签名验证
 * 参考: https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 */
export class DiscordEd25519 {
  /**
   * 验证 Discord 交互的签名
   * @param publicKey Discord Bot 的公钥 (hex 格式)
   * @param signature x-signature-ed25519 header (hex 格式)
   * @param timestamp x-signature-timestamp header
   * @param body 原始的请求 body (字符串格式)
   */
  static verify(publicKey: string, signature: string, timestamp: string, body: string): boolean {
    try {
      // 构造需要验证的消息: timestamp + raw body
      const message = timestamp + body;
      const messageBytes = Buffer.from(message, 'utf8');
      const signatureBytes = Buffer.from(signature, 'hex');
      const publicKeyBytes = Buffer.from(publicKey, 'hex');

      // 使用 Ed25519 验证签名
      // ed25519.verify 返回 true 表示签名有效，false 表示无效
      // 会抛出异常如果签名或公钥格式不正确
      return ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
    } catch (error) {
      console.error('[Ed25519] Verification error:', error);
      return false;
    }
  }
}
