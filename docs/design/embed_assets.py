from pathlib import Path
import re, base64

root = Path(__file__).resolve().parents[2]
preview = Path(__file__).with_name('login-preview.html')
css_path = next((root/'web/.next/dev/static/chunks').glob('*prompt*.css'))
css = css_path.read_text(encoding='utf-8')
faces = '\n'.join(re.findall(r'@font-face\s*\{[^}]+\}', css))
def font(match):
    path = (css_path.parent/match.group(1)).resolve()
    return 'url("data:font/woff2;base64,' + base64.b64encode(path.read_bytes()).decode() + '")'
faces = re.sub(r'url\("([^\"]+)"\)', font, faces)
content = preview.read_text(encoding='utf-8')
content = re.sub(r'<style id="embedded-fonts">.*?</style>', '', content, flags=re.S)
content = content.replace('</head>', '<style id="embedded-fonts">'+faces+'</style></head>')
for name in ('nso-white.png','gdcatalog-white.png'):
    data = base64.b64encode((root/'web/public/brand'/name).read_bytes()).decode()
    content = content.replace('../../web/public/brand/'+name, 'data:image/png;base64,'+data)
preview.write_text(content, encoding='utf-8')
print('Embedded existing Prompt fonts and official project logos; preview is standalone.')
