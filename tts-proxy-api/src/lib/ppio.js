const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

/**
 * PPIO API调用封装类
 */
class PPIOClient {
  constructor() {
    this.apiUrl = process.env.PPIO_API_URL || 'https://api.ppinfra.com/v3/minimax-voice-cloning'
    this.apiToken = process.env.PPIO_API_TOKEN
    
    // Voice ID映射
    this.voiceMap = {
      'sam_altman': process.env.VOICE_SAM_ALTMAN,
      'feifeili': process.env.VOICE_FEIFEILI,
      'wuenda': process.env.VOICE_WUENDA,
      'paul_graham': process.env.VOICE_PAUL_GRAHAM
    }

    if (!this.apiToken) {
      console.warn('⚠️ PPIO_API_TOKEN环境变量未设置，将启用模拟模式')
      process.env.ENABLE_MOCK_MODE = 'true'
    }
  }

  /**
   * 获取Voice ID
   */
  getVoiceId(speaker) {
    const voiceId = this.voiceMap[speaker]
    if (!voiceId) {
      throw new Error(`不支持的语音角色: ${speaker}。支持的角色: ${Object.keys(this.voiceMap).join(', ')}`)
    }
    return voiceId
  }

  /**
   * 调用PPIO TTS API生成语音（带重试机制和模拟模式）
   */
  async generateSpeech(text, speaker, retryCount = 0) {
    const maxRetries = 3

    try {
      const voiceId = this.getVoiceId(speaker)

      console.log(`🎯 开始生成语音: ${speaker} (${voiceId}) - 尝试 ${retryCount + 1}/${maxRetries + 1}`)
      console.log(`📝 文本长度: ${text.length} 字符`)

      // 检查是否启用模拟模式或缺少API Token
      if (process.env.ENABLE_MOCK_MODE === 'true' || !this.apiToken) {
        console.log('🎭 模拟模式已启用，返回模拟音频URL')
        return this.generateMockResponse(text, speaker, voiceId)
      }

      const payload = {
        voice_id: voiceId, // 使用Voice ID
        text: text,
        model: "speech-02-hd",
        need_noise_reduction: true,
        need_volume_normalization: true
      }

      // 配置fetch选项，处理SSL问题
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'TTS-Proxy-API/1.0.0'
        },
        body: JSON.stringify(payload),
        timeout: 90000, // 90秒超时
        // 添加SSL配置
        agent: process.env.NODE_ENV === 'development' ?
          new (require('https').Agent)({ rejectUnauthorized: false }) : undefined
      }

      const response = await fetch(this.apiUrl, fetchOptions)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`PPIO API调用失败: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.demo_audio_url) {
        throw new Error('PPIO API返回数据中缺少音频URL')
      }

      console.log(`✅ 语音生成成功: ${result.demo_audio_url}`)
      
      return {
        success: true,
        audioUrl: result.demo_audio_url,
        voiceId: result.voice_id || voiceId,
        textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        speaker: speaker,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error(`❌ PPIO API调用失败 (尝试 ${retryCount + 1}):`, error.message)

      // 如果是网络错误且还有重试次数，则重试
      if (retryCount < maxRetries && this.isRetryableError(error)) {
        console.log(`🔄 ${2000 * (retryCount + 1)}ms后重试...`)
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)))
        return this.generateSpeech(text, speaker, retryCount + 1)
      }

      return {
        success: false,
        error: error.message,
        speaker: speaker,
        retryCount: retryCount,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * 生成模拟响应（用于开发和测试）
   */
  generateMockResponse(text, speaker, voiceId) {
    const mockAudioUrl = process.env.MOCK_AUDIO_URL || 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav'

    // 模拟API延迟
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          audioUrl: mockAudioUrl,
          voiceId: voiceId,
          textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          speaker: speaker,
          timestamp: new Date().toISOString(),
          mockMode: true,
          message: '🎭 模拟模式 - 使用示例音频文件'
        })
      }, 1000 + Math.random() * 2000) // 1-3秒随机延迟
    })
  }

  /**
   * 判断是否为可重试的错误
   */
  isRetryableError(error) {
    const retryableErrors = [
      'network timeout',
      'socket disconnected',
      'SSL_ERROR_SYSCALL',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND'
    ]

    return retryableErrors.some(errorType =>
      error.message.toLowerCase().includes(errorType.toLowerCase())
    )
  }

  /**
   * 文本预处理
   * 处理过长文本，确保在API限制范围内
   */
  preprocessText(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('文本内容不能为空')
    }

    // 清理文本
    let cleanText = text
      .trim()
      .replace(/\s+/g, ' ') // 合并多个空格
      .replace(/\n+/g, ' ') // 替换换行符

    // 检查文本长度（PPIO API建议不超过500字符）
    const maxLength = 500
    if (cleanText.length > maxLength) {
      console.log(`⚠️ 文本过长 (${cleanText.length}字符)，截取前${maxLength}字符`)
      cleanText = cleanText.substring(0, maxLength)
      
      // 尝试在句号处截断，避免截断句子
      const lastPeriod = cleanText.lastIndexOf('。')
      const lastDot = cleanText.lastIndexOf('.')
      const lastBreak = Math.max(lastPeriod, lastDot)
      
      if (lastBreak > maxLength * 0.8) { // 如果句号位置合理
        cleanText = cleanText.substring(0, lastBreak + 1)
      }
    }

    return cleanText
  }

  /**
   * 获取支持的语音角色列表
   */
  getSupportedSpeakers() {
    return Object.keys(this.voiceMap).map(speaker => ({
      name: speaker,
      voiceId: this.voiceMap[speaker],
      displayName: this.getDisplayName(speaker)
    }))
  }

  /**
   * 获取语音角色的显示名称
   */
  getDisplayName(speaker) {
    const displayNames = {
      'sam_altman': 'Sam Altman',
      'feifeili': '李飞飞',
      'wuenda': '吴恩达',
      'paul_graham': 'Paul Graham'
    }
    return displayNames[speaker] || speaker
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 简单的API连通性测试
      const response = await fetch(this.apiUrl, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        timeout: 5000
      })

      return {
        status: 'healthy',
        apiUrl: this.apiUrl,
        supportedSpeakers: Object.keys(this.voiceMap),
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// 创建单例实例
const ppioClient = new PPIOClient()

module.exports = ppioClient
