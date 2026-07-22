import { describe, it, expect } from 'vitest';
import {
  AssessmentVerdict,
  ASSESSMENT_VERDICT_VALUES,
  OVERALL_ASSESSMENT,
  FINDING_ASSESSMENTS,
} from './assessment.js';

/**
 * Diese Datei wird von Hand gepflegt. Die Tests sind daher ein Schutz gegen
 * Fluechtigkeitsfehler beim Editieren, nicht gegen Logik -- sie stellen sicher,
 * dass jede Einordnung die vom Renderer erwartete Form hat.
 */
describe('project-state/assessment', () => {
  it('gibt zu jedem Verdict-Namen genau einen Wert und die Werte-Menge dazu', () => {
    expect(ASSESSMENT_VERDICT_VALUES).toEqual(Object.values(AssessmentVerdict));
    expect(new Set(ASSESSMENT_VERDICT_VALUES).size).toBe(ASSESSMENT_VERDICT_VALUES.length);
  });

  it('traegt ein vollstaendiges Gesamturteil', () => {
    expect(OVERALL_ASSESSMENT.headline.trim()).not.toBe('');
    expect(OVERALL_ASSESSMENT.summary.trim()).not.toBe('');
  });

  it('haelt jede Einordnung vollstaendig und mit gueltigem Verdict', () => {
    expect(FINDING_ASSESSMENTS.length).toBeGreaterThan(0);
    for (const finding of FINDING_ASSESSMENTS) {
      expect(finding.source.trim(), `source von "${finding.title}"`).not.toBe('');
      expect(finding.title.trim()).not.toBe('');
      expect(finding.detail.trim(), `detail von "${finding.title}"`).not.toBe('');
      expect(ASSESSMENT_VERDICT_VALUES, `verdict von "${finding.title}"`).toContain(finding.verdict);
    }
  });

  it('enthaelt die beiden bereits bekannten Einordnungen', () => {
    const knip = FINDING_ASSESSMENTS.find((finding) => /knip/i.test(finding.source));
    expect(knip, 'Knip-Einordnung fehlt').toBeDefined();
    expect(knip.verdict).toBe(AssessmentVerdict.Intentional);
    expect(knip.detail).toMatch(/ADR 0023/);

    const depcruise = FINDING_ASSESSMENTS.find((finding) => /dependency-cruiser/i.test(finding.source));
    expect(depcruise, 'dependency-cruiser-Einordnung fehlt').toBeDefined();
    expect(depcruise.verdict).toBe(AssessmentVerdict.NotRun);
  });
});
