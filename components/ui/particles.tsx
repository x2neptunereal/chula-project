"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Circle {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
}

interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  color?: string;
  vx?: number;
  vy?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function remapValue(value: number, s1: number, e1: number, s2: number, e2: number) {
  const r = ((value - s1) * (e2 - s2)) / (e1 - s1) + s2;
  return r > 0 ? r : 0;
}

export function Particles({
  className,
  quantity = 120,
  staticity = 50,
  ease = 50,
  size = 0.5,
  color = "#ffffff",
  vx = 0,
  vy = 0,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const circlesRef = useRef<Circle[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const canvasSize = useRef({ w: 0, h: 0 });
  const rafId = useRef<number>(0);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

  function circleParams(): Circle {
    const { w, h } = canvasSize.current;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      translateX: 0,
      translateY: 0,
      size: Math.random() * 1.5 + size,
      alpha: 0,
      targetAlpha: parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)),
      dx: (Math.random() - 0.5) * 0.2,
      dy: (Math.random() - 0.5) * 0.2,
      magnetism: 0.1 + Math.random() * 4,
    };
  }

  function drawCircle(circle: Circle, update = false) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const rgb = hexToRgb(color);
    ctx.save();
    ctx.translate(circle.translateX, circle.translateY);
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${circle.alpha})`;
    ctx.fill();
    ctx.restore();
    if (!update) circlesRef.current.push(circle);
  }

  function clearCtx() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
  }

  function drawParticles() {
    clearCtx();
    circlesRef.current = [];
    for (let i = 0; i < quantity; i++) {
      drawCircle(circleParams());
    }
  }

  function resizeCanvas() {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!container || !canvas || !ctx) return;
    canvasSize.current.w = container.offsetWidth;
    canvasSize.current.h = container.offsetHeight;
    canvas.width = canvasSize.current.w * dpr;
    canvas.height = canvasSize.current.h * dpr;
    canvas.style.width = `${canvasSize.current.w}px`;
    canvas.style.height = `${canvasSize.current.h}px`;
    ctx.scale(dpr, dpr);
    circlesRef.current = [];
    drawParticles();
  }

  function animate() {
    clearCtx();
    const { w, h } = canvasSize.current;
    circlesRef.current.forEach((circle, i) => {
      const edges = [
        circle.x + circle.translateX - circle.size,
        w - circle.x - circle.translateX - circle.size,
        circle.y + circle.translateY - circle.size,
        h - circle.y - circle.translateY - circle.size,
      ];
      const closest = Math.min(...edges);
      const edgeAlpha = parseFloat(remapValue(closest, 0, 20, 0, 1).toFixed(2));

      if (edgeAlpha >= 1) {
        circle.alpha = Math.min(circle.alpha + 0.02, circle.targetAlpha);
      } else {
        circle.alpha = circle.targetAlpha * edgeAlpha;
      }

      circle.x += circle.dx + vx;
      circle.y += circle.dy + vy;
      circle.translateX += (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease;
      circle.translateY += (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease;

      drawCircle(circle, true);

      if (
        circle.x < -circle.size ||
        circle.x > w + circle.size ||
        circle.y < -circle.size ||
        circle.y > h + circle.size
      ) {
        circlesRef.current.splice(i, 1);
        drawCircle(circleParams());
      }
    });
    rafId.current = requestAnimationFrame(animate);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext("2d");
    resizeCanvas();
    animate();

    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { w, h } = canvasSize.current;
      const x = e.clientX - rect.left - w / 2;
      const y = e.clientY - rect.top - h / 2;
      if (Math.abs(x) < w / 2 && Math.abs(y) < h / 2) {
        mouse.current = { x, y };
      }
    };
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  useEffect(() => {
    drawParticles();
  }, [color]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
