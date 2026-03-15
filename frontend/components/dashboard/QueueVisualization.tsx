"use client";

import { useEffect, useRef } from "react";

interface QueueVisualizationProps {
  queueDepth: number;
}

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  phase: "incoming" | "funnel" | "queue";
  hue: number;
}

export default function QueueVisualization({ queueDepth }: QueueVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const depthRef = useRef(queueDepth);

  depthRef.current = queueDepth;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement!);

    const createParticle = (w: number, h: number): Particle => {
      const phase = Math.random();
      if (phase < 0.5) {
        return {
          x: Math.random() * w * 0.35,
          y: Math.random() * h,
          targetX: w * 0.4,
          targetY: h * 0.5 + (Math.random() - 0.5) * h * 0.6,
          speed: 0.3 + Math.random() * 0.7,
          phase: "incoming",
          hue: 260 + Math.random() * 20,
        };
      } else if (phase < 0.8) {
        return {
          x: w * 0.4 + Math.random() * w * 0.25,
          y: h * 0.3 + Math.random() * h * 0.4,
          targetX: w * 0.72,
          targetY: h * 0.5 + (Math.random() - 0.5) * h * 0.15,
          speed: 0.4 + Math.random() * 0.6,
          phase: "funnel",
          hue: 270,
        };
      } else {
        return {
          x: w * 0.72 + Math.random() * w * 0.05,
          y: h * 0.15 + Math.random() * h * 0.7,
          targetX: w * 0.95,
          targetY: h * 0.15 + Math.random() * h * 0.7,
          speed: 0.5 + Math.random() * 0.5,
          phase: "queue",
          hue: 140,
        };
      }
    };

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.fillStyle = "rgba(8, 8, 16, 0.15)";
      ctx.fillRect(0, 0, w, h);

      // Draw funnel shape (subtle guide lines)
      ctx.strokeStyle = "rgba(107, 92, 231, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, 0);
      ctx.lineTo(w * 0.7, h * 0.35);
      ctx.lineTo(w * 0.7, h * 0.65);
      ctx.lineTo(w * 0.35, h);
      ctx.stroke();

      // Draw queue channel
      ctx.strokeStyle = "rgba(74, 222, 128, 0.08)";
      ctx.beginPath();
      ctx.moveTo(w * 0.7, h * 0.35);
      ctx.lineTo(w, h * 0.35);
      ctx.moveTo(w * 0.7, h * 0.65);
      ctx.lineTo(w, h * 0.65);
      ctx.stroke();

      // Target particle count based on queue depth
      const targetCount = Math.min(Math.max(depthRef.current, 20), 500);
      const particles = particlesRef.current;

      // Add/remove particles
      while (particles.length < targetCount) {
        particles.push(createParticle(w, h));
      }
      while (particles.length > targetCount + 50) {
        particles.pop();
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
          // Recycle particle
          particles[i] = createParticle(w, h);
          continue;
        }

        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;

        // Add slight wobble to incoming particles
        if (p.phase === "incoming") {
          p.y += Math.sin(Date.now() * 0.003 + i) * 0.3;
        }

        const alpha = p.phase === "incoming" ? 0.4 : p.phase === "funnel" ? 0.7 : 0.9;
        const size = p.phase === "queue" ? 3 : 2;

        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow for queue particles
        if (p.phase === "queue") {
          ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, 0.15)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="bg-midnight-900/80 border border-midnight-700/30 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-midnight-100/50">
          Queue Flow
        </span>
        <span className="text-xs font-mono text-midnight-100/40">
          {queueDepth.toLocaleString()} in queue
        </span>
      </div>

      <div className="flex-1 relative min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-lg" />
        {/* Zone labels */}
        <div className="absolute inset-0 flex pointer-events-none">
          <div className="w-[35%] flex items-end justify-center pb-2">
            <span className="text-[10px] uppercase tracking-widest text-purple-400/30">
              Incoming
            </span>
          </div>
          <div className="w-[35%] flex items-end justify-center pb-2">
            <span className="text-[10px] uppercase tracking-widest text-purple-400/30">
              Funnel
            </span>
          </div>
          <div className="w-[30%] flex items-end justify-center pb-2">
            <span className="text-[10px] uppercase tracking-widest text-green-400/30">
              FIFO Queue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
