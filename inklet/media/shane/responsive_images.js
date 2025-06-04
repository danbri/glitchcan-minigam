// Shane Manor Responsive Image System
// Automatically serves appropriate image sizes based on device capabilities

class ShaneManorImages {
    constructor() {
        this.basePath = 'media/shane/';
        this.deviceType = this.detectDeviceType();
        this.highPriorityImages = [
            'manor_with_taxi',
            'study_crime_scene', 
            'entrance_hall_stairs',
            'household_meeting',
            'manor_floor_plan',
            'manor_exterior_detailed',
            'morning_room_table',
            'butler_questioning'
        ];
    }
    
    detectDeviceType() {
        const width = window.innerWidth;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (width <= 480 || isMobile) {
            return 'mobile';
        } else if (width <= 768) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }
    
    getOptimalImagePath(imageName) {
        // Remove .png extension if present
        const baseName = imageName.replace('.png', '');
        
        // Check if this is a high priority image with multiple sizes
        const isHighPriority = this.highPriorityImages.includes(baseName);
        const hasMediumPriority = [
            'manor_exterior_stormy',
            'dining_room_formal', 
            'entrance_hall_doors',
            'servants_hall',
            'study_library_combo',
            'small_house_path'
        ].includes(baseName);
        
        let imagePath;
        
        if (this.deviceType === 'mobile') {
            if (isHighPriority || hasMediumPriority) {
                imagePath = `${this.basePath}mobile/${baseName}_mobile.jpg`;
            } else {
                // Fallback to desktop for low priority images
                imagePath = `${this.basePath}desktop/${baseName}_desktop.jpg`;
            }
        } else if (this.deviceType === 'tablet' && isHighPriority) {
            imagePath = `${this.basePath}tablet/${baseName}_tablet.jpg`;
        } else {
            // Desktop or fallback
            imagePath = `${this.basePath}desktop/${baseName}_desktop.jpg`;
        }
        
        return imagePath;
    }
    
    preloadHighPriorityImages() {
        // Preload the most critical images
        const criticalImages = ['manor_with_taxi', 'study_crime_scene', 'entrance_hall_stairs'];
        
        criticalImages.forEach(imageName => {
            const img = new Image();
            img.src = this.getOptimalImagePath(imageName);
        });
    }
    
    // Progressive loading: load low-res first, then high-res
    loadProgressiveImage(imageName, imgElement) {
        const baseName = imageName.replace('.png', '');
        
        // Always start with mobile version for fast loading
        const lowResPath = `${this.basePath}mobile/${baseName}_mobile.jpg`;
        const highResPath = this.getOptimalImagePath(imageName);
        
        // Set low-res immediately
        imgElement.src = lowResPath;
        imgElement.style.filter = 'blur(2px)';
        
        // Load high-res in background
        if (lowResPath !== highResPath) {
            const highResImg = new Image();
            highResImg.onload = () => {
                imgElement.src = highResPath;
                imgElement.style.filter = 'none';
                imgElement.style.transition = 'filter 0.3s ease';
            };
            highResImg.src = highResPath;
        } else {
            imgElement.style.filter = 'none';
        }
    }
}

// Initialize responsive image system
window.shaneManorImages = new ShaneManorImages();

// Auto-preload on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.shaneManorImages.preloadHighPriorityImages();
    });
} else {
    window.shaneManorImages.preloadHighPriorityImages();
}

// Export for use in FINK system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShaneManorImages;
}