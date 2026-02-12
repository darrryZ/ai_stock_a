// 微信公众号消息接口
// POST /api/wechat — 接收微信消息，返回股票分析
// GET  /api/wechat — 微信服务器验证（Token校验）

import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getKlines } from '@/lib/market-data';
import { normalizeCode } from '@/types/stock';
import { analyzeStock } from '@/lib/analyzer';
import crypto from 'crypto';

const WECHAT_TOKEN = process.env.WECHAT_TOKEN || 'stock_analyzer_token';

// ============ GET: 微信Token验证 ============

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const signature = searchParams.get('signature') || '';
  const timestamp = searchParams.get('timestamp') || '';
  const nonce = searchParams.get('nonce') || '';
  const echostr = searchParams.get('echostr') || '';

  const arr = [WECHAT_TOKEN, timestamp, nonce].sort();
  const hash = crypto.createHash('sha1').update(arr.join('')).digest('hex');

  if (hash === signature) {
    return new NextResponse(echostr);
  }
  return new NextResponse('验证失败', { status: 403 });
}

// ============ POST: 处理用户消息 ============

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const msg = parseXML(body);

    if (msg.MsgType !== 'text') {
      return buildReply(msg, '请发送股票代码（如 600519）或基金代码进行分析');
    }

    const content = msg.Content.trim();

    // 判断是否是股票/基金代码
    const codeMatch = content.match(/^[a-zA-Z]{0,2}\d{6}$/);
    if (!codeMatch) {
      return buildReply(msg, '请发送6位股票/基金代码（如 600519、159915），我会为你分析最新行情。');
    }

    const code = normalizeCode(content);
    const [quote, klines] = await Promise.all([
      getQuote(code),
      getKlines(code, 'daily', 120),
    ]);

    const result = analyzeStock(quote, klines);

    const replyText = [
      `【${quote.name}】${quote.code}`,
      `当前价: ${quote.price} | 涨跌: ${quote.change}(${quote.changePercent}%)`,
      ``,
      result.summary.split('\n').slice(0, 8).join('\n'), // 微信限制，截取前几行
      ``,
      `💡 ${result.suggestion}`,
    ].join('\n');

    return buildReply(msg, replyText);
  } catch (err: unknown) {
    console.error('微信消息处理失败:', err);
    return new NextResponse('success'); // 微信要求返回 success
  }
}

// ============ XML 解析/构建 ============

function parseXML(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /<(\w+)><!\[CDATA\[(.+?)\]\]><\/\1>|<(\w+)>(.+?)<\/\3>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    result[key] = value;
  }
  return result;
}

function buildReply(msg: Record<string, string>, content: string): NextResponse {
  const xml = `<xml>
  <ToUserName><![CDATA[${msg.FromUserName}]]></ToUserName>
  <FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${content}]]></Content>
</xml>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
