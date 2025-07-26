const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const ttsRoutes = require('./routes/tts')

const app = express()
const PORT = process.env.PORT || 8080

// 安全中间件
app.use(helmet())

// 压缩中间件
app.use(compression())

// CORS配置 - 允许所有域名（开发阶段）
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// 请求体解析
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100次请求
  message: {
    error: '请求过于频繁，请稍后再试',
    retryAfter: '15分钟'
  },
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/', limiter)

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: require('../package.json').version
  })
})

// API路由
const commentsRoutes = require('./routes/comments')

app.use('/api/tts', ttsRoutes)
app.use('/api/comments', commentsRoutes)

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'TTS Proxy API',
    description: 'TTS语音播放系统API代理服务',
    version: require('../package.json').version,
    endpoints: {
      health: '/health',
      tts: '/api/tts',
      comments: '/api/comments'
    },
    documentation: 'https://github.com/your-username/tts-proxy-api'
  })
})

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalUrl,
    method: req.method
  })
})

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err)
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 TTS Proxy API 服务启动成功`)
  console.log(`📍 端口: ${PORT}`)
  console.log(`🌍 环境: ${process.env.NODE_ENV}`)
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`)
  console.log(`🎯 TTS API: http://localhost:${PORT}/api/tts`)
})

module.exports = app
