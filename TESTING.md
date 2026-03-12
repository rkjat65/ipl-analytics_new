# Testing Guide for IPL Analytics

## Backend Tests

### Run All Backend Tests
```bash
# From the project root directory
python -m pytest backend/tests/ -v
```

### Run Specific Test Class
```bash
python -m pytest backend/tests/test_comparisons.py::TestTeamComparison -v
```

### Test Coverage Report
```bash
python -m pytest backend/tests/ --cov=backend --cov-report=html
```

### What's Tested
- **Team Comparisons**: Valid/invalid teams, H2H records, same-team edge cases
- **Season Comparisons**: Valid/invalid seasons, KPI calculations, top performers
- **Data Integrity**: No negative values, consistent totals, data relationships

---

## Frontend Tests

### Install Test Dependencies
```bash
cd frontend
npm install --save-dev vitest @testing-library/react @vitejs/plugin-react @vitest/ui
```

### Run All Frontend Tests
```bash
cd frontend
npm run test
```

### Run Tests in Watch Mode
```bash
npm run test -- --watch
```

### Run Tests with UI
```bash
npm run test -- --ui
```

### what's Tested
- **TeamComparisonInput**: Rendering, filtering, disabled state, selections
- **SeasonComparisonInput**: Rendering, season filtering, dropdown behavior
- **Component Props**: Correct props passed and displayed
- **User Interactions**: Input changes, selections, callbacks

---

## Integration Tests (Manual)

### Test Team Comparison Page
1. Visit `http://localhost:3000/teams/compare`
2. Select two teams (e.g., Mumbai Indians vs Chennai Super Kings)
3. Verify:
   - Head-to-head record displays
   - Win percentage shows correctly
   - Recent matches list populates
   - Page loads within 2 seconds

### Test Season Comparison Page
1. Visit `http://localhost:3000/analytics/seasons/compare`
2. Select two seasons (e.g., 2015 vs 2024)
3. Verify:
   - KPI table displays all metrics
   - Differences calculated correctly
   - Top batters list shows accurate data
   - Mobile responsiveness (resize browser)

### Test Homepage CTAs
1. Visit `http://localhost:3000`
2. Scroll to "Compare & Analyze" section
3. Click "Team Comparison" → should navigate to `/teams/compare`
4. Click "Season Comparison" → should navigate to `/analytics/seasons/compare`

### Test Sidebar Navigation
1. Check sidebar has "Comparisons" section
2. Verify links point to correct pages
3. Verify active state highlighting works

---

## API Endpoint Tests

### Test Team H2H Endpoint
```bash
curl "http://localhost:8000/api/matches/Mumbai%20Indians/vs/Chennai%20Super%20Kings"
```

Should return:
```json
{
  "team1": "Mumbai Indians",
  "team2": "Chennai Super Kings",
  "record": {
    "total_matches": 25,
    "team1_wins": 14,
    "team2_wins": 11,
    "ties": 0,
    "team1_win_pct": 56.0
  },
  "recent_matches": [...]
}
```

### Test Season Comparison Endpoint
```bash
curl "http://localhost:8000/api/analytics/2024/vs/2023"
```

Should return KPIs, top batsmen for both seasons

---

## CI/CD Integration

Add to GitHub Actions workflow (for future):
```yaml
- name: Run Backend Tests
  run: python -m pytest backend/tests/ -v

- name: Run Frontend Tests
  run: |
    cd frontend
    npm install
    npm run test
```

---

## Debugging Tips

### Backend Debug
```python
# Add to any test
import pdb; pdb.set_trace()  # Breakpoint
```

### Frontend Debug
```tsx
// Add to any test
console.log("Debug info:", data);  // Will appear in test output
```

### Check API Response
```bash
# Pretty print JSON response
curl "http://localhost:8000/api/matches/..." | jq .
```

---

## Known Issues & Fixes

| Issue | Solution |
|-------|----------|
| Tests fail with DB connection | Ensure backend/config.py has correct DuckDB path |
| Frontend tests timeout | Increase timeout in vitest.config.ts |
| H2H endpoint returns 404 | Check team names match exactly (case-sensitive) |
| Season comparison no data | Verify season format (e.g., "2024", "2023/24") |

---

## Performance Benchmarks

Target metrics:
- Team H2H API response: <300ms
- Season comparison API response: <500ms
- Frontend page load: <2 seconds
- Comparison components: render in <100ms

Monitor with:
```bash
# Backend
time curl "http://localhost:8000/api/matches/..."

# Frontend
npm run test -- --reporter=verbose
```
