# 🎤 a42z前端TTS API集成指南

## 📋 API概述

您的TTS服务已成功部署，现在可以通过简单的HTTP请求调用语音生成功能。

### 🔗 API基础信息

- **API域名**: `https://your-zeabur-domain.zeabur.app`
- **协议**: HTTPS
- **请求方式**: POST
- **响应格式**: JSON

---

## 🎯 核心API端点

### 1. 健康检查

**端点**: `GET /health`

**用途**: 检查服务状态

**请求示例**:
```javascript
const response = await fetch('https://your-domain.zeabur.app/health')
const data = await response.json()
console.log(data)
```

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2025-07-26T16:20:00.673Z",
  "uptime": 26.328636333,
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. TTS语音生成

**端点**: `POST /api/tts`

**用途**: 将文本转换为语音

**请求头**:
```
Content-Type: application/json
```

**请求参数**:
```typescript
interface TTSRequest {
  text: string          // 要转换的文本（必需）
  speaker: string       // 语音角色（必需）
}
```

**支持的语音角色**:
- `sam_altman` - Sam Altman (英文)
- `feifeili` - 李飞飞 (中文)
- `wuenda` - 吴恩达 (中文)
- `paul_graham` - Paul Graham (英文)

**响应格式**:
```typescript
interface TTSResponse {
  success: boolean
  audioUrl?: string     // 音频播放URL
  textPreview?: string  // 文字预览（前50字符）
  speaker?: string      // 使用的语音角色
  voiceId?: string      // Voice ID
  timestamp?: string    // 生成时间戳
  error?: string        // 错误信息（失败时）
}
```

---

## 💻 前端集成代码

### 1. 基础TTS服务类

```javascript
class TTSService {
  constructor(apiUrl = 'https://your-domain.zeabur.app') {
    this.apiUrl = `${apiUrl}/api/tts`
    this.healthUrl = `${apiUrl}/health`
    this.currentAudio = null
  }

  /**
   * 检查服务状态
   */
  async checkHealth() {
    try {
      const response = await fetch(this.healthUrl)
      return await response.json()
    } catch (error) {
      console.error('健康检查失败:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * 生成语音
   */
  async generateSpeech(text, speaker = 'sam_altman') {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, speaker })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('语音生成失败:', error)
      throw error
    }
  }

  /**
   * 播放文本
   */
  async playText(text, speaker = 'sam_altman') {
    try {
      const result = await this.generateSpeech(text, speaker)
      
      if (result.success && result.audioUrl) {
        // 停止当前播放的音频
        this.stopAudio()
        
        // 创建新的音频对象
        this.currentAudio = new Audio(result.audioUrl)
        
        // 添加事件监听
        this.currentAudio.addEventListener('ended', () => {
          this.currentAudio = null
        })
        
        this.currentAudio.addEventListener('error', (e) => {
          console.error('音频播放失败:', e)
          this.currentAudio = null
        })
        
        // 播放音频
        await this.currentAudio.play()
        
        return {
          audio: this.currentAudio,
          result: result
        }
      } else {
        throw new Error(result.error || '语音生成失败')
      }
    } catch (error) {
      console.error('TTS播放失败:', error)
      throw error
    }
  }

  /**
   * 停止当前播放
   */
  stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
  }

  /**
   * 暂停播放
   */
  pauseAudio() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause()
    }
  }

  /**
   * 恢复播放
   */
  resumeAudio() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play()
    }
  }

  /**
   * 获取播放状态
   */
  getPlaybackState() {
    if (!this.currentAudio) {
      return 'stopped'
    }
    return this.currentAudio.paused ? 'paused' : 'playing'
  }
}
```

### 2. React Hook集成

```javascript
import { useState, useCallback, useRef } from 'react'

export const useTTS = (apiUrl = 'https://your-domain.zeabur.app') => {
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)
  const ttsService = useRef(new TTSService(apiUrl))

  const playText = useCallback(async (text, speaker = 'sam_altman') => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { audio, result } = await ttsService.current.playText(text, speaker)
      
      setIsPlaying(true)
      
      // 监听播放结束
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
      })
      
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const stopAudio = useCallback(() => {
    ttsService.current.stopAudio()
    setIsPlaying(false)
  }, [])

  const pauseAudio = useCallback(() => {
    ttsService.current.pauseAudio()
    setIsPlaying(false)
  }, [])

  const resumeAudio = useCallback(() => {
    ttsService.current.resumeAudio()
    setIsPlaying(true)
  }, [])

  return {
    playText,
    stopAudio,
    pauseAudio,
    resumeAudio,
    isLoading,
    isPlaying,
    error
  }
}
```

### 3. Vue.js Composable

```javascript
import { ref, reactive } from 'vue'

export function useTTS(apiUrl = 'https://your-domain.zeabur.app') {
  const isLoading = ref(false)
  const isPlaying = ref(false)
  const error = ref(null)
  const ttsService = new TTSService(apiUrl)

  const playText = async (text, speaker = 'sam_altman') => {
    isLoading.value = true
    error.value = null
    
    try {
      const { audio, result } = await ttsService.playText(text, speaker)
      
      isPlaying.value = true
      
      audio.addEventListener('ended', () => {
        isPlaying.value = false
      })
      
      return result
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const stopAudio = () => {
    ttsService.stopAudio()
    isPlaying.value = false
  }

  const pauseAudio = () => {
    ttsService.pauseAudio()
    isPlaying.value = false
  }

  const resumeAudio = () => {
    ttsService.resumeAudio()
    isPlaying.value = true
  }

  return {
    playText,
    stopAudio,
    pauseAudio,
    resumeAudio,
    isLoading,
    isPlaying,
    error
  }
}
```

---

## 🎮 使用示例

### 1. 基础使用

```javascript
// 初始化TTS服务
const tts = new TTSService('https://your-domain.zeabur.app')

// 播放英文文本
await tts.playText('Hello, this is Sam Altman speaking.', 'sam_altman')

// 播放中文文本
await tts.playText('大家好，我是李飞飞。', 'feifeili')
```

### 2. React组件示例

```jsx
import React, { useState } from 'react'
import { useTTS } from './hooks/useTTS'

function TTSPlayer() {
  const [text, setText] = useState('')
  const [speaker, setSpeaker] = useState('sam_altman')
  const { playText, stopAudio, isLoading, isPlaying, error } = useTTS()

  const handlePlay = async () => {
    if (!text.trim()) return
    
    try {
      await playText(text, speaker)
    } catch (err) {
      console.error('播放失败:', err)
    }
  }

  return (
    <div className="tts-player">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="输入要转换为语音的文本..."
        rows={4}
        cols={50}
      />
      
      <select value={speaker} onChange={(e) => setSpeaker(e.target.value)}>
        <option value="sam_altman">Sam Altman (英文)</option>
        <option value="feifeili">李飞飞 (中文)</option>
        <option value="wuenda">吴恩达 (中文)</option>
        <option value="paul_graham">Paul Graham (英文)</option>
      </select>
      
      <div className="controls">
        <button onClick={handlePlay} disabled={isLoading || !text.trim()}>
          {isLoading ? '生成中...' : '播放'}
        </button>
        <button onClick={stopAudio} disabled={!isPlaying}>
          停止
        </button>
      </div>
      
      {error && <div className="error">错误: {error}</div>}
      {isPlaying && <div className="status">正在播放...</div>}
    </div>
  )
}
```

### 3. Vue组件示例

```vue
<template>
  <div class="tts-player">
    <textarea
      v-model="text"
      placeholder="输入要转换为语音的文本..."
      rows="4"
      cols="50"
    />
    
    <select v-model="speaker">
      <option value="sam_altman">Sam Altman (英文)</option>
      <option value="feifeili">李飞飞 (中文)</option>
      <option value="wuenda">吴恩达 (中文)</option>
      <option value="paul_graham">Paul Graham (英文)</option>
    </select>
    
    <div class="controls">
      <button @click="handlePlay" :disabled="isLoading || !text.trim()">
        {{ isLoading ? '生成中...' : '播放' }}
      </button>
      <button @click="stopAudio" :disabled="!isPlaying">
        停止
      </button>
    </div>
    
    <div v-if="error" class="error">错误: {{ error }}</div>
    <div v-if="isPlaying" class="status">正在播放...</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useTTS } from './composables/useTTS'

const text = ref('')
const speaker = ref('sam_altman')
const { playText, stopAudio, isLoading, isPlaying, error } = useTTS()

const handlePlay = async () => {
  if (!text.value.trim()) return
  
  try {
    await playText(text.value, speaker.value)
  } catch (err) {
    console.error('播放失败:', err)
  }
}
</script>
```

---

## 🔧 高级功能

### 1. 批量文本处理

```javascript
class AdvancedTTSService extends TTSService {
  /**
   * 分段播放长文本
   */
  async playLongText(text, speaker = 'sam_altman', maxLength = 500) {
    const segments = this.splitText(text, maxLength)
    
    for (let i = 0; i < segments.length; i++) {
      console.log(`播放第 ${i + 1}/${segments.length} 段`)
      await this.playText(segments[i], speaker)
      
      // 等待当前段播放完成
      await this.waitForPlaybackEnd()
      
      // 段间暂停
      if (i < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  /**
   * 分割文本
   */
  splitText(text, maxLength) {
    const sentences = text.split(/[.!?。！？]/)
    const segments = []
    let currentSegment = ''

    for (const sentence of sentences) {
      if (currentSegment.length + sentence.length <= maxLength) {
        currentSegment += sentence + '.'
      } else {
        if (currentSegment) segments.push(currentSegment.trim())
        currentSegment = sentence + '.'
      }
    }
    
    if (currentSegment) segments.push(currentSegment.trim())
    return segments
  }

  /**
   * 等待播放结束
   */
  waitForPlaybackEnd() {
    return new Promise((resolve) => {
      if (!this.currentAudio) {
        resolve()
        return
      }

      const checkEnd = () => {
        if (!this.currentAudio || this.currentAudio.ended) {
          resolve()
        } else {
          setTimeout(checkEnd, 100)
        }
      }
      
      checkEnd()
    })
  }
}
```

### 2. 错误处理和重试

```javascript
class RobustTTSService extends TTSService {
  async generateSpeechWithRetry(text, speaker, maxRetries = 3) {
    let lastError
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.generateSpeech(text, speaker)
      } catch (error) {
        lastError = error
        console.warn(`第 ${i + 1} 次尝试失败:`, error.message)
        
        if (i < maxRetries - 1) {
          // 指数退避
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, i) * 1000)
          )
        }
      }
    }
    
    throw lastError
  }
}
```

---

## 🚨 注意事项

### 1. 错误处理

```javascript
try {
  await tts.playText(text, speaker)
} catch (error) {
  if (error.message.includes('HTTP 429')) {
    // 请求频率限制
    console.log('请求过于频繁，请稍后再试')
  } else if (error.message.includes('HTTP 500')) {
    // 服务器错误
    console.log('服务器暂时不可用')
  } else {
    // 其他错误
    console.log('语音生成失败:', error.message)
  }
}
```

### 2. 性能优化

- **文本长度限制**: 建议单次请求文本不超过500字符
- **请求频率**: 避免过于频繁的API调用
- **音频缓存**: 考虑缓存常用文本的音频结果
- **错误重试**: 实现合理的重试机制

### 3. 用户体验

- **加载状态**: 显示语音生成进度
- **播放控制**: 提供播放/暂停/停止功能
- **错误提示**: 友好的错误信息展示
- **语音角色选择**: 根据内容语言自动选择合适的语音角色

---

## 📞 技术支持

- **GitHub仓库**: https://github.com/gegej1/a42ztts1
- **API文档**: 本文档
- **示例代码**: 仓库中的 `frontend-integration-example.html`

现在您可以轻松地在a42z前端中集成TTS功能了！🚀
