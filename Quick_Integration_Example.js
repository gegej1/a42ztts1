/**
 * a42z前端TTS快速集成示例
 * 
 * 使用方法：
 * 1. 替换 API_BASE_URL 为您的实际Zeabur域名
 * 2. 复制需要的函数到您的项目中
 * 3. 调用 playText() 函数播放语音
 */

// 配置您的API地址
const API_BASE_URL = 'https://your-zeabur-domain.zeabur.app'

// 简单的TTS服务类
class SimpleTTS {
  constructor(apiUrl = API_BASE_URL) {
    this.apiUrl = `${apiUrl}/api/tts`
    this.currentAudio = null
  }

  // 播放文本语音
  async playText(text, speaker = 'sam_altman') {
    try {
      // 停止当前播放
      this.stop()
      
      // 调用API生成语音
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speaker })
      })
      
      const result = await response.json()
      
      if (result.success && result.audioUrl) {
        // 创建音频对象并播放
        this.currentAudio = new Audio(result.audioUrl)
        await this.currentAudio.play()
        return result
      } else {
        throw new Error(result.error || '语音生成失败')
      }
    } catch (error) {
      console.error('TTS播放失败:', error)
      throw error
    }
  }

  // 停止播放
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
  }
}

// 创建全局TTS实例
const tts = new SimpleTTS()

// 快速使用函数
async function speakText(text, speaker = 'sam_altman') {
  try {
    await tts.playText(text, speaker)
    console.log('语音播放成功')
  } catch (error) {
    console.error('语音播放失败:', error.message)
  }
}

// 使用示例
// speakText('Hello, this is a test.', 'sam_altman')
// speakText('你好，这是一个测试。', 'feifeili')

// ===== React Hook 版本 =====
function useTTS() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [error, setError] = React.useState(null)
  const ttsRef = React.useRef(new SimpleTTS())

  const playText = React.useCallback(async (text, speaker = 'sam_altman') => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await ttsRef.current.playText(text, speaker)
      setIsPlaying(true)
      
      // 监听播放结束
      if (ttsRef.current.currentAudio) {
        ttsRef.current.currentAudio.addEventListener('ended', () => {
          setIsPlaying(false)
        })
      }
      
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const stop = React.useCallback(() => {
    ttsRef.current.stop()
    setIsPlaying(false)
  }, [])

  return { playText, stop, isLoading, isPlaying, error }
}

// ===== Vue Composable 版本 =====
function useTTSVue() {
  const isLoading = Vue.ref(false)
  const isPlaying = Vue.ref(false)
  const error = Vue.ref(null)
  const ttsService = new SimpleTTS()

  const playText = async (text, speaker = 'sam_altman') => {
    isLoading.value = true
    error.value = null
    
    try {
      const result = await ttsService.playText(text, speaker)
      isPlaying.value = true
      
      if (ttsService.currentAudio) {
        ttsService.currentAudio.addEventListener('ended', () => {
          isPlaying.value = false
        })
      }
      
      return result
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const stop = () => {
    ttsService.stop()
    isPlaying.value = false
  }

  return { playText, stop, isLoading, isPlaying, error }
}

// ===== 原生JavaScript DOM操作示例 =====
function createTTSButton(text, speaker = 'sam_altman') {
  const button = document.createElement('button')
  button.textContent = '🔊 播放'
  button.onclick = () => speakText(text, speaker)
  return button
}

// 为页面上的文本添加TTS功能
function addTTSToElements(selector = '.tts-enabled') {
  document.querySelectorAll(selector).forEach(element => {
    const text = element.textContent || element.innerText
    const speaker = element.dataset.speaker || 'sam_altman'
    
    const button = createTTSButton(text, speaker)
    element.appendChild(button)
  })
}

// ===== 支持的语音角色 =====
const SPEAKERS = {
  sam_altman: 'Sam Altman (英文)',
  feifeili: '李飞飞 (中文)',
  wuenda: '吴恩达 (中文)',
  paul_graham: 'Paul Graham (英文)'
}

// 根据文本语言自动选择语音角色
function autoSelectSpeaker(text) {
  // 简单的中英文检测
  const chineseRegex = /[\u4e00-\u9fff]/
  return chineseRegex.test(text) ? 'feifeili' : 'sam_altman'
}

// 智能播放函数（自动选择语音角色）
async function smartSpeak(text) {
  const speaker = autoSelectSpeaker(text)
  await speakText(text, speaker)
}

// ===== 批量播放示例 =====
async function playTextArray(textArray, speaker = 'sam_altman', delay = 1000) {
  for (let i = 0; i < textArray.length; i++) {
    console.log(`播放第 ${i + 1}/${textArray.length} 段`)
    await speakText(textArray[i], speaker)
    
    // 等待播放完成
    await new Promise(resolve => {
      const checkEnd = () => {
        if (!tts.currentAudio || tts.currentAudio.ended) {
          resolve()
        } else {
          setTimeout(checkEnd, 100)
        }
      }
      checkEnd()
    })
    
    // 段间延迟
    if (i < textArray.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// ===== 错误处理示例 =====
async function robustSpeak(text, speaker = 'sam_altman', maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await speakText(text, speaker)
      return // 成功则退出
    } catch (error) {
      console.warn(`第 ${i + 1} 次尝试失败:`, error.message)
      
      if (i < maxRetries - 1) {
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      } else {
        throw error // 最后一次失败则抛出错误
      }
    }
  }
}

// ===== 导出供其他模块使用 =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SimpleTTS,
    speakText,
    smartSpeak,
    playTextArray,
    robustSpeak,
    SPEAKERS,
    autoSelectSpeaker
  }
}

// ===== 使用示例 =====
/*
// 基础使用
await speakText('Hello World', 'sam_altman')
await speakText('你好世界', 'feifeili')

// 智能语音角色选择
await smartSpeak('Hello World')  // 自动选择英文语音
await smartSpeak('你好世界')      // 自动选择中文语音

// React中使用
function MyComponent() {
  const { playText, stop, isLoading, isPlaying } = useTTS()
  
  return (
    <div>
      <button onClick={() => playText('Hello World', 'sam_altman')}>
        {isLoading ? '生成中...' : '播放'}
      </button>
      <button onClick={stop} disabled={!isPlaying}>停止</button>
    </div>
  )
}

// Vue中使用
const { playText, stop, isLoading, isPlaying } = useTTSVue()

// 为现有元素添加TTS功能
// HTML: <p class="tts-enabled" data-speaker="feifeili">这是一段中文文本</p>
addTTSToElements('.tts-enabled')
*/
