import React from 'react';

export type LogoVariant =
  | 'biometric_viewfinder'
  | 'print_grid_lens'
  | 'oval_horizon'
  | 'privacy_shutter';

interface LocalFotoLogoProps {
  variant?: LogoVariant;
  className?: string;
}

/**
 * Clean, geometric Material Design 3 vector logo mark for LocalFoto.
 */
export const LocalFotoLogo: React.FC<LocalFotoLogoProps> = ({
  variant = 'privacy_shutter',
  className = 'w-10 h-10',
}) => {
  if (variant === 'print_grid_lens') {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="18" fill="#0B57D0" />
        <rect
          x="13"
          y="17"
          width="38"
          height="30"
          rx="5"
          stroke="#FFFFFF"
          strokeWidth="3"
        />
        <line
          x1="32"
          y1="17"
          x2="32"
          y2="47"
          stroke="#D3E3FD"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
        <circle cx="22.5" cy="32" r="5.5" stroke="#81C995" strokeWidth="2.8" />
        <circle cx="41.5" cy="32" r="5.5" stroke="#FFFFFF" strokeWidth="2.8" />
      </svg>
    );
  }

  if (variant === 'oval_horizon') {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="18" fill="#041E49" />
        <ellipse
          cx="32"
          cy="32"
          rx="13"
          ry="17"
          stroke="#8AB4F8"
          strokeWidth="3.2"
        />
        <line
          x1="14"
          y1="29"
          x2="50"
          y2="29"
          stroke="#81C995"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="27" cy="29" r="2.5" fill="#FFFFFF" />
        <circle cx="37" cy="29" r="2.5" fill="#FFFFFF" />
      </svg>
    );
  }

  if (variant === 'privacy_shutter') {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="18" fill="#0F5C29" />
        {/* Privacy Shield */}
        <path
          d="M32 11L49 17.5V30.5C49 41.8 41.2 50.2 32 53C22.8 50.2 15 41.8 15 30.5V17.5L32 11Z"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Passport Photo Frame */}
        <rect
          x="23"
          y="21"
          width="18"
          height="22"
          rx="2"
          stroke="#C4EED0"
          strokeWidth="1.4"
        />
        {/* Person Silhouette */}
        <circle cx="32" cy="28" r="3.6" fill="#FFFFFF" />
        <path
          d="M25.5 41.8C25.5 36.9 28.4 34.5 32 34.5C35.6 34.5 38.5 36.9 38.5 41.8H25.5Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // Default: Option 1 — Biometric Viewfinder & Eye Horizon
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="18" fill="#0B57D0" />
      {/* Corner Viewfinder Brackets */}
      <path
        d="M16 24V19C16 17.3431 17.3431 16 19 16H24"
        stroke="#D3E3FD"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M48 24V19C48 17.3431 46.6569 16 45 16H40"
        stroke="#D3E3FD"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M16 40V45C16 46.6569 17.3431 48 19 48H24"
        stroke="#D3E3FD"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M48 40V45C48 46.6569 46.6569 48 45 48H40"
        stroke="#D3E3FD"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Biometric Oval & Eye Horizon */}
      <ellipse
        cx="32"
        cy="31"
        rx="9.5"
        ry="12"
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      <line
        x1="20"
        y1="29"
        x2="44"
        y2="29"
        stroke="#81C995"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
      <circle cx="32" cy="29" r="2.5" fill="#81C995" />
    </svg>
  );
};
