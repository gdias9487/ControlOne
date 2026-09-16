import { Info } from 'lucide-react';
import {
  BUSINESS_PROFILE_OPTIONS,
  type BusinessProfile,
} from '@shared/business-profile';
import { cn } from '@/utils';

export function BusinessProfilePicker({
  value,
  onChange,
}: {
  value: BusinessProfile;
  onChange: (profile: BusinessProfile) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BUSINESS_PROFILE_OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium shadow-soft transition-colors',
              selected
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-foreground hover:bg-muted/60',
            )}
          >
            {option.title}
            <span className="group/info relative inline-flex">
              <Info
                aria-label={option.description}
                className={cn(
                  'h-3.5 w-3.5',
                  selected ? 'text-background/80' : 'text-muted-foreground',
                )}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-52 -translate-x-1/2 rounded-xl border bg-popover px-3 py-2 text-left text-xs font-normal leading-snug text-popover-foreground opacity-0 shadow-elev transition-opacity group-hover/info:opacity-100"
              >
                <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r bg-popover" />
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
