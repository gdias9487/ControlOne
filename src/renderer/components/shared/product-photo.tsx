import { Package } from 'lucide-react';
import { cn } from '@/utils';

interface ProductPhotoProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
}

export function ProductPhoto({
  src,
  alt = '',
  className,
  iconClassName,
}: ProductPhotoProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden bg-muted text-muted-foreground',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Package className={cn('h-6 w-6', iconClassName)} aria-hidden />
      )}
    </div>
  );
}
