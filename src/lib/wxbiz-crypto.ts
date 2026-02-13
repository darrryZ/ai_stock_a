/**
 * 企业微信消息加解密工具
 * 实现 AES-256-CBC 加解密 + 签名校验
 * 参考：https://developer.work.weixin.qq.com/document/path/90968
 */

import crypto from 'crypto';

export class WXBizMsgCrypt {
  private token: string;
  private encodingAESKey: string;
  private corpId: string;
  private aesKey: Buffer;
  private iv: Buffer;

  constructor(token: string, encodingAESKey: string, corpId: string) {
    this.token = token;
    this.encodingAESKey = encodingAESKey;
    this.corpId = corpId;
    // EncodingAESKey 是 Base64 编码的 AES 密钥（43个字符 + '=' 补齐）
    this.aesKey = Buffer.from(encodingAESKey + '=', 'base64');
    this.iv = this.aesKey.subarray(0, 16);
  }

  /**
   * 验证签名
   */
  private getSignature(timestamp: string, nonce: string, encrypt: string): string {
    const arr = [this.token, timestamp, nonce, encrypt].sort();
    return crypto.createHash('sha1').update(arr.join('')).digest('hex');
  }

  /**
   * 验证 URL 回调（GET 请求）
   * 返回解密后的 echostr
   */
  verifyURL(msgSignature: string, timestamp: string, nonce: string, echostr: string): string {
    const signature = this.getSignature(timestamp, nonce, echostr);
    if (signature !== msgSignature) {
      throw new Error('签名验证失败');
    }
    return this.decrypt(echostr);
  }

  /**
   * 解密消息
   */
  decryptMsg(msgSignature: string, timestamp: string, nonce: string, encrypt: string): string {
    const signature = this.getSignature(timestamp, nonce, encrypt);
    if (signature !== msgSignature) {
      throw new Error('消息签名验证失败');
    }
    return this.decrypt(encrypt);
  }

  /**
   * 加密回复消息
   * 返回 { encrypt, signature, timestamp, nonce } 用于构建回复 XML
   */
  encryptMsg(replyMsg: string, timestamp?: string, nonce?: string): {
    encrypt: string;
    signature: string;
    timestamp: string;
    nonce: string;
  } {
    const ts = timestamp || String(Math.floor(Date.now() / 1000));
    const nc = nonce || this.generateNonce();
    const encrypted = this.encrypt(replyMsg);
    const sig = this.getSignature(ts, nc, encrypted);
    return { encrypt: encrypted, signature: sig, timestamp: ts, nonce: nc };
  }

  /**
   * AES 解密
   */
  private decrypt(encrypted: string): string {
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.aesKey, this.iv);
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([
      decipher.update(encrypted, 'base64'),
      decipher.final(),
    ]);

    // PKCS#7 去填充
    const pad = decrypted[decrypted.length - 1];
    if (pad < 1 || pad > 32) {
      throw new Error('PKCS#7 去填充失败');
    }
    decrypted = decrypted.subarray(0, decrypted.length - pad);

    // 去掉16字节随机字符串
    // 格式: random(16) + msgLen(4, network byte order) + msg + receiveid
    const msgLen = decrypted.readUInt32BE(16);
    const msg = decrypted.subarray(20, 20 + msgLen).toString('utf-8');
    const receiveid = decrypted.subarray(20 + msgLen).toString('utf-8');

    if (receiveid !== this.corpId) {
      throw new Error(`CorpID 不匹配: 期望 ${this.corpId}, 收到 ${receiveid}`);
    }

    return msg;
  }

  /**
   * AES 加密
   */
  private encrypt(text: string): string {
    // random(16) + msgLen(4) + msg + corpId
    const randomBytes = crypto.randomBytes(16);
    const msgBuf = Buffer.from(text, 'utf-8');
    const corpIdBuf = Buffer.from(this.corpId, 'utf-8');
    const msgLenBuf = Buffer.alloc(4);
    msgLenBuf.writeUInt32BE(msgBuf.length, 0);

    let data = Buffer.concat([randomBytes, msgLenBuf, msgBuf, corpIdBuf]);

    // PKCS#7 填充
    const blockSize = 32;
    const pad = blockSize - (data.length % blockSize);
    data = Buffer.concat([data, Buffer.alloc(pad, pad)]);

    const cipher = crypto.createCipheriv('aes-256-cbc', this.aesKey, this.iv);
    cipher.setAutoPadding(false);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return encrypted.toString('base64');
  }

  private generateNonce(): string {
    return crypto.randomBytes(8).toString('hex');
  }
}
