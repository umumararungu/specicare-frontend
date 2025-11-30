// src/utils/testGuidance.js
// Provides preparation guidance for common medical tests.

const defaultGuidanceMap = [
  {
    match: /blood/i,
    guidance: [
      'Do not eat 8 hours before this test.',
      'Drink water and stay hydrated unless instructed otherwise.',
      'Bring your insurance card.'
    ],
  },
  {
    match: /mri|magnetic resonance/i,
    guidance: [
      'Remove metal items (jewelry, watches, belts).',
      'Tell staff if you have implants, pacemakers, or metal fragments.',
      'Bring your insurance card.'
    ],
  },
  {
    match: /x-?ray|xray/i,
    guidance: [
      'Remove metal items from the area to be imaged.',
      'Wear loose, comfortable clothing.',
      'Bring your insurance card.'
    ],
  },
  {
    match: /ultrasound|sonography/i,
    guidance: [
      'Follow fasting instructions if specified by the provider.',
      'For abdominal ultrasound, you may be asked to fast for several hours.',
      'Bring your insurance card.'
    ],
  },
  {
    match: /ct|computed tomography/i,
    guidance: [
      'Remove metal items and jewelry.',
      'Inform staff if you are pregnant or suspect pregnancy.',
      'Bring your insurance card.'
    ],
  },
];

export function getTestGuidance(test = {}) {
  if (!test) return [];

  // If server already provides explicit preparation instructions, prefer that
  const explicit = test.preparation || test.preparation_instructions || test.preparationInstructions || test.instructions || null;
  if (explicit) {
    if (Array.isArray(explicit)) return explicit.filter(Boolean);
    if (typeof explicit === 'string') return explicit.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  const name = (test.name || '') + ' ' + (test.category || '');
  const matches = [];
  for (const rule of defaultGuidanceMap) {
    try {
      if (rule.match.test(name)) {
        for (const g of rule.guidance) matches.push(g);
      }
    } catch (e) {
      // ignore
    }
  }

  // Deduplicate and return
  return Array.from(new Set(matches));
}

export default getTestGuidance;
