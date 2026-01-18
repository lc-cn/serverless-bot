import { ed25519 } from '@noble/curves/ed25519.js';

/**
 * QQ Bot Ed25519 签名验证与生成
 * 
 * 完全按照 QQ Bot 官方文档和 Yunzai/KarinJS 实现
 * 参考: https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/event-emit.html
 * 
 * QQ 机器人使用的签名方式：
 * - 使用 App Secret 作为 seed（不足 32 字节则 repeat 填充）
 * - 从 seed 派生 Ed25519 密钥对
 * - OpCode 0（事件推送）：验证签名，消息体为 timestamp + body
 * - OpCode 13（回调验证）：签名 event_ts + plain_token 并返回
 */
export class QQEd25519 {
  /**
   * 从 App Secret 派生 Ed25519 密钥对
   * 
   * 密钥派生规则（与 Yunzai/tweetnacl 完全一致）：
   * - 将 secret 重复填充到至少 32 字节
   * - 截取前 32 字节作为种子
   * - 使用种子生成 Ed25519 密钥对
   */
  static deriveKeyPair(secret: string): { publicKey: Uint8Array; privateKey: Uint8Array } {
    // seed 需要 32 字节，不足则 repeat（与 Yunzai 一致）
    let seed = secret;
    while (seed.length < 32) {
      seed = seed.repeat(2).slice(0, 32);
    }
    seed = seed.slice(0, 32);

    const seedBytes = new TextEncoder().encode(seed);
    // @noble/curves 的 ed25519: privateKey 就是 seed (32 bytes)
    const privateKey = seedBytes;
    const publicKey = ed25519.getPublicKey(privateKey);

    return { publicKey, privateKey };
  }

  /**
   * 验证 QQ 回调的 Ed25519 签名（OpCode 0 事件推送）
   * 
   * @param secret App Secret
   * @param signature X-Signature-Ed25519 header（hex 格式）
   * @param timestamp X-Signature-Timestamp header
   * @param body 原始请求 body（字符串）
   * @returns 签名是否有效
   */
  static verify(secret: string, signature: string, timestamp: string, body: string): boolean {
    try {
      const { publicKey } = this.deriveKeyPair(secret);
      // 签名验证：timestamp + body（与 Yunzai 一致）
      const message = timestamp + body;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = this.hexToBytes(signature);

      // Ed25519 签名应该是 64 字节
      if (signatureBytes.length !== 64) {
        console.error('[QQEd25519] Invalid signature length:', signatureBytes.length, 'expected 64');
        return false;
      }

      return ed25519.verify(signatureBytes, messageBytes, publicKey);
    } catch (error) {
      console.error('[QQEd25519] Verification error:', error);
      return false;
    }
  }

  /**
   * 生成签名（用于 OpCode 13 回调地址验证）
   * 
   * 签名顺序：event_ts + plain_token（与 KarinJS 一致）
   * 
   * @param secret App Secret
   * @param eventTs 事件时间戳（d.event_ts）
   * @param plainToken 明文 token（d.plain_token）
   * @returns 签名（hex 编码）
   */
  static sign(secret: string, eventTs: string, plainToken: string): string {
    try {
      const { privateKey } = this.deriveKeyPair(secret);
      // 签名顺序：event_ts + plain_token
      const message = eventTs + plainToken;
      const messageBytes = new TextEncoder().encode(message);
      const signature = ed25519.sign(messageBytes, privateKey);
      return this.bytesToHex(signature);
    } catch (error) {
      console.error('[QQEd25519] Sign error:', error);
      throw error;
    }
  }

  private static hexToBytes(hex: string): Uint8Array {
    // 处理可能的 0x 前缀和空格
    hex = hex.replace(/^0x/, '').trim();
    
    if (hex.length % 2 !== 0) {
      throw new Error('Hex string must have an even number of characters');
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
