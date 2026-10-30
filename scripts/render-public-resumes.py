"""Regenerate the public PDF CVs from their maintained HTML editions.

Requires reportlab. Run from any directory with Python 3.
"""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]

class Blocks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.parts = []
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.current is None and (tag in ['h1', 'h2', 'h3', 'p', 'li'] or (tag == 'span' and attrs.get('class') == 'meta')):
            self.current = tag
            self.parts = []
        elif self.current:
            if tag == 'a':
                self.parts.append('<a color="#086f77" href="' + escape(attrs['href'], quote=True) + '">')
            elif tag == 'strong':
                self.parts.append('<b>')
            elif tag == 'span':
                self.parts.append(' ')

    def handle_endtag(self, tag):
        if tag == self.current:
            value = ' '.join(''.join(self.parts).split())
            self.blocks.append((tag, value))
            self.current = None
        elif self.current and tag == 'a':
            self.parts.append('</a>')
        elif self.current and tag == 'strong':
            self.parts.append('</b>')
        elif self.current and tag == 'span':
            self.parts.append(' · ')

    def handle_data(self, data):
        if self.current:
            self.parts.append(escape(data.replace('–', '-').replace('—', '-')))

def render(lang):
    source = ROOT / 'public/resume' / f'chakib-belgaid-product-engineer-{lang}.html'
    parser = Blocks()
    parser.feed(source.read_text())
    font_dir = Path('/usr/share/fonts/truetype/dejavu')
    if (font_dir / 'DejaVuSans.ttf').exists():
        pdfmetrics.registerFont(TTFont('Resume', str(font_dir / 'DejaVuSans.ttf')))
        pdfmetrics.registerFont(TTFont('Resume-Bold', str(font_dir / 'DejaVuSans-Bold.ttf')))
        pdfmetrics.registerFontFamily('Resume', normal='Resume', bold='Resume-Bold')
        font, bold = 'Resume', 'Resume-Bold'
    else:
        font, bold = 'Helvetica', 'Helvetica-Bold'
    body = ParagraphStyle('body', fontName=font, fontSize=9.1, leading=13, spaceAfter=5, textColor=HexColor('#142126'))
    styles = {
        'p': body,
        'span': ParagraphStyle('meta', parent=body, fontSize=8.5, textColor=HexColor('#53686d'), spaceAfter=5),
        'li': ParagraphStyle('bullet', parent=body, leftIndent=9, firstLineIndent=-7, spaceAfter=4),
        'h1': ParagraphStyle('name', parent=body, fontName=bold, fontSize=20, leading=24, spaceAfter=8, keepWithNext=True),
        'h2': ParagraphStyle('section', parent=body, fontName=bold, fontSize=11, leading=15, textColor=HexColor('#086f77'), spaceBefore=12, spaceAfter=7, keepWithNext=True),
        'h3': ParagraphStyle('entry', parent=body, fontName=bold, fontSize=9.5, leading=13, spaceBefore=6, spaceAfter=3, keepWithNext=True),
    }
    story = []
    for tag, value in parser.blocks:
        if not value:
            continue
        if tag == 'h2' and value in ['Selected projects', 'Projets sélectionnés']:
            story.append(PageBreak())
        if tag == 'li':
            value = '• ' + value
        story.append(Paragraph(value, styles[tag]))
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(font, 8)
        canvas.setFillColor(HexColor('#53686d'))
        canvas.drawString(40, 24, 'Chakib Belgaid | October 2026' if lang == 'en' else 'Chakib Belgaid | Octobre 2026')
        canvas.drawRightString(A4[0]-40, 24, str(doc.page))
        canvas.restoreState()
    doc = SimpleDocTemplate(str(source.with_suffix('.pdf')), pagesize=A4, rightMargin=40, leftMargin=40, topMargin=36, bottomMargin=42, title='Mohammed Chakib Belgaid - Applied AI and software engineering', author='Mohammed Chakib Belgaid')
    doc.build(story, onFirstPage=footer, onLaterPages=footer)

if __name__ == '__main__':
    for language in ['en', 'fr']:
        render(language)
