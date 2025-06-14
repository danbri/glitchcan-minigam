
// This file is auto-generated to create optimized texture versions
// Import this in your HTML file after importing three.js but before your main script

// Function to create a downsampled version of a texture to improve load times
function createResizedTexture(originalTexture, newWidth, newHeight) {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    
    // Create an image element
    const img = new Image();
    img.src = originalTexture;
    
    // Create a promise that resolves when the image is loaded and processed
    return new Promise((resolve, reject) => {
        img.onload = function() {
            // Draw the image to the canvas, scaling it down
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, newWidth, newHeight);
            
            // Create a new texture from the canvas
            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            
            // Resolve the promise with the new texture
            resolve(texture);
        };
        
        img.onerror = function() {
            reject(new Error('Failed to load image: ' + originalTexture));
        };
    });
}

// Main function to create all optimized textures
async function createOptimizedTextures() {
    const optimizedTextures = {};
    
    try {
        // Define the textures to resize and their target resolutions
        const texturesToResize = [
            { key: 'colorMap', src: '../color_map.jpg', width: 2048, height: 1024 },
            { key: 'bumpMap', src: '../bump.jpg', width: 2048, height: 1024 },
            { key: 'specMap', src: '../spec_mask.jpg', width: 2048, height: 1024 },
            { key: 'nightMap', src: '../night_lights.jpg', width: 2048, height: 1024 },
            { key: 'cloudsMap', src: '../clouds.png', width: 2048, height: 1024 }
        ];
        
        // Create and process each texture in parallel
        const texturePromises = texturesToResize.map(async (textureConfig) => {
            const texture = await createResizedTexture(
                textureConfig.src, 
                textureConfig.width, 
                textureConfig.height
            );
            
            // Store in the result object
            optimizedTextures[textureConfig.key] = texture;
        });
        
        // Wait for all textures to be processed
        await Promise.all(texturePromises);
        
        console.log('All textures optimized successfully');
        return optimizedTextures;
    } catch (error) {
        console.error('Error creating optimized textures:', error);
        throw error;
    }
}

// Export the function for use in the main script
window.createOptimizedTextures = createOptimizedTextures;
