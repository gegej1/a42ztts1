-- =============================================
-- Supabase AI语音克隆平台数据库结构
-- =============================================

-- 1. 文章表
CREATE TABLE articles (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    word_count INTEGER,
    language TEXT DEFAULT 'zh-CN',
    category TEXT,
    tags TEXT[],
    source_file TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AI人物表
CREATE TABLE ai_speakers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    voice_id TEXT NOT NULL UNIQUE,
    description TEXT,
    avatar_url TEXT,
    language TEXT DEFAULT 'zh-CN',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 语音生成记录表
CREATE TABLE voice_generations (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    speaker_id BIGINT NOT NULL REFERENCES ai_speakers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    audio_urls JSONB, -- 存储音频文件URL数组
    segments_count INTEGER DEFAULT 1,
    total_duration INTEGER, -- 总时长（秒）
    file_size BIGINT, -- 文件大小（字节）
    error_message TEXT,
    api_cost DECIMAL(10,4), -- API调用成本
    processing_time INTEGER, -- 处理时间（秒）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- 唯一约束：每篇文章每个说话人只能有一个有效记录
    UNIQUE(article_id, speaker_id)
);

-- 4. 用户播放历史表
CREATE TABLE play_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID, -- 如果有用户系统
    voice_generation_id BIGINT NOT NULL REFERENCES voice_generations(id) ON DELETE CASCADE,
    play_duration INTEGER, -- 播放时长（秒）
    completed BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 系统配置表
CREATE TABLE system_config (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 索引优化
-- =============================================

-- 文章索引
CREATE INDEX idx_articles_title ON articles USING gin(to_tsvector('english', title));
CREATE INDEX idx_articles_content ON articles USING gin(to_tsvector('english', content));
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);

-- 语音生成记录索引
CREATE INDEX idx_voice_generations_status ON voice_generations(status);
CREATE INDEX idx_voice_generations_article_speaker ON voice_generations(article_id, speaker_id);
CREATE INDEX idx_voice_generations_created_at ON voice_generations(created_at DESC);

-- 播放历史索引
CREATE INDEX idx_play_history_voice_generation ON play_history(voice_generation_id);
CREATE INDEX idx_play_history_created_at ON play_history(created_at DESC);

-- =============================================
-- 触发器和函数
-- =============================================

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间戳触发器
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_speakers_updated_at BEFORE UPDATE ON ai_speakers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_generations_updated_at BEFORE UPDATE ON voice_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 文章字数统计触发器
CREATE OR REPLACE FUNCTION update_word_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = LENGTH(TRIM(NEW.content));
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_articles_word_count BEFORE INSERT OR UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_word_count();

-- =============================================
-- 初始数据插入
-- =============================================

-- 插入AI说话人数据
INSERT INTO ai_speakers (name, display_name, voice_id, description, language) VALUES
('sam_altman', 'Sam Altman', 'voice_4bc8f72b-71ed-4089-a93e-ad3381fde6e5', 'OpenAI CEO，创业导师', 'en-US'),
('feifeili', '李飞飞', 'voice_c514c3d8-1d62-4e49-8526-d82fd857548b', 'Stanford AI Lab主任，计算机视觉专家', 'zh-CN'),
('wuenda', '吴恩达', 'voice_7fcc1d94-d0ec-4a39-91fe-508b0fb43af6', 'Coursera联合创始人，机器学习专家', 'zh-CN'),
('paul_graham', 'Paul Graham', 'voice_bb4693a9-4ece-4c68-961d-30016cfd10f9', 'Y Combinator创始人，创业思想家', 'en-US');

-- 插入系统配置
INSERT INTO system_config (key, value, description) VALUES
('api_settings', '{"base_url": "https://api.ppinfra.com/v3/minimax-voice-cloning", "timeout": 90, "max_text_length": 500}', 'PPIO API配置'),
('storage_settings', '{"bucket_name": "voice-articles", "max_file_size": 52428800, "allowed_types": ["audio/mpeg", "audio/mp3"]}', 'Storage配置'),
('generation_settings', '{"max_concurrent": 3, "retry_attempts": 3, "segment_delay": 2}', '语音生成配置');

-- =============================================
-- RLS (Row Level Security) 策略
-- =============================================

-- 启用RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;

-- 公开读取策略（文章和语音记录）
CREATE POLICY "Public read access for articles" ON articles
    FOR SELECT USING (true);

CREATE POLICY "Public read access for voice_generations" ON voice_generations
    FOR SELECT USING (status = 'completed');

-- AI说话人表公开读取
CREATE POLICY "Public read access for ai_speakers" ON ai_speakers
    FOR SELECT USING (is_active = true);

-- 播放历史插入策略
CREATE POLICY "Anyone can insert play history" ON play_history
    FOR INSERT WITH CHECK (true);

-- =============================================
-- 视图定义
-- =============================================

-- 文章统计视图
CREATE VIEW article_stats AS
SELECT 
    a.id,
    a.title,
    a.author,
    a.word_count,
    a.created_at,
    COUNT(vg.id) as voice_count,
    COUNT(CASE WHEN vg.status = 'completed' THEN 1 END) as completed_voices,
    MAX(vg.updated_at) as last_generated
FROM articles a
LEFT JOIN voice_generations vg ON a.id = vg.article_id
GROUP BY a.id, a.title, a.author, a.word_count, a.created_at;

-- 说话人统计视图
CREATE VIEW speaker_stats AS
SELECT 
    s.id,
    s.name,
    s.display_name,
    s.language,
    COUNT(vg.id) as total_generations,
    COUNT(CASE WHEN vg.status = 'completed' THEN 1 END) as completed_generations,
    SUM(vg.total_duration) as total_duration,
    AVG(vg.processing_time) as avg_processing_time
FROM ai_speakers s
LEFT JOIN voice_generations vg ON s.id = vg.speaker_id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.display_name, s.language;
