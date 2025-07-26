const express = require('express')
const database = require('../lib/db')
const ppioClient = require('../lib/ppio')

const router = express.Router()

/**
 * POST /api/tts
 * TTS语音生成API端点
 */
router.post('/', async (req, res) => {
  try {
    const { textId, text, speaker } = req.body

    // 参数验证
    if (!speaker) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: speaker',
        supportedSpeakers: ppioClient.getSupportedSpeakers()
      })
    }

    if (!textId && !text) {
      return res.status(400).json({
        success: false,
        error: '必须提供 textId 或 text 参数之一'
      })
    }

    if (textId && text) {
      return res.status(400).json({
        success: false,
        error: 'textId 和 text 参数不能同时提供，请选择其中一个'
      })
    }

    let finalText = text

    // 如果提供了textId，从数据库获取文字内容
    if (textId) {
      try {
        // 确保数据库已连接
        if (!database.isConnected) {
          await database.connect()
        }

        // 检查textId是否为评委名称
        const judgeNames = ['sam_altman', 'feifei_li', 'paul_graham', 'andrew_ng']
        if (judgeNames.includes(textId.toString().toLowerCase())) {
          // 获取评委输出
          const judgeOutput = await database.getJudgeOutput(textId.toString())
          if (!judgeOutput || !judgeOutput.data || judgeOutput.data.length === 0) {
            return res.status(404).json({
              success: false,
              error: `未找到评委 ${textId} 的输出内容`
            })
          }

          // 使用第一条输出内容
          finalText = judgeOutput.data[0].content
          console.log(`👨‍⚖️ 获取评委输出: ${textId}, 表=${judgeOutput.table}`)
        } else {
          // 按ID获取普通文字内容
          const textRecord = await database.getTextById(textId)
          if (!textRecord) {
            return res.status(404).json({
              success: false,
              error: `未找到ID为 ${textId} 的文字内容`
            })
          }

          finalText = textRecord.content
          console.log(`📖 从数据库获取文字: ID=${textId}, 标题="${textRecord.title}"`)
        }
      } catch (dbError) {
        console.error('数据库查询失败:', dbError.message)
        return res.status(500).json({
          success: false,
          error: '数据库查询失败，请稍后重试'
        })
      }
    }

    // 文本预处理
    try {
      finalText = ppioClient.preprocessText(finalText)
    } catch (textError) {
      return res.status(400).json({
        success: false,
        error: textError.message
      })
    }

    // 调用PPIO API生成语音
    const result = await ppioClient.generateSpeech(finalText, speaker)

    if (result.success) {
      res.json({
        success: true,
        audioUrl: result.audioUrl,
        textPreview: result.textPreview,
        speaker: result.speaker,
        voiceId: result.voiceId,
        timestamp: result.timestamp
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        speaker: result.speaker,
        timestamp: result.timestamp
      })
    }

  } catch (error) {
    console.error('TTS API处理失败:', error.message)
    res.status(500).json({
      success: false,
      error: '服务器内部错误，请稍后重试',
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * GET /api/tts/speakers
 * 获取支持的语音角色列表
 */
router.get('/speakers', (req, res) => {
  try {
    const speakers = ppioClient.getSupportedSpeakers()
    res.json({
      success: true,
      speakers: speakers,
      total: speakers.length
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/tts/health
 * TTS服务健康检查
 */
router.get('/health', async (req, res) => {
  try {
    const ppioHealth = await ppioClient.healthCheck()
    const dbHealth = await database.healthCheck()

    const overallStatus = ppioHealth.status === 'healthy' && dbHealth.status === 'healthy' 
      ? 'healthy' : 'unhealthy'

    res.json({
      status: overallStatus,
      services: {
        ppio: ppioHealth,
        database: dbHealth
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * GET /api/tts/explore
 * 探索Supabase数据库表结构
 */
router.get('/explore', async (req, res) => {
  try {
    // 确保数据库已连接
    if (!database.isConnected) {
      await database.connect()
    }

    const tables = await database.exploreTables()

    res.json({
      success: true,
      message: '数据库表结构探索完成',
      tables: tables,
      total: tables.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * GET /api/tts/judges
 * 获取所有评委的输出信息
 */
router.get('/judges', async (req, res) => {
  try {
    // 确保数据库已连接
    if (!database.isConnected) {
      await database.connect()
    }

    const judges = ['sam_altman', 'feifei_li', 'paul_graham', 'andrew_ng']
    const results = []

    for (const judge of judges) {
      try {
        const output = await database.getJudgeOutput(judge)
        results.push({
          judge,
          found: !!output,
          data: output
        })
      } catch (error) {
        results.push({
          judge,
          found: false,
          error: error.message
        })
      }
    }

    const foundCount = results.filter(r => r.found).length

    res.json({
      success: foundCount > 0,
      message: `找到 ${foundCount}/${judges.length} 位评委的输出信息`,
      judges: results,
      summary: {
        total: judges.length,
        found: foundCount,
        missing: judges.length - foundCount
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * GET /api/tts/judge/:name
 * 获取特定评委的输出信息
 */
router.get('/judge/:name', async (req, res) => {
  try {
    const judgeName = req.params.name

    // 确保数据库已连接
    if (!database.isConnected) {
      await database.connect()
    }

    const output = await database.getJudgeOutput(judgeName)

    if (!output) {
      return res.status(404).json({
        success: false,
        error: `未找到评委 ${judgeName} 的输出信息`,
        judge: judgeName
      })
    }

    res.json({
      success: true,
      judge: judgeName,
      table: output.table,
      data: output.data,
      count: output.data.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      judge: req.params.name,
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * 创建简化的语音生成函数
 */
async function generateSpeechSimple(text, speaker, res) {
  try {
    // 参数验证
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: text',
        speaker: speaker
      })
    }

    // 文本预处理
    const processedText = ppioClient.preprocessText(text)
    
    console.log(`🎯 ${speaker} 语音生成开始，文本长度: ${processedText.length}`)

    // 直接调用PPIO API生成语音，无数据库查询
    const result = await ppioClient.generateSpeech(processedText, speaker)

    if (result.success) {
      console.log(`✅ ${speaker} 语音生成成功`)
      res.json({
        success: true,
        audioUrl: result.audioUrl,
        textPreview: result.textPreview,
        speaker: result.speaker,
        voiceId: result.voiceId,
        timestamp: result.timestamp
      })
    } else {
      console.error(`❌ ${speaker} 语音生成失败:`, result.error)
      res.status(500).json({
        success: false,
        error: result.error,
        speaker: result.speaker,
        timestamp: result.timestamp
      })
    }

  } catch (error) {
    console.error(`💥 ${speaker} API处理异常:`, error.message)
    res.status(500).json({
      success: false,
      error: '服务器内部错误，请稍后重试',
      speaker: speaker,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * POST /api/tts/sam-altman
 * Sam Altman 专用语音生成端点
 */
router.post('/sam-altman', async (req, res) => {
  const { text } = req.body
  await generateSpeechSimple(text, 'sam_altman', res)
})

/**
 * POST /api/tts/feifeili
 * 李飞飞 专用语音生成端点
 */
router.post('/feifeili', async (req, res) => {
  const { text } = req.body
  await generateSpeechSimple(text, 'feifeili', res)
})

/**
 * POST /api/tts/wuenda
 * 吴恩达 专用语音生成端点
 */
router.post('/wuenda', async (req, res) => {
  const { text } = req.body
  await generateSpeechSimple(text, 'wuenda', res)
})

/**
 * POST /api/tts/paul-graham
 * Paul Graham 专用语音生成端点
 */
router.post('/paul-graham', async (req, res) => {
  const { text } = req.body
  await generateSpeechSimple(text, 'paul_graham', res)
})

/**
 * GET /api/tts/test
 * 测试端点 - 使用固定文本测试所有语音角色
 */
router.get('/test', async (req, res) => {
  try {
    const testText = "Hello, this is a test of the TTS system. 你好，这是TTS系统的测试。"
    const speakers = Object.keys(ppioClient.voiceMap)
    const results = []

    for (const speaker of speakers) {
      console.log(`🧪 测试语音角色: ${speaker}`)
      const result = await ppioClient.generateSpeech(testText, speaker)
      results.push({
        speaker,
        ...result
      })
    }

    const successCount = results.filter(r => r.success).length

    res.json({
      success: successCount > 0,
      testText,
      results,
      summary: {
        total: speakers.length,
        successful: successCount,
        failed: speakers.length - successCount
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = router
