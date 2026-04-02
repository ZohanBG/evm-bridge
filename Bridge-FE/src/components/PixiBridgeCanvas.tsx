'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import { chainA, chainB, chainC, CHAIN_META } from '@/config/chains';

export interface PixiBridgeCanvasProps {
  pair: 'AB' | 'AC';
  direction: 'outgoing' | 'incoming' | null;
  onPairChange?: (pair: 'AB' | 'AC') => void;
}

const COIN_COUNT = 10;
const STAR_COUNT = 120;
const PLANET_RADIUS = 50;
const RING_COUNT = 3; // surface bands per planet

export function PixiBridgeCanvas({ pair, direction, onPairChange }: PixiBridgeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef({ pair, direction });
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const onPairChangeRef = useRef(onPairChange);
  onPairChangeRef.current = onPairChange;

  stateRef.current = { pair, direction };

  const initApp = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const app = new Application();
    await app.init({
      width: w,
      height: h,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    el.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    // ============================
    // Starfield — depth layers
    // ============================
    const stars: { g: Graphics; vx: number; vy: number; baseAlpha: number; depth: number }[] = [];
    const starContainer = new Container();
    app.stage.addChild(starContainer);

    for (let i = 0; i < STAR_COUNT; i++) {
      const g = new Graphics();
      const depth = Math.random();
      const r = depth * 2 + 0.3;
      g.circle(0, 0, r);
      g.fill({ color: depth > 0.7 ? 0xc4b5fd : depth > 0.4 ? 0x93c5fd : 0xffffff });
      g.position.set(Math.random() * w, Math.random() * h);
      const baseAlpha = depth * 0.5 + 0.1;
      g.alpha = baseAlpha;
      starContainer.addChild(g);
      stars.push({ g, vx: (Math.random() - 0.5) * 0.1 * (1 + depth), vy: (Math.random() - 0.5) * 0.06 * (1 + depth), baseAlpha, depth });
    }

    // ============================
    // Nebula blobs (ambient color)
    // ============================
    const nebulaContainer = new Container();
    app.stage.addChild(nebulaContainer);
    const nebulaColors = [0x6366f1, 0x8b5cf6, 0x3b82f6, 0x06b6d4];
    for (let i = 0; i < 4; i++) {
      const blob = new Graphics();
      blob.circle(0, 0, 120 + Math.random() * 80);
      blob.fill({ color: nebulaColors[i] });
      blob.alpha = 0.015 + Math.random() * 0.01;
      blob.position.set(Math.random() * w, Math.random() * h);
      nebulaContainer.addChild(blob);
    }

    // ============================
    // Grid (subtle)
    // ============================
    const gridGraphics = new Graphics();
    app.stage.addChild(gridGraphics);

    // ============================
    // Mouse glow
    // ============================
    const mouseGlow = new Graphics();
    mouseGlow.circle(0, 0, 200);
    mouseGlow.fill({ color: 0x6366f1 });
    mouseGlow.alpha = 0;
    app.stage.addChild(mouseGlow);

    // ============================
    // Edge graphics
    // ============================
    const edgeGraphics = new Graphics();
    app.stage.addChild(edgeGraphics);

    // ============================
    // Planet system
    // ============================
    function getNodes(cw: number, ch: number) {
      const cx = cw / 2;
      const cy = ch / 2;
      const spread = Math.min(cw, ch) * 0.28;
      return {
        A: { x: cx, y: cy - spread * 1.05, chainId: chainA.id },
        B: { x: cx - spread * 1.35, y: cy + spread * 0.75, chainId: chainB.id },
        C: { x: cx + spread * 1.35, y: cy + spread * 0.75, chainId: chainC.id },
      };
    }

    let nodes = getNodes(w, h);

    // Each planet: container with layers
    interface Planet {
      key: string;
      container: Container;
      baseColor: number;
      bands: Graphics[];
      atmosphere: Graphics;
      core: Graphics;
      shadow: Graphics;
      label: Text;
      tiltX: number; // rotation axis tilt
      tiltY: number;
      rotSpeed: number;
      orbitParticles: { g: Graphics; angle: number; dist: number; speed: number; size: number }[];
    }

    const planetContainer = new Container();
    app.stage.addChild(planetContainer);

    const planets: Planet[] = [];

    function buildPlanets(cw: number, ch: number) {
      planetContainer.removeChildren();
      planets.length = 0;
      nodes = getNodes(cw, ch);

      const configs: { key: string; tiltX: number; tiltY: number; rotSpeed: number }[] = [
        { key: 'A', tiltX: 0.3, tiltY: 0.1, rotSpeed: 0.4 },
        { key: 'B', tiltX: -0.2, tiltY: 0.5, rotSpeed: 0.6 },
        { key: 'C', tiltX: 0.15, tiltY: -0.4, rotSpeed: 0.5 },
      ];

      for (const cfg of configs) {
        const node = nodes[cfg.key as keyof typeof nodes];
        const meta = CHAIN_META[node.chainId];
        const baseColor = parseInt(meta.color.replace('#', ''), 16);

        const container = new Container();
        container.position.set(node.x, node.y);

        // Atmosphere glow
        const atmosphere = new Graphics();
        atmosphere.circle(0, 0, PLANET_RADIUS + 15);
        atmosphere.fill({ color: baseColor });
        atmosphere.alpha = 0.12;
        container.addChild(atmosphere);

        // Second atmosphere layer
        const atmo2 = new Graphics();
        atmo2.circle(0, 0, PLANET_RADIUS + 8);
        atmo2.fill({ color: baseColor });
        atmo2.alpha = 0.08;
        container.addChild(atmo2);

        // Core sphere (main body)
        const core = new Graphics();
        core.circle(0, 0, PLANET_RADIUS);
        core.fill({ color: baseColor });
        container.addChild(core);

        // Surface bands (to create rotation illusion)
        const bands: Graphics[] = [];
        for (let b = 0; b < RING_COUNT; b++) {
          const band = new Graphics();
          container.addChild(band);
          bands.push(band);
        }

        // Highlight (light source from top-left)
        const highlight = new Graphics();
        highlight.circle(-PLANET_RADIUS * 0.25, -PLANET_RADIUS * 0.25, PLANET_RADIUS * 0.6);
        highlight.fill({ color: 0xffffff });
        highlight.alpha = 0.1;
        container.addChild(highlight);

        // Shadow (dark side)
        const shadow = new Graphics();
        shadow.circle(PLANET_RADIUS * 0.15, PLANET_RADIUS * 0.15, PLANET_RADIUS);
        shadow.fill({ color: 0x000000 });
        shadow.alpha = 0.25;
        container.addChild(shadow);

        // Label
        const label = new Text({
          text: meta.label,
          style: new TextStyle({ fontSize: 20, fontWeight: 'bold', fill: 0xffffff, letterSpacing: 2 }),
        });
        label.anchor.set(0.5, 0.5);
        label.position.set(0, 0);
        container.addChild(label);

        // Orbiting particles
        const orbitParticles: Planet['orbitParticles'] = [];
        const particleCount = 5 + Math.floor(Math.random() * 4);
        for (let p = 0; p < particleCount; p++) {
          const pg = new Graphics();
          const size = 1.5 + Math.random() * 2;
          pg.circle(0, 0, size);
          pg.fill({ color: baseColor });
          pg.alpha = 0.4 + Math.random() * 0.3;
          container.addChild(pg);
          orbitParticles.push({
            g: pg,
            angle: Math.random() * Math.PI * 2,
            dist: PLANET_RADIUS + 20 + Math.random() * 25,
            speed: 0.3 + Math.random() * 0.5,
            size,
          });
        }

        planetContainer.addChild(container);

        planets.push({
          key: cfg.key,
          container,
          baseColor,
          bands,
          atmosphere,
          core,
          shadow,
          label,
          tiltX: cfg.tiltX,
          tiltY: cfg.tiltY,
          rotSpeed: cfg.rotSpeed,
          orbitParticles,
        });
      }
    }

    buildPlanets(w, h);

    // ============================
    // Coin particles (energy orbs)
    // ============================
    const coinContainer = new Container();
    app.stage.addChild(coinContainer);

    const coins: { core: Graphics; glow: Graphics; trail: Graphics; progress: number }[] = [];
    for (let i = 0; i < COIN_COUNT; i++) {
      const glow = new Graphics();
      glow.circle(0, 0, 12);
      glow.fill({ color: 0xfbbf24 });
      glow.alpha = 0.3;

      const core = new Graphics();
      core.circle(0, 0, 5);
      core.fill({ color: 0xfef3c7 });
      core.circle(0, 0, 3);
      core.fill({ color: 0xfbbf24 });

      const trail = new Graphics();

      coinContainer.addChild(trail);
      coinContainer.addChild(glow);
      coinContainer.addChild(core);

      core.alpha = 0;
      glow.alpha = 0;
      trail.alpha = 0;

      coins.push({ core, glow, trail, progress: i / COIN_COUNT });
    }

    // ============================
    // Hover tooltip
    // ============================
    const tooltip = new Container();
    const tooltipBg = new Graphics();
    const tooltipText = new Text({
      text: '',
      style: new TextStyle({ fontSize: 12, fill: '#e2e8f0' }),
    });
    tooltipText.anchor.set(0.5, 0);
    tooltip.addChild(tooltipBg);
    tooltip.addChild(tooltipText);
    tooltip.alpha = 0;
    app.stage.addChild(tooltip);

    // ============================
    // Events
    // ============================
    const handleMouseMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mouseRef.current.x = e.clientX - r.left;
      mouseRef.current.y = e.clientY - r.top;
    };
    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };
    const handleClick = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      for (const planet of planets) {
        const node = nodes[planet.key as keyof typeof nodes];
        const dx = cx - node.x;
        const dy = cy - node.y;
        if (Math.sqrt(dx * dx + dy * dy) < PLANET_RADIUS + 15) {
          if (planet.key === 'B') onPairChangeRef.current?.('AB');
          else if (planet.key === 'C') onPairChangeRef.current?.('AC');
          // Clicking A does nothing (it's always the source)
          break;
        }
      }
    };
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('click', handleClick);

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      app.renderer.resize(r.width, r.height);
      buildPlanets(r.width, r.height);
    });
    ro.observe(el);

    // ============================
    // Animation
    // ============================
    let elapsed = 0;

    app.ticker.add((ticker) => {
      elapsed += ticker.deltaTime / 60;
      const { pair: curPair, direction: curDir } = stateRef.current;
      const target = curPair === 'AB' ? 'B' : 'C';
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // --- Stars ---
      for (const star of stars) {
        star.g.x += star.vx;
        star.g.y += star.vy;
        if (star.g.x < -10) star.g.x = cw + 10;
        if (star.g.x > cw + 10) star.g.x = -10;
        if (star.g.y < -10) star.g.y = ch + 10;
        if (star.g.y > ch + 10) star.g.y = -10;
        star.g.alpha = star.baseAlpha + Math.sin(elapsed * 3 + star.g.x * 0.005 + star.g.y * 0.003) * 0.2;
      }

      // --- Grid ---
      gridGraphics.clear();
      const gridAlpha = 0.025 + Math.sin(elapsed * 0.5) * 0.01;
      for (let x = 0; x < cw; x += 60) {
        gridGraphics.moveTo(x, 0); gridGraphics.lineTo(x, ch);
      }
      for (let y = 0; y < ch; y += 60) {
        gridGraphics.moveTo(0, y); gridGraphics.lineTo(cw, y);
      }
      gridGraphics.stroke({ width: 0.4, color: 0x6366f1, alpha: gridAlpha });

      // --- Mouse glow ---
      if (mx > 0 && my > 0) {
        mouseGlow.position.set(mx, my);
        mouseGlow.alpha = 0.06;
      } else {
        mouseGlow.alpha = 0;
      }

      // --- Edges ---
      edgeGraphics.clear();
      const allEdges: [string, string][] = [['A', 'B'], ['A', 'C'], ['B', 'C']];
      for (const [a, b] of allEdges) {
        const na = nodes[a as keyof typeof nodes];
        const nb = nodes[b as keyof typeof nodes];
        const isActive = (a === 'A' && b === target) || (b === 'A' && a === target);

        if (isActive) {
          const pulse = 0.5 + Math.sin(elapsed * 2.5) * 0.3;
          // Wide glow
          edgeGraphics.moveTo(na.x, na.y); edgeGraphics.lineTo(nb.x, nb.y);
          edgeGraphics.stroke({ width: 10, color: 0x6366f1, alpha: pulse * 0.15 });
          // Mid glow
          edgeGraphics.moveTo(na.x, na.y); edgeGraphics.lineTo(nb.x, nb.y);
          edgeGraphics.stroke({ width: 4, color: 0x818cf8, alpha: pulse * 0.4 });
          // Core
          edgeGraphics.moveTo(na.x, na.y); edgeGraphics.lineTo(nb.x, nb.y);
          edgeGraphics.stroke({ width: 1.5, color: 0xa5b4fc, alpha: 0.8 });
        } else {
          edgeGraphics.moveTo(na.x, na.y); edgeGraphics.lineTo(nb.x, nb.y);
          edgeGraphics.stroke({ width: 1, color: 0x334155, alpha: 0.25 });
        }
      }

      // --- Planets ---
      let hoveredPlanet: Planet | null = null;

      for (const planet of planets) {
        const node = nodes[planet.key as keyof typeof nodes];
        planet.container.position.set(node.x, node.y);

        const isEndpoint = planet.key === 'A' || planet.key === target;
        const dx = mx - node.x;
        const dy = my - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hovered = dist < PLANET_RADIUS + 15;
        if (hovered) hoveredPlanet = planet;

        // Atmosphere pulse
        const atmPulse = 1 + Math.sin(elapsed * 1.5 + planet.tiltX * 5) * 0.08;
        planet.atmosphere.scale.set(atmPulse);
        planet.atmosphere.alpha = isEndpoint ? (hovered ? 0.2 : 0.14) : 0.06;

        // Surface bands — rotating ellipses to fake 3D rotation
        for (let b = 0; b < planet.bands.length; b++) {
          const band = planet.bands[b];
          band.clear();

          const bandOffset = (b - (RING_COUNT - 1) / 2) * (PLANET_RADIUS * 0.5);
          const t = elapsed * planet.rotSpeed + b * 1.2;

          // Elliptical band that shifts horizontally to simulate rotation
          const xShift = Math.sin(t) * PLANET_RADIUS * 0.6;
          const bandWidth = Math.abs(Math.cos(t)) * PLANET_RADIUS * 0.3 + 2;
          const yPos = bandOffset * Math.cos(planet.tiltX);

          if (bandWidth > 3) {
            band.ellipse(xShift * 0.3, yPos, bandWidth, PLANET_RADIUS * 0.85);
            band.stroke({
              width: 1.5,
              color: planet.baseColor,
              alpha: (isEndpoint ? 0.25 : 0.1) * Math.abs(Math.cos(t)),
            });
          }
        }

        // Shadow rotation
        const shadowAngle = elapsed * 0.3 + planet.tiltY;
        planet.shadow.position.set(
          Math.cos(shadowAngle) * PLANET_RADIUS * 0.15,
          Math.sin(shadowAngle) * PLANET_RADIUS * 0.15,
        );

        // Orbit particles
        for (const op of planet.orbitParticles) {
          op.angle += op.speed * 0.02;
          const ox = Math.cos(op.angle) * op.dist;
          const oy = Math.sin(op.angle) * op.dist * (0.3 + Math.abs(Math.sin(planet.tiltX)) * 0.4);
          op.g.position.set(ox, oy);
          op.g.alpha = isEndpoint ? 0.5 + Math.sin(elapsed * 2 + op.angle) * 0.2 : 0.15;
        }

        // Scale on hover
        const targetScale = hovered ? 1.08 : 1;
        planet.container.scale.set(
          planet.container.scale.x + (targetScale - planet.container.scale.x) * 0.1,
        );

        // Label visibility
        planet.label.alpha = isEndpoint ? 0.9 : 0.4;
      }

      // --- Cursor style ---
      el.style.cursor = (hoveredPlanet && (hoveredPlanet.key === 'B' || hoveredPlanet.key === 'C')) ? 'pointer' : 'default';

      // --- Tooltip on hover ---
      if (hoveredPlanet && mx > 0) {
        const meta = CHAIN_META[nodes[hoveredPlanet.key as keyof typeof nodes].chainId];
        const chainId = nodes[hoveredPlanet.key as keyof typeof nodes].chainId;
        tooltipText.text = `Chain ${meta.label} (${chainId})`;
        tooltipBg.clear();
        const tw = tooltipText.width + 16;
        const th = tooltipText.height + 8;
        tooltipBg.roundRect(-tw / 2, -2, tw, th, 6);
        tooltipBg.fill({ color: 0x1e293b });
        tooltipBg.stroke({ width: 1, color: 0x475569 });
        const node = nodes[hoveredPlanet.key as keyof typeof nodes];
        tooltip.position.set(node.x, node.y - PLANET_RADIUS - 28);
        tooltipText.position.set(0, 2);
        tooltip.alpha += (0.95 - tooltip.alpha) * 0.15;
      } else {
        tooltip.alpha *= 0.85;
      }

      // --- Coins (energy orbs) ---
      if (!curDir) {
        for (const coin of coins) {
          coin.core.alpha = 0;
          coin.glow.alpha = 0;
          coin.trail.alpha = 0;
        }
      } else {
        const fromNode = curDir === 'outgoing' ? nodes.A : nodes[target as keyof typeof nodes];
        const toNode = curDir === 'outgoing' ? nodes[target as keyof typeof nodes] : nodes.A;

        for (let i = 0; i < coins.length; i++) {
          coins[i].progress += 0.005;
          if (coins[i].progress > 1) coins[i].progress -= 1;

          const t = coins[i].progress;
          // Quadratic bezier curve — always arc "outward" from triangle center
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          // Perpendicular unit vector (rotate 90° CCW)
          const perpX = -dy / len;
          const perpY = dx / len;
          // Arc outward: use fixed magnitude, flip sign so arc bows away from triangle center
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;
          const triCenterX = (nodes.A.x + nodes.B.x + nodes.C.x) / 3;
          const triCenterY = (nodes.A.y + nodes.B.y + nodes.C.y) / 3;
          // Dot product to check which side of the edge the center is on
          const toCenter = (triCenterX - midX) * perpX + (triCenterY - midY) * perpY;
          const sign = toCenter > 0 ? -1 : 1; // arc away from center
          const arcAmount = len * 0.25;
          const cx = midX + perpX * arcAmount * sign;
          const cy = midY + perpY * arcAmount * sign;
          // Quadratic bezier interpolation
          const mt = 1 - t;
          const x = mt * mt * fromNode.x + 2 * mt * t * cx + t * t * toNode.x;
          const y = mt * mt * fromNode.y + 2 * mt * t * cy + t * t * toNode.y;

          coins[i].core.position.set(x, y);
          coins[i].glow.position.set(x, y);

          const fade = Math.min(t * 5, (1 - t) * 5, 1);
          coins[i].core.alpha = fade * 0.95;
          coins[i].glow.alpha = fade * 0.35;

          // Pulsing glow
          const glowPulse = 1 + Math.sin(elapsed * 6 + i * 0.8) * 0.3;
          coins[i].glow.scale.set(glowPulse);

          // Trail — multiple segments along the bezier
          coins[i].trail.clear();
          if (t > 0.02 && t < 0.98) {
            const trailLen = 0.08;
            const ts = Math.max(t - trailLen, 0);
            const segments = 6;
            for (let s = 0; s <= segments; s++) {
              const st = ts + (t - ts) * (s / segments);
              const smt = 1 - st;
              const sx = smt * smt * fromNode.x + 2 * smt * st * cx + st * st * toNode.x;
              const sy = smt * smt * fromNode.y + 2 * smt * st * cy + st * st * toNode.y;
              if (s === 0) coins[i].trail.moveTo(sx, sy);
              else coins[i].trail.lineTo(sx, sy);
            }
            coins[i].trail.stroke({ width: 2, color: 0xfbbf24, alpha: fade * 0.4 });
          }
          coins[i].trail.alpha = 1;
        }
      }
    });

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('click', handleClick);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initApp().then((fn) => { if (fn) cleanup = fn; });
    return () => {
      cleanup?.();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [initApp]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: 'radial-gradient(ellipse at 30% 30%, #0c1222 0%, #030712 70%)' }}
    />
  );
}
