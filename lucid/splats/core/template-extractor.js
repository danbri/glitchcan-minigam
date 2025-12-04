/**
 * Template Extractor
 *
 * Extracts unique object templates from Lucid SDF scenes.
 * Identifies 'defs' as templates and 'ref' nodes as instances.
 */

export class TemplateExtractor {
  constructor(sceneJson) {
    this.scene = sceneJson;
    this.templates = new Map();  // id -> definition node
    this.instances = [];         // { templateId, transform, animation, ... }
  }

  /**
   * Extract templates and instances from scene
   * @returns {{ templates: Map, instances: Array }}
   */
  extract() {
    // Step 1: Extract template definitions
    if (this.scene.defs) {
      for (const [id, def] of Object.entries(this.scene.defs)) {
        this.templates.set(id, def);
      }
    }

    // Step 2: Walk scene graph to find ref instances
    if (this.scene.root) {
      this.walkNode(this.scene.root, {
        translate: [0, 0, 0],
        rotate: [0, 0, 0],
        scale: [1, 1, 1]
      }, null);
    }

    return {
      templates: this.templates,
      instances: this.instances
    };
  }

  /**
   * Recursively walk scene graph
   */
  walkNode(node, parentTransform, parentAnimation) {
    if (!node) return;

    // Compute current transform (combine with parent)
    const currentTransform = this.combineTransforms(parentTransform, node.transform);

    // Check for animation expressions in transform
    const animation = this.extractAnimation(node.transform, parentAnimation);

    switch (node.type) {
      case 'ref':
        // Found an instance of a template
        this.instances.push({
          templateId: node.id,
          id: `${node.id}_${this.instances.length}`,
          transform: this.staticTransform(currentTransform),
          animation: animation,
          color: [1, 1, 1, 1],
          visible: true
        });
        break;

      case 'union':
      case 'subtract':
      case 'intersect':
      case 'smoothUnion':
        // Walk children
        if (node.children) {
          for (const child of node.children) {
            this.walkNode(child, currentTransform, animation);
          }
        }
        break;

      case 'transform':
      case 'group':
        if (node.child) {
          this.walkNode(node.child, currentTransform, animation);
        }
        break;

      case 'material':
        // Extract color for instance
        if (node.child) {
          const childAnimation = animation ? { ...animation } : null;
          if (node.params?.color) {
            if (this.hasExpression(node.params.color)) {
              if (!childAnimation) childAnimation = {};
              childAnimation.color = node.params.color;
            }
          }
          this.walkNode(node.child, currentTransform, childAnimation);
        }
        break;

      case 'mirror':
        if (node.child) {
          // Original
          this.walkNode(node.child, currentTransform, animation);
          // Mirrored
          const mirrorTransform = this.applyMirror(currentTransform, node.axis);
          this.walkNode(node.child, mirrorTransform, animation);
        }
        break;

      case 'repeat':
        // For repeat nodes, we'd need to expand instances
        // For MVP, treat the child as a single instance
        if (node.child) {
          this.walkNode(node.child, currentTransform, animation);
        }
        break;

      case 'select':
        // For select nodes, include both branches as separate instances
        if (node.a) this.walkNode(node.a, currentTransform, animation);
        if (node.b) this.walkNode(node.b, currentTransform, animation);
        break;

      // Primitives - these could become templates themselves
      case 'sphere':
      case 'box':
      case 'cylinder':
      case 'capsule':
      case 'torus':
      case 'ellipsoid':
      case 'cone':
        // For primitives not in defs, create ad-hoc templates
        const primitiveId = `__primitive_${node.type}_${this.templates.size}`;
        if (!this.templates.has(primitiveId)) {
          this.templates.set(primitiveId, node);
        }
        this.instances.push({
          templateId: primitiveId,
          id: `${primitiveId}_inst`,
          transform: this.staticTransform(currentTransform),
          animation: animation,
          color: node.params?.color ? [...node.params.color, 1] : [0.8, 0.8, 0.8, 1],
          visible: true
        });
        break;
    }
  }

  /**
   * Combine parent and child transforms
   */
  combineTransforms(parent, child) {
    if (!child) return parent;

    return {
      translate: this.combineVec3(
        parent.translate,
        child.translate || [0, 0, 0]
      ),
      rotate: this.combineVec3(
        parent.rotate,
        child.rotate || [0, 0, 0]
      ),
      scale: this.combineScale(
        parent.scale,
        child.scale
      )
    };
  }

  combineVec3(a, b) {
    // For MVP, just add (proper would be matrix multiplication)
    return [
      this.addValues(a[0], b[0]),
      this.addValues(a[1], b[1]),
      this.addValues(a[2], b[2])
    ];
  }

  combineScale(a, b) {
    if (!b) return a;

    // Handle scalar scale
    const bArr = Array.isArray(b) ? b : [b, b, b];

    return [
      this.mulValues(a[0], bArr[0] || 1),
      this.mulValues(a[1], bArr[1] || bArr[0] || 1),
      this.mulValues(a[2], bArr[2] || bArr[0] || 1)
    ];
  }

  addValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      return a + b;
    }
    // If either is an expression, return expression
    if (this.isExpression(a) || this.isExpression(b)) {
      return { expr: 'add', args: [a, b] };
    }
    return (a || 0) + (b || 0);
  }

  mulValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      return a * b;
    }
    if (this.isExpression(a) || this.isExpression(b)) {
      return { expr: 'mul', args: [a, b] };
    }
    return (a || 1) * (b || 1);
  }

  isExpression(v) {
    return v && typeof v === 'object' && (v.expr || v.var);
  }

  hasExpression(arr) {
    if (!Array.isArray(arr)) return this.isExpression(arr);
    return arr.some(v => this.isExpression(v));
  }

  /**
   * Extract static transform (evaluate expressions at t=0)
   */
  staticTransform(transform) {
    return {
      translate: transform.translate.map(v => this.evaluateStatic(v)),
      rotate: transform.rotate.map(v => this.evaluateStatic(v)),
      scale: transform.scale.map(v => this.evaluateStatic(v))
    };
  }

  evaluateStatic(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    if (v.var === 'time') return 0;
    if (v.expr) {
      const args = (v.args || []).map(a => this.evaluateStatic(a));
      switch (v.expr) {
        case 'add': return args.reduce((a, b) => a + b, 0);
        case 'sub': return args[0] - (args[1] || 0);
        case 'mul': return args.reduce((a, b) => a * b, 1);
        case 'div': return args[0] / (args[1] || 1);
        case 'sin': return Math.sin(args[0] || 0);
        case 'cos': return Math.cos(args[0] || 0);
        case 'mix': return args[0];  // Return first value at t=0
        case 'smoothstep': return 0; // Before edge at t=0
        default: return 0;
      }
    }
    return 0;
  }

  /**
   * Extract animation info from transform
   */
  extractAnimation(transform, parentAnimation) {
    if (!transform) return parentAnimation;

    const hasAnim =
      this.hasExpression(transform.translate) ||
      this.hasExpression(transform.rotate) ||
      this.hasExpression(transform.scale);

    if (!hasAnim) return parentAnimation;

    const animation = parentAnimation ? { ...parentAnimation } : { type: 'expression' };

    if (this.hasExpression(transform.translate)) {
      animation.translate = transform.translate;
    }
    if (this.hasExpression(transform.rotate)) {
      animation.rotate = transform.rotate;
    }
    if (this.hasExpression(transform.scale)) {
      animation.scale = transform.scale;
    }

    return animation;
  }

  /**
   * Apply mirror transform
   */
  applyMirror(transform, axis) {
    const result = {
      translate: [...transform.translate],
      rotate: [...transform.rotate],
      scale: [...transform.scale]
    };

    const axisIndex = { x: 0, y: 1, z: 2 }[axis] || 0;

    // Flip position on axis
    if (typeof result.translate[axisIndex] === 'number') {
      result.translate[axisIndex] = -result.translate[axisIndex];
    }

    // Flip scale on axis
    if (typeof result.scale[axisIndex] === 'number') {
      result.scale[axisIndex] = -result.scale[axisIndex];
    }

    return result;
  }

  /**
   * Get bounds for a template
   */
  getTemplateBounds(templateId) {
    const def = this.templates.get(templateId);
    if (!def) return null;

    // Estimate bounds from node type
    return this.estimateNodeBounds(def);
  }

  estimateNodeBounds(node) {
    if (!node) return { min: [-1, -1, -1], max: [1, 1, 1] };

    switch (node.type) {
      case 'sphere':
        const r = node.params?.r || 1;
        return { min: [-r, -r, -r], max: [r, r, r] };

      case 'box':
        const size = node.params?.size || [1, 1, 1];
        return {
          min: [-size[0], -size[1], -size[2]],
          max: [size[0], size[1], size[2]]
        };

      case 'union':
      case 'subtract':
        if (node.children && node.children.length > 0) {
          return this.estimateNodeBounds(node.children[0]);
        }
        break;

      case 'transform':
        if (node.child) {
          const childBounds = this.estimateNodeBounds(node.child);
          // Apply transform to bounds (simplified)
          const t = node.transform?.translate || [0, 0, 0];
          return {
            min: childBounds.min.map((v, i) => v + (typeof t[i] === 'number' ? t[i] : 0)),
            max: childBounds.max.map((v, i) => v + (typeof t[i] === 'number' ? t[i] : 0))
          };
        }
        break;
    }

    return { min: [-1, -1, -1], max: [1, 1, 1] };
  }
}

export default TemplateExtractor;
