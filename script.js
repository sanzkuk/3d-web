/**
 * ============================================================================
 * GeoGebra 3D - Standalone JavaScript Engine (script.js)
 * Script Three.js mandiri, cepat, dan responsif dengan sistem input aljabar di bawah,
 * perbaikan fungsi tan, bidang datar presisi, dan Platonic Solids.
 * ============================================================================
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GEOGEBRA_PALETTE = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#f59e0b', '#ec4899'];

function _safeTan(v) {
  if (isNaN(v) || !isFinite(v)) return 0;
  const modPi = ((v % Math.PI) + Math.PI) % Math.PI;
  if (Math.abs(modPi - Math.PI / 2) < 0.002) return 0;
  const res = Math.tan(v);
  if (isNaN(res) || !isFinite(res)) return 0;
  if (res > 7) return 7;
  if (res < -7) return -7;
  return res;
}

function sanitizeMathString(expr) {
  let clean = expr.trim().replace(/;/g, '').replace(/\s+/g, ' ').replace(/\^/g, '**');
  clean = clean.replace(/\bpi\b/gi, 'Math.PI').replace(/\be\b/gi, 'Math.E');
  clean = clean.replace(/Math\.tan\b/g, '_safeTan').replace(/\btan\b(?!\h)/gi, '_safeTan');
  ['sqrt', 'cbrt', 'sin', 'cos', 'asin', 'acos', 'atan', 'exp', 'log', 'abs'].forEach((fn) => {
    clean = clean.replace(new RegExp(`\\b${fn}\\b`, 'gi'), `Math.${fn}`);
  });
  clean = clean.replace(/([0-9])([a-zA-Z(])/g, '$1*$2');
  clean = clean.replace(/(\))([0-9a-zA-Z(])/g, '$1*$2');
  return clean;
}

class GeoGebra3DEngine {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.items = [];
    this.sliderVars = {};
    this.objectsMap = new Map();

    this.initThree();
    this.initEnvironment();
    this.setupEvents();
    this.initKeypad();

    this.addItem('a = 1.8');
    this.addItem('z = a * sin(sqrt(x^2 + y^2))');
    this.addItem('z = 0');
    this.addItem('Ikosahedron');

    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(12, 10, 14);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(15, 25, 20);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.4);
    dirLight2.position.set(-15, -10, -15);
    this.scene.add(dirLight2);

    this.itemsGroup = new THREE.Group();
    this.scene.add(this.itemsGroup);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
  }

  initEnvironment() {
    const boxSize = 6;
    const envGroup = new THREE.Group();

    const grid = new THREE.GridHelper(boxSize * 2, boxSize * 2, 0x475569, 0x334155);
    grid.position.y = 0;
    envGroup.add(grid);

    const matX = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 });
    const geomX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-8, 0, 0), new THREE.Vector3(8, 0, 0)]);
    envGroup.add(new THREE.Line(geomX, matX));

    const matY = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2 });
    const geomY = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -8), new THREE.Vector3(0, 0, 8)]);
    envGroup.add(new THREE.Line(geomY, matY));

    const matZ = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
    const geomZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -8, 0), new THREE.Vector3(0, 8, 0)]);
    envGroup.add(new THREE.Line(geomZ, matZ));

    this.scene.add(envGroup);
  }

  addItem(rawExpr) {
    const expr = rawExpr.trim();
    if (!expr) return;

    const id = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const color = GEOGEBRA_PALETTE[this.items.length % GEOGEBRA_PALETTE.length];

    const solidLower = expr.toLowerCase();
    const platonicTypes = ['tetrahedron', 'cube', 'kubus', 'octahedron', 'oktahedron', 'dodecahedron', 'dodekahedron', 'icosahedron', 'ikosahedron', 'cylinder', 'silinder', 'torus', 'pyramid', 'piramida'];
    const matchedSolid = platonicTypes.find((t) => solidLower.startsWith(t));

    if (matchedSolid) {
      let st = 'cube';
      if (solidLower.includes('tetra')) st = 'tetrahedron';
      else if (solidLower.includes('okta') || solidLower.includes('octa')) st = 'octahedron';
      else if (solidLower.includes('dodeka') || solidLower.includes('dodeca')) st = 'dodecahedron';
      else if (solidLower.includes('ikosa') || solidLower.includes('icosa')) st = 'icosahedron';
      else if (solidLower.includes('silinder') || solidLower.includes('cylinder')) st = 'cylinder';
      else if (solidLower.includes('torus')) st = 'torus';
      else if (solidLower.includes('piramid') || solidLower.includes('pyramid')) st = 'pyramid';

      this.items.push({ id, type: 'solid', solidType: st, name: expr, color, size: 2.2, visible: true });
      this.syncGeometries();
      this.renderAlgebraUI();
      return;
    }

    const sliderMatch = expr.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(-?\d+(\.\d+)?)$/);
    if (sliderMatch) {
      const name = sliderMatch[1];
      const val = parseFloat(sliderMatch[2]);
      this.sliderVars[name] = val;
      this.items.push({ id, type: 'slider', name, val, min: -5, max: 5, step: 0.1, visible: true, color });
      this.syncGeometries();
      this.renderAlgebraUI();
      return;
    }

    const planeCoeffs = this.parsePlane(expr);
    if (planeCoeffs) {
      this.items.push({ id, type: 'plane', name: expr, planeCoeffs, color, visible: true });
      this.syncGeometries();
      this.renderAlgebraUI();
      return;
    }

    let cleanSurf = expr.replace(/^z\s*=\s*/i, '');
    this.items.push({ id, type: 'surface', name: `z = ${cleanSurf}`, expr: cleanSurf, color, visible: true });
    this.syncGeometries();
    this.renderAlgebraUI();
  }

  parsePlane(expr) {
    if (!expr.includes('=')) return null;
    const parts = expr.split('=');
    let lhs = parts[0].trim();
    let rhs = parts[1].trim();
    try {
      const sLhs = sanitizeMathString(lhs);
      const sRhs = sanitizeMathString(rhs);
      const fn = new Function('x', 'y', 'z', '_safeTan', `return (${sLhs}) - (${sRhs});`);
      const D = -fn(0, 0, 0, _safeTan);
      const A = fn(1, 0, 0, _safeTan) + D;
      const B = fn(0, 1, 0, _safeTan) + D;
      const C = fn(0, 0, 1, _safeTan) + D;
      if (A * A + B * B + C * C > 1e-6) return [A, B, C, D];
    } catch {
      return null;
    }
    return null;
  }

  syncGeometries() {
    const currentIds = new Set(this.items.map((i) => i.id));
    for (const [id, obj] of this.objectsMap.entries()) {
      if (!currentIds.has(id)) {
        this.itemsGroup.remove(obj);
        this.objectsMap.delete(id);
      }
    }

    this.items.forEach((item) => {
      if (!item.visible) {
        const obj = this.objectsMap.get(item.id);
        if (obj) obj.visible = false;
        return;
      }

      if (item.type === 'surface') {
        const res = 45;
        const xMin = -5, xMax = 5, yMin = -5, yMax = 5;
        const stepX = (xMax - xMin) / res;
        const stepY = (yMax - yMin) / res;

        const varNames = Object.keys(this.sliderVars);
        const sExpr = sanitizeMathString(item.expr);
        let evalFn = () => 0;
        try {
          const compiled = new Function('x', 'y', 't', '_safeTan', ...varNames, `return ${sExpr};`);
          evalFn = (x, y) => compiled(x, y, 0, _safeTan, ...varNames.map((k) => this.sliderVars[k]));
        } catch {
          evalFn = () => 0;
        }

        const positions = [];
        const indices = [];
        const heights = [];

        for (let i = 0; i <= res; i++) {
          heights[i] = [];
          const x = xMin + i * stepX;
          for (let j = 0; j <= res; j++) {
            const y = yMin + j * stepY;
            let val = 0;
            try { val = Number(evalFn(x, y)); } catch { val = 0; }
            if (isNaN(val) || !isFinite(val)) val = 0;
            val = Math.max(-8, Math.min(8, val));
            heights[i][j] = val;
            positions.push(x, val, y);
          }
        }

        const jump = 5.2;
        for (let i = 0; i < res; i++) {
          for (let j = 0; j < res; j++) {
            const a = i * (res + 1) + j;
            const b = (i + 1) * (res + 1) + j;
            const c = (i + 1) * (res + 1) + (j + 1);
            const d = i * (res + 1) + (j + 1);

            const z1 = heights[i][j], z2 = heights[i + 1][j], z3 = heights[i + 1][j + 1], z4 = heights[i][j + 1];
            if (Math.abs(z1 - z2) < jump && Math.abs(z1 - z4) < jump && Math.abs(z2 - z4) < jump) {
              indices.push(a, b, d);
            }
            if (Math.abs(z2 - z3) < jump && Math.abs(z3 - z4) < jump && Math.abs(z2 - z4) < jump) {
              indices.push(b, c, d);
            }
          }
        }

        let mesh = this.objectsMap.get(item.id);
        if (!mesh) {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geom.setIndex(indices);
          geom.computeVertexNormals();

          const mat = new THREE.MeshStandardMaterial({
            color: item.color,
            side: THREE.DoubleSide,
            roughness: 0.35,
            metalness: 0.15,
            transparent: true,
            opacity: 0.88
          });

          mesh = new THREE.Mesh(geom, mat);
          this.itemsGroup.add(mesh);
          this.objectsMap.set(item.id, mesh);
        } else {
          mesh.visible = true;
          mesh.geometry.dispose();
          mesh.geometry = new THREE.BufferGeometry();
          mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          mesh.geometry.setIndex(indices);
          mesh.geometry.computeVertexNormals();
        }
      } else if (item.type === 'plane') {
        let pGroup = this.objectsMap.get(item.id);
        const [A, B, C, D] = item.planeCoeffs;
        const norm = new THREE.Vector3(A, C, B).normalize();
        const len = Math.sqrt(A * A + B * B + C * C) || 1;
        const centerPos = norm.clone().multiplyScalar(D / len);

        if (!pGroup) {
          pGroup = new THREE.Group();
          const geom = new THREE.PlaneGeometry(16, 16, 4, 4);
          const mat = new THREE.MeshStandardMaterial({
            color: item.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45,
            depthWrite: false
          });
          const pMesh = new THREE.Mesh(geom, mat);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: item.color, linewidth: 2 }));
          pMesh.add(edges);
          pGroup.add(pMesh);
          this.itemsGroup.add(pGroup);
          this.objectsMap.set(item.id, pGroup);
        }

        pGroup.visible = true;
        pGroup.position.copy(centerPos);
        const defNorm = new THREE.Vector3(0, 0, 1);
        if (norm.dot(defNorm) < -0.9999) {
          pGroup.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        } else {
          pGroup.quaternion.setFromUnitVectors(defNorm, norm);
        }
      } else if (item.type === 'solid') {
        let sGroup = this.objectsMap.get(item.id);
        if (!sGroup) {
          sGroup = new THREE.Group();
          let geom;
          switch (item.solidType) {
            case 'tetrahedron': geom = new THREE.TetrahedronGeometry(item.size); break;
            case 'cube': geom = new THREE.BoxGeometry(item.size * 1.3, item.size * 1.3, item.size * 1.3); break;
            case 'octahedron': geom = new THREE.OctahedronGeometry(item.size * 1.15); break;
            case 'dodecahedron': geom = new THREE.DodecahedronGeometry(item.size); break;
            case 'icosahedron': geom = new THREE.IcosahedronGeometry(item.size); break;
            case 'cylinder': geom = new THREE.CylinderGeometry(item.size * 0.7, item.size * 0.7, item.size * 1.4, 32); break;
            case 'torus': geom = new THREE.TorusGeometry(item.size * 0.8, item.size * 0.3, 16, 48); break;
            case 'pyramid': geom = new THREE.ConeGeometry(item.size, item.size * 1.4, 4); break;
            default: geom = new THREE.BoxGeometry(item.size, item.size, item.size);
          }

          const mat = new THREE.MeshStandardMaterial({
            color: item.color,
            transparent: true,
            opacity: 0.85,
            roughness: 0.25,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geom, mat);
          sGroup.add(mesh);

          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
          sGroup.add(edges);

          this.itemsGroup.add(sGroup);
          this.objectsMap.set(item.id, sGroup);
        }
        sGroup.visible = true;
      }
    });
  }

  renderAlgebraUI() {
    const list = document.getElementById('items-list');
    const badge = document.getElementById('dock-counter');
    if (badge) badge.textContent = this.items.length;
    if (!list) return;

    list.innerHTML = '';
    this.items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const dot = document.createElement('div');
      dot.className = 'item-dot';
      dot.style.backgroundColor = item.visible ? item.color : 'transparent';
      dot.style.border = `2px solid ${item.color}`;
      dot.onclick = () => {
        item.visible = !item.visible;
        this.syncGeometries();
        this.renderAlgebraUI();
      };

      const content = document.createElement('div');
      content.className = 'item-content';

      const expr = document.createElement('div');
      expr.className = 'item-expr';
      expr.textContent = item.name;

      const sub = document.createElement('div');
      sub.className = 'item-sub';
      sub.textContent = item.type === 'solid' ? 'Bangun 3D Platonic' : item.type === 'plane' ? 'Bidang Datar' : item.type === 'slider' ? 'Penggeser' : 'Permukaan 3D';

      content.appendChild(expr);
      content.appendChild(sub);

      if (item.type === 'slider') {
        const sliderDiv = document.createElement('div');
        sliderDiv.className = 'slider-control';
        const range = document.createElement('input');
        range.type = 'range';
        range.min = item.min;
        range.max = item.max;
        range.step = item.step;
        range.value = this.sliderVars[item.name];
        range.oninput = (e) => {
          this.sliderVars[item.name] = parseFloat(e.target.value);
          this.syncGeometries();
        };
        sliderDiv.appendChild(range);
        content.appendChild(sliderDiv);
      }

      const del = document.createElement('button');
      del.className = 'item-del';
      del.textContent = '✕';
      del.onclick = () => {
        this.items = this.items.filter((i) => i.id !== item.id);
        if (item.type === 'slider') delete this.sliderVars[item.name];
        this.syncGeometries();
        this.renderAlgebraUI();
      };

      card.appendChild(dot);
      card.appendChild(content);
      card.appendChild(del);
      list.appendChild(card);
    });
  }

  setupEvents() {
    const dock = document.getElementById('bottom-dock');
    const trigger = document.getElementById('bottom-dock-trigger');
    const openBtn = document.getElementById('btn-open-dock');
    const closeBtn = document.getElementById('btn-close-dock');
    const platonicBtn = document.getElementById('btn-quick-platonic');

    openBtn.onclick = () => {
      dock.classList.remove('hidden');
      trigger.classList.add('hidden');
    };

    closeBtn.onclick = () => {
      dock.classList.add('hidden');
      trigger.classList.remove('hidden');
    };

    platonicBtn.onclick = () => {
      dock.classList.remove('hidden');
      trigger.classList.add('hidden');
      document.getElementById('tab-solids').click();
    };

    const tabAlg = document.getElementById('tab-algebra');
    const tabSol = document.getElementById('tab-solids');
    const tabPla = document.getElementById('tab-planes');
    const paneAlg = document.getElementById('pane-algebra');
    const paneSol = document.getElementById('pane-solids');
    const panePla = document.getElementById('pane-planes');

    tabAlg.onclick = () => {
      [tabAlg, tabSol, tabPla].forEach((t) => t.classList.remove('active'));
      tabAlg.classList.add('active');
      paneAlg.classList.remove('hidden');
      paneSol.classList.add('hidden');
      panePla.classList.add('hidden');
    };

    tabSol.onclick = () => {
      [tabAlg, tabSol, tabPla].forEach((t) => t.classList.remove('active'));
      tabSol.classList.add('active');
      paneSol.classList.remove('hidden');
      paneAlg.classList.add('hidden');
      panePla.classList.add('hidden');
    };

    tabPla.onclick = () => {
      [tabAlg, tabSol, tabPla].forEach((t) => t.classList.remove('active'));
      tabPla.classList.add('active');
      panePla.classList.remove('hidden');
      paneAlg.classList.add('hidden');
      paneSol.classList.add('hidden');
    };

    const input = document.getElementById('expression-input');
    const submitBtn = document.getElementById('btn-submit-expr');
    const submitAction = () => {
      this.addItem(input.value);
      input.value = '';
    };
    submitBtn.onclick = submitAction;
    input.onkeydown = (e) => { if (e.key === 'Enter') submitAction(); };

    document.querySelectorAll('.chip').forEach((chip) => {
      chip.onclick = () => this.addItem(chip.dataset.insert);
    });

    document.querySelectorAll('.solid-card').forEach((card) => {
      card.onclick = () => {
        this.addItem(card.dataset.solid);
        tabAlg.click();
      };
    });

    document.querySelectorAll('.plane-card').forEach((card) => {
      card.onclick = () => {
        this.addItem(card.dataset.plane);
        tabAlg.click();
      };
    });

    document.getElementById('btn-clear-all').onclick = () => {
      this.items = [];
      this.sliderVars = {};
      this.itemsGroup.clear();
      this.objectsMap.clear();
      this.renderAlgebraUI();
    };

    document.getElementById('btn-cam-iso').onclick = () => this.setCamera(12, 10, 14);
    document.getElementById('btn-cam-top').onclick = () => this.setCamera(0, 20, 0.001);
    document.getElementById('btn-cam-front').onclick = () => this.setCamera(0, 0, 18);
    document.getElementById('btn-cam-side').onclick = () => this.setCamera(18, 0, 0);
    document.getElementById('btn-reset-cam').onclick = () => this.setCamera(12, 10, 14);

    document.getElementById('btn-screenshot').onclick = () => {
      this.renderer.render(this.scene, this.camera);
      const link = document.createElement('a');
      link.download = `geogebra-3d-${Date.now()}.png`;
      link.href = this.renderer.domElement.toDataURL('image/png');
      link.click();
    };

    window.onresize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
  }

  setCamera(x, y, z) {
    this.camera.position.set(x, y, z);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  initKeypad() {
    const keypad = document.getElementById('virtual-keypad');
    const dockKeypadBtn = document.getElementById('btn-toggle-keypad-dock');
    const closeBtn = document.getElementById('btn-close-keypad');
    const input = document.getElementById('expression-input');
    const keysContainer = document.getElementById('keypad-keys');

    dockKeypadBtn.onclick = () => keypad.classList.toggle('hidden');
    closeBtn.onclick = () => keypad.classList.add('hidden');

    const defaultKeys = ['x', 'y', 'z', '7', '8', '9', '/', '⌫', 'x²', '√', 'pi', '4', '5', '6', '*', '(', 'a', 't', '=', '1', '2', '3', '-', ')', '+', '0', '.', 'sin(', 'cos(', 'tan(', '^', '↵'];

    keysContainer.innerHTML = '';
    defaultKeys.forEach((k) => {
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      btn.textContent = k;
      btn.onclick = () => {
        if (k === '⌫') {
          input.value = input.value.slice(0, -1);
        } else if (k === '↵') {
          this.addItem(input.value);
          input.value = '';
          keypad.classList.add('hidden');
        } else if (k === 'x²') {
          input.value += '^2';
        } else {
          input.value += k;
        }
        input.focus();
      };
      keysContainer.appendChild(btn);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GeoGebra3DEngine();
});
