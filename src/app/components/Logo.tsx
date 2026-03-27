import Image from 'next/image'

export function Logo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = size === 'sm' ? { w: 76, h: 30 } : size === 'lg' ? { w: 200, h: 79 } : { w: 120, h: 47 }

  return (
    <Image
      src="/LOGO G4 AZUL.png"
      alt="G4"
      width={dims.w}
      height={dims.h}
      className={className}
      style={{ filter: 'brightness(0) invert(1)' }}
      {...(size === 'lg' ? { loading: 'eager' as const } : {})}
    />
  )
}
