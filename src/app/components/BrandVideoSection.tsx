'use client';

import React, { useState } from 'react';

// ── Replace YOUTUBE_VIDEO_ID below with your actual YouTube video ID ──────────
// Example: if your video URL is https://www.youtube.com/watch?v=dQw4w9WgXcQ
// then YOUTUBE_VIDEO_ID = 'dQw4w9WgXcQ'
const YOUTUBE_VIDEO_ID = 'etsM4wvX158'; // TODO: Replace with your actual YouTube video ID

export default function BrandVideoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <section
      className="relative py-20 md:py-28 bg-primary overflow-hidden"
      aria-label="Brand video">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(200,150,90,0.4) 39px, rgba(200,150,90,0.4) 40px)',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-5 md:px-10">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-14">
          <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.35em] mb-4 flex items-center justify-center gap-3">
            <span className="w-6 h-px bg-accent/60 inline-block" />
            Meet Maggi May
            <span className="w-6 h-px bg-accent/60 inline-block" />
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-primary-foreground leading-tight mb-4">
            Paralegal Support You Can{' '}
            <span className="italic text-accent">Trust</span>
          </h2>
          <p className="text-primary-foreground/60 text-base max-w-xl mx-auto leading-relaxed">
            Learn how Broussard Legal Services delivers precision, dedication, and results for law firms nationwide.
          </p>
        </div>

        {/* Video container */}
        <div className="relative mx-auto max-w-3xl">
          {/* Decorative border frame */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent/40 via-accent/10 to-transparent pointer-events-none" />

          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 bg-black aspect-video">
            {!playing ? (
              /* Thumbnail / play overlay */
              <button
                onClick={() => setPlaying(true)}
                className="group absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-primary/80 hover:bg-primary/70 transition-colors duration-300 cursor-pointer"
                aria-label="Play brand video">
                {/* YouTube thumbnail */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-40"
                  style={{
                    backgroundImage: `url('https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg')`,
                  }}
                />

                {/* Play button */}
                <div className="relative z-10 flex flex-col items-center gap-5">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-accent flex items-center justify-center shadow-xl shadow-accent/30 group-hover:scale-110 transition-transform duration-300">
                    <svg
                      className="w-8 h-8 md:w-10 md:h-10 text-white ml-1"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="text-primary-foreground/80 text-sm font-medium tracking-wide uppercase">
                    Watch the Video
                  </p>
                </div>
              </button>
            ) : (
              /* Embedded YouTube video */
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                title="Broussard Legal Services — Brand Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          {/* Caption */}
          <p className="mt-5 text-center text-primary-foreground/40 text-xs tracking-wide">
            Broussard Legal Services · Contract Paralegal · Louisiana &amp; Nationwide
          </p>
        </div>
      </div>
    </section>
  );
}
