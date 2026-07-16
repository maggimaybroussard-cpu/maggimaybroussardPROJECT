'use client';

import React, { useMemo } from 'react';
import { encode } from 'uqr';

interface QRCodeImageProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  className?: string;
  style?: React.CSSProperties;
}

export default function QRCodeImage({
  value,
  size = 128,
  fgColor = '#000000',
  bgColor = '#ffffff',
  level = 'M',
  className,
  style,
}: QRCodeImageProps) {
  const svgContent = useMemo(() => {
    if (!value) return null;
    try {
      const result = encode(value, { ecc: level });
      const cells = result.data;
      const moduleCount = result.size;
      const cellSize = size / moduleCount;

      const rects: React.ReactElement[] = [];
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (cells[row * moduleCount + col]) {
            rects.push(
              <rect
                key={`${row}-${col}`}
                x={col * cellSize}
                y={row * cellSize}
                width={cellSize}
                height={cellSize}
                fill={fgColor}
              />
            );
          }
        }
      }

      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={className}
          style={style}
          role="img"
          aria-label="QR code"
        >
          <rect width={size} height={size} fill={bgColor} />
          {rects}
        </svg>
      );
    } catch {
      return null;
    }
  }, [value, size, fgColor, bgColor, level, className, style]);

  if (!svgContent) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, background: '#f3f4f6', borderRadius: 4, ...style }}
      />
    );
  }

  return svgContent;
}