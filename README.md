# Stock Analyzer - A股实时分析助手

实时A股行情分析工具，支持股票 + ETF/LOF 基金。

## 功能
- 📊 实时行情（新浪/东方财富数据源）
- 📈 技术分析（MA/MACD/RSI/KDJ/BOLL/ATR）
- 💡 多指标交叉验证，输出操作建议
- 🛡️ 基于 ATR 的止损止盈建议
- 💬 微信公众号被动回复

## 技术栈
- Next.js 15 + TypeScript
- TailwindCSS 4
- ECharts（K线图表，待实现）
- Vercel 部署

## 本地开发
```bash
npm install
npm run dev
```

## 环境变量
```
WECHAT_TOKEN=your_wechat_token
```

## 部署
推送到 GitHub → Vercel 自动部署
