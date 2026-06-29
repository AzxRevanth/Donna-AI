import React, { useEffect, useRef } from 'react';

interface DonnaBlobProps {
  state: 'idle' | 'listening' | 'speaking' | 'thinking';
  audioLevel?: number; // 0 to 1
  isMini?: boolean;
  size?: number;
}

export default function DonnaBlob({ state, audioLevel = 0, isMini = false, size: sizeProp }: DonnaBlobProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const size = sizeProp || (isMini ? 80 : 280);
    const miniLike = isMini || (sizeProp !== undefined && sizeProp < 150);

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      timeRef.current += 0.016; // Approx 60fps
      const t = timeRef.current;

      const cx = size / 2;
      const cy = size / 2;
      
      // Base radius of the blob
      const baseRadius = miniLike ? Math.round(size * 0.275) : Math.round(size * 0.285);

      // Parameters based on state
      let morphSpeed = 1.0;
      let morphAmp = miniLike ? Math.round(size * 0.025) : Math.round(size * 0.028);
      let scaleX = 1.0;
      let scaleY = 1.0;
      let rotationSpeed = 0.5; // rad per sec
      let colorCenter = '#c9a84c';
      let colorEdge = '#8a6f30';
      let glowOpacity = 0.3;

      if (state === 'idle') {
        morphSpeed = 1.0;
        morphAmp = miniLike ? Math.round(size * 0.025) : Math.round(size * 0.021);
        rotationSpeed = 0.15;
        const breathe = 1.0 + Math.sin(t * 2) * 0.04;
        scaleX = breathe;
        scaleY = breathe;
        colorCenter = '#c9a84c';
        colorEdge = '#8a6f30';
        glowOpacity = 0.25;
      } else if (state === 'listening') {
        morphSpeed = 2.5;
        // audioLevel determines the distortion amplitude
        morphAmp = (miniLike ? Math.round(size * 0.037) : Math.round(size * 0.035)) + audioLevel * (miniLike ? Math.round(size * 0.1) : Math.round(size * 0.09));
        rotationSpeed = 0.3;
        const scalePulse = 1.0 + audioLevel * 0.35;
        scaleX = scalePulse;
        scaleY = scalePulse;
        colorCenter = '#e8c46a';
        colorEdge = '#8a6f30';
        glowOpacity = 0.4 + audioLevel * 0.3;

        // Draw outer concentric pulse ring if sound is loud
        if (audioLevel > 0.4 && !miniLike) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius * scalePulse * 1.4, 0, 2 * Math.PI);
          ctx.strokeStyle = `rgba(232, 196, 106, ${0.4 - audioLevel * 0.2})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }
      } else if (state === 'speaking') {
        morphSpeed = 1.8;
        morphAmp = miniLike ? Math.round(size * 0.037) : Math.round(size * 0.042);
        rotationSpeed = 0.5;
        // Simulated rhythmic speech pulse
        const speechPulse = 1.0 + Math.abs(Math.sin(t * 8) * Math.cos(t * 3.7)) * 0.12;
        scaleX = speechPulse;
        scaleY = speechPulse;
        colorCenter = '#f0e8d0';
        colorEdge = '#8a6f30';
        glowOpacity = 0.35;
      } else if (state === 'thinking') {
        morphSpeed = 0.6;
        morphAmp = miniLike ? Math.round(size * 0.018) : Math.round(size * 0.014);
        rotationSpeed = 0.1;
        scaleX = 0.93;
        scaleY = 1.07;
        colorCenter = '#b09545';
        colorEdge = '#6e5824';
        glowOpacity = 0.15;

        // Orbiting dots in thinking state (only in normal mode)
        if (!miniLike) {
          ctx.save();
          const orbitRadius = baseRadius * 1.35;
          const numDots = 3;
          for (let i = 0; i < numDots; i++) {
            const angle = t * 1.5 + (i * 2 * Math.PI) / numDots;
            const dotX = cx + Math.cos(angle) * orbitRadius;
            const dotY = cy + Math.sin(angle) * orbitRadius;
            
            // Draw small glowing orbit dot
            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#c9a84c';
            ctx.shadowColor = '#c9a84c';
            ctx.shadowBlur = 10;
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // Start drawing blob
      ctx.save();
      
      // Outer Glow Effect using native canvas shadow
      if (!miniLike) {
        ctx.shadowColor = colorCenter;
        ctx.shadowBlur = 35 * (miniLike ? 0.3 : 1.0);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // Translate to center and apply state-based scaling and rotation
      ctx.translate(cx, cy);
      ctx.scale(scaleX, scaleY);
      ctx.rotate(t * rotationSpeed);

      // Generate morphed control points
      const numPoints = 8;
      const pts: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * 2 * Math.PI;
        
        // Multi-frequency sine wave morph offset
        const morphOffset = 
          Math.sin(theta * 2 + t * morphSpeed * 2.2) * morphAmp +
          Math.cos(theta * 3 - t * morphSpeed * 1.5) * (morphAmp * 0.4) +
          Math.sin(theta * 5 + t * morphSpeed * 3.1) * (morphAmp * 0.15);

        const r = baseRadius + morphOffset;
        pts.push({
          x: Math.cos(theta) * r,
          y: Math.sin(theta) * r
        });
      }

      // Draw the smooth blob using quadratic bezier interpolation
      ctx.beginPath();
      const startPtX = (pts[0].x + pts[numPoints - 1].x) / 2;
      const startPtY = (pts[0].y + pts[numPoints - 1].y) / 2;
      ctx.moveTo(startPtX, startPtY);

      for (let i = 0; i < numPoints; i++) {
        const next = (i + 1) % numPoints;
        const controlX = pts[i].x;
        const controlY = pts[i].y;
        const endX = (pts[i].x + pts[next].x) / 2;
        const endY = (pts[i].y + pts[next].y) / 2;
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
      }
      ctx.closePath();

      // Create rich radial gradient for premium look
      const grad = ctx.createRadialGradient(0, 0, baseRadius * 0.1, 0, 0, baseRadius * 1.2);
      grad.addColorStop(0, colorCenter);
      grad.addColorStop(0.4, colorEdge);
      grad.addColorStop(1.0, 'rgba(26, 24, 20, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Add a fine highlight stroke on top for metallic glass look
      ctx.strokeStyle = `rgba(240, 232, 208, ${0.15 + (state === 'listening' ? audioLevel * 0.1 : 0)})`;
      ctx.lineWidth = isMini ? 1 : 2;
      ctx.stroke();

      ctx.restore();

      // Request next frame
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, audioLevel, isMini]);

  return (
    <div className="relative flex items-center justify-center select-none pointer-events-none">
      <canvas ref={canvasRef} className="block transition-all duration-300 ease-out" />
    </div>
  );
}
