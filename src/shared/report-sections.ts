import type { ReportDto, ReportSectionDto } from './types';

export function reportSections(report: ReportDto): ReportSectionDto[] {
  if (report.sections && report.sections.length > 0) {
    return report.sections.filter((section) => section.rows.length > 0);
  }
  if (report.rows.length > 0) {
    return [{ id: 'detail', title: 'Detalhamento', rows: report.rows }];
  }
  return [];
}
