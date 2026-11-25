import { calculateImpliedValue, generateFarmSteps, processWatchlist } from './main';

describe('Token Launch Radar Core Tests', () => {
  test('calculates non-constant implied USD value correctly', () => {
    const val1 = calculateImpliedValue(1000000, 50000, 1000);
    const val2 = calculateImpliedValue(2000000, 100000, 2000);
    expect(val1).toBeGreaterThan(0);
    expect(val2).toBeGreaterThan(val1);
  });

  test('generates appropriate farm steps based on token status', () => {
    const stepsWithToken = generateFarmSteps('TestDEX', 'DEX', true);
    const stepsWithoutToken = generateFarmSteps('TestLend', 'Lending', false);

    expect(stepsWithToken.length).toBeGreaterThanOrEqual(3);
    expect(stepsWithoutToken.length).toBeGreaterThanOrEqual(3);
    expect(stepsWithoutToken.some(s => s.toLowerCase().includes('without assuming any airdrop'))).toBe(true);
  });

  test('processes watchlist entries deterministically', () => {
    const input = [
      { id: '1', name: 'ProtocolA', category: 'Yield', hasToken: false, tvl: 5000000, volume24h: 100000, fees24h: 500 }
    ];
    const result1 = processWatchlist(input);
    const result2 = processWatchlist(input);
    expect(result1).toEqual(result2);
    expect(result1[0].impliedUsdValue).toBeDefined();
    expect(result1[0].farmSteps.length).toBeGreaterThanOrEqual(3);
  });
});
