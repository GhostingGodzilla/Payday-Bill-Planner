# Payday Bill Planner

This is a simple browser app that helps you plan bills around your payday schedule.

## What it does

- Save multiple income schedules (weekly, biweekly, or monthly)
- Optionally estimate pay using hours, hourly rate, overtime, state, and filing status
- Optionally add per-check deductions (health insurance, 401k, and other)
- Add recurring monthly bills with category and due day
- Automatically match bill due dates into each pay period
- Show how much money is left each period after bills
- Save data in local storage so your entries remain on refresh

## How to run

1. Open `index.html` in your browser.
2. Enter income details and click **Add Income** (repeat for each income source).
3. Add your bills.
4. Review upcoming pay periods in the timeline.

## Notes

- Bills are treated as monthly recurring by due day (1 to 31).
- If a month has fewer days (for example 30 days or February), a day 31 bill is moved to that month's last day.
- Estimator values are rough projections and not tax advice.

## Push Summaries

- A `pre-push` git hook is included in `.githooks/pre-push`.
- Before each `git push`, it appends a short summary to `PUSH_SUMMARY.md`.
- Summary includes timestamp, branch, commit subject, author, remote ref, and changed files.

If needed on another machine, run:

```bash
git config core.hooksPath .githooks
```
