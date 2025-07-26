# 🎤 a42z TTS语音系统

基于PPIO API的AI语音克隆和TTS系统，为a42z.ai提供高质量的语音播放功能。

## 📋 项目概述

本项目成功克隆了4位AI领域知名人物的声音，并构建了完整的TTS代理API服务，支持实时语音生成和播放。

## 🎤 已克隆的语音角色

| 角色 | Voice ID | 语言 | 音频文件 |
|------|----------|------|----------|
| **Sam Altman** | `voice_4bc8f72b-71ed-4089-a93e-ad3381fde6e5` | 英文 | `sam_altman_cloned_voice_20250725_175122.mp3` |
| **李飞飞** | `voice_c514c3d8-1d62-4e49-8526-d82fd857548b` | 中文 | `feifeili_cloned_voice_20250725_184142.mp3` |
| **吴恩达** | `voice_7fcc1d94-d0ec-4a39-91fe-508b0fb43af6` | 中文 | `wuenda_cloned_voice_20250725_184227.mp3` |
| **Paul Graham** | `voice_bb4693a9-4ece-4c68-961d-30016cfd10f9` | 英文 | `paul_graham_cloned_voice_final_20250725_190931.mp3` |

⚠️ **Voice ID有效期**: 7天内有效（到2025年8月1日）

## 🏗️ 项目结构

```
├── tts-proxy-api/              # TTS代理API服务
│   ├── src/                    # 源代码
│   ├── DEPLOYMENT.md           # 部署指南
│   ├── package.json            # 依赖配置
│   └── zeabur.json            # Zeabur部署配置
├── supabase/                   # Supabase数据库函数
├── sam/                        # Sam Altman原始音频
├── feifeili/                   # 李飞飞原始音频
├── wuenda/                     # 吴恩达原始音频
├── paul/                       # Paul Graham原始音频
├── voice_cloning_progress.md   # 项目进度文档
├── DEPLOYMENT_READY.md         # 部署就绪指南
└── README.md                   # 项目说明
```

## 🚀 快速开始

### 1. 本地开发

```bash
cd tts-proxy-api
npm install
npm run dev
```

### 2. 测试API

```bash
# 健康检查
curl http://localhost:3000/health

# TTS测试
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World", "speaker": "sam_altman"}'
```

### 3. 云端部署

详细部署指南请查看：
- `DEPLOYMENT_READY.md` - 快速部署指南
- `tts-proxy-api/DEPLOYMENT.md` - 详细部署文档

## 💻 前端集成

```javascript
// TTS服务类
class TTSService {
  constructor(apiUrl = 'https://your-domain.zeabur.app') {
    this.apiUrl = `${apiUrl}/api/tts`
  }

  async playText(text, speaker = 'sam_altman') {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker })
    })
    
    const result = await response.json()
    if (result.success && result.audioUrl) {
      const audio = new Audio(result.audioUrl)
      await audio.play()
      return audio
    } else {
      throw new Error(result.error || '语音生成失败')
    }
  }
}

// 使用示例
const tts = new TTSService()
await tts.playText('Hello World', 'sam_altman')
```

## 🔧 支持的语音角色

- `sam_altman` - Sam Altman (英文)
- `feifeili` - 李飞飞 (中文)
- `wuenda` - 吴恩达 (中文)
- `paul_graham` - Paul Graham (英文)

## 📚 文档

- [项目进度文档](voice_cloning_progress.md) - 详细的开发过程记录
- [部署就绪指南](DEPLOYMENT_READY.md) - 快速部署到云端
- [API部署文档](tts-proxy-api/DEPLOYMENT.md) - 详细的部署说明
- [前端集成示例](tts-proxy-api/frontend-integration-example.html) - 完整的前端集成代码

## 🔑 环境配置

主要环境变量：
```env
PPIO_API_TOKEN=sk_P7dvruEBeOoxYXN4lILmfwmB4DvpmSxSvzrPVGwU01c
VOICE_SAM_ALTMAN=voice_4bc8f72b-71ed-4089-a93e-ad3381fde6e5
VOICE_FEIFEILI=voice_c514c3d8-1d62-4e49-8526-d82fd857548b
VOICE_WUENDA=voice_7fcc1d94-d0ec-4a39-91fe-508b0fb43af6
VOICE_PAUL_GRAHAM=voice_bb4693a9-4ece-4c68-961d-30016cfd10f9
```

## 💰 成本预估

- **Zeabur部署**: $5/月
- **PPIO API调用**: $0.01-0.05/次
- **总成本**: $55-205/月（取决于使用量）

## 🚨 重要提醒

1. **Voice ID有效期**: 需在2025年8月1日前完成部署
2. **API密钥安全**: 确保PPIO API Token仅在服务端使用
3. **成本监控**: 监控API调用量，避免意外费用

## 📞 技术支持

- **GitHub Issues**: 提交问题和建议
- **文档**: 查看项目文档获取详细信息
- **示例**: 参考前端集成示例代码

---

**🎯 项目状态**: ✅ 完全就绪，可立即部署到云端！

**开发时间**: 2025年7月25日 - 2025年7月26日  
**最后更新**: 2025年7月26日
