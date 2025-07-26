# 🎯 TTS Proxy API

为 a42z.ai 前端提供安全的TTS语音生成代理服务，解决CORS跨域和API密钥安全问题。

## 📋 功能特性

- 🔐 **API密钥安全**: 隐藏PPIO API密钥，防止前端暴露
- 🌐 **CORS支持**: 解决跨域请求问题
- 🗄️ **数据库集成**: 支持从PostgreSQL获取文字内容
- 🎭 **多语音角色**: 支持4个AI人物语音（Sam Altman、李飞飞、吴恩达、Paul Graham）
- ⚡ **高性能**: 基于Express + Zeabur云原生部署
- 🛡️ **安全防护**: 请求频率限制、参数验证、错误处理

## 🏗️ 技术架构

```
前端 (a42z.ai) → Zeabur API代理 → PPIO TTS API
                      ↓
                  PostgreSQL
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd tts-proxy-api
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# PostgreSQL数据库连接
DATABASE_URL=postgresql://username:password@host:port/database

# PPIO API配置
PPIO_API_TOKEN=your_ppio_api_token

# 其他配置...
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 4. 测试API

```bash
# 健康检查
curl http://localhost:3000/health

# 获取支持的语音角色
curl http://localhost:3000/api/tts/speakers

# 测试语音生成
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World", "speaker": "sam_altman"}'
```

## 📡 API接口

### POST /api/tts

生成TTS语音

**请求参数:**
```json
{
  "textId": 123,           // 数据库文字ID（与text二选一）
  "text": "Hello World",   // 直接文字内容（与textId二选一）
  "speaker": "sam_altman"  // 语音角色
}
```

**响应格式:**
```json
{
  "success": true,
  "audioUrl": "https://...",
  "textPreview": "Hello World",
  "speaker": "sam_altman",
  "voiceId": "voice_xxx",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/tts/speakers

获取支持的语音角色列表

### GET /api/tts/health

TTS服务健康检查

### GET /api/tts/test

测试所有语音角色

## 🎭 支持的语音角色

| 角色名 | speaker参数 | 描述 |
|--------|-------------|------|
| Sam Altman | `sam_altman` | OpenAI CEO |
| 李飞飞 | `feifeili` | 斯坦福AI实验室主任 |
| 吴恩达 | `wuenda` | AI教育家 |
| Paul Graham | `paul_graham` | Y Combinator创始人 |

## 🔧 部署到Zeabur

### 1. 推送代码到Git仓库

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

### 2. 在Zeabur创建项目

1. 登录 [Zeabur](https://zeabur.com)
2. 连接Git仓库
3. 选择 `tts-proxy-api` 目录
4. 配置环境变量

### 3. 配置环境变量

在Zeabur控制台设置以下环境变量：

```
DATABASE_URL=your_postgresql_url
PPIO_API_TOKEN=your_ppio_token
ALLOWED_ORIGIN=*
NODE_ENV=production
```

### 4. 部署

Zeabur会自动检测 `zeabur.json` 配置并部署应用。

## 💻 前端集成

```javascript
// TTS服务类
class TTSService {
  constructor() {
    this.apiUrl = 'https://your-app.zeabur.app/api/tts'
  }

  async playText(options) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    
    const result = await response.json()
    if (result.success) {
      const audio = new Audio(result.audioUrl)
      await audio.play()
      return audio
    } else {
      throw new Error(result.error)
    }
  }
}

// 使用示例
const tts = new TTSService()
await tts.playText({ text: 'Hello World', speaker: 'sam_altman' })
```

## 🔍 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查 `DATABASE_URL` 是否正确
   - 确认数据库服务是否运行

2. **PPIO API调用失败**
   - 检查 `PPIO_API_TOKEN` 是否有效
   - 确认Voice ID是否在有效期内（7天）

3. **CORS错误**
   - 检查 `ALLOWED_ORIGIN` 配置
   - 确认前端域名是否正确

### 日志查看

```bash
# 开发环境
npm run dev

# 生产环境（Zeabur）
# 在Zeabur控制台查看实时日志
```

## 📄 许可证

MIT License
