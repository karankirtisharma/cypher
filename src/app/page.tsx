'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, Volume2, VolumeX } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 288;
const SPLASH_DURATION_MS = 8200;
const TRANSITION_DURATION_MS = 1400;
const TRANSITION_MIDPOINT_MS = 700;
const AUTO_SCROLL_DELAY_MS = 1600;
const SEQUENCE_TRIGGER_ID = 'cyphernaut-sequence';

export default function SplashPage() {
  const [mounted, setMounted] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isAppActive, setIsAppActive] = useState(false);
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionType, setTransitionType] = useState<'pop' | 'white'>('pop');

  // Refs for values that should NOT trigger re-renders
  const isMutedRef = useRef(true);
  const [isMutedDisplay, setIsMutedDisplay] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const imagesLoadedRef = useRef(false);
  const lenisRef = useRef<any>(null);
  const rafIdRef = useRef<number>(0);
  const lastRenderedFrameRef = useRef(-1);
  const dropletsRef = useRef<{ tx: string; ty: string; delay: string }[]>([]);

  // Pre-generate droplets once (avoids hydration mismatch via ref)
  if (dropletsRef.current.length === 0 && typeof window !== 'undefined') {
    dropletsRef.current = Array.from({ length: 16 }, () => ({
      tx: `${(Math.random() - 0.5) * 1200}px`,
      ty: `${(Math.random() - 0.5) * 1200}px`,
      delay: `${Math.random() * 0.4}s`,
    }));
  }

  // ── Canvas Frame Renderer (memoized, no deps on state) ──
  const renderFrame = useCallback((index: number) => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const clamped = Math.max(0, Math.min(index, FRAME_COUNT - 1));
    if (clamped === lastRenderedFrameRef.current) return; // Skip redundant draws

    const img = imagesRef.current[clamped];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    lastRenderedFrameRef.current = clamped;

    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const x = (canvas.width - img.naturalWidth * scale) / 2;
    const y = (canvas.height - img.naturalHeight * scale) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
  }, []);

  // ── Transition Controller ──
  const triggerTransition = useCallback((callback?: () => void, type: 'pop' | 'white' = 'pop') => {
    setTransitionType(type);
    setTransitionActive(true);

    const midTimer = setTimeout(() => {
      if (callback) callback();
    }, TRANSITION_MIDPOINT_MS);

    const endTimer = setTimeout(() => {
      setTransitionActive(false);
    }, TRANSITION_DURATION_MS);

    return () => {
      clearTimeout(midTimer);
      clearTimeout(endTimer);
    };
  }, []);

  // ── Phase Transitions ──
  const handleLaunchExperience = useCallback(() => {
    triggerTransition(() => {
      setIsEntering(true);
      isMutedRef.current = false;
      setIsMutedDisplay(false);
    }, 'pop');
  }, [triggerTransition]);

  const toApp = useCallback(() => {
    triggerTransition(() => {
      setIsEntering(false);
      setIsAppActive(true);
    }, 'white');
  }, [triggerTransition]);

  const handleExit = useCallback(() => {
    setIsAppActive(false);
    setIsEntering(false);
    // Reset scroll position
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
    window.scrollTo(0, 0);
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMutedDisplay(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  }, []);

  // ── 1. Mount + Lenis Init ──
  useEffect(() => {
    setMounted(true);

    // Generate droplets client-side for hydration safety
    if (dropletsRef.current.length === 0) {
      dropletsRef.current = Array.from({ length: 16 }, () => ({
        tx: `${(Math.random() - 0.5) * 1200}px`,
        ty: `${(Math.random() - 0.5) * 1200}px`,
        delay: `${Math.random() * 0.4}s`,
      }));
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      rafIdRef.current = requestAnimationFrame(raf);
    }
    rafIdRef.current = requestAnimationFrame(raf);

    lenis.on('scroll', ScrollTrigger.update);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // ── 2. Splash Phase: Single Timer (fixes timer conflict) ──
  useEffect(() => {
    if (!isEntering || isAppActive) {
      // Stop audio when leaving splash
      if (!isEntering && !isAppActive && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    // Play audio safely
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.muted = isMutedRef.current;
      audioRef.current.play().catch(() => {
        // Autoplay blocked by browser — silently degrade
      });
    }

    // Single auto-advance timer
    const timer = setTimeout(toApp, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isEntering, isAppActive, toApp]);

  // ── 3. Canvas Sequence + GSAP ScrollTrigger ──
  useEffect(() => {
    if (!isAppActive || !mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    contextRef.current = context;

    // Size canvas to viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Preload images ONCE (fixes memory leak)
    if (!imagesLoadedRef.current) {
      imagesLoadedRef.current = true;
      imagesRef.current = [];

      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = new (window as any).Image() as HTMLImageElement;
        img.src = `/sequence/ezgif-frame-${(i + 1).toString().padStart(3, '0')}.webp`;
        imagesRef.current.push(img);

        // Render first frame as soon as it loads
        if (i === 0) {
          img.onload = () => renderFrame(0);
        }
      }
    } else {
      // Images already loaded — render current frame
      renderFrame(0);
    }

    // GSAP ScrollTrigger for frame scrubbing
    const frameObj = { value: 0 };
    const scrollTl = gsap.to(frameObj, {
      value: FRAME_COUNT - 1,
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.15,
        id: SEQUENCE_TRIGGER_ID,
        onUpdate: (self) => {
          const frame = Math.round(self.progress * (FRAME_COUNT - 1));
          renderFrame(frame);
        },
      },
    });

    const handleResize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      lastRenderedFrameRef.current = -1; // Force re-draw on resize

      const trigger = ScrollTrigger.getById(SEQUENCE_TRIGGER_ID);
      const progress = trigger?.progress ?? 0;
      renderFrame(Math.round(progress * (FRAME_COUNT - 1)));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scrollTl.kill();
      // Kill ONLY our trigger, not others
      const trigger = ScrollTrigger.getById(SEQUENCE_TRIGGER_ID);
      if (trigger) trigger.kill();
    };
  }, [isAppActive, mounted, renderFrame]);

  // ── 4. Cinematic Auto-Scroll on App Entry ──
  useEffect(() => {
    if (!isAppActive || !lenisRef.current) return;

    const timer = setTimeout(() => {
      if (!lenisRef.current) return;
      lenisRef.current.scrollTo(window.innerHeight * 1.5, {
        duration: 6,
        easing: (t: number) => t,
        immediate: false,
      });
    }, AUTO_SCROLL_DELAY_MS);

    const stopAutoScroll = () => {
      clearTimeout(timer);
      if (lenisRef.current) {
        lenisRef.current.stop();
        lenisRef.current.start();
      }
      window.removeEventListener('wheel', stopAutoScroll);
      window.removeEventListener('touchstart', stopAutoScroll);
    };

    window.addEventListener('wheel', stopAutoScroll, { passive: true });
    window.addEventListener('touchstart', stopAutoScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('wheel', stopAutoScroll);
      window.removeEventListener('touchstart', stopAutoScroll);
    };
  }, [isAppActive]);

  // ── 5. Audio Cleanup on Unmount ──
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // ── SSR Guard ──
  if (!mounted) return <main className="min-h-screen bg-cypher-dark" />;

  // ── Render: Main App Content ──
  const MainContent = (
    <main ref={containerRef} className="relative bg-cypher-dark w-full">
      {/* Fixed Background Canvas */}
      <div className="fixed inset-0 z-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover grayscale-[0.2] brightness-75"
          style={{ willChange: 'contents' }}
        />
        <div className="absolute inset-0 bg-radial-[at_center_center] from-transparent via-transparent to-black/80 pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
      </div>

      {/* Scrollable Spatial UI */}
      <div className="relative z-10 w-full overflow-hidden">
        {/* Section 1: Hero */}
        <section className="h-[250vh] flex flex-col items-center justify-center relative">
          <div className="text-center space-y-6 px-4 sm:px-6">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 rounded-full border border-cypher-cyan/30 bg-cypher-cyan/5 backdrop-blur-sm animate-pulse">
              <div className="w-1.5 h-1.5 bg-cypher-cyan rounded-full" />
              <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.4em] text-cypher-cyan">
                System Live
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-9xl font-black text-white uppercase tracking-tighter leading-tight">
              Architecting<br />
              <span className="bg-linear-to-r from-cypher-cyan to-cypher-magenta bg-clip-text text-transparent">
                The Void.
              </span>
            </h1>
            <p className="max-w-xs sm:max-w-md mx-auto text-white/40 font-mono text-xs sm:text-sm uppercase tracking-widest pt-6 sm:pt-8 border-t border-white/10">
              A spatial experiment in decentralized identity and cryptographics.
            </p>
          </div>

          {/* Cinematic Scroll Indicator */}
          <div className="absolute bottom-16 sm:bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-1000">
            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.6em] sm:tracking-[1em] text-white/60 whitespace-nowrap scroll-indicator-text">
              Scroll Further
            </span>
            <div className="w-px h-10 sm:h-16 bg-linear-to-b from-white/30 to-transparent" />
          </div>
        </section>

        {/* Section 2: Neural Integration */}
        <section className="h-[200vh] md:h-[250vh] flex items-center justify-center md:justify-end px-6 sm:px-12 md:px-32 relative">
          <div className="max-w-xl text-center md:text-right group">
            <div className="mb-4 text-cypher-magenta font-mono text-[10px] sm:text-xs tracking-[0.4em] sm:tracking-[0.6em] uppercase">
              Phase 02 / Integration
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-7xl font-bold text-white uppercase mb-6 sm:mb-8 group-hover:text-cypher-magenta transition-colors duration-500">
              Neural<br />Grid.
            </h2>
            <p className="text-white/50 text-base sm:text-xl font-light leading-relaxed">
              Connecting edge protocols with human consciousness. The first true layer of the spatial web starts here.
            </p>
            <div className="mt-8 sm:mt-12 h-px w-full bg-linear-to-r from-transparent to-cypher-magenta/50" />
          </div>
        </section>

        {/* Section 3: Final Call */}
        <section className="h-[200vh] md:h-[250vh] flex items-center justify-center md:justify-start px-6 sm:px-12 md:px-32 relative">
          <div className="max-w-2xl space-y-8 sm:space-y-12 text-center md:text-left">
            <div className="space-y-2">
              <div className="text-cypher-cyan font-mono text-[10px] sm:text-xs tracking-[0.4em] sm:tracking-[0.6em] uppercase mb-4">
                Phase 03 / Transmission
              </div>
              <h2 className="text-4xl sm:text-5xl md:text-8xl font-black text-white uppercase italic tracking-tight">
                Become<br />Autonomous.
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center md:items-start">
              <button className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-4 bg-cypher-cyan text-black font-black uppercase text-[10px] sm:text-xs tracking-widest hover:bg-white transition-all shadow-[0_0_30px_rgba(0,255,255,0.3)]">
                Establish Connection
              </button>
              <button className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-4 border border-white/20 text-white font-mono uppercase text-[9px] sm:text-[10px] tracking-widest hover:border-cypher-cyan transition-all">
                View Whitepaper
              </button>
            </div>
          </div>
        </section>

        {/* Infinity Spacer */}
        <div className="h-screen md:h-[150vh]" />
      </div>
    </main>
  );

  return (
    <div className="relative w-full min-h-screen bg-cypher-dark selection:bg-cypher-cyan/30">
      {/* GLOBAL TRANSITION OVERLAY */}
      {transitionActive && (
        <>
          {transitionType === 'pop' ? (
            <div className="neon-transition-container z-10000">
              <div className="neon-pop-shape" />
              <div className="neon-ripple" style={{ animationDelay: '0.1s' }} />
              <div className="neon-ripple" style={{ animationDelay: '0.3s' }} />
              {dropletsRef.current.map((d, i) => (
                <div
                  key={i}
                  className="neon-droplet"
                  style={{
                    '--tx': d.tx,
                    '--ty': d.ty,
                    left: '50%',
                    top: '50%',
                    animationDelay: d.delay,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          ) : (
            <div className="white-dissolve-overlay z-10000" />
          )}
        </>
      )}

      {/* PHASE 3: MAIN APP */}
      {isAppActive && (
        <div className="relative z-10 animate-in fade-in zoom-in-95 duration-1000">
          {MainContent}
        </div>
      )}

      {/* PHASE 1 & 2: PRELOADER */}
      {!isAppActive && (
        <main className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden bg-cypher-dark transition-opacity duration-1000">
          {/* Phase 2: Cinematic Splash */}
          {isEntering && (
            <div className="fixed inset-0 z-100 bg-black flex items-center justify-center animate-in fade-in duration-1000 overflow-hidden">
              <Image
                src="/splash-effect.webp"
                alt="Entering Cyphernaut"
                fill
                className="object-cover scale-105"
                priority
                unoptimized
              />
              <div className="absolute bottom-12 sm:bottom-16 left-1/2 -translate-x-1/2 z-110 flex flex-col items-center gap-4 sm:gap-6">
                <div className="h-px w-16 sm:w-24 bg-white/20" />
                <button
                  onClick={toApp}
                  className="text-[9px] sm:text-[10px] font-mono tracking-[0.5em] text-white/30 hover:text-white transition-opacity uppercase animate-pulse"
                >
                  Skip Transmission
                </button>
              </div>
            </div>
          )}

          {/* Phase 1: Brand Entry */}
          {!isEntering && (
            <>
              {/* Background Ambience */}
              <div className="absolute top-1/2 left-1/2 w-[120vw] h-[120vw] -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen opacity-30">
                <div
                  className="absolute top-[40%] left-[40%] w-[50%] h-[50%] bg-cypher-purple rounded-full blur-[100px] sm:blur-[140px] mix-blend-screen"
                  style={{
                    animationName: 'ambientGlow',
                    animationDuration: '10s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDirection: 'alternate',
                  }}
                />
                <div
                  className="absolute top-[30%] left-[60%] w-[45%] h-[45%] bg-cypher-cyan rounded-full blur-[100px] sm:blur-[140px] mix-blend-screen opacity-40"
                  style={{
                    animationName: 'ambientGlow',
                    animationDuration: '12s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDirection: 'alternate',
                    animationDelay: '-4s',
                  }}
                />
              </div>

              <div className="absolute inset-0 bg-grid z-0 opacity-20" />

              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                <div className="absolute w-[500px] sm:w-[600px] md:w-[800px] h-[500px] sm:h-[600px] md:h-[800px] animate-spin-slow rounded-full border border-cypher-cyan/10">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cypher-cyan pixel-lg" />
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-cypher-magenta font-mono text-xl font-bold"
                    style={{ textShadow: '0 0 10px currentColor' }}
                  >
                    +
                  </div>
                </div>
                <div className="absolute w-[350px] sm:w-[450px] md:w-[550px] h-[350px] sm:h-[450px] md:h-[550px] animate-spin-reverse rounded-full">
                  <div className="absolute top-[15%] left-[85%] text-cypher-yellow pixel-lg" />
                </div>
              </div>

              {/* Logo & CTA */}
              <div className="relative z-20 flex flex-col items-center max-w-4xl px-4 sm:px-6 w-full -translate-y-4 sm:-translate-y-8 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-500">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-cypher-purple/5 blur-[60px] sm:blur-[100px] rounded-full mix-blend-screen" />

                <div className="relative mb-12 sm:mb-16 md:mb-24 astronaut-container will-change-transform">
                  <Image
                    src="/cypher-log.png"
                    alt="Cyphernaut Logo"
                    width={600}
                    height={600}
                    priority
                    className="w-[200px] sm:w-[320px] md:w-[420px] lg:w-[540px] h-auto object-contain drop-shadow-2xl"
                  />
                </div>

                <div className="text-center space-y-8 sm:space-y-12">
                  <h1 className="text-xl sm:text-2xl md:text-3xl text-white/90 font-light flex flex-col items-center gap-4 sm:gap-6">
                    <div className="flex flex-wrap justify-center gap-x-2 sm:gap-x-4 opacity-60 tracking-[0.2em] sm:tracking-[0.4em] font-mono text-[10px] sm:text-xs md:text-sm uppercase mb-2 sm:mb-4">
                      <span className="text-word delay-1">Entering</span>
                      <span className="text-word delay-2">into</span>
                      <span className="text-word delay-3">the</span>
                      <span className="text-word delay-4 text-cypher-cyan">crypto</span>
                      <span className="text-word delay-5 text-cypher-cyan">space</span>
                      <span className="text-word delay-6">with</span>
                    </div>
                    <span className="text-4xl sm:text-5xl md:text-[10rem] lg:text-[12rem] font-black uppercase tracking-tighter cypher-highlight">
                      Cyphernaut.
                    </span>
                  </h1>

                  <button
                    className="group glass-cta px-10 sm:px-16 py-4 sm:py-6 mt-6 sm:mt-8"
                    onClick={handleLaunchExperience}
                  >
                    <div className="glass-cta-glow" />
                    <span className="relative text-white/80 font-mono text-[10px] sm:text-xs tracking-[0.4em] sm:tracking-[0.8em] uppercase font-bold group-hover:text-white transition-colors">
                      Launch Experience
                    </span>
                  </button>
                </div>
              </div>

              <div
                className="absolute inset-0 pointer-events-none z-30"
                style={{
                  background: 'radial-gradient(circle at center, transparent 40%, rgba(3,0,8,0.9) 100%)',
                }}
              />
            </>
          )}

          {/* Audio Element */}
          <audio ref={audioRef} muted={isMutedRef.current} loop preload="auto">
            <source src="/splash-audio.mp3" type="audio/mpeg" />
          </audio>

          {/* Shared Controls */}
          {(isEntering || isAppActive) && (
            <>
              <button
                onClick={handleExit}
                className="fixed top-6 sm:top-8 right-6 sm:right-8 z-1000 p-2 sm:p-3 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/40 hover:text-white hover:border-white/30 transition-all group shadow-[0_0_20px_rgba(3,0,8,0.5)] flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-[9px] sm:text-[10px] font-mono tracking-[0.3em] uppercase opacity-60 group-hover:opacity-100 transition-opacity pr-1 sm:pr-2">
                  Exit
                </span>
              </button>

              <div className="fixed bottom-6 sm:bottom-8 left-6 sm:left-8 z-1000 flex items-center gap-4 sm:gap-6">
                <button
                  onClick={toggleMute}
                  className="p-2 sm:p-3 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/40 hover:text-white hover:border-white/30 transition-all group shadow-[0_0_20px_rgba(3,0,8,0.5)]"
                >
                  {isMutedDisplay ? (
                    <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
                <div className="h-px w-12 sm:w-24 bg-white/20" />
                <div className="text-[9px] sm:text-[10px] font-mono uppercase text-white/30 tracking-[0.3em] sm:tracking-[0.5em] hidden sm:block">
                  Status: Cyphernaut Operational
                </div>
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}
