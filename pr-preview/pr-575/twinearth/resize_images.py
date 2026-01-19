#!/usr/bin/env python3
import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow library is not installed. Installing now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

# Define source files and target sizes
IMAGE_CONFIGS = [
    {
        "source": "bump.jpg",
        "target": "resized/bump_2k.jpg",
        "size": (2048, 1024),
        "quality": 90
    },
    {
        "source": "clouds.png",
        "target": "resized/clouds_2k.png",
        "size": (2048, 1024)
    },
    {
        "source": "color_map.jpg",
        "target": "resized/color_map_2k.jpg",
        "size": (2048, 1024),
        "quality": 90
    },
    {
        "source": "night_lights.jpg",
        "target": "resized/night_lights_2k.jpg",
        "size": (2048, 1024),
        "quality": 90
    },
    {
        "source": "spec_mask.jpg",
        "target": "resized/spec_mask_2k.jpg",
        "size": (2048, 1024),
        "quality": 90
    }
]

def resize_image(source_path, target_path, size, quality=None):
    """Resize an image while maintaining aspect ratio"""
    print(f"Processing {source_path} -> {target_path}")
    
    with Image.open(source_path) as img:
        # Convert PNG with transparency to RGBA if needed
        if img.mode == 'P' and 'transparency' in img.info:
            img = img.convert('RGBA')
        
        # Resize image
        resized_img = img.resize(size, Image.LANCZOS)
        
        # Save with appropriate settings
        if target_path.lower().endswith('.jpg') or target_path.lower().endswith('.jpeg'):
            if quality:
                resized_img.save(target_path, quality=quality, optimize=True)
            else:
                resized_img.save(target_path, quality=90, optimize=True)
        elif target_path.lower().endswith('.png'):
            resized_img.save(target_path, optimize=True)
        else:
            resized_img.save(target_path)
        
        print(f"  Original size: {os.path.getsize(source_path):,} bytes")
        print(f"  New size: {os.path.getsize(target_path):,} bytes")

def main():
    """Process all images"""
    print("Starting image resizing...")
    
    # Ensure the resized directory exists
    os.makedirs("resized", exist_ok=True)
    
    for config in IMAGE_CONFIGS:
        source_path = config["source"]
        target_path = config["target"]
        size = config["size"]
        quality = config.get("quality", None)
        
        resize_image(source_path, target_path, size, quality)
    
    print("Image resizing complete!")

if __name__ == "__main__":
    main()