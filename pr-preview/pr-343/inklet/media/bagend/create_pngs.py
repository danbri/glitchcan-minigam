#!/usr/bin/env python3
"""
Simple SVG to PNG converter using basic image generation
Creates placeholder PNGs with descriptive text for the Hobbit story
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_text_png(filename, title, description, size=(400, 300)):
    """Create a simple PNG with text description"""
    # Create image with warm background
    img = Image.new('RGB', size, color='#F4E4BC')
    draw = ImageDraw.Draw(img)
    
    # Try to use a monospace font, fallback to default
    try:
        title_font = ImageFont.truetype('DejaVuSansMono-Bold.ttf', 24)
        desc_font = ImageFont.truetype('DejaVuSansMono.ttf', 16)
    except:
        try:
            title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 24)
            desc_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 16)
        except:
            title_font = ImageFont.load_default()
            desc_font = ImageFont.load_default()
    
    # Draw border
    draw.rectangle([(10, 10), (size[0]-10, size[1]-10)], outline='#8B4513', width=3)
    
    # Draw title
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_x = (size[0] - (title_bbox[2] - title_bbox[0])) // 2
    draw.text((title_x, 30), title, fill='#2F4F4F', font=title_font)
    
    # Draw description (word wrap)
    words = description.split()
    lines = []
    current_line = []
    max_width = size[0] - 40
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        test_bbox = draw.textbbox((0, 0), test_line, font=desc_font)
        if (test_bbox[2] - test_bbox[0]) <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
                current_line = [word]
            else:
                lines.append(word)
    
    if current_line:
        lines.append(' '.join(current_line))
    
    # Draw description lines
    y_offset = 80
    for line in lines:
        line_bbox = draw.textbbox((0, 0), line, font=desc_font)
        line_x = (size[0] - (line_bbox[2] - line_bbox[0])) // 2
        draw.text((line_x, y_offset), line, fill='#654321', font=desc_font)
        y_offset += 25
    
    # Draw decorative elements
    draw.rectangle([(50, y_offset + 20), (size[0]-50, y_offset + 22)], fill='#8B4513')
    
    # Save the image
    img.save(filename)
    print(f"Created {filename}")

# Create the PNG versions
images = [
    ('bag_end_exterior.png', 'BAG END', 
     'The round green door of Bilbo Baggins hobbit-hole, set into a grassy hill with windows on either side and a well-tended garden path leading to the entrance.'),
    
    ('gandalf_at_door.png', 'AN UNEXPECTED VISITOR',
     'The wizard Gandalf in his tall pointed hat and grey robes stands before the hobbit-hole, leaning on his staff, having just knocked on the door of Bag End.'),
    
    ('hobbit_pantry.png', 'THE WELL-STOCKED PANTRY',
     'Inside the hobbit-hole, shelves lined with jars, barrels of ale, wheels of cheese, sacks of flour, hanging herbs, and all manner of provisions for the journey ahead.'),
    
    ('adventure_path.png', 'THE ROAD GOES EVER ON',
     'A winding dirt path leading away from the Shire through rolling green hills toward distant mountains, with trees and wildflowers along the way, promising adventure.')
]

for filename, title, description in images:
    create_text_png(filename, title, description)

print("\nAll PNG images created successfully!")
print("These are temporary placeholder images.")
print("The SVG versions contain the actual artwork.")