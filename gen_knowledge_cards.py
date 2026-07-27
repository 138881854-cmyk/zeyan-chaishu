#!/usr/bin/env python3
"""
Generate structured knowledge cards from book reading notes.
Each card has: hook (attention grabber), insight (contrarian/surprising), action (concrete steps).
Cards are designed to be reusable as short video content structures.
"""
import json, re, os

def load_books():
    with open('data/books.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_sections(md_content):
    """Split MD content into sections by h2/h3 headings."""
    if not md_content:
        return []
    # Split by ## or ### headings
    parts = re.split(r'^(#{2,3}\s+.+)$', md_content, flags=re.MULTILINE)
    sections = []
    current_heading = ""
    current_body = ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if re.match(r'^#{2,3}\s+', part):
            if current_heading or current_body:
                sections.append({"heading": current_heading, "body": current_body})
            current_heading = re.sub(r'^#{2,3}\s+', '', part)
            current_body = ""
        else:
            current_body += "\n" + part
    if current_heading or current_body:
        sections.append({"heading": current_heading, "body": current_body})
    return sections

def extract_blockquotes(text):
    """Extract blockquote content from MD text."""
    quotes = []
    for line in text.split('\n'):
        line = line.strip()
        if line.startswith('>'):
            quote = line.lstrip('>').strip()
            if len(quote) > 15:
                quotes.append(quote)
    return quotes

def extract_bold_points(text):
    """Extract bold text segments as key points."""
    bolds = re.findall(r'\*\*(.+?)\*\*', text)
    return [b.strip() for b in bolds if len(b.strip()) > 10]

def extract_lists(text):
    """Extract list items as action steps."""
    items = []
    for line in text.split('\n'):
        line = line.strip()
        if re.match(r'^[-*]\s+', line):
            item = re.sub(r'^[-*]\s+', '', line)
            # Clean markdown
            item = re.sub(r'\*\*(.+?)\*\*', r'\1', item)
            item = item.strip()
            if len(item) > 8:
                items.append(item)
    return items

def extract_key_paragraphs(text):
    """Extract paragraphs that contain key insights (longer, substantive paragraphs)."""
    paras = []
    for chunk in text.split('\n\n'):
        chunk = chunk.strip()
        # Skip headings, lists, blockquotes
        if chunk.startswith('#') or chunk.startswith('>') or chunk.startswith('-') or chunk.startswith('*'):
            continue
        # Clean markdown
        clean = re.sub(r'\*\*(.+?)\*\*', r'\1', chunk)
        clean = re.sub(r'`(.+?)`', r'\1', clean)
        clean = clean.strip()
        # Look for insight indicators
        if len(clean) > 50 and any(kw in clean for kw in [
            '因为', '所以', '但是', '然而', '其实', '本质', '核心', '关键',
            '秘密', '真相', '错误', '误区', '真正', '不是', '而是',
            '原则', '法则', '定律', '策略', '方法', '如果', '只有',
            '决定', '选择', '改变', '行动', '做到', '必须', '应该',
            '意味着', '说明', '表明', '发现', '证明', '关键在于'
        ]):
            paras.append(clean)
    return paras

def make_hook(text):
    """Create a hook from a piece of text."""
    # Try to find a question or surprising statement
    sentences = re.split(r'[。！？]', text)
    for s in sentences:
        s = s.strip()
        if len(s) > 10 and len(s) < 60:
            if '?' in s or '？' in s:
                return s + '？'
            if any(kw in s for kw in ['不是', '其实', '真相', '错误', '误区', '秘密', '为什么', '如何']):
                return s + '。'
    # Fallback: take first sentence
    for s in sentences:
        s = s.strip()
        if len(s) > 8:
            return s + '。'
    return text[:50] + '...'

def make_insight(text, bolds, quotes):
    """Create an insight statement."""
    # Priority: blockquote > bold > paragraph
    if quotes:
        # Find the most insightful quote
        for q in quotes:
            if any(kw in q for kw in ['不是', '其实', '本质', '核心', '关键', '真正', '而是', '真相']):
                return q
        return quotes[0]
    if bolds:
        for b in bolds:
            if any(kw in b for kw in ['不是', '其实', '本质', '核心', '关键', '真正', '而是', '真相', '原则', '法则']):
                return b
        return bolds[0]
    return text[:120] + ('...' if len(text) > 120 else '')

def make_action(items, heading, paras):
    """Create action steps."""
    if items and len(items) >= 2:
        # Use list items as actions
        actions = items[:4]
        return actions
    # Generate actions from paragraphs
    actions = []
    for p in paras[:3]:
        # Extract the actionable part
        sentences = re.split(r'[。！]', p)
        for s in sentences:
            s = s.strip()
            if any(kw in s for kw in ['应该', '可以', '需要', '必须', '尝试', '开始', '做到', '练习', '记录', '思考', '行动']):
                if len(s) > 10 and len(s) < 80:
                    actions.append(s + '。')
                    break
    if not actions:
        # Fallback
        actions.append(f"回顾{heading}的核心观点，思考如何应用到当前情境。")
    return actions[:4]

def assign_tags(heading, body, book_title):
    """Assign topic tags to a card."""
    text = (heading + ' ' + body).lower()
    tags = []
    tag_map = {
        '人生': ['人生', '生活', '意义', '幸福', '快乐', '痛苦', '成长'],
        '哲学': ['哲学', '斯多葛', '老子', '道德经', '心学', '王阳明', '周易', '思想家', '智慧'],
        '商业': ['商业', '企业', '创新', '竞争', '市场', '产品', '客户', '战略', '管理', '组织'],
        '投资': ['投资', '股票', '风险', '收益', '资产', '复利', '价值', '巴菲特'],
        '健康': ['健康', '身体', '饮食', '运动', '睡眠', '衰老', '逆龄', '代谢'],
        '关系': ['关系', '人际', '沟通', '家庭', '朋友', '社交', '情感'],
        '心理': ['心理', '情绪', '焦虑', '恐惧', '认知', '偏见', '决策', '习惯', '意志力'],
        '学习': ['学习', '知识', '阅读', '思考', '方法', '记忆', '技能', '刻意练习'],
        '领导力': ['领导', '管理', '团队', 'OKR', '目标', '激励', '文化', '决策'],
        '历史': ['历史', '朝代', '战争', '文明', '帝国', '革命', '时代'],
    }
    for tag, keywords in tag_map.items():
        if any(kw in text for kw in keywords):
            tags.append(tag)
    if not tags:
        tags.append('通识')
    return tags[:3]

def generate_cards_for_book(book):
    """Generate knowledge cards for a single book."""
    cards = []
    md = book.get('md_content', '')
    if not md:
        return cards

    title = book.get('title', '')
    rating = book.get('rating', '')
    sections = extract_sections(md)

    for section in sections:
        heading = section['heading'].strip()
        body = section['body'].strip()
        if not heading or len(body) < 80:
            continue

        # Extract components
        quotes = extract_blockquotes(body)
        bolds = extract_bold_points(body)
        items = extract_lists(body)
        paras = extract_key_paragraphs(body)

        if not quotes and not bolds and not paras:
            continue

        # Build card
        hook = make_hook(paras[0] if paras else (bolds[0] if bolds else heading))
        insight = make_insight(paras[0] if paras else '', bolds, quotes)
        actions = make_action(items, heading, paras)
        tags = assign_tags(heading, body, title)

        # Create a concise topic
        topic = heading if len(heading) <= 20 else heading[:18] + '...'

        card = {
            'id': f"{title}_{len(cards)}",
            'book': title,
            'rating': rating,
            'topic': topic,
            'hook': hook,
            'insight': insight,
            'action': actions,
            'tags': tags,
            'question': f"关于「{topic}」，{title}给出了什么洞见？",
        }
        cards.append(card)

    return cards

def main():
    data = load_books()
    books = data.get('analyzed_books', [])
    all_cards = []

    for book in books:
        cards = generate_cards_for_book(book)
        all_cards.extend(cards)

    # Sort by book then by topic
    all_cards.sort(key=lambda c: (c['book'], c['topic']))

    # Save
    output = {
        'total': len(all_cards),
        'books': len(set(c['book'] for c in all_cards)),
        'cards': all_cards
    }

    with open('data/knowledge_cards.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Generated {len(all_cards)} knowledge cards from {len(set(c['book'] for c in all_cards))} books")

    # Stats by tag
    tag_counts = {}
    for c in all_cards:
        for t in c['tags']:
            tag_counts[t] = tag_counts.get(t, 0) + 1
    print("\nCards by tag:")
    for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
        print(f"  {tag}: {count}")

    # Sample cards
    print("\nSample cards:")
    for c in all_cards[:3]:
        print(f"\n  [{c['book']}] {c['topic']}")
        print(f"  Hook: {c['hook'][:60]}")
        print(f"  Insight: {c['insight'][:60]}")
        print(f"  Actions: {len(c['action'])} steps")

if __name__ == '__main__':
    main()
