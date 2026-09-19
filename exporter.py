import math
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def generate_srt(lines):
    def format_time(seconds):
        hrs = math.floor(seconds / 3600)
        mins = math.floor((seconds % 3600) / 60)
        secs = math.floor(seconds % 60)
        return f"{hrs:02d}:{mins:02d}:{secs:02d},000"

    content = ""
    for index, line in enumerate(lines):
        start_time = format_time(index * 4)
        end_time = format_time(index * 4 + 3)
        content += f"{index + 1}\n{start_time} --> {end_time}\n{line['cleanText']}\n\n"
    return content

def create_ruby_element(base_text, ruby_text):
    # Create w:ruby element
    ruby = OxmlElement('w:ruby')
    
    # Create w:rubyPr (Properties)
    rubyPr = OxmlElement('w:rubyPr')
    
    rubyAlign = OxmlElement('w:rubyAlign')
    rubyAlign.set(qn('w:val'), 'center')
    rubyPr.append(rubyAlign)
    
    hps = OxmlElement('w:hps') # Ruby text size (half-points)
    hps.set(qn('w:val'), '10') # 5pt
    rubyPr.append(hps)
    
    hpsRaise = OxmlElement('w:hpsRaise')
    hpsRaise.set(qn('w:val'), '20')
    rubyPr.append(hpsRaise)
    
    hpsBaseText = OxmlElement('w:hpsBaseText') # Base text size
    hpsBaseText.set(qn('w:val'), '24') # 12pt
    rubyPr.append(hpsBaseText)
    
    lid = OxmlElement('w:lid')
    lid.set(qn('w:val'), 'ja-JP')
    rubyPr.append(lid)
    
    ruby.append(rubyPr)
    
    # Create w:rt (Ruby Text)
    rt = OxmlElement('w:rt')
    r_rt = OxmlElement('w:r')
    rPr_rt = OxmlElement('w:rPr')
    rFonts_rt = OxmlElement('w:rFonts')
    rFonts_rt.set(qn('w:hint'), 'eastAsia')
    rPr_rt.append(rFonts_rt)
    r_rt.append(rPr_rt)
    t_rt = OxmlElement('w:t')
    t_rt.text = ruby_text
    r_rt.append(t_rt)
    rt.append(r_rt)
    ruby.append(rt)
    
    # Create w:rubyBase (Base Text)
    rubyBase = OxmlElement('w:rubyBase')
    r_base = OxmlElement('w:r')
    rPr_base = OxmlElement('w:rPr')
    rFonts_base = OxmlElement('w:rFonts')
    rFonts_base.set(qn('w:hint'), 'eastAsia')
    rPr_base.append(rFonts_base)
    r_base.append(rPr_base)
    t_base = OxmlElement('w:t')
    t_base.text = base_text
    r_base.append(t_base)
    rubyBase.append(r_base)
    ruby.append(rubyBase)
    
    return ruby

def generate_docx(lines, output_path, font_size_pt=12, title='日语假名配音台本'):
    doc = Document()
    
    style = doc.styles['Normal']
    font = style.font
    # Set default font to MS Mincho or similar for Japanese
    font.name = 'MS Mincho'
    
    doc.add_heading(title or '日语假名配音台本', 0)
    
    for line in lines:
        p = doc.add_paragraph()
        for token in line['tokens']:
            if token.get('ruby'):
                # Add ruby text
                ruby_el = create_ruby_element(token['surface'], token['ruby'])
                p._p.append(ruby_el)
            else:
                # Add normal text
                run = p.add_run(token['surface'])
                run.font.size = font_size_pt * 12700  # Size in twips, approximately (pt * 12700? No, Pt class handles this. But let's just use docx.shared.Pt)
                # Let's fix the font size approach:
                from docx.shared import Pt
                run.font.size = Pt(font_size_pt)

    doc.save(output_path)

def generate_txt(lines):
    content = ""
    for line in lines:
        ruby_text = ""
        for t in line['tokens']:
            if t.get('ruby'):
                ruby_text += f"{t['surface']}({t['ruby']})"
            else:
                ruby_text += t['surface']
        content += ruby_text + "\n"
    return content
