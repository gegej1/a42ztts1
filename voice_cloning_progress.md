# PPIO 声音克隆项目进度文档

## 📋 项目概述
使用 PPIO 平台的 MiniMax Voice Cloning 服务克隆 Sam Altman 的声音，用于朗读文本内容。

## ✅ 已完成的工作

### 1. 文本合并工作
- ✅ 成功合并了多个文件夹的文章：
  - `paul_graham_merged.txt` (3.9MB, 572个文件)
  - `sam_altman_merged.txt` (1.3MB, 138个文件)  
  - `feifei_li_merged.txt` (25KB, 3个文件)
  - `ng_content_merged.txt` (137KB, 4个文件，包含修复编码问题的ng1.txt)

### 2. 声音克隆准备工作
- ✅ 研究了 PPIO 平台的 MiniMax Voice Cloning API
- ✅ 获取了完整的 API 文档和要求
- ✅ 用户提供了必要的信息

## 🎯 用户提供的信息

### API 凭证
```
API Token: sk_P7dvruEBeOoxYXN4lILmfwmB4DvpmSxSvzrPVGwU01c
```

### 音频文件信息
```
路径: /Users/eduardogan/Desktop/GHJProject/advx25/dataforhuman/sam/Sam Altman - How to Succeed with a Startup_[cut_22sec].mp3
格式: MP3
时长: 22秒 (符合10秒-5分钟要求)
```

### 配置要求
- 模型: `speech-02-hd` (高质量模型)
- 降噪: `need_noise_reduction: true`
- 音量归一化: `need_volume_normalization: true`

## 📝 PPIO API 技术要求

### 音频文件要求
- ✅ 格式: MP3、M4A、WAV (用户文件是MP3)
- ✅ 时长: 10秒-5分钟 (用户文件22秒)
- ✅ 大小: ≤20MB
- ✅ 质量: 单人说话，音质清晰

### API 端点
```
POST https://api.ppinfra.com/v3/minimax-voice-cloning
```

### 请求头
```
Authorization: Bearer sk_P7dvruEBeOoxYXN4lILmfwmB4DvpmSxSvzrPVGwU01c
Content-Type: application/json
```

## 🚀 下一步操作清单

### 1. 立即需要确认的信息
- [ ] **朗读内容确认**: 用户想要克隆的声音朗读什么内容？
  - 选项A: `ng_content_merged.txt` 的内容
  - 选项B: `sam_altman_merged.txt` 的内容  
  - 选项C: 其他指定文本
  - 选项D: 先做一个简短的测试文本

### 2. 技术实施步骤

#### 步骤1: 上传音频文件
需要将本地音频文件上传到可访问的URL，或使用文件上传API

#### 步骤2: 创建API调用脚本
```python
import requests
import json

def clone_voice():
    url = "https://api.ppinfra.com/v3/minimax-voice-cloning"
    headers = {
        "Authorization": "Bearer sk_P7dvruEBeOoxYXN4lILmfwmB4DvpmSxSvzrPVGwU01c",
        "Content-Type": "application/json"
    }
    
    data = {
        "audio_url": "需要上传音频后获得的URL",
        "text": "试听文本内容",
        "model": "speech-02-hd",
        "need_noise_reduction": True,
        "need_volume_normalization": True
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()
```

#### 步骤3: 处理返回结果
API 返回：
- `voice_id`: 用于后续语音合成的声音ID
- `demo_audio_url`: 试听音频链接

#### 步骤4: 使用克隆的声音生成最终音频
使用获得的 `voice_id` 调用语音合成API生成完整内容的音频

### 3. 文件处理建议

#### 如果朗读长文本（如合并的txt文件）
- 需要分段处理（每段≤2000字符）
- 批量生成多个音频文件
- 最后合并成完整音频

#### 推荐的测试流程
1. 先用短文本测试克隆效果
2. 确认效果满意后再处理长文本
3. 分段生成，避免单次请求过大

## 💡 重要注意事项

### 临时音色限制
- 生成的音色为临时音色
- 需在7天内使用，否则会被删除
- 建议尽快完成所有音频生成工作

### 费用考虑
- 声音克隆费用
- 试听音频按字符收费
- 最终音频生成按字符收费

### 技术限制
- 单次文本限制2000字符
- 需要处理长文本的分段逻辑

## 📞 下一个对话需要做的事情

1. **确认朗读内容**: 询问用户具体想要朗读什么文本
2. **检查音频文件**: 验证音频文件大小和质量
3. **上传音频**: 将音频上传到可访问的URL
4. **执行API调用**: 调用声音克隆API
5. **测试效果**: 下载试听音频验证效果
6. **生成最终音频**: 使用克隆的声音生成完整内容

## 📁 相关文件位置
- 音频文件: `sam/Sam Altman - How to Succeed with a Startup_[cut_22sec].mp3`
- 可能的朗读内容: `ng_content_merged.txt`, `sam_altman_merged.txt`
- 工作脚本: 需要创建 `voice_cloning_script.py`

---
**创建时间**: 2025-01-25
**状态**: 准备就绪，等待用户确认朗读内容后开始执行
