'use client';

import React, { memo, useMemo } from 'react';

import AppImage from './AppImage';


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
      <AppImage
        src={src}
        alt="Broussard Legal Services logo"
        width={size}
        height={size}
        className="flex-shrink-0 object-contain"
        style={{ background: 'transparent' }}
      />
    </div>
  );
});

export default AppLogo;
