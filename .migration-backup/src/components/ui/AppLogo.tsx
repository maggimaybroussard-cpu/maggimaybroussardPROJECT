'use client';

import React, { memo, useMemo } from 'react';

import AppImage from './AppImage';


interface AppLogoProps {
  src?: string; // Image source (optional)
  iconName?: string; // Icon name when no image
  size?: number; // Size for icon/image
  className?: string; // Additional classes
  onClick?: () => void; // Click handler
}

const AppLogo = memo(function AppLogo({
  src = '/assets/images/initiallogo-1781843073214.png',
  iconName = 'SparklesIcon',
  size = 64,
  className = '',
  onClick,
}: AppLogoProps) {
  // Memoize className calculation
  const containerClassName = useMemo(() => {
    const classes = ['flex items-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  return (
    <div className={containerClassName} onClick={onClick}>
      <AppImage src={src} alt="Broussard Legal Services logo" width={size} height={size} className="flex-shrink-0 object-contain" />
    </div>
  );
});

export default AppLogo;
