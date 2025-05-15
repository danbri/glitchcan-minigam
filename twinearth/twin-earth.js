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
        this.textures = {};
        this.controls = null;
        
        // Bind methods to maintain this context
        this.onWindowResizeBound = this.onWindowResize.bind(this);
        this.toggleTwinModeBound = this.toggleTwinMode.bind(this);
        this.animateBound = this.animate.bind(this);
    }

    connectedCallback() {
        this.init();
        this.setupEventListeners();
        this.loadTextures();
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

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);

        // Add directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(5, 3, 5);
        this.scene.add(sunLight);

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
        toggle.addEventListener('change', this.toggleTwinModeBound);
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

    loadTextures() {
        const textureLoader = new THREE.TextureLoader();
        const textureFiles = {
            colorMap: 'color_map.jpg',
            bumpMap: 'bump.jpg',
            specMap: 'spec_mask.jpg',
            nightMap: 'night_lights.jpg',
            cloudsMap: 'clouds.png'
        };

        // Use Promise.all for better texture loading
        const texturePromises = Object.entries(textureFiles).map(([key, file]) => {
            return new Promise((resolve, reject) => {
                textureLoader.load(
                    file,
                    (texture) => {
                        this.textures[key] = texture;
                        resolve();
                    },
                    undefined,
                    (err) => {
                        console.error(`Error loading texture ${file}:`, err);
                        reject(err);
                    }
                );
            });
        });

        Promise.all(texturePromises)
            .then(() => {
                this.createEarthModel();
                this.animate();
            })
            .catch(err => console.error('Error loading textures:', err));
    }

    createEarthModel() {
        // Create Earth sphere
        const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
        
        // Create Earth material with textures
        const earthMaterial = new THREE.MeshPhongMaterial({
            map: this.textures.colorMap,
            bumpMap: this.textures.bumpMap,
            bumpScale: 0.05,
            specularMap: this.textures.specMap,
            specular: new THREE.Color(0x333333),
            shininess: 15
        });

        // Create Earth mesh
        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        this.scene.add(this.earth);

        // Create clouds layer
        const cloudsGeometry = new THREE.SphereGeometry(1.02, 64, 64);
        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: this.textures.cloudsMap,
            transparent: true,
            opacity: 0.8
        });

        this.clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        this.scene.add(this.clouds);

        // Create night side (using night lights texture)
        const nightGeometry = new THREE.SphereGeometry(0.99, 64, 64);
        const nightMaterial = new THREE.MeshBasicMaterial({
            map: this.textures.nightMap,
            blending: THREE.AdditiveBlending,
            opacity: 0.7,
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
        
        // Rotate earth and clouds slowly
        if (this.earth) {
            this.earth.rotation.y += 0.0005;
        }
        
        if (this.clouds) {
            this.clouds.rotation.y += 0.0007; // Slightly faster than Earth
        }
        
        if (this.night) {
            this.night.rotation.y += 0.0005; // Same as Earth
        }
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}