# 🚀 TTS Proxy API Zeabur部署指南

## 📋 部署前准备

### 1. 确认项目状态
- ✅ 本地测试通过
- ✅ 所有Voice ID有效（7天内）
- ✅ PPIO API Token可用
- ✅ 环境变量配置完成

### 2. 项目文件检查
```bash
tts-proxy-api/
├── src/                    # 源代码
├── package.json           # 依赖配置
├── zeabur.json           # Zeabur部署配置
├── .env.production       # 生产环境变量
└── README.md             # 项目说明
```

## 🌐 Zeabur部署步骤

### 步骤1: 创建Zeabur项目

1. 访问 [Zeabur控制台](https://zeabur.com)
2. 点击 "New Project"
3. 项目名称: `tts-proxy-api`
4. 选择部署方式: "Deploy from GitHub"

### 步骤2: 连接GitHub仓库

1. 授权GitHub访问
2. 选择仓库: `advx25/dataforhuman`
3. 选择目录: `tts-proxy-api`
4. 分支: `main`

### 步骤3: 配置环境变量

在Zeabur项目设置中添加以下环境变量：

```env
# 基础配置
NODE_ENV=production
PORT=3000

# 数据库配置
SUPABASE_URL=https://cslplhzfcfvzsivsgrpc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbHBsaHpmY2Z2enNpdnNncnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5OTMwMDUsImV4cCI6MjA2ODU2OTAwNX0.u_4i51DuA0Uwyv2Ocw6i953Tn7_WdcPp3GFlgtGGhXU

# PPIO API配置
PPIO_API_TOKEN=sk_P7dvruEBeOoxYXN4lILmfwmB4DvpmSxSvzrPVGwU01c
PPIO_API_URL=https://api.ppinfra.com/v3/minimax-voice-cloning

# CORS配置
ALLOWED_ORIGIN=https://a42z.ai

# Voice ID配置（7天内有效）
VOICE_SAM_ALTMAN=voice_4bc8f72b-71ed-4089-a93e-ad3381fde6e5
VOICE_FEIFEILI=voice_c514c3d8-1d62-4e49-8526-d82fd857548b
VOICE_WUENDA=voice_7fcc1d94-d0ec-4a39-91fe-508b0fb43af6
VOICE_PAUL_GRAHAM=voice_bb4693a9-4ece-4c68-961d-30016cfd10f9

# API限制配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 日志配置
LOG_LEVEL=info

# 生产模式配置
ENABLE_MOCK_MODE=false
```

### 步骤4: 配置域名和SSL

1. 在Zeabur项目中点击 "Domains"
2. 添加自定义域名（可选）
3. 使用默认域名: `https://tts-proxy-api-xxx.zeabur.app`
4. SSL证书自动配置

### 步骤5: 部署和验证

1. 点击 "Deploy" 开始部署
2. 等待构建完成（约2-3分钟）
3. 检查部署日志确认无错误
4. 访问健康检查端点验证

## 🧪 部署后测试

### 1. 健康检查
```bash
curl https://your-domain.zeabur.app/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2025-07-26T16:20:00.673Z",
  "uptime": 26.328636333,
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. TTS API测试
```bash
curl -X POST https://your-domain.zeabur.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World", "speaker": "sam_altman"}'
```

预期响应：
```json
{
  "success": true,
  "audioUrl": "https://faas-minimax-audio-xxx.cos.ap-shanghai.myqcloud.com/...",
  "textPreview": "Hello World",
  "speaker": "sam_altman",
  "voiceId": "voice_4bc8f72b-71ed-4089-a93e-ad3381fde6e5"
}
```

### 3. 支持的语音角色测试
```bash
# Sam Altman (英文)
curl -X POST https://your-domain.zeabur.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Sam Altman", "speaker": "sam_altman"}'

# 李飞飞 (中文)
curl -X POST https://your-domain.zeabur.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "你好，我是李飞飞", "speaker": "feifeili"}'

# 吴恩达 (中文)
curl -X POST https://your-domain.zeabur.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "大家好，我是吴恩达", "speaker": "wuenda"}'

# Paul Graham (英文)
curl -X POST https://your-domain.zeabur.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Paul Graham", "speaker": "paul_graham"}'
```

## 📊 监控和维护

### 1. Zeabur监控
- 查看部署日志
- 监控CPU和内存使用
- 设置告警通知

### 2. API使用监控
- 监控请求频率
- 跟踪错误率
- 监控PPIO API成本

### 3. Voice ID管理
- **重要**: Voice ID在7天内有效（到2025年8月1日）
- 需要在过期前重新生成Voice ID
- 更新环境变量中的Voice ID配置

## 🚨 故障排除

### 常见问题

1. **部署失败**
   - 检查package.json配置
   - 确认Node.js版本兼容性
   - 查看构建日志

2. **API调用失败**
   - 检查环境变量配置
   - 验证PPIO API Token
   - 确认Voice ID有效性

3. **CORS错误**
   - 检查ALLOWED_ORIGIN配置
   - 确认前端域名正确

4. **数据库连接失败**
   - 验证Supabase连接信息
   - 检查网络连接

### 紧急联系
- 项目负责人: [联系信息]
- Zeabur支持: support@zeabur.com
- PPIO API支持: [PPIO支持渠道]

## 📝 部署检查清单

### 部署前
- [ ] 本地测试通过
- [ ] 环境变量准备完成
- [ ] Voice ID确认有效
- [ ] PPIO API Token验证

### 部署中
- [ ] Zeabur项目创建
- [ ] GitHub仓库连接
- [ ] 环境变量配置
- [ ] 域名和SSL设置

### 部署后
- [ ] 健康检查通过
- [ ] TTS API测试成功
- [ ] 所有语音角色测试
- [ ] 前端集成测试
- [ ] 监控配置完成

---

**🎯 部署完成后，请更新前端代码中的API端点地址为Zeabur部署的域名**
