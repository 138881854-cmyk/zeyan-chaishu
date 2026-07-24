#!/usr/bin/env python3
"""Generate knowledge graph data: nodes (books) and links (relationships)."""
import json, os

BOOKS_PATH = os.path.join(os.path.dirname(__file__), 'data', 'books.json')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'data', 'graph_data.json')

# Define themes/groups
BOOK_THEMES = {
    '斯多葛哲学': ['像哲学家一样生活', '爱比克泰德论说集', '塞涅卡道德书简'],
    '中国哲学': ['老子道德经注', '老子智慧八十一讲', '周易译注', '梁启超讲读王阳明心学', '传习录'],
    '商业管理': ['创新者的窘境', '这就是OKR', '原则', '激荡三十年', '卓有成效的管理者', '创业维艰', '增长黑客', '定位', '苏世民我的经验与教训'],
    '心理学': ['也许你该找个人聊聊', '人性的优点', '人性的弱点', '理解人性', '自控力', '和压力做朋友'],
    '投资财富': ['我从达尔文那里学到的投资知识', '芒格之道', '百万富翁快车道', '赢-有钱人和你想象的不一样', '思考致富'],
    '健康长寿': ['身体重置', '超越百岁'],
    '西方哲学': ['逻辑哲学论', 'Secret Body', '我能否相信自己'],
    '关系与性别': ['亲密关系', '男人来自火星女人来自金星', '第二性'],
    '认知思维': ['金字塔原理'],
    '历史文明': ['历史的教训'],
    '生命科学': ['自私的基因', '进化心理学'],
    '权力与领导': ['权力'],
    '文学经典': ['卡拉马佐夫兄弟'],
}

# Define relationships: (book1, book2, type, description)
RELATIONSHIPS = [
    # 斯多葛递进
    ('像哲学家一样生活', '爱比克泰德论说集', '递进', '入门概论 → 原著原文'),
    ('像哲学家一样生活', '塞涅卡道德书简', '递进', '入门概论 → 原著原文'),
    ('爱比克泰德论说集', '塞涅卡道德书简', '同源', '同属斯多葛学派，爱比克泰德重实践，塞涅卡重思辨'),

    # 中国哲学
    ('老子道德经注', '老子智慧八十一讲', '同源', '同解《道德经》，王弼注 vs 八十一讲'),
    ('老子道德经注', '周易译注', '关联', '道家经典，易老互参'),
    ('梁启超讲读王阳明心学', '传习录', '源流', '心学原著 → 后人解读'),
    ('老子道德经注', '梁启超讲读王阳明心学', '同域', '道家与心学，中国哲学两大脉络'),

    # 商业管理
    ('创新者的窘境', '这就是OKR', '互补', '发现机会 → 执行落地'),
    ('原则', '这就是OKR', '互补', '管理哲学 → 管理工具'),
    ('卓有成效的管理者', '原则', '同域', '管理学经典，德鲁克 vs 达利欧'),
    ('创业维艰', '创新者的窘境', '互补', '实战经验 → 理论框架'),
    ('定位', '增长黑客', '同域', '营销策略：经典定位 vs 增长实战'),
    ('激荡三十年', '原则', '跨域', '中国商业史 vs 个人管理原则'),
    ('苏世民我的经验与教训', '原则', '同域', '投资大佬的管理哲学'),

    # 心理学
    ('人性的优点', '人性的弱点', '同源', '卡耐基经典系列'),
    ('理解人性', '进化心理学', '同域', '人性研究：个体心理学 vs 进化视角'),
    ('自控力', '和压力做朋友', '同域', '自我管理：意志力 vs 压力转化'),

    # 投资财富
    ('芒格之道', '思考致富', '同域', '财富思维：理性投资 vs 心态法则'),
    ('赢-有钱人和你想象的不一样', '百万富翁快车道', '同域', '财富路径认知'),
    ('我从达尔文那里学到的投资知识', '芒格之道', '同域', '投资智慧：进化论视角 vs 跨学科思维'),
    ('芒格之道', '原则', '跨域', '投资思维 → 管理原则'),

    # 健康
    ('身体重置', '超越百岁', '同域', '健康管理：50+逆龄 → 长寿科学'),

    # 西方哲学
    ('逻辑哲学论', 'Secret Body', '同域', '语言哲学 vs 意识哲学'),
    ('Secret Body', '我能否相信自己', '跨域', '意识探索 → 信念本质'),

    # 关系
    ('亲密关系', '男人来自火星女人来自金星', '同域', '两性关系心理学'),
    ('理解人性', '亲密关系', '跨域', '人性理解 → 亲密关系'),

    # 跨主题
    ('历史的教训', '激荡三十年', '跨域', '历史规律 → 中国商业史'),
    ('自私的基因', '进化心理学', '递进', '基因理论 → 心理学应用'),
    ('权力', '原则', '跨域', '权力运作 → 管理原则'),
    ('卡拉马佐夫兄弟', '我能否相信自己', '跨域', '文学信仰 → 哲学信念'),
    ('也许你该找个人聊聊', '我能否相信自己', '跨域', '心理治疗 → 哲学自传'),
    ('金字塔原理', '原则', '跨域', '思维工具 → 决策原则'),
]

# Theme colors (for visualization)
THEME_COLORS = {
    '斯多葛哲学': '#8B6914',
    '中国哲学': '#C0392B',
    '商业管理': '#2E86C1',
    '心理学': '#8E44AD',
    '投资财富': '#27AE60',
    '健康长寿': '#E67E22',
    '西方哲学': '#34495E',
    '关系与性别': '#E74C3C',
    '认知思维': '#16A085',
    '历史文明': '#7F8C8D',
    '生命科学': '#D35400',
    '权力与领导': '#2C3E50',
    '文学经典': '#7D3C98',
}

def main():
    with open(BOOKS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build book lookup
    book_lookup = {b['title']: b for b in data['analyzed_books']}

    # Build theme lookup
    book_to_theme = {}
    for theme, titles in BOOK_THEMES.items():
        for t in titles:
            book_to_theme[t] = theme

    # Build nodes
    nodes = []
    for book in data['analyzed_books']:
        title = book['title']
        theme = book_to_theme.get(title, '其他')
        nodes.append({
            'id': title,
            'title': title,
            'rating': book.get('rating', ''),
            'word_count': book.get('word_count', 0),
            'theme': theme,
            'color': THEME_COLORS.get(theme, '#95A5A6'),
        })

    # Build links
    links = []
    for b1, b2, rel_type, desc in RELATIONSHIPS:
        if b1 in book_lookup and b2 in book_lookup:
            links.append({
                'source': b1,
                'target': b2,
                'type': rel_type,
                'description': desc,
            })

    output = {
        'nodes': nodes,
        'links': links,
        'themes': list(BOOK_THEMES.keys()),
        'theme_colors': THEME_COLORS,
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'Generated graph: {len(nodes)} nodes, {len(links)} links')
    print(f'Themes: {len(BOOK_THEMES)}')
    print(f'\nLink types:')
    type_counts = {}
    for l in links:
        type_counts[l['type']] = type_counts.get(l['type'], 0) + 1
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f'  {t}: {c}')

if __name__ == '__main__':
    main()
