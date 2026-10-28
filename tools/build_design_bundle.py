#!/usr/bin/env python3
"""
生成「微金100 · UI 设计稿整合版」：把 5 份 *_设计稿.html 合成一个文件，并同步 2026-10 合规改造。

- 每个模块原样嵌入 iframe（各自 CSS/批注脚本互不干扰），外壳提供：本次变更说明、模块切换、
  「显示改动」对照开关、全部批注一键导出。
- 合规改造在构建时作用到设计稿文案上：换词（锁价→下单 等）、隐藏保证金/佣金相关块、
  保证金三屏标「本期暂停」、代交接服务费改线下结算、去掉「担保」。
  每处改动带 class（chg / chg-block / chg-del），打开「显示改动」即可看到原文。
- 原 5 份设计稿不改动；改规则改本脚本后重跑即可。

用法（需 bs4，系统自带 python3 已装）：
    /usr/bin/python3 tools/build_design_bundle.py
输出：微金100_设计稿整合版.html（仓库根目录）
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '微金100_设计稿整合版.html'
VERSION = 'v2 · ' + date.today().isoformat()

MODULES = [
    # key, 源文件, 标签名, 新 STORE_KEY
    ('home', '首页_设计稿.html', '首页 · 金价', 'wj-v2-home'),
    ('lock', '买家锁价_设计稿.html', '买家下单', 'wj-v2-lock'),
    ('mine', '我的_设计稿.html', '我的', 'wj-v2-mine'),
    ('order', '我的订单_设计稿.html', '我的订单', 'wj-v2-order'),
    ('pub', '货品发布功能_设计稿.html', '货品发布', 'wj-v2-pub'),
]

# ───────────────────────── 1. 换词表（全部模块；长词优先匹配） ─────────────────────────
# 值为 None 表示删除该片段（构建为 chg-del，默认隐藏、对照模式可见）。
COMMON_MAP = {
    # 锁价 → 下单
    '锁价待处理': '待交货',
    '确认锁价订单': '确认订单',
    '锁价订单详情': '待交货订单详情',
    '锁价订单': '订单',
    '确认锁价': '确认下单',
    '锁价主页': '下单页',
    '锁价处理中': '下单处理中',
    '锁价成功': '下单成功',
    '锁价失败': '下单失败',
    '锁价结果': '下单结果',
    '正在锁价校验': '正在提交订单',
    '买家锁价': '买家下单',
    '已被锁价': '已有买家下单',
    '已近锁价': '已有买家下单',
    '未被锁价': '暂无买家下单',
    '被锁价后': '有买家下单后',
    '分单锁价': '分批下单',
    '锁价时刻': '下单时刻',
    '普通锁价': '普通订单',
    '锁价': '下单',
    '未锁单前': '买家下单前',
    '已锁单': '已下单',
    '订单锁单': '订单提交',
    '锁单交割': '线下交货',
    '锁单': '下单',
    '须全量锁定': '须全量下单',
    '抢先锁定': '抢先下单',
    # 交割 → 交货
    '交割': '交货',
    # 大盘 → 参考价 / 金价卡
    '金价大盘卡': '金价卡',
    '大盘金价卡': '金价卡',
    '大盘金价': '市场参考价',
    '大盘卡': '金价卡',
    '大盘价': '参考价',
    '大盘': '参考价',
    # 行情 → 金价
    '行情大厅': '金价大厅',
    '黄金行情': '黄金价格',
    '白银行情': '白银价格',
    '铂金行情': '铂金价格',
    '实时行情': '实时金价',
    '行情列表': '挂单列表',
    '行情查询': '金价查询',
    '首页行情（金价': '首页金价（价格',
    '首页行情': '首页金价',
    '行情': '金价',
    '撮合': '信息发布',
    # 担保 / 平台定位
    '交易担保与违约追责': '交易核验与违约追责',
    '实名仅用于担保': '实名仅用于交易核验',
    '全程平台担保': '全程平台跟进',
    '全程担保': '全程跟进',
    '担保服务': '代交接服务',
    '担保中': '进行中',
    '现货交易平台': '现货信息服务平台',
}

MODULE_MAP = {
    'lock': {'剩余可锁价': '剩余可购', '剩余可锁': '剩余可购', '可锁价数量': '可购数量', '可锁价': '可购', '可锁': '可购'},
    'order': {
        '剩余可锁价': '剩余可售', '剩余可锁': '剩余可售',
        '支付 ¥100 并申请': '提交申请',
        '查看流程并支付': '查看流程并申请',
        '发起方支付（可协商分摊）': '线下结算、发起方承担（可协商分摊）',
        '¥100 已付': '¥100 线下结算',
    },
    'mine': {
        '级别与佣金': '我的级别',
        '级别 · 佣金': '级别',
        '三大制度一览': '制度一览',
        '资产与交易': '交易',
        '（交易仍需按克重缴纳保证金）': None,
        '交易时按克重缴保证金。': None,
        '，降级后按新级别佣金计费': None,
        '，不与保证金联动': None,
    },
    'pub': {'实名 + 电话/微信 + 保证金': '实名 + 电话/微信'},
}

SUSPEND_WHY = '本期暂停：平台暂不经手用户资金（无增值电信业务经营许可证），取得许可证后恢复'


# ───────────────────────── 2. 元素级改动（按模块） ─────────────────────────
class Mod:
    def __init__(self, key, soup):
        self.key, self.soup, self.log = key, soup, []

    def root(self, where):
        if where == 0:
            return self.soup.select_one('div.intro')
        return self.soup.select('div.screen')[where - 1]

    def find(self, where, sel, kw, count=1):
        els = [e for e in self.root(where).select(sel) if kw in e.get_text()]
        # 只保留最内层匹配（选择器同时命中祖先与后代时取后代）
        els = [e for e in els if not any(kw in c.get_text() for c in e.select(sel))]
        if len(els) != count:
            sys.exit(f'[{self.key}] 屏{where} {sel} 含「{kw}」应命中 {count} 个，实际 {len(els)}')
        return els

    @staticmethod
    def plain(el):
        return re.sub(r'\s+', ' ', el.get_text(' ', strip=True))

    def hide(self, where, sel, kw, why, count=1):
        for el in self.find(where, sel, kw, count):
            el['class'] = el.get('class', []) + ['chg-del']
            el['title'] = '本期隐藏：' + why
            self.log.append(('隐藏', where, self.plain(el)[:60], why))

    def rewrite(self, where, sel, kw, html, count=1, keep=('pin', 'n', 'ic')):
        for el in self.find(where, sel, kw, count):
            old = self.plain(el)
            kept = [c for c in el.find_all(recursive=False) if set(c.get('class', [])) & set(keep)]
            el.clear()
            for c in kept:
                el.append(c)
            frag = BeautifulSoup(f'<span class="chg-block" title="原：{_attr(old)}">{html}</span>', 'html.parser')
            el.append(frag)
            self.log.append(('改写', where, old[:60], re.sub('<[^>]+>', '', html)[:60]))

    def suspend(self, where):
        sc = self.root(where)
        sc['class'] = sc.get('class', []) + ['chg-susp']
        rib = BeautifulSoup('<div class="susp-ribbon"><b>⏸ 本期暂停</b>平台暂不经手用户资金<br>取得增值电信业务经营许可证后恢复</div>',
                            'html.parser')
        sc.append(rib)
        self.log.append(('暂停整屏', where, self.plain(sc.select_one('.cap'))[:60], ''))

    def susp_tags(self, nums):
        for span in self.soup.select('div.intro .flow-tags span'):
            if span.get_text(strip=True)[:1] in nums:
                span['class'] = span.get('class', []) + ['chg-susp-tag']
                span['title'] = SUSPEND_WHY


def _attr(s):
    return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


def ops_home(m: Mod):
    m.rewrite(0, 'td.x', '静默校验实名 + 保证金', '→ 静默校验实名 + 联系方式')


def ops_lock(m: Mod):
    m.rewrite(0, 'p', '跳转规则', (
        '<b style="color:var(--gold-3)">跳转规则（无弹窗）：</b><br>'
        '· <b>下单（买家）</b>：点「确认下单」时<b>静默校验联系方式</b>（手机 / 微信）→ 未填则<b>直接路由跳转</b>'
        '「我的 - 我的信息」补全 → 返回保留数量 → 再点直接进屏 ④。<br>'
        '· <b>发布货品（卖家）</b>：需补全<b>实名 + 联系方式</b>（详见货品发布稿）。<br>'
        '· <b>本期取消保证金</b>：原「购买上限 = 等级 + 保证金」提示与「补足保证金 →」跳转已移除，购买数量只受挂单库存约束。<br>'
        '<b style="color:var(--up)">所有补全页 UI（我的信息 等）均不在本稿绘制，属「我的」模块单独设计。</b>'))
    for s in (1, 2, 3):
        m.hide(s, '.phone .level-hint', '保证金', '保证金关闭，不再按保证金计算购买上限')
        m.hide(s, '.notes li', '可购买上限', '保证金关闭，不再按保证金计算购买上限')
    m.rewrite(1, '.notes li', '锁价仅校验联系方式', (
        '「确认下单」点击后系统<b>静默校验联系方式（手机 / 微信）</b>：<br>'
        '· <b>已填写</b> → 弹出订单确认（屏 ④）；<br>'
        '· <b>未填写</b> → <b>直接路由跳转</b>到「我的 - 我的信息」（不弹窗、不浮层），补完返回本页保留已填数量，再点「确认下单」直接进屏 ④。<br>'
        '· 下单仅校验联系方式（卖家需要电话/微信对接交货）；本期不校验保证金。<br>'
        '· 我的信息录入 UI <b>不在本稿绘制</b>，属「我的」模块，留待该模块单独设计。'))
    for s in (6, 7):
        m.rewrite(s, '.phone span', '解冻冻结保证金', (
            '尊敬的买卖双方，本次下单已成功！线下实物交货完成后，请双方前往平台<b>【我的订单】</b>'
            '同步点击确认收货、完成交易，系统核验无误后将<b>解除相关操作限制</b>。'), keep=())
        m.rewrite(s, '.phone li', '持续冻结保证金', '订单交货完毕逾期未手动确认，平台将<b>持续限制相关操作权限</b>；', keep=())
    m.rewrite(6, '.notes li', '锁价成功温馨提示', (
        '<b>下单成功温馨提示</b>（橙色卡）：交货后双方须到「我的订单」点确认收货完成交易，系统核验后解除限制；'
        '重要提醒两条——逾期未确认持续限制操作；异议申诉 72 小时内，超时自动判定完结、平台不再介入。'))


def ops_mine(m: Mod):
    m.rewrite(0, 'h1', '保证金 / 级别 / 违约', '我的（个人中心）· 级别 / 违约 制度 v3', keep=())
    m.rewrite(0, 'p', '个人中心聚合', (
        '个人中心聚合<b>个人信息</b>、<b>级别</b>、<b>违约管理</b>。级别 L1-L9 由累计交易笔数决定；'
        '违约按次数<b>限制 + 降级</b>。<b style="color:var(--up)">本期取消保证金与佣金展示</b>（平台不经手用户资金），'
        '原保证金三屏（⑤⑥⑦）保留为灰色「暂停」稿，取得许可证后恢复。<br>'
        '右上角双开关：<b style="color:var(--note)">设计说明</b>（S 键）／<b style="color:#3E63C7">批注模式</b>（A 键）。'), keep=())
    m.hide(0, '.rc-cell', '按克重足额缴纳', '保证金关闭')
    m.rewrite(0, '.rc-cell h4', '笔数升级', '📈 笔数升级', keep=())
    m.rewrite(0, '.rc-cell p', '只与', (
        '级别 <b>L1–L9</b> 只与<b>累计交易笔数</b>挂钩，<b>每 10 笔升 1 级</b>（买卖双方完成即计数）。本期免佣，不展示佣金费率。'), keep=())
    m.rewrite(0, '.rc-cell h4', '扣保证金', '⚠️ 限制 + 降级', keep=())
    m.rewrite(0, '.rc-cell p', '违约按克重扣保证金', (
        '累计 1/2/3/4+ 次分别<b>限制发布 3/7/15/30 天</b>、<b>降 1/2/3 级 / 清零至 L1</b>。'
        '<b>每 30 笔无违约</b>自动消除 1 条最早记录。本期不扣款、不赔付。'), keep=())
    m.susp_tags('⑤⑥⑦')

    # 屏1 我的主页
    m.rewrite(1, '.cap .d', '保证金', '笔数级别', keep=())
    m.hide(1, '.phone .dep-hero', '我的保证金', '保证金关闭')
    m.hide(1, '.phone .menu-row', '保证金与额度', '保证金关闭')
    m.hide(1, '.notes li', '保证金金卡', '保证金关闭')
    m.rewrite(1, '.notes li', '资产与交易', (
        '<b>交易</b>：<b>我的级别</b>（紫徽 L2 + 累计 13 笔，屏⑧）/ 我的订单 / <b>违约记录</b>（红徽次数，屏⑨）。'
        '本期取消保证金，不展示「保证金与额度」入口。'))
    # 屏5–7 保证金三屏：整屏暂停
    for s in (5, 6, 7):
        m.suspend(s)
    # 屏8 级别
    m.rewrite(8, '.cap .d', '佣金', '笔数升级 L1-L9', keep=())
    m.rewrite(8, '.phone .warm-tip', '运营期全场免佣', '每完成 <b>10 笔</b>成交升 1 级，买卖双方完成交易各计 1 笔。')
    m.hide(8, '.phone .sec', '佣金费率表', '本期免佣，线上不收费，不展示费率')
    m.hide(8, '.phone .fee-tbl', 'L1', '本期免佣，线上不收费，不展示费率')
    m.hide(8, '.notes li', '佣金费率表', '本期免佣，线上不收费，不展示费率')
    # 屏9 违约记录
    m.rewrite(9, '.phone div', '保证金扣除', '· 限制期内不能发布挂单、不能下单，<b>可查看金价、管理已有订单</b>。', keep=())
    m.hide(9, '.phone .vc-deduct', '扣除保证金', '违约不再扣保证金')
    m.rewrite(9, '.notes li', '违约处罚规则表', (
        '<b>违约处罚规则表（来自 CSV）</b>：1/2/3/4+ 次 → 限制 3/7/15/30 天 + 降 1/2/3 级 / 清零至 L1。表下注：限制期可看金价、管已有订单。'))
    m.rewrite(9, '.notes li', '违约明细卡', (
        '违约明细卡：类型 + 角色 + 时间；商品克重；处罚标签（限制天数/降级）；关联订单；「查看详情」→ 屏⑩。已撤销记录置灰显示「已撤销处罚」。'))
    # 屏10 违约详情
    m.rewrite(10, '.cap .d', '扣保证金', '处罚明细 + ⚠️ 判定弹窗', keep=())
    m.hide(10, '.phone .field', '扣除保证金', '违约不再扣保证金')
    m.hide(10, '.phone .pl-item', '扣除保证金', '违约不再扣保证金')
    m.rewrite(10, '.notes li', '处罚三连', (
        '<b>处罚两项</b>：功能限制 3 天（不能发布/下单）/ 信用降级（降 1 级 L2→L1）。天数与降级随违约次数动态；本期不扣保证金。'))


def ops_order(m: Mod):
    m.rewrite(9, '.phone .cf-item', '由发起方支付', '服务费 <b>¥100 / 单</b>，<b>线下结算</b>，由发起方承担（可与对方协商分摊）')
    m.rewrite(9, '.phone .sd', '代收代付', '核验通过即通知买家线下打款，<b>订单即完成</b>', keep=())
    m.rewrite(9, '.phone .sd', '不影响交易完成与保证金', '仅物流配送，不影响交易完成', keep=())
    m.rewrite(9, '.notes li', '4 步流程图', (
        '<b>4 步流程图</b>（竖向）：<b>卖家送货到服务点</b>（水贝现货就近送货）→ 平台看货核验 → '
        '<b style="color:#1d8a52">买家线下打款·交易完成（订单即完成）</b> → 平台发货给买家（仅配送）。<br>'
        '<b style="color:var(--note)">关键逻辑：验货通过 + 买家打款即交货完成；平台发货只是后续配送，不再以买家收货为完成条件。</b>'))
    m.rewrite(10, '.phone .sd', '释放双方保证金', '核验通过即通知买家线下打款，<b>订单完成</b>', keep=())
    m.rewrite(10, '.phone .warm-tip', '平台验货通过', (
        '<b>平台验货通过 + 买家打款即视为交货完成</b>，订单<b>立即确认完成</b>；之后平台发货仅为配送，'
        '<b>无需等买家收货</b>。核验异常将通知双方协商或转仲裁。服务费 ¥100 线下结算。'))
    m.rewrite(10, '.notes li', '已转代交接', (
        '<b>已转代交接（待交接态）的订单详情：直接展示代交接，无交货方式二选一、无当面自交选项</b>。'
        '顶部蓝色「交货方式已锁定」条强调不可改回自交。<b>交接进度（竖向 4 步）</b>：卖家送货到服务点 → 平台看货核验 → '
        '<b style="color:#1d8a52">买家线下打款·交易完成</b> → 平台发货（仅配送）。'
        '<b style="color:var(--note)">验货 + 打款即完成，不等买家收货</b>。状态条蓝色区别于普通订单。'))


def ops_pub(m: Mod):
    m.rewrite(1, '.notes li', '同意并继续」时优先', (
        '<b>点击底部「同意并继续」时优先做卖家资料校验</b>（实名 + 联系电话/微信）：<br>'
        '· <b>齐全</b> → 进入发布表单（屏②）；<br>'
        '· <b>不全（如未填电话/微信）</b> → <b>直接路由跳转「我的 - 我的信息」</b>补全后返回，保留已选内容再继续。<br>'
        '· <b>商家电话/微信即在「我的 - 我的信息」录入</b>（该页属"我的"模块，<b>不在本稿绘制</b>）。'
        '校验在此入口优先拦截，避免进入表单后才发现资料缺失。本期不校验保证金。'))
    m.hide(2, '.phone .level-hint', '保证金', '保证金关闭，不再按保证金计算发布上限')
    m.hide(2, '.notes li', '可发布上限', '保证金关闭，不再按保证金计算发布上限')


OPS = {'home': ops_home, 'lock': ops_lock, 'mine': ops_mine, 'order': ops_order, 'pub': ops_pub}


# ───────────────────────── 3. 文本换词 ─────────────────────────
def replace_text(soup, mapping, log):
    keys = sorted(mapping, key=len, reverse=True)
    rx = re.compile('|'.join(map(re.escape, keys)))
    skip_tags = {'script', 'style'}
    for node in list(soup.find_all(string=rx)):
        if isinstance(node, Comment):
            continue
        p = node.parent
        if p is None or p.name in skip_tags:
            continue
        if any('chg-del' in (a.get('class') or []) for a in node.parents if a.name):
            continue  # 隐藏块保留原文，便于对照
        text = str(node)
        if p.name in ('title', 'textarea'):  # 纯文本容器：只换词，不能插标签
            node.replace_with(rx.sub(lambda m_: mapping[m_.group(0)] or '', text))
            continue
        pieces, last = [], 0
        for mt in rx.finditer(text):
            old, new = mt.group(0), mapping[mt.group(0)]
            pieces.append(NavigableString(text[last:mt.start()]))
            if new is None:
                tag = soup.new_tag('span', attrs={'class': 'chg-del', 'title': '本期删除'})
                tag.string = old
            else:
                tag = soup.new_tag('span', attrs={'class': 'chg', 'title': '原：' + old})
                tag.string = new
            pieces.append(tag)
            log[(old, new)] = log.get((old, new), 0) + 1
            last = mt.end()
        pieces.append(NavigableString(text[last:]))
        for piece in pieces:
            node.insert_before(piece)
        node.extract()


# ───────────────────────── 4. 注入模块的样式与桥接脚本 ─────────────────────────
MODULE_CSS = """
.chg,.chg-block{transition:background .2s}
body.show-chg .chg,body.show-chg .chg-block{background:#FFF1A8;box-shadow:0 0 0 1px #E8C94A;border-radius:3px;cursor:help}
body:not(.show-chg) .chg-del{display:none!important}
body.show-chg .chg-del{outline:2px dashed #E0492F;outline-offset:1px;background:rgba(224,73,47,.07);text-decoration:line-through;text-decoration-color:rgba(224,73,47,.6);cursor:help}
.screen.chg-susp .phone{filter:grayscale(1);opacity:.5}
.screen.chg-susp .notes{opacity:.55}
.screen.chg-susp{position:relative}
.susp-ribbon{position:absolute;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-8deg);z-index:6;pointer-events:none;width:270px;padding:10px 14px;border-radius:12px;background:rgba(253,236,234,.96);color:#B23A27;border:2px solid #E0492F;box-shadow:0 6px 18px rgba(178,58,39,.18);text-align:center;font-size:11.5px;line-height:1.5}
.susp-ribbon b{display:block;font-size:20px;letter-spacing:2px;margin-bottom:2px}
.chg-susp-tag{text-decoration:line-through;opacity:.55}
"""

MODULE_JS = """
(function(){
  var MOD = '%s';
  function post(m){ try { parent.postMessage(m, '*'); } catch(e){} }
  var _save = window.saveComments;
  window.saveComments = function(){ _save(); post({type:'wj-save', module:MOD, comments:comments}); };
  window.addEventListener('message', function(e){
    var d = e.data || {};
    if(d.type === 'wj-chg') document.body.classList.toggle('show-chg', !!d.on);
    if(d.type === 'wj-load' && d.module === MOD && d.comments){
      var apply = function(){
        comments = d.comments;
        try { localStorage.setItem(STORE_KEY, JSON.stringify(comments)); } catch(err){}
        renderAllPins(); updateCount();
      };
      // 批注系统在 DOMContentLoaded 初始化；未就绪则排在其后执行
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
    }
  });
  var titles = [].map.call(document.querySelectorAll('.screen'), function(s, i){
    var t = s.querySelector('.cap .t'); return t ? t.textContent.trim() : '第' + (i + 1) + '屏';
  });
  post({type:'wj-ready', module:MOD, titles:titles});
})();
"""


def build_module(key, src, store_key):
    html = (ROOT / src).read_text(encoding='utf-8')
    html = re.sub(r"var STORE_KEY = '[^']*';", f"var STORE_KEY = '{store_key}';", html, count=1)
    soup = BeautifulSoup(html, 'html.parser')
    m = Mod(key, soup)
    OPS[key](m)
    words = {}
    replace_text(soup, {**COMMON_MAP, **MODULE_MAP.get(key, {})}, words)
    style = soup.new_tag('style')
    style.string = MODULE_CSS
    soup.head.append(style)
    script = soup.new_tag('script')
    script.string = MODULE_JS % key
    soup.body.append(script)
    return str(soup), m.log, words


# ───────────────────────── 5. 外壳页 ─────────────────────────
def build_shell(modules):
    data = {k: v for k, v in modules.items()}
    payload = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
    tabs = ''.join(f'<button class="tab" data-mod="{k}">{label}<span class="badge" id="bd-{k}"></span></button>'
                   for k, _, label, _ in MODULES)
    names = json.dumps({k: label for k, _, label, _ in MODULES}, ensure_ascii=False)
    shell = (ROOT / 'tools' / 'design_bundle_shell.html').read_text(encoding='utf-8')
    return (shell.replace('{{VERSION}}', VERSION)
                 .replace('{{TABS}}', tabs)
                 .replace('{{NAMES}}', names)
                 .replace('{{PAYLOAD}}', payload))


def main():
    modules, report = {}, []
    for key, src, label, store_key in MODULES:
        html, log, words = build_module(key, src, store_key)
        modules[key] = html
        report.append((label, log, words))
    OUT.write_text(build_shell(modules), encoding='utf-8')
    for label, log, words in report:
        print(f'\n== {label}：元素改动 {len(log)} 处，换词 {sum(words.values())} 处')
        for kind, where, old, new in log:
            print(f'  [{kind}] 屏{where}：{old}' + (f'  →  {new}' if new else ''))
    print(f'\n已生成 {OUT.name}（{OUT.stat().st_size // 1024} KB）')


if __name__ == '__main__':
    main()
