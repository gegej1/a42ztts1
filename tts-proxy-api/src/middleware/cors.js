const cors = require('cors')

/**
 * CORS中间件配置
 * 支持动态域名配置和开发/生产环境切换
 */

const corsOptions = {
  // 允许的源域名
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGIN

    // 开发环境或允许所有域名
    if (allowedOrigins === '*' || process.env.NODE_ENV === 'development') {
      return callback(null, true)
    }

    // 生产环境检查具体域名
    if (allowedOrigins) {
      const origins = allowedOrigins.split(',').map(o => o.trim())
      if (origins.includes(origin) || !origin) {
        return callback(null, true)
      }
    }

    // 拒绝请求
    callback(new Error('CORS策略不允许此域名访问'))
  },

  // 允许携带认证信息
  credentials: true,

  // 允许的HTTP方法
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  // 允许的请求头
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key'
  ],

  // 暴露的响应头
  exposedHeaders: [
    'X-Total-Count',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],

  // 预检请求缓存时间（秒）
  maxAge: 86400, // 24小时

  // 处理预检请求
  preflightContinue: false,
  optionsSuccessStatus: 204
}

/**
 * 创建CORS中间件
 */
const corsMiddleware = cors(corsOptions)

/**
 * 错误处理中间件
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message.includes('CORS策略')) {
    return res.status(403).json({
      error: 'CORS错误',
      message: '当前域名不被允许访问此API',
      origin: req.get('Origin'),
      timestamp: new Date().toISOString()
    })
  }
  next(err)
}

module.exports = {
  corsMiddleware,
  corsErrorHandler,
  corsOptions
}
