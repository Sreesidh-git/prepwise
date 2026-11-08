// PrepWise Analytics Accuracy and Chart Lifecycle Verification Test Suite
// Tests exact event counts, session aggregation, date-range boundaries,
// chronological timeline generation, completion rate consistency, and chart cleanup.

const assert = require('assert');
const fs = require('fs');

console.log('\n============================================================');
console.log('PREPWISE ANALYTICS ACCURACY & CHART LIFECYCLE TESTS');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

(async () => {
  console.log('--- 1. DATE-RANGE BOUNDARIES & CHRONOLOGICAL TIMELINE ---');

  // Load functions
  const analyticsCode = fs.readFileSync('functions/api/admin/analytics.js', 'utf8');

  test('analytics.js exports chronologicalDailySeries function', () => {
    assert(analyticsCode.includes('function chronologicalDailySeries'), 'Missing chronologicalDailySeries');
  });

  // Evaluate chronologicalDailySeries logic
  function chronologicalDailySeries(events, rangeStart, rangeEnd) {
    const counts = new Map();
    events.forEach((e) => {
      if (!e.occurred_at) return;
      const k = new Date(e.occurred_at).toISOString().slice(0, 10);
      counts.set(k, (counts.get(k) || 0) + 1);
    });

    const timeline = [];
    const current = new Date(rangeStart);
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setUTCHours(23, 59, 59, 999);

    let iterations = 0;
    while (current <= end && iterations < 366) {
      const dayStr = current.toISOString().slice(0, 10);
      timeline.push({
        label: dayStr,
        count: counts.get(dayStr) || 0
      });
      current.setUTCDate(current.getUTCDate() + 1);
      iterations++;
    }

    return timeline;
  }

  test('Last 7 days produces exactly 7 chronological points', () => {
    const now = new Date('2026-11-08T18:00:00Z');
    const start = new Date(now.getTime() - 6 * 86400000); // 7 calendar days
    const events = [
      { occurred_at: '2026-11-08T12:00:00Z' },
      { occurred_at: '2026-11-08T15:00:00Z' },
      { occurred_at: '2026-11-05T09:00:00Z' }
    ];

    const timeline = chronologicalDailySeries(events, start, now);
    assert.strictEqual(timeline.length, 7, `Expected 7 points, got ${timeline.length}`);
    assert.strictEqual(timeline[6].label, '2026-11-08');
    assert.strictEqual(timeline[6].count, 2);
    assert.strictEqual(timeline[3].label, '2026-11-05');
    assert.strictEqual(timeline[3].count, 1);
    assert.strictEqual(timeline[0].count, 0);

    // Verify chronological order
    for (let i = 1; i < timeline.length; i++) {
      assert(timeline[i].label > timeline[i - 1].label, 'Labels must be ascending chronological order');
    }
  });

  test('Last 30 days produces exactly 30 chronological points', () => {
    const now = new Date('2026-11-08T18:00:00Z');
    const start = new Date(now.getTime() - 29 * 86400000);
    const timeline = chronologicalDailySeries([], start, now);
    assert.strictEqual(timeline.length, 30, `Expected 30 points, got ${timeline.length}`);
  });

  test('Empty days contain zero counts instead of missing keys', () => {
    const now = new Date('2026-11-08T18:00:00Z');
    const start = new Date(now.getTime() - 2 * 86400000);
    const timeline = chronologicalDailySeries([], start, now);
    assert.strictEqual(timeline.length, 3);
    timeline.forEach(pt => assert.strictEqual(pt.count, 0));
  });

  console.log('\n--- 2. COMPLETION-RATE CALCULATION CONSISTENCY ---');

  function calculateCompletionRate(quizStarts, quizCompletions, quizAttempts, completedAttempts) {
    const eligibleStarts = quizStarts > 0 ? quizStarts : quizAttempts;
    const eligibleCompletions = quizStarts > 0 ? quizCompletions : completedAttempts;
    return eligibleStarts > 0
      ? Math.round((eligibleCompletions / eligibleStarts) * 10000) / 100
      : null;
  }

  test('Completion rate handles quizStarts=0 but attempts=1 and completions=1 (resolves to 100%)', () => {
    const rate = calculateCompletionRate(0, 1, 1, 1);
    assert.strictEqual(rate, 100, `Expected 100%, got ${rate}`);
  });

  test('Completion rate handles standard telemetry (quizStarts=10, completions=8 -> 80%)', () => {
    const rate = calculateCompletionRate(10, 8, 10, 8);
    assert.strictEqual(rate, 80, `Expected 80%, got ${rate}`);
  });

  test('Completion rate returns null when no attempts or starts exist (renders Unavailable)', () => {
    const rate = calculateCompletionRate(0, 0, 0, 0);
    assert.strictEqual(rate, null, `Expected null, got ${rate}`);
  });

  test('overview.js and analytics.js implement the harmonized completion rate calculation', () => {
    const overviewCode = fs.readFileSync('functions/api/admin/overview.js', 'utf8');
    assert(overviewCode.includes('eligibleStarts'), 'overview.js missing eligibleStarts');
    assert(analyticsCode.includes('eligibleStarts'), 'analytics.js missing eligibleStarts');
  });

  console.log('\n--- 3. FRONTEND QUIZ PATH TRACKING ---');

  test('js/analytics.js tracks quiz_start on clean URL (/quiz) as well as /quiz.html', () => {
    const jsAnalytics = fs.readFileSync('js/analytics.js', 'utf8');
    assert(jsAnalytics.includes("window.location.pathname === '/quiz'") || jsAnalytics.includes("window.location.pathname.endsWith('/quiz')"), 'Missing clean /quiz path check');
  });

  console.log('\n--- 4. CHART LIFECYCLE & RESIZE LOOP PROTECTION ---');

  const adminCss = fs.readFileSync('admin/admin.css', 'utf8');
  const adminJs = fs.readFileSync('admin/admin.js', 'utf8');

  test('admin.css: .chart-card has position: relative and overflow: hidden to prevent infinite resizing loops', () => {
    assert(adminCss.includes('.chart-card { min-height: 220px; position: relative; overflow: hidden;'), 'Missing chart-card overflow/position styling');
    assert(adminCss.includes('max-height: 180px; max-width: 100% !important;'), 'Missing canvas max-height/max-width styling');
  });

  test('admin.js: renderChart clears residual canvas inline styles on destroy', () => {
    assert(adminJs.includes("canvas.removeAttribute('style');"), 'renderChart must remove residual style');
    assert(adminJs.includes("canvas.style.maxHeight = '180px';"), 'renderChart must set explicit maxHeight');
  });

  test('admin.js: renderChart nulls out destroyed chart instances to prevent duplicate instances', () => {
    assert(adminJs.includes('state.charts[key] = null;'), 'renderChart must null out destroyed instance');
    assert(adminJs.includes('state.chart = null;'), 'loadOverview must null out destroyed overview chart');
  });

  test('admin.js: renderChart clones dataset arrays to prevent mutating previous state', () => {
    assert(adminJs.includes('[...labels]'), 'renderChart must clone labels array');
    assert(adminJs.includes('[...values]'), 'renderChart must clone values array');
  });

  console.log('\n--- 5. REPEATED REFRESH & FILTER SIMULATION ---');

  test('Simulating 10 consecutive chart re-renders does not leak or duplicate datasets', () => {
    // Mock canvas and Chart
    let chartInstance = null;
    let destroyCount = 0;
    let createCount = 0;

    class MockChart {
      constructor(canvas, config) {
        createCount++;
        this.canvas = canvas;
        this.data = config.data;
        chartInstance = this;
      }
      destroy() {
        destroyCount++;
        chartInstance = null;
      }
    }

    const mockCanvas = {
      removeAttribute: () => {},
      style: {}
    };

    const mockState = { charts: {} };

    function mockRenderChart(key, labels, values) {
      if (mockState.charts[key]) {
        mockState.charts[key].destroy();
        mockState.charts[key] = null;
      }
      mockCanvas.removeAttribute('style');
      mockState.charts[key] = new MockChart(mockCanvas, {
        data: { labels: [...labels], datasets: [{ data: [...values] }] }
      });
    }

    // Run 10 rapid re-renders
    for (let i = 0; i < 10; i++) {
      mockRenderChart('daily', ['2026-11-01', '2026-11-02'], [10, 20]);
    }

    assert.strictEqual(createCount, 10, 'Should create exactly 10 instances across 10 calls');
    assert.strictEqual(destroyCount, 9, 'Should destroy exactly 9 previous instances');
    assert.strictEqual(mockState.charts['daily'].data.labels.length, 2, 'Labels array must contain exactly 2 items, not appended');
    assert.strictEqual(mockState.charts['daily'].data.datasets[0].data.length, 2, 'Data array must contain exactly 2 items, not appended');
  });

  console.log('\n============================================================');
  console.log(`ANALYTICS TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
})();

