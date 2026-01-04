#!/usr/bin/env node
/**
 * Simple SVG to PNG converter using Node.js and Canvas
 * Creates PNG versions of the Hobbit SVG artwork
 */

const fs = require('fs');
const path = require('path');

// Simple SVG to canvas renderer using HTML5 Canvas (browser-style)
function createPNGFromSVG(svgContent, outputPath, width = 400, height = 300) {
    // For Node.js environment, we'll create a simple data URL approach
    console.log(`Converting SVG to PNG: ${outputPath}`);
    
    // Read the SVG content and create a basic HTML file that renders it
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; padding: 0; background: white; }
        svg { display: block; }
    </style>
</head>
<body>
    ${svgContent}
    <script>
        // Auto-convert when loaded in browser
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = ${width};
            canvas.height = ${height};
            const ctx = canvas.getContext('2d');
            
            const svg = document.querySelector('svg');
            if (svg) {
                const data = new XMLSerializer().serializeToString(svg);
                const img = new Image();
                img.onload = function() {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    
                    // Download the PNG
                    const link = document.createElement('a');
                    link.download = '${path.basename(outputPath)}';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                };
                const blob = new Blob([data], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                img.src = url;
            }
        }, 100);
    </script>
</body>
</html>`;
    
    // Write HTML converter file
    const htmlPath = outputPath.replace('.png', '_converter.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`Created HTML converter: ${htmlPath}`);
    console.log(`Open ${htmlPath} in a browser to download the PNG`);
}

// Convert all SVG files to PNG
const svgFiles = [
    'bag_end_exterior.svg',
    'gandalf_at_door.svg',
    'hobbit_pantry.svg',
    'adventure_path.svg'
];

console.log('Starting SVG to PNG conversion...');

svgFiles.forEach(svgFile => {
    const svgPath = path.join(__dirname, svgFile);
    const pngFile = svgFile.replace('.svg', '.png');
    const pngPath = path.join(__dirname, pngFile);
    
    if (fs.existsSync(svgPath)) {
        const svgContent = fs.readFileSync(svgPath, 'utf8');
        createPNGFromSVG(svgContent, pngPath);
    } else {
        console.log(`SVG file not found: ${svgPath}`);
    }
});

console.log('\nConversion setup complete!');
console.log('To create PNGs:');
console.log('1. Open each *_converter.html file in a web browser');
console.log('2. The PNG will download automatically');
console.log('3. Save the PNG files in this directory');