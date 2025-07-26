const ppioClient = require('./ppio')
const commentService = require('./commentService')

/**
 * 批量TTS生成服务
 * 处理评论的批量语音生成和缓存
 */
class BatchTTSService {
  constructor() {
    // 简单内存缓存 - 生产环境建议使用Redis
    this.audioCache = new Map()
    this.generationQueue = new Map() // 防止重复生成
  }

  /**
   * 为单条评论生成所有英文语音
   */
  async generateAllEnglishAudios(commentId) {
    try {
      console.log(`🚀 开始为评论 ${commentId} 生成所有英文语音`)
      
      const comment = await commentService.getComment(commentId)
      const englishComments = commentService.extractEnglishComments(comment)
      
      const results = {}
      const generated = []
      const failed = []
      const skipped = []
      const startTime = Date.now()

      // 检查是否已在生成队列中
      if (this.generationQueue.has(commentId)) {
        throw new Error('该评论正在生成语音中，请稍后再试')
      }

      this.generationQueue.set(commentId, true)

      try {
        for (const [speaker, text] of Object.entries(englishComments)) {
          if (!text || text.trim() === '') {
            console.log(`⏭️ 跳过 ${speaker}: 无英文评论内容`)
            skipped.push(speaker)
            continue
          }

          // 检查缓存
          const cacheKey = `${commentId}_${speaker}_en`
          if (this.audioCache.has(cacheKey)) {
            console.log(`📦 使用缓存 ${speaker} 语音`)
            results[speaker] = this.audioCache.get(cacheKey)
            generated.push(speaker)
            continue
          }

          try {
            console.log(`🎯 生成 ${speaker} 英文语音: ${text.substring(0, 50)}...`)
            
            const result = await ppioClient.generateSpeech(text, speaker)
            
            if (result.success && result.audioUrl) {
              const audioData = {
                text: text,
                audioUrl: result.audioUrl,
                speaker: speaker,
                language: 'en',
                voiceId: result.voiceId,
                timestamp: result.timestamp,
                commentId: commentId,
                textLength: text.length
              }

              results[speaker] = audioData
              generated.push(speaker)
              
              // 缓存结果
              this.audioCache.set(cacheKey, audioData)
              console.log(`✅ ${speaker} 英文语音生成成功`)
              
            } else {
              throw new Error(result.error || '语音生成失败')
            }

            // 避免API限制，添加延迟
            if (Object.keys(englishComments).indexOf(speaker) < Object.keys(englishComments).length - 1) {
              console.log('⏳ 等待2秒避免API限制...')
              await new Promise(resolve => setTimeout(resolve, 2000))
            }

          } catch (error) {
            console.error(`❌ ${speaker} 英文语音生成失败:`, error.message)
            failed.push({ speaker, error: error.message, language: 'en' })
          }
        }
      } finally {
        this.generationQueue.delete(commentId)
      }

      const totalTime = (Date.now() - startTime) / 1000

      const response = {
        success: generated.length > 0,
        commentId,
        audios: results,
        generated,
        failed,
        skipped,
        totalTime,
        statistics: {
          total: Object.keys(englishComments).length,
          generated: generated.length,
          failed: failed.length,
          skipped: skipped.length
        },
        message: `英文语音生成完成: 成功 ${generated.length} 个，失败 ${failed.length} 个，跳过 ${skipped.length} 个`
      }

      console.log(`🎉 评论 ${commentId} 英文语音生成完成:`, response.message)
      return response

    } catch (error) {
      this.generationQueue.delete(commentId)
      console.error('批量生成英文语音失败:', error)
      throw error
    }
  }

  /**
   * 生成单个语音
   */
  async generateSingleAudio(commentId, speaker, language = 'en') {
    try {
      const cacheKey = `${commentId}_${speaker}_${language}`
      
      // 检查缓存
      if (this.audioCache.has(cacheKey)) {
        console.log(`📦 使用缓存 ${speaker} ${language} 语音`)
        return this.audioCache.get(cacheKey)
      }

      const comment = await commentService.getComment(commentId)
      const comments = language === 'en' 
        ? commentService.extractEnglishComments(comment)
        : commentService.extractChineseComments(comment)
      
      const text = comments[speaker]
      
      if (!text || text.trim() === '') {
        throw new Error(`${speaker} 没有${language === 'en' ? '英文' : '中文'}评论内容`)
      }

      console.log(`🎯 实时生成 ${speaker} ${language} 语音`)
      const result = await ppioClient.generateSpeech(text, speaker)
      
      if (result.success && result.audioUrl) {
        const audioData = {
          text: text,
          audioUrl: result.audioUrl,
          speaker: speaker,
          language: language,
          voiceId: result.voiceId,
          timestamp: result.timestamp,
          commentId: commentId,
          textLength: text.length
        }
        
        // 缓存结果
        this.audioCache.set(cacheKey, audioData)
        console.log(`✅ ${speaker} ${language} 语音生成成功`)
        
        return audioData
      } else {
        throw new Error(result.error || '语音生成失败')
      }

    } catch (error) {
      console.error(`生成单个语音失败 (${speaker}, ${language}):`, error)
      throw error
    }
  }

  /**
   * 获取缓存的音频
   */
  getCachedAudio(commentId, speaker, language = 'en') {
    const cacheKey = `${commentId}_${speaker}_${language}`
    return this.audioCache.get(cacheKey)
  }

  /**
   * 检查是否有缓存
   */
  hasCachedAudio(commentId, speaker, language = 'en') {
    const cacheKey = `${commentId}_${speaker}_${language}`
    return this.audioCache.has(cacheKey)
  }

  /**
   * 获取评论的所有缓存音频
   */
  getAllCachedAudios(commentId, language = 'en') {
    const speakers = ['sam_altman', 'feifeili', 'wuenda', 'paul_graham']
    const audios = {}
    
    for (const speaker of speakers) {
      const cached = this.getCachedAudio(commentId, speaker, language)
      if (cached) {
        audios[speaker] = cached
      }
    }
    
    return audios
  }

  /**
   * 清除特定评论的缓存
   */
  clearCommentCache(commentId) {
    const speakers = ['sam_altman', 'feifeili', 'wuenda', 'paul_graham']
    const languages = ['en', 'cn']
    let cleared = 0
    
    for (const speaker of speakers) {
      for (const language of languages) {
        const cacheKey = `${commentId}_${speaker}_${language}`
        if (this.audioCache.delete(cacheKey)) {
          cleared++
        }
      }
    }
    
    console.log(`🗑️ 清除评论 ${commentId} 的 ${cleared} 个缓存音频`)
    return cleared
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const stats = {
      totalCached: this.audioCache.size,
      activeGenerations: this.generationQueue.size,
      cacheKeys: Array.from(this.audioCache.keys()),
      memoryUsage: process.memoryUsage()
    }
    
    return stats
  }

  /**
   * 清除所有缓存
   */
  clearAllCache() {
    const size = this.audioCache.size
    this.audioCache.clear()
    console.log(`🗑️ 清除所有缓存，共 ${size} 个音频`)
    return size
  }

  /**
   * 预热缓存 - 为最新的评论生成语音
   */
  async warmupCache(limit = 5) {
    try {
      console.log(`🔥 开始预热缓存，处理最新 ${limit} 条评论`)
      
      const { data: comments } = await commentService.getComments(1, limit)
      const results = []
      
      for (const comment of comments) {
        try {
          const result = await this.generateAllEnglishAudios(comment.id)
          results.push({
            commentId: comment.id,
            success: result.success,
            generated: result.generated.length
          })
          
          // 避免过于频繁的请求
          await new Promise(resolve => setTimeout(resolve, 5000))
          
        } catch (error) {
          console.error(`预热评论 ${comment.id} 失败:`, error.message)
          results.push({
            commentId: comment.id,
            success: false,
            error: error.message
          })
        }
      }
      
      console.log('🎉 缓存预热完成')
      return results
      
    } catch (error) {
      console.error('缓存预热失败:', error)
      throw error
    }
  }
}

// 创建单例实例
const batchTTSService = new BatchTTSService()

module.exports = batchTTSService
