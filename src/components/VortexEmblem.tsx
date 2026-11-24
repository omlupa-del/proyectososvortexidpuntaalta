import React from 'react';

interface VortexEmblemProps {
  variant?: 'shield' | 'full';
  className?: string;
  alt?: string;
}

export const VortexEmblem: React.FC<VortexEmblemProps> = ({
  variant = 'shield',
  className = 'w-8 h-8',
  alt = 'Logo oficial Vortex ID'
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-[#061224] shrink-0 select-none ${className}`}
    >
      <img
        src="/assets/aistudio/image__2__7d12aee0.png"
        alt={alt}
        className={
          variant === 'shield'
            ? 'w-full h-full object-contain translate-y-[7%] scale-[1.52] pointer-events-none block'
            : 'w-full h-full object-contain translate-y-[6%] scale-[1.4] pointer-events-none block'
        }
      />
    </div>
  );
};
