import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class VRMViewer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.currentVrm = null;
    this.clock = new THREE.Clock();

    // Idle animation state
    this.blinkTimer = 0;
    this.nextBlinkTime = 3;
    this.isBlinking = false;
    this.blinkDuration = 0.15;
    this.currentViseme = 'aa';
    this.visemeAmount = 0;

    this.initScene();
    this.initLights();
    this.initLoader();
    this.animate();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initScene() {
    this.scene = new THREE.Scene();

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 20.0);
    // Portrait framing focused on upper body and face
    this.camera.position.set(0.0, 1.36, 0.92);
    this.camera.lookAt(0.0, 1.34, 0.0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.5);
    keyLight.position.set(1.0, 2.0, 1.5).normalize();
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd9e8ff, 0.8);
    fillLight.position.set(-1.0, 1.5, 1.0).normalize();
    this.scene.add(fillLight);
  }

  initLoader() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  async loadModel(urlOrBlobUrl) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        urlOrBlobUrl,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          if (!vrm) {
            reject(new Error('No VRM data found in model'));
            return;
          }

          if (this.currentVrm) {
            this.scene.remove(this.currentVrm.scene);
            VRMUtils.deepDispose(this.currentVrm.scene);
          }

          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);

          // Rotate to face camera if VRM 0.0
          VRMUtils.rotateVRM0(vrm);

          this.currentVrm = vrm;
          this.scene.add(vrm.scene);

          // Set default friendly expression
          this.setExpression('happy', 0.2);

          resolve(vrm);
        },
        (progress) => {
          // Progress callback
        },
        (error) => {
          console.error('Error loading VRM:', error);
          reject(error);
        }
      );
    });
  }

  setExpression(name, value) {
    if (!this.currentVrm) return;
    const mgr = this.currentVrm.expressionManager;
    const proxy = this.currentVrm.blendShapeProxy;

    const aliases = {
      'aa': ['aa', 'a'],
      'ih': ['ih', 'i'],
      'ou': ['ou', 'u'],
      'ee': ['ee', 'e'],
      'oh': ['oh', 'o'],
      'happy': ['happy', 'joy'],
      'blink': ['blink']
    };

    const keysToTry = aliases[name] || [name];
    for (const key of keysToTry) {
      try {
        if (mgr && mgr.setValue) mgr.setValue(key, value);
        if (proxy && proxy.setValue) proxy.setValue(key, value);
      } catch (e) {}
    }
  }

  setLipSync(viseme, amount) {
    if (!this.currentVrm) return;
    const visemes = ['aa', 'ih', 'ou', 'ee', 'oh'];
    visemes.forEach(v => this.setExpression(v, 0));
    if (amount > 0) {
      this.setExpression(viseme, amount);
    }
    this.currentViseme = viseme;
    this.visemeAmount = amount;
  }

  onWindowResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  updateIdleAnimation(delta, time) {
    if (!this.currentVrm) return;

    // 1. Natural Breathing & subtle posture swaying
    const humanoid = this.currentVrm.humanoid;
    if (humanoid) {
      const spine = humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        spine.rotation.x = Math.sin(time * 2.0) * 0.015;
      }
      const neck = humanoid.getNormalizedBoneNode('neck');
      if (neck) {
        neck.rotation.y = Math.sin(time * 0.8) * 0.03;
        neck.rotation.x = Math.sin(time * 1.5) * 0.01;
      }
    }

    // 2. Natural periodic eye blinking
    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }

    if (this.isBlinking) {
      const blinkProgress = this.blinkTimer / this.blinkDuration;
      if (blinkProgress <= 0.5) {
        this.setExpression('blink', blinkProgress * 2.0);
      } else if (blinkProgress <= 1.0) {
        this.setExpression('blink', (1.0 - blinkProgress) * 2.0);
      } else {
        this.setExpression('blink', 0.0);
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.nextBlinkTime = 2.5 + Math.random() * 3.5; // Next blink in 2.5 ~ 6 seconds
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    if (this.currentVrm) {
      this.updateIdleAnimation(delta, elapsedTime);
      this.currentVrm.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
