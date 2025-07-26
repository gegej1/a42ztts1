const express = require('express')
const router = express.Router()
const commentService = require('../lib/commentService')
const batchTTSService = require('../lib/batchTTS')

/**
 * 获取评论列表
 * GET /api/comments?page=1&limit=10&search=query
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 10, 50) // 最大50条
    const search = req.query.search

    let result
    if (search && search.trim()) {
      result = await commentService.searchComments(search.trim(), page, limit)
    } else {
      result = await commentService.getComments(page, limit)
    }
    
    // 检查每条评论的音频缓存状态
    const dataWithAudioStatus = result.data.map(comment => {
      const hasAudio = {
        sam_altman: batchTTSService.hasCachedAudio(comment.id, 'sam_altman', 'en'),
        feifeili: batchTTSService.hasCachedAudio(comment.id, 'feifeili', 'en'),
        wuenda: batchTTSService.hasCachedAudio(comment.id, 'wuenda', 'en'),
        paul_graham: batchTTSService.hasCachedAudio(comment.id, 'paul_graham', 'en')
      }

      // 获取评论文本预览
      const englishComments = commentService.extractEnglishComments(comment)
      const textPreviews = {}
      for (const [speaker, text] of Object.entries(englishComments)) {
        textPreviews[speaker] = text ? {
          hasText: true,
          preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          length: text.length
        } : {
          hasText: false,
          preview: null,
          length: 0
        }
      }

      return {
        id: comment.id,
        gmail: comment.gmail,
        github_repo_url: comment.github_repo_url,
        created_at: comment.created_at,
        hasAudio,
        textPreviews
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

/**
 * 获取单条评论详情
 * GET /api/comments/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!commentService.isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的评论ID格式'
      })
    }

    const comment = await commentService.getComment(id)
    const stats = await commentService.getCommentStats(id)

    res.json({
      success: true,
      data: comment,
      stats
    })

  } catch (error) {
    console.error('获取评论详情失败:', error)
    if (error.message.includes('No rows')) {
      res.status(404).json({
        success: false,
        error: '评论不存在'
      })
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
})

/**
 * 获取单条评论的所有英文语音
 * GET /api/comments/:id/audio
 */
router.get('/:id/audio', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!commentService.isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的评论ID格式'
      })
    }

    const comment = await commentService.getComment(id)
    const englishComments = commentService.extractEnglishComments(comment)

    const audios = {}
    const available = []
    const missing = []
    
    for (const [speaker, text] of Object.entries(englishComments)) {
      if (text && text.trim() !== '') {
        const cachedAudio = batchTTSService.getCachedAudio(id, speaker, 'en')
        if (cachedAudio) {
          audios[speaker] = cachedAudio
          available.push(speaker)
        } else {
          missing.push(speaker)
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
      },
      statistics: {
        available: available.length,
        missing: missing.length,
        availableSpeakers: available,
        missingSpeakers: missing
      }
    })

  } catch (error) {
    console.error('获取评论音频失败:', error)
    if (error.message.includes('No rows')) {
      res.status(404).json({
        success: false,
        error: '评论不存在'
      })
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
})

/**
 * 获取特定人物的语音
 * GET /api/comments/:id/audio/:speaker
 */
router.get('/:id/audio/:speaker', async (req, res) => {
  try {
    const { id, speaker } = req.params
    const language = req.query.lang || 'en' // 默认英文
    
    if (!commentService.isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的评论ID格式'
      })
    }

    // 验证speaker参数
    const validSpeakers = ['wuenda', 'paul_graham', 'feifeili', 'sam_altman']
    if (!validSpeakers.includes(speaker)) {
      return res.status(400).json({
        success: false,
        error: `无效的语音角色: ${speaker}。支持的角色: ${validSpeakers.join(', ')}`
      })
    }

    // 验证language参数
    if (!['en', 'cn'].includes(language)) {
      return res.status(400).json({
        success: false,
        error: '无效的语言参数，支持: en, cn'
      })
    }

    const comment = await commentService.getComment(id)
    const comments = language === 'en' 
      ? commentService.extractEnglishComments(comment)
      : commentService.extractChineseComments(comment)
    
    const text = comments[speaker]

    if (!text || text.trim() === '') {
      return res.status(404).json({
        success: false,
        error: `${speaker} 没有${language === 'en' ? '英文' : '中文'}评论内容`
      })
    }

    // 检查缓存
    let audioData = batchTTSService.getCachedAudio(id, speaker, language)
    
    if (!audioData) {
      // 实时生成
      console.log(`🎯 实时生成 ${speaker} ${language} 语音`)
      audioData = await batchTTSService.generateSingleAudio(id, speaker, language)
    }

    res.json({
      success: true,
      commentId: id,
      ...audioData
    })

  } catch (error) {
    console.error('获取特定语音失败:', error)
    if (error.message.includes('No rows')) {
      res.status(404).json({
        success: false,
        error: '评论不存在'
      })
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
})

/**
 * 批量生成所有英文语音
 * POST /api/comments/:id/generate-all
 */
router.post('/:id/generate-all', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!commentService.isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的评论ID格式'
      })
    }
    
    console.log(`🚀 开始为评论 ${id} 批量生成英文语音`)
    const result = await batchTTSService.generateAllEnglishAudios(id)
    
    res.json(result)

  } catch (error) {
    console.error('批量生成语音失败:', error)
    if (error.message.includes('No rows')) {
      res.status(404).json({
        success: false,
        error: '评论不存在'
      })
    } else if (error.message.includes('正在生成语音中')) {
      res.status(409).json({
        success: false,
        error: error.message
      })
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
})

/**
 * 清除评论缓存
 * DELETE /api/comments/:id/cache
 */
router.delete('/:id/cache', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!commentService.isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的评论ID格式'
      })
    }

    const cleared = batchTTSService.clearCommentCache(id)
    
    res.json({
      success: true,
      commentId: id,
      clearedCount: cleared,
      message: `已清除 ${cleared} 个缓存音频`
    })

  } catch (error) {
    console.error('清除缓存失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * 获取缓存统计信息
 * GET /api/comments/cache/stats
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = batchTTSService.getCacheStats()
    
    res.json({
      success: true,
      cache: stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('获取缓存统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * 预热缓存
 * POST /api/comments/cache/warmup
 */
router.post('/cache/warmup', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.body.limit) || 5, 10) // 最多10条
    
    console.log(`🔥 开始预热缓存，处理最新 ${limit} 条评论`)
    const results = await batchTTSService.warmupCache(limit)
    
    res.json({
      success: true,
      results,
      message: `缓存预热完成，处理了 ${results.length} 条评论`
    })

  } catch (error) {
    console.error('缓存预热失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
