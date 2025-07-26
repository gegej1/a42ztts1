/**
 * 评论API测试工具
 * 用于测试数据库TTS集成系统的各个API端点
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000'

// 测试用的评论ID (需要从实际数据库获取)
let TEST_COMMENT_ID = null

/**
 * 发送HTTP请求的辅助函数
 */
async function makeRequest(url, options = {}) {
  try {
    console.log(`📤 ${options.method || 'GET'} ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    const data = await response.json()
    
    console.log(`📥 状态: ${response.status}`)
    console.log(`📄 响应:`, JSON.stringify(data, null, 2))
    console.log('─'.repeat(50))
    
    return { response, data }
  } catch (error) {
    console.error(`❌ 请求失败:`, error.message)
    console.log('─'.repeat(50))
    throw error
  }
}

/**
 * 测试健康检查
 */
async function testHealthCheck() {
  console.log('🏥 测试健康检查...')
  await makeRequest(`${API_BASE_URL}/health`)
}

/**
 * 测试获取评论列表
 */
async function testGetComments() {
  console.log('📋 测试获取评论列表...')
  const { data } = await makeRequest(`${API_BASE_URL}/api/comments?page=1&limit=5`)
  
  if (data.success && data.data.length > 0) {
    TEST_COMMENT_ID = data.data[0].id
    console.log(`✅ 获取到测试评论ID: ${TEST_COMMENT_ID}`)
  }
  
  return data
}

/**
 * 测试获取评论详情
 */
async function testGetCommentDetail() {
  if (!TEST_COMMENT_ID) {
    console.log('⏭️ 跳过评论详情测试 - 无测试ID')
    return
  }
  
  console.log('📄 测试获取评论详情...')
  await makeRequest(`${API_BASE_URL}/api/comments/${TEST_COMMENT_ID}`)
}

/**
 * 测试获取评论音频
 */
async function testGetCommentAudio() {
  if (!TEST_COMMENT_ID) {
    console.log('⏭️ 跳过音频测试 - 无测试ID')
    return
  }
  
  console.log('🎵 测试获取评论音频...')
  await makeRequest(`${API_BASE_URL}/api/comments/${TEST_COMMENT_ID}/audio`)
}

/**
 * 测试获取特定语音
 */
async function testGetSpecificAudio() {
  if (!TEST_COMMENT_ID) {
    console.log('⏭️ 跳过特定语音测试 - 无测试ID')
    return
  }
  
  const speakers = ['sam_altman', 'feifeili', 'wuenda', 'paul_graham']
  
  for (const speaker of speakers) {
    console.log(`🎤 测试获取 ${speaker} 语音...`)
    try {
      await makeRequest(`${API_BASE_URL}/api/comments/${TEST_COMMENT_ID}/audio/${speaker}`)
    } catch (error) {
      console.log(`⚠️ ${speaker} 语音获取失败，可能是没有对应的评论内容`)
    }
  }
}

/**
 * 测试批量生成语音
 */
async function testGenerateAllAudio() {
  if (!TEST_COMMENT_ID) {
    console.log('⏭️ 跳过批量生成测试 - 无测试ID')
    return
  }
  
  console.log('🚀 测试批量生成语音...')
  await makeRequest(`${API_BASE_URL}/api/comments/${TEST_COMMENT_ID}/generate-all`, {
    method: 'POST'
  })
}

/**
 * 测试缓存统计
 */
async function testCacheStats() {
  console.log('📊 测试缓存统计...')
  await makeRequest(`${API_BASE_URL}/api/comments/cache/stats`)
}

/**
 * 测试搜索评论
 */
async function testSearchComments() {
  console.log('🔍 测试搜索评论...')
  await makeRequest(`${API_BASE_URL}/api/comments?search=test&page=1&limit=3`)
}

/**
 * 测试错误处理
 */
async function testErrorHandling() {
  console.log('❌ 测试错误处理...')
  
  // 测试无效的评论ID
  try {
    await makeRequest(`${API_BASE_URL}/api/comments/invalid-id`)
  } catch (error) {
    console.log('✅ 无效ID错误处理正常')
  }
  
  // 测试无效的语音角色
  if (TEST_COMMENT_ID) {
    try {
      await makeRequest(`${API_BASE_URL}/api/comments/${TEST_COMMENT_ID}/audio/invalid_speaker`)
    } catch (error) {
      console.log('✅ 无效语音角色错误处理正常')
    }
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🧪 开始运行评论API测试套件...')
  console.log(`🌐 API地址: ${API_BASE_URL}`)
  console.log('='.repeat(60))
  
  try {
    // 基础测试
    await testHealthCheck()
    await testGetComments()
    await testGetCommentDetail()
    
    // 音频相关测试
    await testGetCommentAudio()
    await testGetSpecificAudio()
    
    // 高级功能测试
    await testCacheStats()
    await testSearchComments()
    
    // 错误处理测试
    await testErrorHandling()
    
    // 批量生成测试 (放在最后，因为耗时较长)
    console.log('⚠️ 即将进行批量生成测试，这可能需要较长时间...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    await testGenerateAllAudio()
    
    console.log('🎉 所有测试完成!')
    
  } catch (error) {
    console.error('💥 测试过程中出现错误:', error.message)
  }
}

/**
 * 快速测试 (不包括批量生成)
 */
async function runQuickTests() {
  console.log('⚡ 开始运行快速测试...')
  console.log(`🌐 API地址: ${API_BASE_URL}`)
  console.log('='.repeat(60))
  
  try {
    await testHealthCheck()
    await testGetComments()
    await testGetCommentDetail()
    await testGetCommentAudio()
    await testCacheStats()
    
    console.log('⚡ 快速测试完成!')
    
  } catch (error) {
    console.error('💥 测试过程中出现错误:', error.message)
  }
}

// 命令行参数处理
const args = process.argv.slice(2)
const command = args[0] || 'quick'

if (command === 'all') {
  runAllTests()
} else if (command === 'quick') {
  runQuickTests()
} else if (command === 'health') {
  testHealthCheck()
} else if (command === 'comments') {
  testGetComments()
} else if (command === 'generate') {
  testGetComments().then(() => testGenerateAllAudio())
} else {
  console.log(`
🧪 评论API测试工具

用法:
  node test-comments-api.js [command]

命令:
  quick     - 快速测试 (默认)
  all       - 完整测试 (包括批量生成)
  health    - 仅健康检查
  comments  - 仅评论列表
  generate  - 批量生成测试

环境变量:
  API_URL   - API地址 (默认: http://localhost:3000)

示例:
  API_URL=https://your-domain.zeabur.app node test-comments-api.js quick
  `)
}
