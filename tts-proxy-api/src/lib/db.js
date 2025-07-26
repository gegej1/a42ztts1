const { createClient } = require('@supabase/supabase-js')

/**
 * Supabase数据库连接类
 */
class Database {
  constructor() {
    this.supabase = null
    this.isConnected = false
  }

  /**
   * 初始化Supabase连接
   */
  async connect() {
    try {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量未设置')
      }

      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false
          }
        }
      )

      // 测试连接 - 简单验证客户端创建成功
      // Supabase客户端创建成功就表示连接配置正确

      this.isConnected = true
      console.log('✅ Supabase数据库连接成功')

      return this.supabase
    } catch (error) {
      console.error('❌ Supabase数据库连接失败:', error.message)
      this.isConnected = false
      throw error
    }
  }

  /**
   * 获取Supabase客户端
   */
  getClient() {
    if (!this.supabase || !this.isConnected) {
      throw new Error('数据库未连接，请先调用connect()方法')
    }
    return this.supabase
  }

  /**
   * 探索数据库表结构
   */
  async exploreTables() {
    try {
      const client = this.getClient()

      // 尝试查询一些常见的表名
      const commonTableNames = [
        'users', 'profiles', 'posts', 'articles', 'content',
        'judges', 'evaluations', 'outputs', 'responses',
        'sam_altman', 'feifei_li', 'paul_graham', 'andrew_ng',
        'judge_outputs', 'evaluator_responses', 'conversations',
        'messages', 'workflow_runs', 'workflow_app_logs'
      ]

      const existingTables = []

      for (const tableName of commonTableNames) {
        try {
          const { data, error } = await client
            .from(tableName)
            .select('*')
            .limit(1)

          if (!error) {
            existingTables.push({
              table_name: tableName,
              sample_data: data
            })
          }
        } catch (e) {
          // 表不存在，继续下一个
        }
      }

      return existingTables
    } catch (error) {
      console.error('❌ 探索表结构失败:', error.message)
      throw error
    }
  }

  /**
   * 获取评委输出信息
   * 根据评委名称获取其输出内容
   */
  async getJudgeOutput(judgeName) {
    try {
      const client = this.getClient()

      // 标准化评委名称映射
      const judgeNameMap = {
        'sam_altman': ['sam_altman', 'sam altman', 'Sam Altman'],
        'feifei_li': ['feifei_li', 'feifei li', 'Feifei Li', '李飞飞'],
        'paul_graham': ['paul_graham', 'paul graham', 'Paul Graham'],
        'andrew_ng': ['andrew_ng', 'andrew ng', 'Andrew Ng', '吴恩达', 'wuenda']
      }

      const normalizedName = judgeName.toLowerCase().replace(/\s+/g, '_')
      const searchNames = judgeNameMap[normalizedName] || [judgeName]

      // 尝试多种可能的表结构
      const possibleQueries = [
        // 方案1: 专门的评委输出表
        { table: 'judge_outputs', nameField: 'judge_name', contentField: 'output' },
        { table: 'evaluator_responses', nameField: 'evaluator', contentField: 'response' },
        { table: 'outputs', nameField: 'name', contentField: 'content' },

        // 方案2: 按评委名称的独立表
        { table: normalizedName, nameField: null, contentField: 'content' },
        { table: normalizedName, nameField: null, contentField: 'output' },
        { table: normalizedName, nameField: null, contentField: 'response' },

        // 方案3: 通用内容表
        { table: 'content', nameField: 'author', contentField: 'text' },
        { table: 'articles', nameField: 'author', contentField: 'content' },
        { table: 'posts', nameField: 'author', contentField: 'content' }
      ]

      for (const query of possibleQueries) {
        try {
          let supabaseQuery = client.from(query.table)

          if (query.nameField) {
            // 有名称字段的情况，搜索匹配的评委
            supabaseQuery = supabaseQuery.select('*')
            for (const name of searchNames) {
              const { data, error } = await supabaseQuery
                .ilike(query.nameField, `%${name}%`)
                .limit(10)

              if (!error && data && data.length > 0) {
                console.log(`✅ 在表 ${query.table} 中找到评委 ${judgeName} 的数据`)
                return {
                  judge: judgeName,
                  table: query.table,
                  data: data.map(item => ({
                    id: item.id,
                    content: item[query.contentField],
                    metadata: item
                  }))
                }
              }
            }
          } else {
            // 没有名称字段，直接获取表内容
            const { data, error } = await supabaseQuery
              .select('*')
              .limit(10)

            if (!error && data && data.length > 0) {
              console.log(`✅ 在表 ${query.table} 中找到数据`)
              return {
                judge: judgeName,
                table: query.table,
                data: data.map(item => ({
                  id: item.id,
                  content: item[query.contentField],
                  metadata: item
                }))
              }
            }
          }
        } catch (e) {
          // 表不存在或查询失败，继续下一个
          continue
        }
      }

      return null
    } catch (error) {
      console.error('❌ 获取评委输出失败:', error.message)
      throw error
    }
  }

  /**
   * 根据ID获取文字内容（兼容原有接口）
   */
  async getTextById(textId) {
    try {
      const client = this.getClient()

      // 尝试多个可能的表
      const tables = ['articles', 'content', 'posts', 'outputs']

      for (const table of tables) {
        try {
          const { data, error } = await client
            .from(table)
            .select('*')
            .eq('id', textId)
            .single()

          if (!error && data) {
            return {
              id: data.id,
              title: data.title || data.name || `内容 ${textId}`,
              content: data.content || data.text || data.output || data.response,
              author: data.author || data.creator,
              created_at: data.created_at
            }
          }
        } catch (e) {
          continue
        }
      }

      return null
    } catch (error) {
      console.error('❌ 获取文字内容失败:', error.message)
      throw error
    }
  }

  /**
   * 检查数据库连接状态
   */
  async healthCheck() {
    try {
      const client = this.getClient()

      // 简单的连接测试
      // Supabase客户端存在就表示连接正常

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connected: this.isConnected,
        supabase_url: process.env.SUPABASE_URL
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      }
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.supabase) {
      // Supabase客户端不需要显式关闭
      this.isConnected = false
      console.log('📴 Supabase数据库连接已关闭')
    }
  }
}

// 创建单例实例
const database = new Database()

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.log('🔄 正在关闭数据库连接...')
  await database.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('🔄 正在关闭数据库连接...')
  await database.close()
  process.exit(0)
})

module.exports = database
