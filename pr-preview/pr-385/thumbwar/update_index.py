#!/usr/bin/env python3
"""
Auto-update thumbwar/index.html with discovered HTML files
Run this script whenever you add new HTML files to thumbwar/
"""

import os
import glob
import re

def get_html_files():
    """Get all HTML files in current directory except index.html"""
    html_files = []
    for file in glob.glob("*.html"):
        if file != "index.html":
            # Convert filename to display name
            name = file.replace('.html', '').replace('_', ' ').replace('-', ' ')
            name = ' '.join(word.capitalize() for word in name.split())
            html_files.append({'file': file, 'name': name})
    return sorted(html_files, key=lambda x: x['file'])

def update_index_html(html_files):
    """Update index.html with the discovered files"""
    # Generate JavaScript array
    js_array = "[\n"
    for file_info in html_files:
        js_array += f"            {{ file: '{file_info['file']}', name: '{file_info['name']}' }},\n"
    js_array = js_array.rstrip(',\n') + "\n        ]"
    
    # Read current index.html
    with open('index.html', 'r') as f:
        content = f.read()
    
    # Replace the games array
    pattern = r'const games = \[.*?\];'
    replacement = f'const games = {js_array};'
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Write back
    with open('index.html', 'w') as f:
        f.write(new_content)
    
    print(f"Updated index.html with {len(html_files)} HTML files:")
    for file_info in html_files:
        print(f"  - {file_info['name']} ({file_info['file']})")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    html_files = get_html_files()
    update_index_html(html_files)