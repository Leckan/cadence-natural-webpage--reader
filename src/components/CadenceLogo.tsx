interface CadenceLogoProps {
  size?: number;
  className?: string;
}

export function CadenceLogo({ size = 24, className = '' }: CadenceLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <rect x="6.5" y="12.5" width="2.6" height="7" rx="1.3" fill="#FFFFFF" />
      <rect x="10.6" y="9" width="2.6" height="14" rx="1.3" fill="#FFFFFF" />
      <rect x="14.7" y="6.5" width="2.6" height="19" rx="1.3" fill="#FFFFFF" />
      <rect x="18.8" y="10" width="2.6" height="12" rx="1.3" fill="#FFFFFF" />
      <rect x="22.9" y="13" width="2.6" height="6" rx="1.3" fill="#FFFFFF" />
    </svg>
  );
}
