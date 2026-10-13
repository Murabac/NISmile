import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  className?: string;
  isLightOnDark?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  iconOnly = false,
  className = '',
  isLightOnDark = false,
}) => {
  const iconSizes = {
    sm: { width: 24, height: 26 },
    md: { width: 32, height: 35 },
    lg: { width: 44, height: 48 },
  };

  const currentSize = iconSizes[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Tooth silhouette with lower wave */}
      <svg
        width={currentSize.width}
        height={currentSize.height}
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="tooth-clip">
            {/* Anatomical molar silhouette */}
            <path d="M 50 4 C 68 4, 88 10, 92 30 C 94 45, 90 62, 85 85 C 80 102, 70 106, 60 106 C 53 106, 51 92, 50 82 C 49 92, 47 106, 40 106 C 30 106, 20 102, 15 85 C 10 62, 6 45, 8 30 C 12 10, 32 4, 50 4 Z" />
          </clipPath>
        </defs>

        {/* Clipped tooth container */}
        <g clipPath="url(#tooth-clip)">
          {/* Upper Enamel Half */}
          <rect
            x="0"
            y="0"
            width="100"
            height="110"
            fill={isLightOnDark ? '#FFFFFF' : '#0C3B4A'}
          />

          {/* Lower Half: Smooth Flowing Wave in Flow Teal */}
          <path
            d="M 0 52 C 24 40, 42 66, 70 54 C 84 48, 94 56, 100 58 L 100 110 L 0 110 Z"
            fill="#12A6A0"
          />
        </g>
      </svg>

      {/* Wordmark: Denta in Extra Bold, Flow in Regular weight */}
      {!iconOnly && (
        <span
          className={`font-display tracking-tight text-nowrap whitespace-nowrap leading-none ${
            size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'
          } ${isLightOnDark ? 'text-white' : 'text-[#0C3B4A] dark:text-[#E8F2F0]'}`}
        >
          <span className="font-extrabold tracking-tight">Denta</span>
          <span className="font-normal text-opacity-90">Flow</span>
        </span>
      )}
    </div>
  );
};
