# 🎤 数据库TTS集成系统设计

## 📋 系统概述

基于您的Supabase数据库结构，设计一个自动化TTS系统，从`judge_comments`表获取评论文本，调用TTS API生成对应人物的语音。

### 🗄️ 数据库结构分析

```sql
-- judge_comments表结构
CREATE TABLE public.judge_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail text NOT NULL,
  github_repo_url text NOT NULL,
  comment_cn_ng text NULL,      -- 吴恩达中文评论
  comment_en_ng text NULL,      -- 吴恩达英文评论
  comment_cn_paul text NULL,    -- Paul Graham中文评论
  comment_en_paul text NULL,    -- Paul Graham英文评论
  comment_cn_li text NULL,      -- 李飞飞中文评论
  comment_en_li text NULL,      -- 李飞飞英文评论
  comment_cn_sam text NULL,     -- Sam Altman中文评论
  comment_en_sam text NULL,     -- Sam Altman英文评论
  created_at timestamp with time zone DEFAULT now()
);
```

### 🎯 字段与语音角色映射

| 数据库字段 | 语音角色 | 语言 | TTS Speaker |
|-----------|---------|------|-------------|
| `comment_en_ng` | 吴恩达 | 英文 | `wuenda` |
| `comment_en_paul` | Paul Graham | 英文 | `paul_graham` |
| `comment_en_li` | 李飞飞 | 英文 | `feifeili` |
| `comment_en_sam` | Sam Altman | 英文 | `sam_altman` |

---

## 🏗️ 系统架构设计

```mermaid
graph TB
    A[a42z前端] --> B[TTS代理API]
    B --> C[Supabase数据库]
    B --> D[PPIO TTS服务]
    C --> E[judge_comments表]
    D --> F[生成的音频文件]
    F --> A
    
    G[批量处理服务] --> C
    G --> D
    G --> H[音频缓存存储]
```

### 核心组件

1. **数据库查询服务** - 从Supabase获取评论文本
2. **TTS生成服务** - 调用PPIO API生成语音
3. **音频管理服务** - 缓存和管理生成的音频
4. **前端API接口** - 为a42z提供统一的语音接口

---

## 🔧 API接口设计

### 1. 获取单条评论的所有语音

**端点**: `GET /api/comments/{id}/audio`

**响应格式**:
```json
{
  "success": true,
  "commentId": "uuid",
  "audios": {
    "wuenda": {
      "text": "Andrew Ng's comment in English...",
      "audioUrl": "https://cdn.example.com/ng_audio.mp3",
      "speaker": "wuenda",
      "language": "en"
    },
    "paul_graham": {
      "text": "Paul Graham's comment...",
      "audioUrl": "https://cdn.example.com/paul_audio.mp3",
      "speaker": "paul_graham",
      "language": "en"
    },
    "feifeili": {
      "text": "Fei-Fei Li's comment...",
      "audioUrl": "https://cdn.example.com/li_audio.mp3",
      "speaker": "feifeili",
      "language": "en"
    },
    "sam_altman": {
      "text": "Sam Altman's comment...",
      "audioUrl": "https://cdn.example.com/sam_audio.mp3",
      "speaker": "sam_altman",
      "language": "en"
    }
  },
  "metadata": {
    "gmail": "user@example.com",
    "github_repo_url": "https://github.com/user/repo",
    "created_at": "2025-07-26T16:20:00.673Z"
  }
}
```

### 2. 获取特定人物的语音

**端点**: `GET /api/comments/{id}/audio/{speaker}`

**响应格式**:
```json
{
  "success": true,
  "commentId": "uuid",
  "speaker": "sam_altman",
  "text": "Sam Altman's comment in English...",
  "audioUrl": "https://cdn.example.com/sam_audio.mp3",
  "language": "en",
  "duration": 15.5,
  "fileSize": 245760
}
```

### 3. 批量生成语音

**端点**: `POST /api/comments/{id}/generate-all`

**响应格式**:
```json
{
  "success": true,
  "commentId": "uuid",
  "generated": ["wuenda", "paul_graham", "feifeili", "sam_altman"],
  "failed": [],
  "totalTime": 45.2,
  "message": "所有语音生成完成"
}
```

### 4. 获取评论列表

**端点**: `GET /api/comments?page=1&limit=10`

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "gmail": "user@example.com",
      "github_repo_url": "https://github.com/user/repo",
      "created_at": "2025-07-26T16:20:00.673Z",
      "hasAudio": {
        "wuenda": true,
        "paul_graham": false,
        "feifeili": true,
        "sam_altman": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

## 💻 实现代码

### 1. Supabase数据库服务

```javascript
// src/lib/database.js
const { createClient } = require('@supabase/supabase-js')

class DatabaseService {
  constructor() {
    this.supabase = createClient(
      'https://cslplhzfcfvzsivsgrpc.supabase.co',
      process.env.SUPABASE_ANON_KEY
    )
  }

  // 获取单条评论
  async getComment(id) {
    const { data, error } = await this.supabase
      .from('judge_comments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw new Error(`数据库查询失败: ${error.message}`)
    return data
  }

  // 获取评论列表
  async getComments(page = 1, limit = 10) {
    const offset = (page - 1) * limit

    const { data, error, count } = await this.supabase
      .from('judge_comments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(`数据库查询失败: ${error.message}`)

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    }
  }

  // 提取英文评论文本
  extractEnglishComments(comment) {
    return {
      wuenda: comment.comment_en_ng,
      paul_graham: comment.comment_en_paul,
      feifeili: comment.comment_en_li,
      sam_altman: comment.comment_en_sam
    }
  }
}

module.exports = new DatabaseService()
```

### 2. TTS批量生成服务

```javascript
// src/lib/batchTTS.js
const ppioClient = require('./ppio')
const databaseService = require('./database')

class BatchTTSService {
  constructor() {
    this.audioCache = new Map() // 简单内存缓存
  }

  // 为单条评论生成所有语音
  async generateAllAudios(commentId) {
    const comment = await databaseService.getComment(commentId)
    const englishComments = databaseService.extractEnglishComments(comment)
    
    const results = {}
    const generated = []
    const failed = []
    const startTime = Date.now()

    for (const [speaker, text] of Object.entries(englishComments)) {
      if (!text || text.trim() === '') {
        console.log(`跳过 ${speaker}: 无文本内容`)
        continue
      }

      try {
        console.log(`🎯 生成 ${speaker} 语音: ${text.substring(0, 50)}...`)
        
        const result = await ppioClient.generateSpeech(text, speaker)
        
        if (result.success && result.audioUrl) {
          results[speaker] = {
            text: text,
            audioUrl: result.audioUrl,
            speaker: speaker,
            language: 'en',
            voiceId: result.voiceId,
            timestamp: result.timestamp
          }
          generated.push(speaker)
          
          // 缓存结果
          this.audioCache.set(`${commentId}_${speaker}`, results[speaker])
          
        } else {
          throw new Error(result.error || '语音生成失败')
        }

        // 避免API限制，添加延迟
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`❌ ${speaker} 语音生成失败:`, error.message)
        failed.push({ speaker, error: error.message })
      }
    }

    const totalTime = (Date.now() - startTime) / 1000

    return {
      success: generated.length > 0,
      commentId,
      audios: results,
      generated,
      failed,
      totalTime,
      message: `成功生成 ${generated.length} 个语音，失败 ${failed.length} 个`
    }
  }

  // 获取缓存的音频
  getCachedAudio(commentId, speaker) {
    return this.audioCache.get(`${commentId}_${speaker}`)
  }

  // 检查是否有缓存
  hasCachedAudio(commentId, speaker) {
    return this.audioCache.has(`${commentId}_${speaker}`)
  }
}

module.exports = new BatchTTSService()
```

### 3. 评论音频路由

```javascript
// src/routes/comments.js
const express = require('express')
const router = express.Router()
const databaseService = require('../lib/database')
const batchTTSService = require('../lib/batchTTS')
const ppioClient = require('../lib/ppio')

// 获取评论列表
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    const result = await databaseService.getComments(page, limit)
    
    // 检查每条评论的音频缓存状态
    const dataWithAudioStatus = result.data.map(comment => {
      const hasAudio = {
        wuenda: batchTTSService.hasCachedAudio(comment.id, 'wuenda'),
        paul_graham: batchTTSService.hasCachedAudio(comment.id, 'paul_graham'),
        feifeili: batchTTSService.hasCachedAudio(comment.id, 'feifeili'),
        sam_altman: batchTTSService.hasCachedAudio(comment.id, 'sam_altman')
      }

      return {
        id: comment.id,
        gmail: comment.gmail,
        github_repo_url: comment.github_repo_url,
        created_at: comment.created_at,
        hasAudio
      }
    })

    res.json({
      success: true,
      data: dataWithAudioStatus,
      pagination: result.pagination
    })

  } catch (error) {
    console.error('获取评论列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 获取单条评论的所有语音
router.get('/:id/audio', async (req, res) => {
  try {
    const { id } = req.params
    const comment = await databaseService.getComment(id)
    const englishComments = databaseService.extractEnglishComments(comment)

    const audios = {}
    
    for (const [speaker, text] of Object.entries(englishComments)) {
      if (text && text.trim() !== '') {
        const cachedAudio = batchTTSService.getCachedAudio(id, speaker)
        if (cachedAudio) {
          audios[speaker] = cachedAudio
        }
      }
    }

    res.json({
      success: true,
      commentId: id,
      audios,
      metadata: {
        gmail: comment.gmail,
        github_repo_url: comment.github_repo_url,
        created_at: comment.created_at
      }
    })

  } catch (error) {
    console.error('获取评论音频失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 获取特定人物的语音
router.get('/:id/audio/:speaker', async (req, res) => {
  try {
    const { id, speaker } = req.params
    
    // 验证speaker参数
    const validSpeakers = ['wuenda', 'paul_graham', 'feifeili', 'sam_altman']
    if (!validSpeakers.includes(speaker)) {
      return res.status(400).json({
        success: false,
        error: `无效的语音角色: ${speaker}`
      })
    }

    const comment = await databaseService.getComment(id)
    const englishComments = databaseService.extractEnglishComments(comment)
    const text = englishComments[speaker]

    if (!text || text.trim() === '') {
      return res.status(404).json({
        success: false,
        error: `${speaker} 没有英文评论内容`
      })
    }

    // 检查缓存
    let audioData = batchTTSService.getCachedAudio(id, speaker)
    
    if (!audioData) {
      // 实时生成
      console.log(`🎯 实时生成 ${speaker} 语音`)
      const result = await ppioClient.generateSpeech(text, speaker)
      
      if (result.success && result.audioUrl) {
        audioData = {
          text: text,
          audioUrl: result.audioUrl,
          speaker: speaker,
          language: 'en',
          voiceId: result.voiceId,
          timestamp: result.timestamp
        }
        
        // 缓存结果
        batchTTSService.audioCache.set(`${id}_${speaker}`, audioData)
      } else {
        throw new Error(result.error || '语音生成失败')
      }
    }

    res.json({
      success: true,
      commentId: id,
      ...audioData
    })

  } catch (error) {
    console.error('获取特定语音失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 批量生成所有语音
router.post('/:id/generate-all', async (req, res) => {
  try {
    const { id } = req.params
    
    console.log(`🚀 开始为评论 ${id} 批量生成语音`)
    const result = await batchTTSService.generateAllAudios(id)
    
    res.json(result)

  } catch (error) {
    console.error('批量生成语音失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
```

### 4. 更新主应用

```javascript
// src/app.js (添加新路由)
const commentsRoutes = require('./routes/comments')

// 在现有路由后添加
app.use('/api/comments', commentsRoutes)
```

---

## 🚀 前端集成示例

### React组件示例

```jsx
import React, { useState, useEffect } from 'react'

function CommentAudioPlayer({ commentId }) {
  const [audios, setAudios] = useState({})
  const [loading, setLoading] = useState(false)
  const [currentPlaying, setCurrentPlaying] = useState(null)

  // 获取评论的所有语音
  useEffect(() => {
    fetchCommentAudios()
  }, [commentId])

  const fetchCommentAudios = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/comments/${commentId}/audio`)
      const data = await response.json()
      
      if (data.success) {
        setAudios(data.audios)
      }
    } catch (error) {
      console.error('获取语音失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 播放特定人物的语音
  const playAudio = async (speaker) => {
    try {
      if (currentPlaying) {
        currentPlaying.pause()
      }

      let audioData = audios[speaker]
      
      // 如果没有缓存，实时生成
      if (!audioData) {
        setLoading(true)
        const response = await fetch(`/api/comments/${commentId}/audio/${speaker}`)
        const data = await response.json()
        
        if (data.success) {
          audioData = data
          setAudios(prev => ({ ...prev, [speaker]: audioData }))
        } else {
          throw new Error(data.error)
        }
      }

      if (audioData && audioData.audioUrl) {
        const audio = new Audio(audioData.audioUrl)
        setCurrentPlaying(audio)
        await audio.play()
        
        audio.addEventListener('ended', () => {
          setCurrentPlaying(null)
        })
      }

    } catch (error) {
      console.error('播放失败:', error)
      alert('播放失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 批量生成所有语音
  const generateAllAudios = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/comments/${commentId}/generate-all`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setAudios(data.audios)
        alert(data.message)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('批量生成失败:', error)
      alert('批量生成失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const speakers = [
    { key: 'sam_altman', name: 'Sam Altman', icon: '🚀' },
    { key: 'feifeili', name: '李飞飞', icon: '🤖' },
    { key: 'wuenda', name: '吴恩达', icon: '🎓' },
    { key: 'paul_graham', name: 'Paul Graham', icon: '💡' }
  ]

  return (
    <div className="comment-audio-player">
      <div className="audio-controls">
        <button onClick={generateAllAudios} disabled={loading}>
          {loading ? '生成中...' : '🎵 生成所有语音'}
        </button>
      </div>
      
      <div className="speaker-grid">
        {speakers.map(speaker => (
          <div key={speaker.key} className="speaker-card">
            <h4>{speaker.icon} {speaker.name}</h4>
            {audios[speaker.key] && (
              <p className="text-preview">
                {audios[speaker.key].text.substring(0, 100)}...
              </p>
            )}
            <button 
              onClick={() => playAudio(speaker.key)}
              disabled={loading}
              className={audios[speaker.key] ? 'has-audio' : 'no-audio'}
            >
              {audios[speaker.key] ? '🔊 播放' : '🎤 生成并播放'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CommentAudioPlayer
```

---

## 🔧 环境变量配置

```env
# 添加到 .env.production
SUPABASE_URL=https://cslplhzfcfvzsivsgrpc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbHBsaHpmY2Z2enNpdnNncnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5OTMwMDUsImV4cCI6MjA2ODU2OTAwNX0.u_4i51DuA0Uwyv2Ocw6i953Tn7_WdcPp3GFlgtGGhXU
```

---

## 🎯 使用流程

1. **获取评论列表**: `GET /api/comments`
2. **选择评论**: 从列表中选择要生成语音的评论
3. **批量生成**: `POST /api/comments/{id}/generate-all`
4. **播放语音**: `GET /api/comments/{id}/audio/{speaker}`
5. **获取所有语音**: `GET /api/comments/{id}/audio`

这个系统将完美地将您的数据库评论转换为对应人物的语音，并提供给a42z前端使用！🚀
