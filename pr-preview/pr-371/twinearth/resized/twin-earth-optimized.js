import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

export class TwinEarthComponent extends HTMLElement {
    constructor() {
        super();
        this.isTwinMode = false;
        this.animationId = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.earth = null;
        this.clouds = null;
        this.night = null;
        this.sunLight = null;
        this.textures = {};
        this.controls = null;
        this.useOptimizedTextures = true; // Flag to use optimized textures
        
        // Default values for controls
        this.settings = {
            rotationSpeed: 0.5,
            bumpStrength: 0.05,
            cloudOpacity: 0.5,
            cloudSpeed: 0.7,
            lightIntensity: 1.0,
            nightGlow: 0.7
        };
        
        // Bind methods to maintain this context
        this.onWindowResizeBound = this.onWindowResize.bind(this);
        this.toggleTwinModeBound = this.toggleTwinMode.bind(this);
        this.animateBound = this.animate.bind(this);
    }

    connectedCallback() {
        this.init();
        this.setupEventListeners();
        this.loadTextures();
        
        // Set up control panel if in the HTML
        if (document.getElementById('controls-panel')) {
            this.setupControlPanel();
        }
    }

    disconnectedCallback() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('resize', this.onWindowResizeBound);
        const toggle = document.getElementById('twin-toggle');
        if (toggle) {
            toggle.removeEventListener('change', this.toggleTwinModeBound);
        }
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 3;

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.appendChild(this.renderer.domElement);

        // Add ambient light - slightly brighter for better visibility
        const ambientLight = new THREE.AmbientLight(0x555555);
        this.scene.add(ambientLight);

        // Add directional light (sun)
        this.sunLight = new THREE.DirectionalLight(0xffffff, this.settings.lightIntensity);
        this.sunLight.position.set(5, 3, 5);
        this.scene.add(this.sunLight);

        // Add orbit controls - using imported OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;
        
        // Add starfield background
        this.addStarfield();
    }

    addStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
        });

        const starVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starVertices.push(x, y, z);
        }

        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResizeBound);
        
        const toggle = document.getElementById('twin-toggle');
        if (toggle) {
            toggle.addEventListener('change', this.toggleTwinModeBound);
        }
    }
    
    setupControlPanel() {
        // Toggle control panel
        const controlsPanel = document.getElementById('controls-panel');
        const controlsToggle = document.getElementById('controls-toggle');
        
        controlsToggle.addEventListener('click', () => {
            controlsPanel.classList.toggle('collapsed');
            controlsToggle.textContent = controlsPanel.classList.contains('collapsed') ? '▶' : '◀';
        });
        
        // Connect sliders to settings
        this.connectSlider('rotation-slider', 'rotation-value', 'rotationSpeed');
        this.connectSlider('bump-slider', 'bump-value', 'bumpStrength', this.updateBumpScale.bind(this));
        this.connectSlider('cloud-opacity-slider', 'cloud-opacity-value', 'cloudOpacity', this.updateCloudOpacity.bind(this));
        this.connectSlider('cloud-speed-slider', 'cloud-speed-value', 'cloudSpeed');
        this.connectSlider('light-slider', 'light-value', 'lightIntensity', this.updateLightIntensity.bind(this));
        this.connectSlider('night-slider', 'night-value', 'nightGlow', this.updateNightGlow.bind(this));
        
        // Reset button
        const resetButton = document.getElementById('reset-button');
        if (resetButton) {
            resetButton.addEventListener('click', this.resetToDefaults.bind(this));
        }
    }
    
    connectSlider(sliderId, valueId, settingKey, callback = null) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        
        if (slider && valueDisplay) {
            // Initialize with current setting value
            slider.value = this.settings[settingKey];
            valueDisplay.textContent = this.settings[settingKey].toFixed(2);
            
            // Update on change
            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                this.settings[settingKey] = value;
                valueDisplay.textContent = value.toFixed(2);
                
                // Call the callback if provided
                if (callback) callback(value);
            });
        }
    }
    
    resetToDefaults() {
        // Default values
        const defaults = {
            rotationSpeed: 0.5,
            bumpStrength: 0.05,
            cloudOpacity: 0.5,
            cloudSpeed: 0.7,
            lightIntensity: 1.0,
            nightGlow: 0.7
        };
        
        // Reset each setting
        Object.keys(defaults).forEach(key => {
            this.settings[key] = defaults[key];
        });
        
        // Update UI
        document.getElementById('rotation-slider').value = defaults.rotationSpeed;
        document.getElementById('rotation-value').textContent = defaults.rotationSpeed.toFixed(2);
        
        document.getElementById('bump-slider').value = defaults.bumpStrength;
        document.getElementById('bump-value').textContent = defaults.bumpStrength.toFixed(2);
        this.updateBumpScale(defaults.bumpStrength);
        
        document.getElementById('cloud-opacity-slider').value = defaults.cloudOpacity;
        document.getElementById('cloud-opacity-value').textContent = defaults.cloudOpacity.toFixed(2);
        this.updateCloudOpacity(defaults.cloudOpacity);
        
        document.getElementById('cloud-speed-slider').value = defaults.cloudSpeed;
        document.getElementById('cloud-speed-value').textContent = defaults.cloudSpeed.toFixed(2);
        
        document.getElementById('light-slider').value = defaults.lightIntensity;
        document.getElementById('light-value').textContent = defaults.lightIntensity.toFixed(2);
        this.updateLightIntensity(defaults.lightIntensity);
        
        document.getElementById('night-slider').value = defaults.nightGlow;
        document.getElementById('night-value').textContent = defaults.nightGlow.toFixed(2);
        this.updateNightGlow(defaults.nightGlow);
    }
    
    updateBumpScale(value) {
        if (this.earth && this.earth.material) {
            this.earth.material.bumpScale = value;
        }
    }
    
    updateCloudOpacity(value) {
        if (this.clouds && this.clouds.material) {
            this.clouds.material.opacity = value;
        }
    }
    
    updateLightIntensity(value) {
        if (this.sunLight) {
            this.sunLight.intensity = value;
        }
    }
    
    updateNightGlow(value) {
        if (this.night && this.night.material) {
            this.night.material.opacity = value;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    toggleTwinMode() {
        const toggle = document.getElementById('twin-toggle');
        this.isTwinMode = toggle.checked;
        this.updateEarthModel();
    }

    async loadTextures() {
        console.log('Starting texture loading');
        // Always use original textures directly for now
        this.loadOriginalTextures();
    }

    loadOriginalTextures() {
        console.log('Loading original textures directly');
        const textureLoader = new THREE.TextureLoader();
        const textureFiles = {
            colorMap: '../color_map.jpg',
            bumpMap: '../bump.jpg',
            specMap: '../spec_mask.jpg',
            nightMap: '../night_lights.jpg',
            cloudsMap: '../clouds.png'
        };

        // Log the full paths for debugging
        Object.entries(textureFiles).forEach(([key, file]) => {
            const fullPath = new URL(file, window.location.href).href;
            console.log(`Loading texture ${key} from: ${fullPath}`);
        });

        // Load each texture one by one with logging
        const loadTexture = (key, file) => {
            return new Promise((resolve, reject) => {
                console.log(`Starting to load ${key} from ${file}...`);
                textureLoader.load(
                    file,
                    (texture) => {
                        console.log(`Successfully loaded ${key}`);
                        this.textures[key] = texture;
                        resolve();
                    },
                    (progress) => {
                        if (progress.lengthComputable) {
                            const percentComplete = (progress.loaded / progress.total) * 100;
                            console.log(`${key} loading: ${percentComplete.toFixed(1)}%`);
                        }
                    },
                    (err) => {
                        console.error(`Error loading texture ${file}:`, err);
                        reject(err);
                    }
                );
            });
        };

        // Chain the promises sequentially for more stability
        let loadPromise = Promise.resolve();
        Object.entries(textureFiles).forEach(([key, file]) => {
            loadPromise = loadPromise.then(() => loadTexture(key, file));
        });

        loadPromise
            .then(() => {
                console.log('All textures loaded successfully');
                this.createEarthModel();
                this.animate();
                
                // Hide loading screen if it's still visible
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.style.opacity = 0;
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }
            })
            .catch(err => {
                console.error('Error loading textures:', err);
                
                // Still hide loading screen even if there's an error
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.style.opacity = 0;
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }
                
                // Add error message to the page
                const errorMessage = document.createElement('div');
                errorMessage.style.position = 'absolute';
                errorMessage.style.top = '50%';
                errorMessage.style.left = '50%';
                errorMessage.style.transform = 'translate(-50%, -50%)';
                errorMessage.style.color = 'white';
                errorMessage.style.backgroundColor = 'rgba(0,0,0,0.7)';
                errorMessage.style.padding = '20px';
                errorMessage.style.borderRadius = '5px';
                errorMessage.style.zIndex = '1000';
                errorMessage.textContent = 'Error loading Earth textures. Please check console for details.';
                document.body.appendChild(errorMessage);
            });
    }

    createEarthModel() {
        // Create Earth sphere
        const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
        
        // Create Earth material with textures, enhanced color saturation
        const earthMaterial = new THREE.MeshPhongMaterial({
            map: this.textures.colorMap,
            bumpMap: this.textures.bumpMap,
            bumpScale: this.settings.bumpStrength,
            specularMap: this.textures.specMap,
            specular: new THREE.Color(0x444444),
            shininess: 15
        });

        // Create Earth mesh
        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        this.scene.add(this.earth);

        // Create clouds layer with reduced opacity for better earth visibility
        const cloudsGeometry = new THREE.SphereGeometry(1.02, 64, 64);
        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: this.textures.cloudsMap,
            transparent: true,
            opacity: this.settings.cloudOpacity
        });

        this.clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        this.scene.add(this.clouds);

        // Create night side (using night lights texture)
        const nightGeometry = new THREE.SphereGeometry(0.99, 64, 64);
        const nightMaterial = new THREE.MeshBasicMaterial({
            map: this.textures.nightMap,
            blending: THREE.AdditiveBlending,
            opacity: this.settings.nightGlow,
            transparent: true
        });
        
        this.night = new THREE.Mesh(nightGeometry, nightMaterial);
        this.scene.add(this.night);

        // Apply initial Earth model settings
        this.updateEarthModel();
    }

    updateEarthModel() {
        if (!this.earth || !this.clouds || !this.night) return;

        // Apply twin earth effect by flipping textures horizontally
        const earthMaterial = this.earth.material;
        const cloudsMaterial = this.clouds.material;
        const nightMaterial = this.night.material;

        // Set texture repeat and offset to flip horizontally
        if (this.isTwinMode) {
            // Create twin earth by setting repeat.x to -1 and offset.x to 1
            earthMaterial.map.repeat.set(-1, 1);
            earthMaterial.map.offset.set(1, 0);
            
            earthMaterial.bumpMap.repeat.set(-1, 1);
            earthMaterial.bumpMap.offset.set(1, 0);
            
            earthMaterial.specularMap.repeat.set(-1, 1);
            earthMaterial.specularMap.offset.set(1, 0);
            
            cloudsMaterial.map.repeat.set(-1, 1);
            cloudsMaterial.map.offset.set(1, 0);
            
            nightMaterial.map.repeat.set(-1, 1);
            nightMaterial.map.offset.set(1, 0);
        } else {
            // Reset to normal earth
            earthMaterial.map.repeat.set(1, 1);
            earthMaterial.map.offset.set(0, 0);
            
            earthMaterial.bumpMap.repeat.set(1, 1);
            earthMaterial.bumpMap.offset.set(0, 0);
            
            earthMaterial.specularMap.repeat.set(1, 1);
            earthMaterial.specularMap.offset.set(0, 0);
            
            cloudsMaterial.map.repeat.set(1, 1);
            cloudsMaterial.map.offset.set(0, 0);
            
            nightMaterial.map.repeat.set(1, 1);
            nightMaterial.map.offset.set(0, 0);
        }

        // Update texture properties
        earthMaterial.map.needsUpdate = true;
        earthMaterial.bumpMap.needsUpdate = true;
        earthMaterial.specularMap.needsUpdate = true;
        cloudsMaterial.map.needsUpdate = true;
        nightMaterial.map.needsUpdate = true;
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animateBound);
        
        // Apply rotation based on control settings
        const baseSpeed = 0.001;
        
        // Rotate earth and clouds slowly
        if (this.earth) {
            this.earth.rotation.y += baseSpeed * this.settings.rotationSpeed;
        }
        
        if (this.clouds) {
            this.clouds.rotation.y += baseSpeed * this.settings.cloudSpeed; // Clouds rotate at separate speed
        }
        
        if (this.night) {
            this.night.rotation.y += baseSpeed * this.settings.rotationSpeed; // Same as Earth
        }
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}