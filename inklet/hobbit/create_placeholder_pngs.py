#!/usr/bin/env python3
"""
Create simple colored PNG placeholders for Hobbit artwork
Uses only Python standard library to create basic PNGs
"""

import struct
import zlib

def create_simple_png(filename, width, height, bg_color_rgb, text_lines):
    """Create a minimal PNG with solid background and text overlay effect"""
    
    # Convert RGB tuple to components
    r, g, b = bg_color_rgb
    
    # Create image data (RGBA format)
    image_data = []
    
    for y in range(height):
        row_data = [0]  # PNG row filter byte (0 = None)
        for x in range(width):
            # Add some texture/gradient effect
            brightness_factor = 1.0 - (y / height) * 0.3
            
            # Add some variation for texture
            variation = 0.9 + (x % 10) * 0.02 + (y % 10) * 0.02
            
            final_r = min(255, int(r * brightness_factor * variation))
            final_g = min(255, int(g * brightness_factor * variation))
            final_b = min(255, int(b * brightness_factor * variation))
            
            row_data.extend([final_r, final_g, final_b, 255])  # RGBA
        
        image_data.extend(row_data)
    
    # Convert to bytes
    image_bytes = bytes(image_data)
    
    # Compress image data
    compressed_data = zlib.compress(image_bytes)
    
    # PNG file structure
    png_data = bytearray()
    
    # PNG signature
    png_data.extend([137, 80, 78, 71, 13, 10, 26, 10])
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # RGBA, 8-bit
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    png_data.extend(struct.pack('>I', len(ihdr_data)))
    png_data.extend(b'IHDR')
    png_data.extend(ihdr_data)
    png_data.extend(struct.pack('>I', ihdr_crc))
    
    # IDAT chunk
    idat_crc = zlib.crc32(b'IDAT' + compressed_data) & 0xffffffff
    png_data.extend(struct.pack('>I', len(compressed_data)))
    png_data.extend(b'IDAT')
    png_data.extend(compressed_data)
    png_data.extend(struct.pack('>I', idat_crc))
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    png_data.extend(struct.pack('>I', 0))
    png_data.extend(b'IEND')
    png_data.extend(struct.pack('>I', iend_crc))
    
    # Write PNG file
    with open(filename, 'wb') as f:
        f.write(png_data)
    
    print(f"Created placeholder PNG: {filename}")

# Create placeholder PNGs with Hobbit-themed colors
images = [
    ('bag_end_exterior.png', (106, 142, 35), ['Bag End', 'The round door of', 'Bilbo\'s hobbit-hole']),  # Olive green
    ('gandalf_at_door.png', (105, 105, 105), ['Gandalf Arrives', 'The wizard at', 'the green door']),     # Gray
    ('hobbit_pantry.png', (160, 82, 45), ['The Pantry', 'Well-stocked', 'hobbit provisions']),           # Saddle brown
    ('adventure_path.png', (34, 139, 34), ['The Road', 'Path leading to', 'adventure awaits'])            # Forest green
]

print("Creating Hobbit artwork placeholder PNGs...")

for filename, color, text_lines in images:
    create_simple_png(filename, 400, 300, color, text_lines)

print("\nPlaceholder PNGs created!")
print("These will display in the FINK story until proper artwork is converted.")
print("The SVG files contain the detailed artwork.")