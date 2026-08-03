import type { PeriodPreset } from '@shared/schemas';
import { PERIOD_PRESETS } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PeriodFilterProps {
  preset: PeriodPreset;
  startDate?: string;
  endDate?: string;
  onChange: (value: {
    preset: PeriodPreset;
    startDate?: string;
    endDate?: string;
  }) => void;
}

const PRESETS: PeriodPreset[] = [
  'TODAY',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'CURRENT_MONTH',
  'CURRENT_YEAR',
  'CUSTOM',
];

export function PeriodFilter({ preset, startDate, endDate, onChange }: PeriodFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {PRESETS.map((item) => (
        <Button
          key={item}
          size="sm"
          variant={preset === item ? 'accent' : 'outline'}
          onClick={() => onChange({ preset: item, startDate, endDate })}
        >
          {PERIOD_PRESETS[item]}
        </Button>
      ))}
      {preset === 'CUSTOM' ? (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate?.slice(0, 10) ?? ''}
            onChange={(e) =>
              onChange({
                preset: 'CUSTOM',
                startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                endDate,
              })
            }
          />
          <Input
            type="date"
            value={endDate?.slice(0, 10) ?? ''}
            onChange={(e) =>
              onChange({
                preset: 'CUSTOM',
                startDate,
                endDate: e.target.value
                  ? new Date(`${e.target.value}T23:59:59.999`).toISOString()
                  : undefined,
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
