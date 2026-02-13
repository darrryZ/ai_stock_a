# 企业微信自建应用对接指南

## 一、创建自建应用

### 1. 登录企业微信管理后台
访问 https://work.weixin.qq.com/wework_admin/loginpage_wx

### 2. 创建应用
1. 进入 **应用管理** → **自建** → **创建应用**
2. 填写：
   - **应用名称**：A股分析助手（或你喜欢的名字）
   - **应用 logo**：上传一个图标
   - **可见范围**：选择你自己或整个企业
3. 创建完成后，记录：
   - **AgentId**：应用详情页顶部
   - **Secret**：点击查看，发送到手机

### 3. 获取企业 ID（CorpID）
进入 **我的企业** → 页面最下方的 **企业ID**

---

## 二、配置接收消息

### 1. 进入应用设置
**应用管理** → 找到刚创建的应用 → **接收消息** → **设置 API 接收**

### 2. 填写回调参数

| 参数 | 值 |
|------|------|
| **URL** | `https://你的域名/api/wxwork` |
| **Token** | 点击"随机获取"，记录下来 |
| **EncodingAESKey** | 点击"随机获取"，记录下来 |

> ⚠️ **先不要点保存！** 需要先配置好服务端环境变量，否则 URL 验证会失败。

---

## 三、配置环境变量

### Vercel 部署
进入 Vercel 项目 → **Settings** → **Environment Variables**，添加：

| 变量名 | 值 | 说明 |
|--------|------|------|
| `WXWORK_CORP_ID` | 你的企业ID | 如 `ww1234567890abcdef` |
| `WXWORK_TOKEN` | 上一步的 Token | 如 `abc123def456` |
| `WXWORK_ENCODING_KEY` | 上一步的 EncodingAESKey | 43 位字符串 |
| `WXWORK_AGENT_ID` | 应用的 AgentId | 如 `1000002` |
| `WXWORK_SECRET` | 应用的 Secret | 查看应用详情获取 |

添加完成后，需要 **重新部署**（Vercel → Deployments → Redeploy）。

### 本地开发
在项目根目录创建 `.env.local` 文件：

```env
WXWORK_CORP_ID=你的企业ID
WXWORK_TOKEN=你的Token
WXWORK_ENCODING_KEY=你的EncodingAESKey
WXWORK_AGENT_ID=你的AgentId
WXWORK_SECRET=你的Secret
```

---

## 四、验证 URL

1. 确认 Vercel 已重新部署成功
2. 回到企业微信管理后台，点击 **保存**
3. 企业微信会发送 GET 请求到你的 URL 进行验证
4. 验证通过后，接收消息功能启用 ✅

> 如果验证失败，检查：
> - 环境变量是否正确设置并重新部署
> - URL 是否正确（https://你的域名/api/wxwork）
> - Token 和 EncodingAESKey 是否与后台一致

---

## 五、使用方式

配置完成后，在企业微信中打开应用，直接发消息：

| 输入 | 说明 |
|------|------|
| `600519` | 按股票代码分析 |
| `贵州茅台` | 按名称搜索并分析 |
| `gzmt` | 按拼音首字母搜索并分析 |

返回内容包括：
- 实时价格和涨跌幅
- 综合信号（看多/看空/观望）
- 技术分析摘要
- 操作建议
- 止损止盈参考

---

## 六、API 路由说明

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/wxwork` | GET | 企业微信 URL 验证回调 |
| `/api/wxwork` | POST | 接收用户消息并被动回复 |
| `/api/wechat` | GET/POST | 微信公众号接口（已有） |

两个接口独立运行，互不干扰。

---

## 七、操作清单（Checklist）

- [ ] 登录企业微信管理后台
- [ ] 创建自建应用，记录 AgentId + Secret
- [ ] 获取企业 CorpID
- [ ] 在应用中设置 API 接收，记录 Token + EncodingAESKey
- [ ] 在 Vercel 添加 5 个环境变量
- [ ] Vercel 重新部署
- [ ] 回到企业微信后台，保存 API 接收配置（触发 URL 验证）
- [ ] 在企业微信中打开应用，发送股票代码测试
