import type { Message, MessageSegment } from '@/types';

/**
 * 消息构建器
 */

/**
 * 消息构建器
 */
export class MessageBuilder {
  private segments: MessageSegment[] = [];

  text(content: string): this {
    this.segments.push({ type: 'text', data: { text: content } });
    return this;
  }

  image(url: string, file?: string): this {
    this.segments.push({ type: 'image', data: { url, ...(file && { file }) } });
    return this;
  }

  at(userId: string, name?: string): this {
    this.segments.push({ type: 'at', data: { userId, ...(name && { name }) } });
    return this;
  }

  reply(messageId: string): this {
    this.segments.push({ type: 'reply', data: { messageId } });
    return this;
  }

  face(faceId: string): this {
    this.segments.push({ type: 'face', data: { id: faceId } });
    return this;
  }

  build(): Message {
    return this.segments;
  }

  static parse(template: string, context: Record<string, unknown>): Message {
    // 简单的模板解析：支持 [text:xxx] [at:userId] [image:url] 等格式
    const segments: MessageSegment[] = [];
    const regex = /\[(\w+):([^\]]+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(template)) !== null) {
      // 添加前面的纯文本
      if (match.index > lastIndex) {
        const text = template.slice(lastIndex, match.index);
        if (text) {
          segments.push({ type: 'text', data: { text } });
        }
      }

      const [, type, content] = match;
      switch (type) {
        case 'text':
          segments.push({ type: 'text', data: { text: content } });
          break;
        case 'at':
          segments.push({ type: 'at', data: { userId: content } });
          break;
        case 'image':
          segments.push({ type: 'image', data: { url: content } });
          break;
        case 'reply':
          segments.push({ type: 'reply', data: { messageId: content } });
          break;
        case 'face':
          segments.push({ type: 'face', data: { id: content } });
          break;
      }

      lastIndex = regex.lastIndex;
    }

    // 添加剩余文本
    if (lastIndex < template.length) {
      const text = template.slice(lastIndex);
      if (text) {
        segments.push({ type: 'text', data: { text } });
      }
    }

    return segments.length > 0 ? segments : [{ type: 'text', data: { text: template } }];
  }
}
