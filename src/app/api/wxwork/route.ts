/**
 * 企业微信自建应用消息回调
 * GET  /api/wxwork — URL 验证
 * POST /api/wxwork — 接收用户消息，被动回复股票分析
 *
 * 环境变量：
 *   WXWORK_CORP_ID       — 企业ID
 *   WXWORK_TOKEN         — 接收消息 Token
 *   WXWORK_ENCODING_KEY  — EncodingAESKey（43位）
 *   WXWORK_AGENT_ID      — 应用 AgentId
 *   WXWORK_SECRET        — 应用 Secret（主动推送时需要）
 */

import { NextRequest, NextResponse } from 'next/server';
import { WXBizMsgCrypt } from '@/lib/wxbiz-crypto';
import { getQuote, getKlines } from '@/lib/market-data';
import { normalizeCode } from '@/types/stock';
import { analyzeStock } from '@/lib/analyzer';

function getCrypt() {
  const corpId = process.env.WXWORK_CORP_ID;
  const token = process.env.WXWORK_TOKEN;
  const encodingKey = process.env.WXWORK_ENCODING_KEY;
  if (!corpId || !token || !encodingKey) {
    throw new Error('缺少企业微信配置：WXWORK_CORP_ID / WXWORK_TOKEN / WXWORK_ENCODING_KEY');
  }
  return new WXBizMsgCrypt(token, encodingKey, corpId);
}

// ============ GET: URL 验证 ============
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const msgSignature = searchParams.get('msg_signature') || '';
    const timestamp = searchParams.get('timestamp') || '';
    const nonce = searchParams.get('nonce') || '';
    const echostr = searchParams.get('echostr') || '';

    const crypt = getCrypt();
    const replyEchoStr = crypt.verifyURL(msgSignature, timestamp, nonce, echostr);

    // 必须返回明文 echostr，不带引号、不带 BOM、不带换行
    return new NextResponse(replyEchoStr, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    console.error('企业微信 URL 验证失败:', err);
    return new NextResponse('验证失败', { status: 403 });
  }
}

// ============ POST: 接收消息 ============
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const msgSignature = searchParams.get('msg_signature') || '';
    const timestamp = searchParams.get('timestamp') || '';
    const nonce = searchParams.get('nonce') || '';

    const body = await req.text();
    const crypt = getCrypt();

    // 从 XML 中提取 Encrypt 字段
    const encryptMatch = body.match(/<Encrypt><!\[CDATA\[(.+?)\]\]><\/Encrypt>/);
    if (!encryptMatch) {
      console.error('无法解析 Encrypt 字段');
      return new NextResponse('', { status: 200 });
    }
    const encrypt = encryptMatch[1];

    // 解密消息
    const decryptedXml = crypt.decryptMsg(msgSignature, timestamp, nonce, encrypt);
    console.log('[企业微信] 解密后原文:', decryptedXml);
    const msg = parseXML(decryptedXml);

    console.log('[企业微信] 收到消息:', JSON.stringify(msg));

    // 只处理文本消息
    if (msg.MsgType !== 'text') {
      return buildEncryptedReply(crypt, msg, '发送股票代码（如 600519）或名称进行分析\n\n支持:\n• 6位股票代码\n• 股票名称（如"贵州茅台"）\n• 拼音首字母（如"gzmt"）', nonce);
    }

    const content = msg.Content?.trim();
    if (!content) {
      return new NextResponse('', { status: 200 });
    }

    // 尝试搜索或直接分析
    let stockCode = '';

    // 先判断是否直接是股票代码
    const codeMatch = content.match(/^[a-zA-Z]{0,2}\d{6}$/);
    if (codeMatch) {
      stockCode = content;
    } else {
      // 尝试名称/拼音搜索
      try {
        const searchUrl = new URL('/api/search', req.url);
        searchUrl.searchParams.set('q', content);
        const searchRes = await fetch(searchUrl.toString());
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0) {
          stockCode = searchData.results[0].code;
        }
      } catch {
        // 搜索失败，继续
      }
    }

    if (!stockCode) {
      return buildEncryptedReply(crypt, msg,
        `未找到"${content}"相关股票\n\n请输入:\n• 6位代码（如 600519）\n• 股票名称（如"贵州茅台"）\n• 拼音首字母（如"gzmt"）`, nonce);
    }

    // 分析股票
    const code = normalizeCode(stockCode);
    const [quote, klines] = await Promise.all([
      getQuote(code),
      getKlines(code, 'daily', 120),
    ]);

    const result = analyzeStock(quote, klines);

    const signalEmoji = result.signal === 'bullish' ? '🟢' : result.signal === 'bearish' ? '🔴' : '🟡';
    const signalText = result.signal === 'bullish' ? '看多' : result.signal === 'bearish' ? '看空' : '观望';

    const replyText = [
      `${signalEmoji}【${quote.name}】${quote.code}`,
      `现价: ${quote.price} | ${quote.change > 0 ? '+' : ''}${quote.change}(${quote.changePercent > 0 ? '+' : ''}${quote.changePercent}%)`,
      ``,
      `📊 信号: ${signalText}`,
      result.summary.split('\n').slice(0, 6).join('\n'),
      ``,
      `💡 ${result.suggestion}`,
      result.stopLoss ? `\n🛡 止损: ${result.stopLoss} | 🎯 止盈: ${result.takeProfit}` : '',
    ].filter(Boolean).join('\n');

    return buildEncryptedReply(crypt, msg, replyText, nonce);
  } catch (err) {
    console.error('企业微信消息处理失败:', err);
    return new NextResponse('', { status: 200 }); // 必须返回200
  }
}

// ============ 辅助函数 ============

function parseXML(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  // 先匹配 CDATA 格式
  const cdataRegex = /<(\w+)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g;
  let match;
  while ((match = cdataRegex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  // 再匹配纯文本格式（不含子标签）
  const textRegex = /<(\w+)>([^<]+)<\/\1>/g;
  while ((match = textRegex.exec(xml)) !== null) {
    if (!result[match[1]]) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

function buildEncryptedReply(
  crypt: WXBizMsgCrypt,
  msg: Record<string, string>,
  content: string,
  nonce: string
): NextResponse {
  // 构建明文回复 XML
  const replyXml = `<xml>
<ToUserName><![CDATA[${msg.FromUserName}]]></ToUserName>
<FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;

  // 加密
  const { encrypt, signature, timestamp, nonce: replyNonce } = crypt.encryptMsg(replyXml, undefined, nonce);

  // 构建加密回复
  const encryptedXml = `<xml>
<Encrypt><![CDATA[${encrypt}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${replyNonce}]]></Nonce>
</xml>`;

  return new NextResponse(encryptedXml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
