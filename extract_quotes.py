#!/usr/bin/env python3
"""Extract notable quotes from all analyzed books' md_content."""
import json, re, os

BOOKS_PATH = os.path.join(os.path.dirname(__file__), 'data', 'books.json')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'data', 'quotes.json')

# Theme keywords for auto-tagging
THEME_KEYWORDS = {
    '人生': ['人生', '生命', '活着', '意义', '死亡', '命运', '选择', '活', '死', '存在'],
    '哲学': ['哲学', '智慧', '真理', '理性', '美德', '德性', '斯多葛', '道', '理性', '自然', '灵魂', '内心', '宁静'],
    '商业': ['商业', '管理', '创新', '企业', '组织', '市场', '竞争', '产品', '战略', 'OKR', '目标', '增长'],
    '投资': ['投资', '财富', '金钱', '经济', '资本', '风险', '收益', '理财', '财务'],
    '幸福': ['幸福', '快乐', '满足', '安宁', '平静', '喜悦', '痛苦', '苦难', '情绪'],
    '健康': ['健康', '身体', '衰老', '运动', '饮食', '睡眠', '疾病', '长寿', '肌肉', '代谢'],
    '关系': ['关系', '爱', '婚姻', '亲密', '孤独', '沟通', '理解', '信任', '朋友', '家庭'],
    '认知': ['认知', '思维', '学习', '知识', '理解', '判断', '决策', '偏见', '逻辑', '心智'],
    '领导力': ['领导', '权力', '权威', '影响', '团队', '执行', '责任', '决策', '组织'],
    '历史': ['历史', '时代', '变革', '文明', '王朝', '战争', '革命', '社会', '政治'],
}

# Metadata patterns to exclude
METADATA_PATTERNS = [
    r'精读版字数', r'原著', r'预计阅读', r'翻译说明', r'推荐读法', r'领域',
    r'难度', r'版本', r'出版社', r'译本', r'ISBN', r'作者',
    r'^\d+\.', r'排版', r'目录', r'章节'
]

def is_metadata(text):
    text_stripped = text.strip()
    if len(text_stripped) < 15:
        return True
    for pattern in METADATA_PATTERNS:
        if re.search(pattern, text_stripped):
            return True
    return False

def clean_markdown(text):
    """Remove markdown formatting from text."""
    # Remove bold/italic markers
    text = re.sub(r'\*{1,3}(.+?)\*{1,3}', r'\1', text)
    # Remove link syntax
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)
    # Remove headers
    text = re.sub(r'^#{1,6}\s+', '', text)
    # Remove list markers
    text = re.sub(r'^[\-\*\+]\s+', '', text)
    # Remove code blocks
    text = re.sub(r'`(.+?)`', r'\1', text)
    # Remove table pipes
    text = re.sub(r'\|', ' ', text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_quotes_from_md(md_content, book_title):
    """Extract quotes from markdown content."""
    quotes = []
    lines = md_content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Extract blockquotes (> ...)
        if line.startswith('>'):
            quote_parts = [line[1:].strip()]
            # Collect multi-line blockquotes
            j = i + 1
            while j < len(lines) and lines[j].strip().startswith('>'):
                part = lines[j].strip()[1:].strip()
                if part:
                    quote_parts.append(part)
                j += 1
            
            full_quote = ' '.join(quote_parts)
            full_quote = clean_markdown(full_quote)
            
            if not is_metadata(full_quote) and len(full_quote) > 25:
                # Check if it looks like a quote (has quotation marks or attribution)
                has_quote_marks = '"' in full_quote or '"' in full_quote or '"' in full_quote or '「' in full_quote or '——' in full_quote
                if has_quote_marks or len(full_quote) > 40:
                    quotes.append(full_quote)
            i = j
            continue
        
        # Extract lines with Chinese quotation marks that look like quotes
        if ('"' in line or '"' in line or '「' in line) and len(line) > 30:
            cleaned = clean_markdown(line)
            # Extract just the quoted portion if possible
            quoted = re.findall(r'"(.+?)"', cleaned)
            if not quoted:
                quoted = re.findall(r'"(.+?)"', cleaned)
            if not quoted:
                quoted = re.findall(r'「(.+?)」', cleaned)
            
            if quoted:
                for q in quoted:
                    q = q.strip()
                    if len(q) > 20 and not is_metadata(q):
                        quotes.append(q)
            elif len(cleaned) > 40 and not is_metadata(cleaned):
                # The whole line might be a paraphrased quote
                if any(kw in cleaned for kw in ['说', '认为', '写道', '指出', '提出', '强调']):
                    quotes.append(cleaned)
        
        i += 1
    
    # Deduplicate while preserving order
    seen = set()
    unique_quotes = []
    for q in quotes:
        key = q[:50]
        if key not in seen:
            seen.add(key)
            unique_quotes.append(q)
    
    return unique_quotes

def tag_quote(quote_text, book_title):
    """Auto-tag a quote with themes based on keywords."""
    text = quote_text + ' ' + book_title
    tags = []
    for theme, keywords in THEME_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            tags.append(theme)
    if not tags:
        tags.append('人生')  # Default tag
    return tags

def main():
    with open(BOOKS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    all_quotes = []
    
    for book in data['analyzed_books']:
        title = book.get('title', '')
        md_content = book.get('md_content', '')
        rating = book.get('rating', '')
        
        if not md_content:
            continue
        
        quotes = extract_quotes_from_md(md_content, title)
        
        for q in quotes:
            tags = tag_quote(q, title)
            all_quotes.append({
                'text': q,
                'book': title,
                'rating': rating,
                'tags': tags,
            })
    
    # Sort by book then by order of appearance
    # Write output
    output = {
        'total': len(all_quotes),
        'themes': list(THEME_KEYWORDS.keys()),
        'quotes': all_quotes,
    }
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f'Extracted {len(all_quotes)} quotes from {len(data["analyzed_books"])} books')
    
    # Print stats
    theme_counts = {}
    for q in all_quotes:
        for t in q['tags']:
            theme_counts[t] = theme_counts.get(t, 0) + 1
    
    print('\nTheme distribution:')
    for theme, count in sorted(theme_counts.items(), key=lambda x: -x[1]):
        print(f'  {theme}: {count}')
    
    # Print sample quotes
    print('\nSample quotes:')
    for q in all_quotes[:5]:
        print(f'  [{",".join(q["tags"])}] {q["book"]}: {q["text"][:80]}...')

if __name__ == '__main__':
    main()
