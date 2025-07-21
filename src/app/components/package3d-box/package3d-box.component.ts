import {
  Component,
  Input,
  ElementRef,
  AfterViewInit,
  ViewChild,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-package-3d-box',
  standalone: true,
  templateUrl: './package3d-box.component.html',
  styleUrls: ['./package3d-box.component.scss'],
})
export class Package3dBoxComponent implements AfterViewInit, OnDestroy {
  @Input() pkg!: any; // Replace 'any' with your Package type if you have it
  @ViewChild('boxCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() stopSpin = new EventEmitter<void>();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private boxMesh!: THREE.Mesh;
  private animationId = 0;
  private isHovered = false;

  ngAfterViewInit(): void {
    this.initScene();
    this.startRenderingLoop();

    // Stop spin on user hover or click
    const canvas = this.canvasRef.nativeElement;

    canvas.addEventListener('mouseenter', () => {
      this.isHovered = true;
    });
    canvas.addEventListener('mouseleave', () => {
      this.isHovered = false;
    });
    canvas.addEventListener('touchstart', () => {
      this.isHovered = true;
    });
    canvas.addEventListener('touchend', () => {
      this.isHovered = false;
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);

    // Dispose Three.js mesh and children
    if (this.boxMesh) {
      // Dispose box geometry and material
      this.boxMesh.geometry.dispose();
      if (Array.isArray(this.boxMesh.material)) {
        this.boxMesh.material.forEach((mat) => mat.dispose && mat.dispose());
      } else {
        this.boxMesh.material?.dispose?.();
      }
      // Dispose child geometries/materials (edges, tape)
      while (this.boxMesh.children.length > 0) {
        const child = this.boxMesh.children[0];
        if ((child as any).geometry) (child as any).geometry.dispose?.();
        if ((child as any).material) (child as any).material.dispose?.();
        this.boxMesh.remove(child);
      }
    }

    this.controls?.dispose();
    this.renderer?.dispose();

    // THIS IS THE KEY HACK:
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    } catch (e) {
      // ignore
    }

    // Nullify references for GC (not strictly required, but helps)
    (this as any).boxMesh = null;
    (this as any).renderer = null;
    (this as any).controls = null;
    (this as any).scene = null;
    (this as any).camera = null;
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Box dimensions (meters) - realistic, but must fit canvas
    const length = this.pkg.length ?? 0.4;
    const width = this.pkg.width ?? 0.3;
    const height = this.pkg.height ?? 0.25;

    // Find the largest dimension
    const maxDim = Math.max(length, width, height);

    // Cardboard color, use random for distinction
    const boxColor = this.pkg.color ?? 0xdeb887;
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: boxColor,
      roughness: 0.9,
      metalness: 0.1,
    });

    const geom = new THREE.BoxGeometry(length, height, width);
    this.boxMesh = new THREE.Mesh(geom, boxMaterial);

    // Add darker edges
    const edges = new THREE.EdgesGeometry(geom);
    const edgeLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x775533 }),
    );
    this.boxMesh.add(edgeLines);

    // "Tape" on top face (distinction)
    const tapeGeom = new THREE.PlaneGeometry(width * 0.7, length * 0.12);
    const tapeMat = new THREE.MeshBasicMaterial({
      color: this.pkg.tapeColor ?? 0x3b82f6,
    });
    const tape = new THREE.Mesh(tapeGeom, tapeMat);
    tape.position.y = height / 2 + 0.001;
    tape.rotation.x = -Math.PI / 2;
    this.boxMesh.add(tape);

    this.scene.add(this.boxMesh);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(2, 4, 2);
    this.scene.add(dir);

    // Camera: always fit the box in the view!
    const { clientWidth: w, clientHeight: h } = canvas;
    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 10);
    const camDist = maxDim * 2.3; // Always fit no matter box size
    this.camera.position.set(maxDim, maxDim, camDist);
    this.camera.lookAt(0, 0, 0);

    // Orbit Controls
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private startRenderingLoop(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      // Auto-spin until user interacts
      if (!this.isHovered && this.boxMesh) {
        this.boxMesh.rotation.y += 0.008;
      } else if (this.controls) {
        this.controls.enableRotate = true;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
