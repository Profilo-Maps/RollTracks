import { Colors } from '@/constants/theme';
import * as aChecker from 'accessibility-checker';

function buildHtml(
  fg: string,
  bg: string,
  text: string,
  fontSize = '16px',
  fontWeight = 'normal'
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Contrast Test</title></head>
<body style="background-color: ${bg}; margin: 0; padding: 20px;">
  <p style="color: ${fg}; font-size: ${fontSize}; font-weight: ${fontWeight};">${text}</p>
</body>
</html>`;
}

function getContrastViolations(report: any): any[] {
  return report.results.filter(
    (r: any) =>
      r.ruleId?.includes('color_contrast') &&
      (r.value[1] === 'FAIL' || r.level === 'violation' || r.level === 'potentialviolation')
  );
}

describe('Dark theme WCAG 2.1 AAA contrast compliance', () => {
  const dark = Colors.dark;

  afterAll(async () => {
    await aChecker.close();
  });

  test('text on background meets AAA (7:1)', async () => {
    const html = buildHtml(dark.text, dark.background, 'Normal text content');
    const results = await aChecker.getCompliance(html, 'dark-text-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('icon color on background meets AAA (7:1)', async () => {
    const html = buildHtml(dark.icon, dark.background, 'Icon-colored text');
    const results = await aChecker.getCompliance(html, 'dark-icon-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('tint color on background meets AAA (7:1)', async () => {
    const html = buildHtml(dark.tint, dark.background, 'Tint-colored text');
    const results = await aChecker.getCompliance(html, 'dark-tint-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('error color on background meets AAA (7:1)', async () => {
    const html = buildHtml(dark.error, dark.background, 'Error message text');
    const results = await aChecker.getCompliance(html, 'dark-error-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('link color on background meets AAA (7:1)', async () => {
    const html = buildHtml(dark.link, dark.background, 'Link text content');
    const results = await aChecker.getCompliance(html, 'dark-link-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('button text on primary button meets contrast (large text 4.5:1)', async () => {
    const html = buildHtml(
      dark.buttonText,
      dark.buttonPrimary,
      'Button Text',
      '18px',
      '700'
    );
    const results = await aChecker.getCompliance(html, 'dark-btn-primary');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('button text on danger button meets contrast (large text 4.5:1)', async () => {
    const html = buildHtml(
      dark.buttonText,
      dark.buttonDanger,
      'Danger Button',
      '18px',
      '700'
    );
    const results = await aChecker.getCompliance(html, 'dark-btn-danger');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });
});

describe('Light theme WCAG 2.1 contrast sanity check', () => {
  const light = Colors.light;

  test('text on background meets minimum contrast', async () => {
    const html = buildHtml(light.text, light.background, 'Light theme text');
    const results = await aChecker.getCompliance(html, 'light-text-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('error color on background meets contrast', async () => {
    const html = buildHtml(light.error, light.background, 'Error text');
    const results = await aChecker.getCompliance(html, 'light-error-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('link color on background meets contrast', async () => {
    const html = buildHtml(light.link, light.background, 'Link text');
    const results = await aChecker.getCompliance(html, 'light-link-on-bg');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('button text on primary button meets contrast (large text 4.5:1)', async () => {
    const html = buildHtml(
      light.buttonText,
      light.buttonPrimary,
      'Button Text',
      '18px',
      '700'
    );
    const results = await aChecker.getCompliance(html, 'light-btn-primary');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('button text on danger button meets contrast (large text 4.5:1)', async () => {
    const html = buildHtml(
      light.buttonText,
      light.buttonDanger,
      'Danger Button',
      '18px',
      '700'
    );
    const results = await aChecker.getCompliance(html, 'light-btn-danger');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });
});

describe('Profile screen button accessibility', () => {
  const dark = Colors.dark;
  const light = Colors.light;

  test('dark theme: toggle button text on tint background meets contrast', async () => {
    const html = buildHtml('#fff', dark.tint, 'ON', '12px', '600');
    const results = await aChecker.getCompliance(html, 'dark-toggle-on-tint');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('light theme: toggle button text on tint background meets contrast', async () => {
    const html = buildHtml('#fff', light.tint, 'ON', '12px', '600');
    const results = await aChecker.getCompliance(html, 'light-toggle-on-tint');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('dark theme: disabled toggle text on gray background meets contrast', async () => {
    const html = buildHtml('#fff', '#ccc', 'OFF', '12px', '600');
    const results = await aChecker.getCompliance(html, 'dark-toggle-disabled');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('light theme: disabled toggle text on gray background meets contrast', async () => {
    const html = buildHtml('#fff', '#ccc', 'OFF', '12px', '600');
    const results = await aChecker.getCompliance(html, 'light-toggle-disabled');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });
});

describe('Modal and interactive element accessibility', () => {
  const dark = Colors.dark;
  const light = Colors.light;

  test('dark theme: selected mode chip text on tint background meets contrast', async () => {
    const html = buildHtml('#11181C', dark.tint, 'Wheelchair', '14px', '400');
    const results = await aChecker.getCompliance(html, 'dark-chip-selected');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('light theme: selected mode chip text on tint background meets contrast', async () => {
    const html = buildHtml('#fff', light.tint, 'Wheelchair', '14px', '400');
    const results = await aChecker.getCompliance(html, 'light-chip-selected');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('dark theme: tab icon selected color on background meets contrast', async () => {
    const html = buildHtml(dark.tabIconSelected, dark.background, 'Icon', '24px', '400');
    const results = await aChecker.getCompliance(html, 'dark-tab-icon-selected');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('light theme: tab icon selected color on background meets contrast', async () => {
    const html = buildHtml(light.tabIconSelected, light.background, 'Icon', '24px', '400');
    const results = await aChecker.getCompliance(html, 'light-tab-icon-selected');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('dark theme: tab icon default color on background meets contrast', async () => {
    const html = buildHtml(dark.tabIconDefault, dark.background, 'Icon', '24px', '400');
    const results = await aChecker.getCompliance(html, 'dark-tab-icon-default');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });

  test('light theme: tab icon default color on background meets contrast', async () => {
    const html = buildHtml(light.tabIconDefault, light.background, 'Icon', '24px', '400');
    const results = await aChecker.getCompliance(html, 'light-tab-icon-default');
    expect(getContrastViolations(results.report)).toHaveLength(0);
  });
});
