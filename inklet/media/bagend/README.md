# Hobbit Adventure Art Assets

This directory contains classic 80s text adventure style artwork for the Hobbit FINK story.

## Files Created

### SVG Artwork (Vector Graphics)
- `bag_end_exterior.svg` - The round door of Bag End hobbit-hole with garden
- `gandalf_at_door.svg` - Gandalf the wizard arriving at the door  
- `hobbit_pantry.svg` - Well-stocked pantry inside the hobbit-hole
- `adventure_path.svg` - The winding path leading to adventure

### Conversion Tools
- `svg_to_png_converter.html` - Web-based tool to view and convert SVGs to PNG
- `create_pngs.py` - Python script to create placeholder PNGs (requires PIL)
- `simple_converter.py` - Basic converter without dependencies

## Art Style

Classic 80s text adventure aesthetic:
- Limited color palette
- Simple geometric shapes  
- Atmospheric lighting
- Monospace typography
- Retro gaming feel inspired by early Sierra/Infocom adventures

## Usage

The FINK story system automatically detects `bagend1.fink.js` and sets the media path to `hobbit/` to load these images.

To view the SVGs as PNGs:
1. Open `svg_to_png_converter.html` in a web browser
2. The tool will automatically convert and display the images
3. Use the download buttons to save PNG versions

## Technical Notes

The SVG files are self-contained and don't require external dependencies. They use:
- Gradients for atmospheric effects
- Simple geometric shapes for 80s aesthetic
- Embedded fonts (monospace fallbacks)
- 400x300px dimensions optimized for story display