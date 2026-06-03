'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export type OpportunityNetworkCursorHandle = {
  burstQuote: (point?: ViewportPoint) => void;
  clusterTeam: (point?: ViewportPoint) => void;
};

type ViewportPoint = {
  x: number;
  y: number;
};

type ParticleKind = 'participant' | 'opportunity' | 'support';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSize: number;
  pulse: number;
  kind: ParticleKind;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type Highlight = {
  a: number;
  b: number;
  life: number;
  maxLife: number;
};

const PARTICLE_COUNT = 30;
const CONNECT_DISTANCE = 145;
const ATTRACT_DISTANCE = 170;
const COLORS: Record<ParticleKind, string> = {
  participant: '#003A34',
  opportunity: '#E7A637',
  support: '#9BCFB3',
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function prefersNoEffect() {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(pointer: coarse), (hover: none), (max-width: 767px)').matches
  );
}

const OpportunityNetworkCursor = forwardRef<OpportunityNetworkCursorHandle>(function OpportunityNetworkCursor(
  _props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const highlightRef = useRef<Highlight | null>(null);
  const cursorRef = useRef({ x: 0, y: 0, active: false });
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const nextHighlightRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const [enabled, setEnabled] = useState(false);

  useImperativeHandle(ref, () => ({
    burstQuote(point) {
      const localPoint = toLocalPoint(canvasRef.current, point);
      if (!localPoint) return;

      for (let i = 0; i < 14; i += 1) {
        const angle = (Math.PI * 2 * i) / 14 + randomBetween(-0.18, 0.18);
        const speed = randomBetween(0.7, 2.1);
        sparksRef.current.push({
          x: localPoint.x,
          y: localPoint.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 34,
          maxLife: 34,
          color: '#E7A637',
          size: randomBetween(1.2, 2.8),
        });
      }
    },
    clusterTeam(point) {
      const localPoint = toLocalPoint(canvasRef.current, point);
      if (!localPoint) return;

      const nearby = particlesRef.current
        .map((particle, index) => ({
          index,
          distance: Math.hypot(particle.x - localPoint.x, particle.y - localPoint.y),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 8);

      nearby.forEach(({ index }, order) => {
        const particle = particlesRef.current[index];
        const angle = (Math.PI * 2 * order) / Math.max(nearby.length, 1);
        particle.vx += (localPoint.x + Math.cos(angle) * 26 - particle.x) * 0.018;
        particle.vy += (localPoint.y + Math.sin(angle) * 20 - particle.y) * 0.018;
        particle.kind = order % 2 === 0 ? 'participant' : 'support';
        particle.pulse = 1;
      });

      for (let i = 0; i < 8; i += 1) {
        sparksRef.current.push({
          x: localPoint.x + randomBetween(-12, 12),
          y: localPoint.y + randomBetween(-10, 10),
          vx: randomBetween(-0.55, 0.55),
          vy: randomBetween(-0.55, 0.55),
          life: 42,
          maxLife: 42,
          color: i % 2 === 0 ? '#003A34' : '#9BCFB3',
          size: randomBetween(1.4, 2.6),
        });
      }
    },
  }), []);

  useEffect(() => {
    setEnabled(!prefersNoEffect());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    const zone = canvas?.closest<HTMLElement>('[data-cursor-zone]');
    if (!canvas || !zone) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const resize = () => {
      const rect = zone.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particlesRef.current.length === 0) {
        particlesRef.current = createParticles(rect.width, rect.height);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const rect = canvas.getBoundingClientRect();

      cursorRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        active: true,
      };
    };

    const handlePointerLeave = () => {
      cursorRef.current.active = false;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(zone);
    zone.addEventListener('pointermove', handlePointerMove, { passive: true });
    zone.addEventListener('pointerleave', handlePointerLeave);

    const animate = (time: number) => {
      const lastTime = lastTimeRef.current || time;
      const delta = Math.min(32, time - lastTime);
      lastTimeRef.current = time;

      if (nextHighlightRef.current === 0) {
        nextHighlightRef.current = time + randomBetween(10000, 15000);
      } else if (time >= nextHighlightRef.current) {
        highlightRef.current = pickHighlight(particlesRef.current);
        nextHighlightRef.current = time + randomBetween(10000, 15000);
      }

      draw(context, delta);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      zone.removeEventListener('pointermove', handlePointerMove);
      zone.removeEventListener('pointerleave', handlePointerLeave);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      particlesRef.current = [];
      sparksRef.current = [];
      highlightRef.current = null;
    };
  }, [enabled]);

  const draw = (context: CanvasRenderingContext2D, delta: number) => {
    const { width, height } = sizeRef.current;
    const particles = particlesRef.current;
    const cursor = cursorRef.current;
    const step = delta / 16.67;

    context.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      if (cursor.active) {
        const dx = cursor.x - particle.x;
        const dy = cursor.y - particle.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 1 && distance < ATTRACT_DISTANCE) {
          const force = (1 - distance / ATTRACT_DISTANCE) * 0.022;
          particle.vx += (dx / distance) * force * step;
          particle.vy += (dy / distance) * force * step;
        }
      }

      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.vx *= 0.992;
      particle.vy *= 0.992;
      particle.pulse *= 0.94;

      if (particle.x < 18 || particle.x > width - 18) particle.vx *= -1;
      if (particle.y < 18 || particle.y > height - 18) particle.vy *= -1;
      particle.x = Math.max(18, Math.min(width - 18, particle.x));
      particle.y = Math.max(18, Math.min(height - 18, particle.y));
    });

    highlightRef.current = drawConnections(context, particles, highlightRef.current);
    drawParticles(context, particles);
    sparksRef.current = drawSparks(context, step, sparksRef.current);
  };

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
    />
  );
});

function createParticles(width: number, height: number) {
  const kinds: ParticleKind[] = ['participant', 'opportunity', 'support'];

  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    x: randomBetween(width * 0.08, width * 0.92),
    y: randomBetween(height * 0.12, height * 0.88),
    vx: randomBetween(-0.17, 0.17),
    vy: randomBetween(-0.13, 0.13),
    baseSize: randomBetween(2.1, 3.8),
    pulse: 0,
    kind: kinds[index % kinds.length],
  }));
}

function drawConnections(
  context: CanvasRenderingContext2D,
  particles: Particle[],
  highlight: Highlight | null
) {
  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const a = particles[i];
      const b = particles[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance > CONNECT_DISTANCE) continue;

      const strength = 1 - distance / CONNECT_DISTANCE;
      const isHighlighted = Boolean(
        highlight &&
          ((highlight.a === i && highlight.b === j) || (highlight.a === j && highlight.b === i))
      );
      const boost = isHighlighted && highlight ? Math.sin((highlight.life / highlight.maxLife) * Math.PI) : 0;
      context.strokeStyle = `rgba(250,240,217,${0.045 + strength * 0.12 + boost * 0.26})`;
      context.lineWidth = isHighlighted ? 1.25 : 0.75;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }

  if (highlight) {
    highlight.life -= 1;
    if (highlight.life <= 0) {
      return null;
    }
  }

  return highlight;
}

function drawParticles(context: CanvasRenderingContext2D, particles: Particle[]) {
  particles.forEach((particle) => {
    const size = particle.baseSize + particle.pulse * 2.4;
    context.shadowColor = 'rgba(250,240,217,0.35)';
    context.shadowBlur = particle.kind === 'participant' ? 8 : 12;
    context.fillStyle = COLORS[particle.kind];
    context.globalAlpha = particle.kind === 'participant' ? 0.58 : 0.68;
    context.beginPath();
    context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
    context.fill();
  });

  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

function drawSparks(context: CanvasRenderingContext2D, step: number, sparks: Spark[]) {
  const nextSparks: Spark[] = [];

  sparks.forEach((spark) => {
    spark.x += spark.vx * step;
    spark.y += spark.vy * step;
    spark.vx *= 0.97;
    spark.vy *= 0.97;
    spark.life -= step;

    const alpha = Math.max(0, spark.life / spark.maxLife);
    context.fillStyle = spark.color;
    context.globalAlpha = alpha * 0.82;
    context.shadowColor = 'rgba(250,240,217,0.35)';
    context.shadowBlur = 10;
    context.beginPath();
    context.arc(spark.x, spark.y, spark.size * (0.7 + alpha), 0, Math.PI * 2);
    context.fill();

    if (spark.life > 0) {
      nextSparks.push(spark);
    }
  });

  context.globalAlpha = 1;
  context.shadowBlur = 0;
  return nextSparks;
}

function pickHighlight(particles: Particle[]): Highlight | null {
  const pairs: Array<{ a: number; b: number; distance: number }> = [];

  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const distance = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
      if (distance <= CONNECT_DISTANCE) {
        pairs.push({ a: i, b: j, distance });
      }
    }
  }

  if (pairs.length === 0) return null;
  const closePairs = pairs.sort((a, b) => a.distance - b.distance).slice(0, 10);
  const pair = closePairs[Math.floor(Math.random() * closePairs.length)];
  return { a: pair.a, b: pair.b, life: 76, maxLife: 76 };
}

function toLocalPoint(canvas: HTMLCanvasElement | null, point?: ViewportPoint) {
  if (!canvas || !point) return null;
  const rect = canvas.getBoundingClientRect();

  return {
    x: point.x - rect.left,
    y: point.y - rect.top,
  };
}

export default OpportunityNetworkCursor;
