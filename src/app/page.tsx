'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, Volume2, VolumeX } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export default function SplashPage() {
  const [mounted, setMounted] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isAppActive, setIsAppActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [transitionActive, setTransitionActive] = useState(false);
  const [droplets, setDroplets] = useState<{ tx: string, ty: string, delay: string }[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const lenisRef = useRef<any>(null);
  
  const frameCount = 288;
  const currentFrame = useRef(1);

  useEffect(() => {
    setMounted(true);

    // Pre-generate droplets to avoid hydration mismatch
    const newDroplets = [...Array(16)].map(() => ({
      tx: `${(Math.random() - 0.5) * 1200}px`,
      ty: `${(Math.random() - 0.5) * 1200}px`,
      delay: `${Math.random() * 0.4}s`
    }));
    setDroplets(newDroplets);
    
    // Initialize Lenis for smooth scroll inertia
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Refresh ScrollTrigger on Lenis scroll
    lenis.on('scroll', ScrollTrigger.update);

    return () => {
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isEntering) {
      // 8-second cinematic splash transition
      timer = setTimeout(() => {
        triggerTransition(() => {
          setIsEntering(false);
          setIsAppActive(true);
        });
      }, 8000);
      
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else if (!isAppActive) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
    return () => clearTimeout(timer);
  }, [isEntering, isAppActive]);

  // Preload and Initialize Scroll Sequence
  useEffect(() => {
    if (isAppActive && mounted) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      if (!context) return;
      contextRef.current = context;

      // Set initial canvas size
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const preloadImages = () => {
        for (let i = 1; i <= frameCount; i++) {
          const img = new (window as any).Image();
          img.src = `/sequence/ezgif-frame-${i.toString().padStart(3, '0')}.webp`;
          imagesRef.current.push(img);
        }
      };

      const renderFrame = (index: number) => {
        if (!contextRef.current || !canvasRef.current) return;
        
        const img = imagesRef.current[index - 1];
        if (!img) return;
        
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        
        // Calculate aspect ratio cover fit
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      };

      preloadImages();
      
      // Initial render once first image loads
      if (imagesRef.current[0]) {
        imagesRef.current[0].onload = () => renderFrame(1);
      } else {
        const firstImg = new (window as any).Image();
        firstImg.src = `/sequence/ezgif-frame-001.webp`;
        firstImg.onload = () => renderFrame(1);
      }

      // GSAP Scroll Scrub
      const scrollTl = gsap.to(currentFrame, {
        current: frameCount,
        snap: 'current',
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.1, // Near-instant response for "next-gen" feel
          id: 'sequence-trigger',
          onUpdate: (self) => {
            const frame = Math.floor(self.progress * (frameCount - 1)) + 1;
            renderFrame(frame);
          }
        }
      });

      const handleResize = () => {
        if (canvasRef.current) {
          canvasRef.current.width = window.innerWidth;
          canvasRef.current.height = window.innerHeight;
          const progress = ScrollTrigger.getById('sequence-trigger')?.progress ?? 0;
          const frame = Math.floor(progress * (frameCount - 1)) + 1;
          renderFrame(frame);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        scrollTl.kill();
      };
    }
  }, [isAppActive, mounted]);

  const [transitionType, setTransitionType] = useState<'pop' | 'white'>('pop');

  const triggerTransition = (callback?: () => void, type: 'pop' | 'white' = 'pop') => {
    console.log(`Engaging cinematic transition: ${type}`);
    setTransitionType(type);
    setTransitionActive(true);
    setTimeout(() => {
      if (callback) callback();
    }, 700);
    setTimeout(() => setTransitionActive(false), 1400);
  };

  const handleLaunchExperience = () => {
    triggerTransition(() => {
      setIsEntering(true);
      setIsMuted(false);
    }, 'pop');
  };

  const toApp = () => {
    triggerTransition(() => {
      setIsEntering(false);
      setIsAppActive(true);
    }, 'white');
  };

  // Auto-advance video splash after 8s
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isEntering && !isAppActive) {
      timer = setTimeout(() => {
        toApp();
      }, 8200);
    }
    return () => clearTimeout(timer);
  }, [isEntering, isAppActive]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  // Cinematic Auto-Scroll for the "Opening Shot"
  useEffect(() => {
    if (isAppActive && lenisRef.current) {
      const waitTime = 1600; // Let the white fade settle
      const timer = setTimeout(() => {
        lenisRef.current.scrollTo(window.innerHeight * 1.5, {
          duration: 6,
          easing: (t: number) => t, // Linear for cinematic steady feel
          immediate: false
        });
      }, waitTime);

      // Stop auto-scroll on manual intervention
      const stopAutoScroll = () => {
        clearTimeout(timer);
        if (lenisRef.current) {
           lenisRef.current.stop();
           lenisRef.current.start();
        }
        window.removeEventListener('wheel', stopAutoScroll);
        window.removeEventListener('touchstart', stopAutoScroll);
      };

      window.addEventListener('wheel', stopAutoScroll);
      window.addEventListener('touchstart', stopAutoScroll);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('wheel', stopAutoScroll);
        window.removeEventListener('touchstart', stopAutoScroll);
      };
    }
  }, [isAppActive]);

  if (!mounted) return <main className="min-h-screen bg-cypher-dark" />;
  const MainContent = (
    <main ref={containerRef} className="relative bg-cypher-dark w-full">
      {/* Fixed Background Canvas */}
      <div className="fixed inset-0 z-0">
        <canvas ref={canvasRef} className="w-full h-full object-cover grayscale-[0.2] brightness-75" />
        <div className="absolute inset-0 bg-radial-[at_center_center] from-transparent via-transparent to-black/80 pointer-events-none"></div>
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>
      </div>

      {/* Scrollable Spatial UI */}
      <div className="relative z-10 w-full overflow-hidden">
        {/* Section 1: Hero */}
        <section className="h-[250vh] flex flex-col items-center justify-center relative">
          <div className="text-center space-y-6 px-6">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-cypher-cyan/30 bg-cypher-cyan/5 backdrop-blur-sm animate-pulse">
              <div className="w-1.5 h-1.5 bg-cypher-cyan rounded-full"></div>
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-cypher-cyan">System Live</span>
            </div>
            <h1 className="text-5xl md:text-9xl font-black text-white uppercase tracking-tighter leading-tight">
              Architecting<br/><span className="bg-linear-to-r from-cypher-cyan to-cypher-magenta bg-clip-text text-transparent">The Void.</span>
            </h1>
              <p className="max-w-md mx-auto text-white/40 font-mono text-sm uppercase tracking-widest pt-8 border-t border-white/10">
              A spatial experiment in decentralized identity and cryptographics.
            </p>
          </div>

          {/* Cinematic Scroll Indicator */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-1000">
            <span className="text-[10px] font-mono uppercase tracking-[1em] text-white/60 whitespace-nowrap scroll-indicator-text">Scroll Further</span>
            <div className="w-px h-16 bg-linear-to-b from-white/30 to-transparent"></div>
          </div>
        </section>

        {/* Section 2: Neural Integration */}
        <section className="h-[250vh] flex items-center justify-end px-12 md:px-32 relative">
          <div className="max-w-xl text-right group">
            <div className="mb-4 text-cypher-magenta font-mono text-xs tracking-[0.6em] uppercase">Phase 02 / Integration</div>
            <h2 className="text-4xl md:text-7xl font-bold text-white uppercase mb-8 group-hover:text-cypher-magenta transition-colors duration-500">Neural<br/>Grid.</h2>
            <p className="text-white/50 text-xl font-light leading-relaxed">Connecting edge protocols with human consciousness. The first true layer of the spatial web starts here.</p>
            <div className="mt-12 h-px w-full bg-linear-to-r from-transparent to-cypher-magenta/50"></div>
          </div>
        </section>

        {/* Section 3: Final Call */}
        <section className="h-[250vh] flex items-center justify-start px-12 md:px-32 relative">
          <div className="max-w-2xl space-y-12">
            <div className="space-y-2">
              <div className="text-cypher-cyan font-mono text-xs tracking-[0.6em] uppercase mb-4">Phase 03 / Transmission</div>
              <h2 className="text-5xl md:text-8xl font-black text-white uppercase italic tracking-tight">Become<br/>Autonomous.</h2>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
              <button className="px-10 py-4 bg-cypher-cyan text-black font-black uppercase text-xs tracking-widest hover:bg-white transition-all shadow-[0_0_30px_rgba(0,255,255,0.3)]">Establish Connection</button>
              <button className="px-10 py-4 border border-white/20 text-white font-mono uppercase text-[10px] tracking-widest hover:border-cypher-cyan transition-all">View Whitepaper</button>
            </div>
          </div>
        </section>

        {/* Infinity Spacer */}
        <div className="h-[150vh]"></div>
      </div>
    </main>
  );

  return (
    <div className="relative w-full min-h-screen bg-cypher-dark selection:bg-cypher-cyan/30">
      {/* GLOBAL TRANSITION OVERLAY (STAYS ON TOP) */}
      {transitionActive && (
        <>
          {transitionType === 'pop' ? (
            <div className="neon-transition-container z-10000">
              <div className="neon-pop-shape"></div>
              <div className="neon-ripple" style={{ animationDelay: '0.1s' }}></div>
              <div className="neon-ripple" style={{ animationDelay: '0.3s' }}></div>
              {droplets.map((d, i) => (
                <div 
                  key={i} 
                  className="neon-droplet" 
                  style={{
                    '--tx': d.tx,
                    '--ty': d.ty,
                    left: '50%',
                    top: '50%',
                    animationDelay: d.delay
                  } as any} 
                />
              ))}
            </div>
          ) : (
            <div className="white-dissolve-overlay z-10000" />
          )}
        </>
      )}

      {/* PHASE 3: MAIN APP (RENDERED UNDERNEATH DURING TRANSITION) */}
      {isAppActive && (
        <div className="relative z-10 animate-in fade-in zoom-in-95 duration-1000">
          {MainContent}
        </div>
      )}

      {/* PHASE 1 & 2: PRELOADER (SPLASH / VIDEO / BRAND) */}
      {!isAppActive && (
        <main className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden bg-cypher-dark transition-opacity duration-1000">
          
          {/* Phase 2: Cinematic Video Transmission */}
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
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-110 flex flex-col items-center gap-6">
                <div className="h-px w-24 bg-white/20"></div>
                <button 
                  onClick={toApp}
                  className="text-[10px] font-mono tracking-[0.5em] text-white/30 hover:text-white transition-opacity uppercase animate-pulse"
                >
                  Skip Transmission
                </button>
              </div>
            </div>
          )}

          {/* Phase 1: Brand Entry Point */}
          {!isEntering && (
            <>
              {/* Background Ambience */}
              <div className="absolute top-1/2 left-1/2 w-[120vw] h-[120vw] -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen opacity-30">
                <div 
                  className="absolute top-[40%] left-[40%] w-[50%] h-[50%] bg-cypher-purple rounded-full blur-[140px] mix-blend-screen" 
                  style={{ 
                    animationName: 'ambientGlow',
                    animationDuration: '10s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDirection: 'alternate',
                    animationDelay: '0s' 
                  }}
                ></div>
                <div 
                  className="absolute top-[30%] left-[60%] w-[45%] h-[45%] bg-cypher-cyan rounded-full blur-[140px] mix-blend-screen opacity-40" 
                  style={{ 
                    animationName: 'ambientGlow',
                    animationDuration: '12s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDirection: 'alternate',
                    animationDelay: '-4s' 
                  }}
                ></div>
              </div>

              <div className="absolute inset-0 bg-grid z-0 opacity-20"></div>

              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                <div className="absolute w-[800px] h-[800px] animate-spin-slow rounded-full border border-cypher-cyan/10">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cypher-cyan pixel-lg"></div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-cypher-magenta font-mono text-xl font-bold" style={{ textShadow: '0 0 10px currentColor' }}>+</div>
                </div>
                <div className="absolute w-[550px] h-[550px] animate-spin-reverse rounded-full">
                  <div className="absolute top-[15%] left-[85%] text-cypher-yellow pixel-lg"></div>
                </div>
              </div>

              {/* Static Logo & Call to Action */}
              <div className="relative z-20 flex flex-col items-center max-w-4xl px-6 w-full -translate-y-8 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-500">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cypher-purple/5 blur-[100px] rounded-full mix-blend-screen"></div>

                <div className="relative mb-24 astronaut-container will-change-transform">
                  <Image 
                    src="/cypher-log.png" 
                    alt="Cyphernaut Logo" 
                    width={600}
                    height={600}
                    priority
                    className="w-[320px] sm:w-[420px] md:w-[500px] lg:w-[540px] h-auto object-contain drop-shadow-2xl"
                  />
                </div>

                <div className="text-center space-y-12">
                  <h1 className="text-xl sm:text-2xl md:text-3xl text-white/90 font-light flex flex-col items-center gap-6">
                    <div className="flex flex-wrap justify-center gap-x-4 opacity-60 tracking-[0.4em] font-mono text-xs sm:text-sm uppercase mb-4">
                      <span className="text-word delay-1">Entering</span>
                      <span className="text-word delay-2">into</span>
                      <span className="text-word delay-3">the</span>
                      <span className="text-word delay-4 text-cypher-cyan">crypto</span>
                      <span className="text-word delay-5 text-cypher-cyan">space</span>
                      <span className="text-word delay-6">with</span>
                    </div>
                    <span className="text-5xl sm:text-9xl md:text-[10rem] lg:text-[12rem] font-black uppercase tracking-tighter cypher-highlight">Cyphernaut.</span>
                  </h1>
                  
                  <button 
                    className="group glass-cta px-16 py-6 mt-8"
                    onClick={handleLaunchExperience}
                  >
                    <div className="glass-cta-glow"></div>
                    <span className="relative text-white/80 font-mono text-xs tracking-[0.8em] uppercase font-bold group-hover:text-white transition-colors">Launch Experience</span>
                  </button>
                </div>
              </div>

              <div className="absolute inset-0 pointer-events-none z-30" style={{ background: 'radial-gradient(circle at center, transparent 40%, rgba(3,0,8,0.9) 100%)' }}></div>
            </>
          )}

          {/* Persistent Audio Manager */}
          <audio ref={audioRef} muted={isMuted} loop preload="auto">
            <source src="/splash-audio.mp3" type="audio/mpeg" />
          </audio>

          {/* SHARED CONTROLS (VISIBLE IN PHASE 2 & 3) */}
          {(isEntering || isAppActive) && (
            <>
              {/* Back Button (Top Right) */}
              <button 
                onClick={() => {
                   setIsAppActive(false);
                   setIsEntering(false);
                }}
                className="fixed top-8 right-8 z-1000 p-3 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/40 hover:text-white hover:border-white/30 transition-all group shadow-[0_0_20px_rgba(3,0,8,0.5)] flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-[10px] font-mono tracking-[0.3em] uppercase opacity-60 group-hover:opacity-100 transition-opacity pr-2">Exit</span>
              </button>

              {/* Volume & Status (Bottom Left) */}
              <div className="fixed bottom-8 left-8 z-1000 flex items-center gap-6">
                <button 
                  onClick={toggleMute}
                  className="p-3 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/40 hover:text-white hover:border-white/30 transition-all group shadow-[0_0_20px_rgba(3,0,8,0.5)]"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <div className="h-px w-24 bg-white/20"></div>
                <div className="text-[10px] font-mono uppercase text-white/30 tracking-[0.5em] hidden sm:block">Status: Cyphernaut Operational</div>
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}
