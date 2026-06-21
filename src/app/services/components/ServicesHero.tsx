import React from 'react';
import AppImage from '@/components/ui/AppImage';

export default function ServicesHero() {
  return (
    <section className="relative min-h-[55vh] flex items-end overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <AppImage
          src="https://img.rocket.new/generatedImages/rocket_gen_img_102787f3d-1772128570053.png"
          alt="Clean organized law office with stacked files, warm desk lamp light, dark wood bookshelves filled with legal volumes"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw" />
        
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/55 to-primary/20" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-10 pb-12 md:pb-16 pt-32 md:pt-40">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 md:mb-5 flex items-center gap-3">
          <span className="w-6 h-px bg-accent" />
          Professional Legal Services
        </p>
        <h1 className="text-hero-display text-primary-foreground max-w-3xl">
          Every service,
          <br />
          <span className="italic opacity-85">every detail</span>
        </h1>
      </div>
    </section>);

}