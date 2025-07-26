// =============================================
// Supabase Edge Function: 语音生成
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VoiceGenerationRequest {
  articleId: number
  speakerId: number
  forceRegenerate?: boolean
}

interface PPIOResponse {
  voice_id: string
  demo_audio_url: string
  status: string
}

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 初始化Supabase客户端
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 解析请求
    const { articleId, speakerId, forceRegenerate = false }: VoiceGenerationRequest = await req.json()

    console.log(`开始处理语音生成请求: 文章${articleId}, 说话人${speakerId}`)

    // 1. 检查是否已存在完成的生成记录
    if (!forceRegenerate) {
      const { data: existingRecord } = await supabaseClient
        .from('voice_generations')
        .select('*')
        .eq('article_id', articleId)
        .eq('speaker_id', speakerId)
        .eq('status', 'completed')
        .single()

      if (existingRecord) {
        return new Response(
          JSON.stringify({
            success: true,
            message: '语音已存在',
            data: existingRecord
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }
    }

    // 2. 获取文章内容
    const { data: article, error: articleError } = await supabaseClient
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      throw new Error(`文章不存在: ${articleError?.message}`)
    }

    // 3. 获取说话人信息
    const { data: speaker, error: speakerError } = await supabaseClient
      .from('ai_speakers')
      .select('*')
      .eq('id', speakerId)
      .eq('is_active', true)
      .single()

    if (speakerError || !speaker) {
      throw new Error(`说话人不存在: ${speakerError?.message}`)
    }

    // 4. 创建或更新生成记录
    const { data: generationRecord, error: recordError } = await supabaseClient
      .from('voice_generations')
      .upsert({
        article_id: articleId,
        speaker_id: speakerId,
        status: 'processing',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (recordError) {
      throw new Error(`创建生成记录失败: ${recordError.message}`)
    }

    // 5. 分割文本
    const textChunks = splitTextIntoChunks(article.content, 500)
    console.log(`文本分割为 ${textChunks.length} 段`)

    // 6. 生成语音
    const audioUrls: string[] = []
    const startTime = Date.now()

    for (let i = 0; i < textChunks.length; i++) {
      console.log(`处理第 ${i + 1}/${textChunks.length} 段`)

      try {
        // 调用PPIO API
        const audioData = await generateVoiceFromPPIO(textChunks[i], speaker.voice_id)
        
        if (audioData) {
          // 上传到Supabase Storage
          const fileName = `articles/${articleId}/${speaker.name}_part${String(i + 1).padStart(2, '0')}_${Date.now()}.mp3`
          const audioUrl = await uploadAudioToStorage(supabaseClient, audioData, fileName)
          
          if (audioUrl) {
            audioUrls.push(audioUrl)
            console.log(`第 ${i + 1} 段完成: ${audioUrl}`)
          }
        }

        // 避免API限制
        if (i < textChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

      } catch (error) {
        console.error(`第 ${i + 1} 段生成失败:`, error)
        // 继续处理下一段，不中断整个流程
      }
    }

    const processingTime = Math.round((Date.now() - startTime) / 1000)

    // 7. 更新生成记录
    if (audioUrls.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('voice_generations')
        .update({
          status: 'completed',
          audio_urls: audioUrls,
          segments_count: audioUrls.length,
          processing_time: processingTime,
          completed_at: new Date().toISOString()
        })
        .eq('id', generationRecord.id)

      if (updateError) {
        console.error('更新记录失败:', updateError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: '语音生成完成',
          data: {
            id: generationRecord.id,
            audioUrls,
            segmentsCount: audioUrls.length,
            processingTime
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    } else {
      // 生成失败
      await supabaseClient
        .from('voice_generations')
        .update({
          status: 'failed',
          error_message: '所有语音段生成失败',
          processing_time: processingTime
        })
        .eq('id', generationRecord.id)

      throw new Error('语音生成失败')
    }

  } catch (error) {
    console.error('语音生成错误:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// =============================================
// 辅助函数
// =============================================

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (currentChunk.length + trimmedSentence.length < maxLength) {
      currentChunk += trimmedSentence + "."
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = trimmedSentence + "."
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.length > 0 ? chunks : [text.substring(0, maxLength)]
}

async function generateVoiceFromPPIO(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  const apiToken = Deno.env.get('PPIO_API_TOKEN')
  const apiUrl = 'https://api.ppinfra.com/v3/minimax-voice-cloning'

  const payload = {
    voice_id: voiceId,
    text: text,
    model: "speech-02-hd",
    need_noise_reduction: true,
    need_volume_normalization: true
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`PPIO API调用失败: ${response.status} - ${await response.text()}`)
    }

    const result: PPIOResponse = await response.json()
    
    if (result.demo_audio_url) {
      // 下载音频数据
      const audioResponse = await fetch(result.demo_audio_url)
      if (audioResponse.ok) {
        return await audioResponse.arrayBuffer()
      }
    }

    return null
  } catch (error) {
    console.error('PPIO API调用失败:', error)
    return null
  }
}

async function uploadAudioToStorage(
  supabaseClient: any,
  audioData: ArrayBuffer,
  fileName: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseClient.storage
      .from('voice-articles')
      .upload(fileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (error) {
      console.error('上传失败:', error)
      return null
    }

    // 获取公开URL
    const { data: urlData } = supabaseClient.storage
      .from('voice-articles')
      .getPublicUrl(fileName)

    return urlData.publicUrl
  } catch (error) {
    console.error('上传到Storage失败:', error)
    return null
  }
}
