import {
  Component,
  ElementRef,
  AfterViewInit,
  ViewChild,
  OnDestroy,
  HostListener,
  ViewChildren,
  QueryList,
  ChangeDetectorRef,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Package3dBoxComponent } from '../package3d-box/package3d-box.component';
import { CommonModule } from '@angular/common';
import { LoadPlanService } from '../../services/load-plan.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-trailer-360',
  standalone: true,
  templateUrl: './uld-360.component.html',
  styleUrls: ['./uld-360.component.scss'],
  imports: [CommonModule, Package3dBoxComponent],
})
export class Uld360Component implements AfterViewInit, OnDestroy {
  @ViewChild('canvas3d', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pkgBar', { static: false }) pkgBar!: ElementRef<HTMLDivElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId = 0;
  private placedBoxes: THREE.Mesh[] = [];
  private placedBoxesById: Map<string, THREE.Mesh> = new Map();
  private trailerGroup: THREE.Group = new THREE.Group();

  isHovered = false;
  isExecuting = false;
  canScrollLeft = false;
  canScrollRight = false;
  packages: any[] = [];
  selectedPackage: any = null;
  visibleIndices: Set<number> = new Set();
  lastLoadPlanMessage: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private loadPlanService: LoadPlanService,
  ) {}

  addPackage() {
    this.packages.push(this.generateRandomPackage());
  }

  ngAfterViewInit(): void {
    this.initScene();
    this.startRenderingLoop();
    this.canvasRef.nativeElement.addEventListener('mouseenter', () => {
      this.isHovered = true;
    });
    this.canvasRef.nativeElement.addEventListener('mouseleave', () => {
      this.isHovered = false;
    });
    this.canvasRef.nativeElement.addEventListener('touchstart', () => {
      this.isHovered = true;
    });
    this.canvasRef.nativeElement.addEventListener('touchend', () => {
      this.isHovered = false;
    });
    this.pkgBar.nativeElement.addEventListener(
      'scroll',
      this.checkArrowVisibility.bind(this),
    );
    setTimeout(() => {
      this.checkArrowVisibility();
    }, 50);
    this.pkgBar.nativeElement.addEventListener('scroll', () => {
      this.checkArrowVisibility();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    this.controls?.dispose();
    this.renderer?.dispose();
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // === Real LD1 AKC Dimensions ===
    const depth = 1.534; // Z
    const height = 1.6256; // Y
    const topWidth = 2.3368; // Full width at top
    const baseWidth = 1.6104; // Full width at base

    const leftBaseX = -baseWidth / 2;
    const rightBaseX = baseWidth / 2; // ✅ Use this for right wall base & top (90°)
    const rightTopX = rightBaseX; // ✅ Make right wall vertical
    const leftTopX = -1.3;

    const midY = height * 0.5; // where flat ends and slant begins on the left

    // === Vertices
    const vertices = new Float32Array([
      // Bottom face
      leftBaseX,
      0,
      -depth / 2, // 0: left-back-bottom
      rightBaseX,
      0,
      -depth / 2, // 1: right-back-bottom
      rightBaseX,
      0,
      depth / 2, // 2: right-front-bottom
      leftBaseX,
      0,
      depth / 2, // 3: left-front-bottom

      // Left vertical midpoint (split point)
      leftTopX,
      midY,
      -depth / 2, // 4
      leftTopX,
      midY,
      depth / 2, // 5

      // Top face
      leftTopX,
      height,
      -depth / 2, // 6
      rightTopX,
      height,
      -depth / 2, // 7
      rightTopX,
      height,
      depth / 2, // 8
      leftTopX,
      height,
      depth / 2, // 9
    ]);

    // === Faces
    const indices = [
      // Bottom face
      0,
      1,
      2,
      0,
      2,
      3,

      // Right wall (flat vertical)
      1,
      2,
      8,
      1,
      8,
      7,

      // Left wall (bottom slant + top flat)
      0,
      3,
      5,
      0,
      5,
      4, // angled bottom section
      4,
      5,
      9,
      4,
      9,
      6, // vertical upper section

      // Front face
      3,
      2,
      8,
      3,
      8,
      9,

      // Back face
      0,
      1,
      7,
      0,
      7,
      6,

      // Top face
      6,
      7,
      8,
      6,
      8,
      9,
    ];

    // === Geometry setup
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    // === Wireframe
    const wireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0xffd700 }),
    );

    // === Glow mesh
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffe066,
        wireframe: true,
        transparent: true,
        opacity: 0.1,
      }),
    );

    this.trailerGroup.clear();
    this.trailerGroup.add(wireframe);
    this.trailerGroup.add(mesh);

    // === Scene placement
    this.trailerGroup.position.y = 1; // bottom of container flush with ground
    this.scene.add(this.trailerGroup);

    // === Floor Grid that matches base size and rotates with container
    const gridWidth = baseWidth; // match container base width (X)
    const gridDepth = depth; // match container length (Z)
    const divisions = 10;

    const floorGrid = new THREE.GridHelper(
      gridWidth, // total size in X direction
      divisions,
      0xccccff,
      0x444466,
    );

    // Rotate grid to lie on XZ (default) — no need for rotation at all
    floorGrid.position.set(0, 0.01, 0); // Just above Y=0 to avoid z-fighting

    // Scale along Z to match depth (since GridHelper only allows square grids by default)
    floorGrid.scale.set(1, 1, gridDepth / gridWidth); // ✅ adjust depth to match container

    this.trailerGroup.add(floorGrid); // ✅ it will rotate with the container

    // === Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const spot = new THREE.SpotLight(0x99bbff, 0.6, 0, Math.PI / 3, 0.1);
    spot.position.set(0, height * 1.1, depth * 0.7);
    this.scene.add(spot);

    // === Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setClearAlpha(0);

    // === Camera
    const { clientWidth: w, clientHeight: ch } = canvas;
    this.camera = new THREE.PerspectiveCamera(50, w / ch, 1, 500);
    this.camera.position.set(3, height * 1.3, depth * 3);

    // === Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enableZoom = true;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI / 1.7;
    this.controls.target.set(0, height / 1.3, 0);
    this.controls.update();

    this.onResize();
  }

  private startRenderingLoop(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      // Auto-rotate trailer until user interacts
      if (!this.isHovered) {
        this.trailerGroup.rotation.y += 0.0025;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.camera || !this.renderer) return;
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  generateRandomPackage(): any {
    const upsBoxes = [
      { name: 'Small', l: 0.305, w: 0.229, h: 0.152 },
      { name: 'Medium', l: 0.457, w: 0.305, h: 0.152 },
      { name: 'Large', l: 0.457, w: 0.305, h: 0.305 },
      { name: 'XL', l: 0.559, w: 0.356, h: 0.356 },
    ];
    const box = upsBoxes[Math.floor(Math.random() * upsBoxes.length)];
    const volume = +(box.l * box.w * box.h).toFixed(3);
    const weight = +(Math.random() * 10 + 2).toFixed(2); // 2–12kg
    const priorities = ['Low', 'Medium', 'High'];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const id = `PKG-${Math.floor(Math.random() * 10000)}`;
    const deliveryOrder = Math.floor(Math.random() * 30) + 1;
    const fragilityOptions = ['Fragile', 'Not Fragile'];
    const fragility =
      fragilityOptions[Math.floor(Math.random() * fragilityOptions.length)];

    // Random “cardboard” color (brown tints)
    function getRandomCardboardColor() {
      const base = [222, 184, 135]; // #deb887
      return (
        ((base[0] + Math.floor(Math.random() * 12 - 6)) << 16) |
        ((base[1] + Math.floor(Math.random() * 20 - 10)) << 8) |
        (base[2] + Math.floor(Math.random() * 20 - 10))
      );
    }
    // Random “tape” color
    function getRandomTapeColor() {
      const palette = [0x3b82f6, 0xf87171, 0x22c55e, 0xfacc15, 0xf59e42];
      return palette[Math.floor(Math.random() * palette.length)];
    }

    return {
      id,
      name: box.name,
      length: box.l,
      width: box.w,
      height: box.h,
      volume,
      weight,
      priority,
      deliveryOrder,
      color: getRandomCardboardColor(),
      tapeColor: getRandomTapeColor(),
      fragility,
    };
  }

  scrollPackages(direction: 'left' | 'right') {
    const el = this.pkgBar.nativeElement;
    const step = 180; // px, match box size
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
    setTimeout(() => this.checkArrowVisibility(), 350);
  }

  checkArrowVisibility() {
    const el = this.pkgBar.nativeElement;
    this.canScrollLeft = el.scrollLeft > 4;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
  }

  addPackageAndScrollToEnd() {
    this.addPackage();
    setTimeout(() => {
      if (this.pkgBar?.nativeElement) {
        this.pkgBar.nativeElement.scrollTo({
          left: this.pkgBar.nativeElement.scrollWidth,
          behavior: 'smooth',
        });
        this.checkArrowVisibility();
      }
    }, 50); // allow DOM to update
  }

  removePackage(index: number) {
    this.packages.splice(index, 1);
  }

  executeLoadPlan() {
    if (this.packages.length === 0) return;
    this.isExecuting = true;
    this.lastLoadPlanMessage = null;

    // ULD/container dimensions (meters)
    const uld = {
      code: 'AKC', // optional, for future
      length: 1.534, // Z
      width: 1.6104, // X (base)
      height: 1.6256, // Y
      topWidth: 2.3368, // X (top)
    };

    this.loadPlanService
      .executeLoadPlan(uld, this.packages)
      .pipe(finalize(() => (this.isExecuting = false)))
      .subscribe({
        next: (res) => {
          this.applyLoadPlanResult(res);
        },
        error: (err) => {
          console.log('API error:', err);
          this.lastLoadPlanMessage = 'Error communicating with backend!';
        },
      });
  }

  private applyLoadPlanResult(res: any) {
    // 1. Remove old boxes
    this.placedBoxes.forEach((box) => this.trailerGroup.remove(box));
    this.placedBoxes = [];

    // 2. For each positioned box, create & add to scene
    if (res?.positions) {
      for (const pos of res.positions) {
        // Box geometry uses width, height, length (Z)
        const geometry = new THREE.BoxGeometry(
          pos.width,
          pos.height,
          pos.length,
        );
        const material = new THREE.MeshStandardMaterial({
          color: 0xdeb887,
          roughness: 0.9,
          metalness: 0.2,
          transparent: true,
          opacity: 0.92,
        });
        const mesh = new THREE.Mesh(geometry, material);
        (mesh as any).packageId = pos.id; // Track ID
        mesh.position.set(pos.x, pos.y, pos.z);
        this.placedBoxesById.set(pos.id, mesh); // Store reference

        // Edges for clear borders
        const edges = new THREE.EdgesGeometry(geometry);
        const edgeLines = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x775533 }),
        );
        mesh.add(edgeLines);

        // Add to container group
        this.trailerGroup.add(mesh);
        this.placedBoxes.push(mesh);
      }
    }
    this.cdr.detectChanges(); // If you want instant update for anything else
  }

  highlightPackage(id: string) {
    const mesh = this.placedBoxesById.get(id);
    if (mesh) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xff4f4f,
        transparent: true,
        opacity: 1,
        emissive: 0xff4444,
        emissiveIntensity: 0.5,
      });
    }
  }

  clearHighlight() {
    for (const [id, mesh] of this.placedBoxesById.entries()) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xdeb887,
        transparent: true,
        opacity: 0.92,
        roughness: 0.9,
        metalness: 0.2,
      });
    }
  }
}
