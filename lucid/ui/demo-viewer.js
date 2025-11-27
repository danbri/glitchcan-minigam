/**
 * Demo viewer UI - code panel and edit panel management
 * Provides DSL and GLSL viewing/editing capabilities
 */
import { parseDslToSceneGraph, generateGlslFromSceneGraph } from '../core/index.js';

export class DemoViewer {
  constructor(options = {}) {
    this.renderer = options.renderer;
    this.onDslChange = options.onDslChange || (() => {});

    this.currentDsl = '';
    this.currentGlsl = '';
    this.currentSceneGraph = null;

    this.setupUI();
  }

  setupUI() {
    // Code toggle button
    const codeToggle = document.querySelector('.code-toggle');
    const codePanel = document.getElementById('codePanel');
    const codeClose = document.querySelector('.code-close');

    if (codeToggle && codePanel) {
      codeToggle.addEventListener('click', () => {
        codePanel.classList.toggle('open');
      });
    }

    if (codeClose && codePanel) {
      codeClose.addEventListener('click', () => {
        codePanel.classList.remove('open');
      });
    }

    // Edit panel setup
    const editToggle = document.querySelector('.edit-toggle');
    const editPanel = document.getElementById('editPanel');
    const editTextarea = document.getElementById('editTextarea');
    const editApply = document.getElementById('editApply');
    const editCancel = document.getElementById('editCancel');
    const editError = document.getElementById('editError');

    if (editToggle && editPanel && editTextarea) {
      editToggle.addEventListener('click', () => {
        editPanel.classList.add('active');
        editTextarea.value = this.currentDsl;
        if (editError) editError.classList.remove('visible');
        editTextarea.focus();
      });
    }

    if (editCancel && editPanel) {
      editCancel.addEventListener('click', () => {
        editPanel.classList.remove('active');
      });
    }

    if (editApply && editPanel && editTextarea && editError) {
      editApply.addEventListener('click', () => {
        const newDsl = editTextarea.value;

        try {
          // Parse and generate GLSL
          const sceneGraph = parseDslToSceneGraph(newDsl);
          const glslCode = generateGlslFromSceneGraph(sceneGraph);

          // Update renderer
          if (this.renderer) {
            this.renderer.updateScene(glslCode);
          }

          // Update stored values
          this.currentDsl = newDsl;
          this.currentGlsl = glslCode;
          this.currentSceneGraph = sceneGraph;

          // Update code display
          this.updateCodeDisplay();

          // Notify callback
          this.onDslChange(newDsl);

          // Close edit panel
          editPanel.classList.remove('active');
          editError.classList.remove('visible');

          console.log('✅ DSL updated successfully');
        } catch (error) {
          console.error('❌ DSL parsing failed:', error);
          editError.textContent = `Error: ${error.message}`;
          editError.classList.add('visible');
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        if (codePanel) {
          codePanel.classList.toggle('open');
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (editPanel && !editPanel.classList.contains('active')) {
          editPanel.classList.add('active');
          if (editTextarea) {
            editTextarea.value = this.currentDsl;
            editTextarea.focus();
          }
          if (editError) editError.classList.remove('visible');
        }
      } else if (e.key === 'Escape') {
        if (editPanel && editPanel.classList.contains('active')) {
          editPanel.classList.remove('active');
        }
        if (codePanel && codePanel.classList.contains('open')) {
          codePanel.classList.remove('open');
        }
      }
    });
  }

  loadDsl(dsl) {
    try {
      // Parse DSL to scene graph
      const sceneGraph = parseDslToSceneGraph(dsl);

      // Generate GLSL from scene graph
      const glslCode = generateGlslFromSceneGraph(sceneGraph);

      // Update renderer
      if (this.renderer) {
        this.renderer.updateScene(glslCode);
      }

      // Store values
      this.currentDsl = dsl;
      this.currentGlsl = glslCode;
      this.currentSceneGraph = sceneGraph;

      // Update UI
      this.updateCodeDisplay();

      console.log('✅ Scene loaded successfully');
      console.log('Scene graph:', sceneGraph);

    } catch (error) {
      console.error('❌ Failed to load scene:', error);
      throw error;
    }
  }

  updateCodeDisplay() {
    // Update DSL display
    const dslCode = document.getElementById('dslCode');
    if (dslCode) {
      dslCode.textContent = this.currentDsl;
    }

    // Update GLSL display
    const glslCode = document.getElementById('glslCode');
    if (glslCode) {
      glslCode.textContent = this.currentGlsl;
    }

    // Update scene graph display
    const sceneGraphCode = document.getElementById('sceneGraphCode');
    if (sceneGraphCode) {
      sceneGraphCode.textContent = JSON.stringify(this.currentSceneGraph, null, 2);
    }
  }

  getDsl() {
    return this.currentDsl;
  }

  getGlsl() {
    return this.currentGlsl;
  }

  getSceneGraph() {
    return this.currentSceneGraph;
  }
}
