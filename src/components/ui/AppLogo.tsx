'use client';

import React, { memo, useMemo } from 'react';

interface AppLogoProps {
  src?: string;
  iconName?: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

const AppLogo = memo(function AppLogo({
  src = '/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784430153618.png',
  iconName = 'SparklesIcon',
  size = 64,
  className = '',
  onClick,
}: AppLogoProps) {
  const containerClassName = useMemo(() => {
    const classes = ['flex items-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  return (
    <div className={containerClassName} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Broussard Legal Services logo"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, background: 'transparent' }}
      />
    </div>
  );
});

export default AppLogo;
