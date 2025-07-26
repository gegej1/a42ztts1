const { createClient } = require('@supabase/supabase-js')

/**
 * 评论数据库服务类
 * 专门处理 judge_comments 表的操作
 */
class CommentService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://cslplhzfcfvzsivsgrpc.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbHBsaHpmY2Z2enNpdnNncnBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5OTMwMDUsImV4cCI6MjA2ODU2OTAwNX0.u_4i51DuA0Uwyv2Ocw6i953Tn7_WdcPp3GFlgtGGhXU'
    )
  }

  /**
   * 获取单条评论
   */
  async getComment(id) {
    try {
      const { data, error } = await this.supabase
        .from('judge_comments')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        throw new Error(`数据库查询失败: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('获取评论失败:', error)
      throw error
    }
  }

  /**
   * 获取评论列表
   */
  async getComments(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit

      const { data, error, count } = await this.supabase
        .from('judge_comments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new Error(`数据库查询失败: ${error.message}`)
      }

      return {
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    } catch (error) {
      console.error('获取评论列表失败:', error)
      throw error
    }
  }

  /**
   * 提取英文评论文本
   */
  extractEnglishComments(comment) {
    return {
      wuenda: comment.comment_en_ng,
      paul_graham: comment.comment_en_paul,
      feifeili: comment.comment_en_li,
      sam_altman: comment.comment_en_sam
    }
  }

  /**
   * 提取中文评论文本
   */
  extractChineseComments(comment) {
    return {
      wuenda: comment.comment_cn_ng,
      paul_graham: comment.comment_cn_paul,
      feifeili: comment.comment_cn_li,
      sam_altman: comment.comment_cn_sam
    }
  }

  /**
   * 获取评论的所有文本内容
   */
  extractAllComments(comment) {
    return {
      english: this.extractEnglishComments(comment),
      chinese: this.extractChineseComments(comment)
    }
  }

  /**
   * 验证评论ID格式
   */
  isValidUUID(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }

  /**
   * 获取评论统计信息
   */
  async getCommentStats(id) {
    try {
      const comment = await this.getComment(id)
      const englishComments = this.extractEnglishComments(comment)
      const chineseComments = this.extractChineseComments(comment)

      const stats = {
        id: comment.id,
        gmail: comment.gmail,
        github_repo_url: comment.github_repo_url,
        created_at: comment.created_at,
        english: {},
        chinese: {},
        total_characters: 0
      }

      // 统计英文评论
      for (const [speaker, text] of Object.entries(englishComments)) {
        stats.english[speaker] = {
          hasText: !!(text && text.trim()),
          length: text ? text.length : 0,
          preview: text ? text.substring(0, 100) + (text.length > 100 ? '...' : '') : null
        }
        stats.total_characters += text ? text.length : 0
      }

      // 统计中文评论
      for (const [speaker, text] of Object.entries(chineseComments)) {
        stats.chinese[speaker] = {
          hasText: !!(text && text.trim()),
          length: text ? text.length : 0,
          preview: text ? text.substring(0, 100) + (text.length > 100 ? '...' : '') : null
        }
        stats.total_characters += text ? text.length : 0
      }

      return stats
    } catch (error) {
      console.error('获取评论统计失败:', error)
      throw error
    }
  }

  /**
   * 搜索评论
   */
  async searchComments(query, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit

      const { data, error, count } = await this.supabase
        .from('judge_comments')
        .select('*', { count: 'exact' })
        .or(`gmail.ilike.%${query}%,github_repo_url.ilike.%${query}%,comment_en_ng.ilike.%${query}%,comment_en_paul.ilike.%${query}%,comment_en_li.ilike.%${query}%,comment_en_sam.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new Error(`搜索失败: ${error.message}`)
      }

      return {
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
          query
        }
      }
    } catch (error) {
      console.error('搜索评论失败:', error)
      throw error
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('judge_comments')
        .select('count(*)')
        .limit(1)

      if (error) {
        throw new Error(`健康检查失败: ${error.message}`)
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        table: 'judge_comments',
        accessible: true
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        table: 'judge_comments',
        accessible: false,
        error: error.message
      }
    }
  }
}

// 创建单例实例
const commentService = new CommentService()

module.exports = commentService
