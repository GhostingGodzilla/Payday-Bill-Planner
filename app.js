const STORAGE_KEY = "payday-bill-planner-v1";
const DEFAULT_STATE_TAX_RATE = 0.04;

const FEDERAL_BRACKETS = {
  single: [
    { cap: 11600, rate: 0.10 },
    { cap: 47150, rate: 0.12 },
    { cap: 100525, rate: 0.22 },
    { cap: 191950, rate: 0.24 },
    { cap: 243725, rate: 0.32 },
    { cap: 609350, rate: 0.35 },
    { cap: Number.POSITIVE_INFINITY, rate: 0.37 }
  ],
  married: [
    { cap: 23200, rate: 0.10 },
    { cap: 94300, rate: 0.12 },
    { cap: 201050, rate: 0.22 },
    { cap: 383900, rate: 0.24 },
    { cap: 487450, rate: 0.32 },
    { cap: 731200, rate: 0.35 },
    { cap: Number.POSITIVE_INFINITY, rate: 0.37 }
  ]
};

const STANDARD_DEDUCTION = {
  single: 14600,
  married: 29200
};

const STATE_TAX_RATES = {
  AK: 0,
  FL: 0,
  NV: 0,
  NH: 0,
  SD: 0,
  TN: 0,
  TX: 0,
  WA: 0,
  WY: 0,
  AL: 0.045,
  AR: 0.047,
  AZ: 0.025,
  CA: 0.06,
  CO: 0.044,
  CT: 0.05,
  DC: 0.06,
  DE: 0.052,
  GA: 0.053,
  HI: 0.06,
  IA: 0.048,
  ID: 0.058,
  IL: 0.05,
  IN: 0.0315,
  KS: 0.05,
  KY: 0.04,
  LA: 0.042,
  MA: 0.05,
  MD: 0.05,
  ME: 0.06,
  MI: 0.043,
  MN: 0.058,
  MO: 0.047,
  MS: 0.045,
  MT: 0.054,
  NC: 0.045,
  ND: 0.025,
  NE: 0.05,
  NJ: 0.055,
  NM: 0.049,
  NY: 0.06,
  OH: 0.04,
  OK: 0.043,
  OR: 0.07,
  PA: 0.031,
  RI: 0.05,
  SC: 0.05,
  UT: 0.048,
  VA: 0.05,
  VT: 0.058,
  WI: 0.053,
  WV: 0.047
};

const state = {
  incomes: [],
  bills: [],
  previewCount: 8,
  editingBillId: null
};

const el = {
  incomeForm: document.querySelector("#income-form"),
  incomeName: document.querySelector("#income-name"),
  payAmount: document.querySelector("#pay-amount"),
  payFrequency: document.querySelector("#pay-frequency"),
  firstPayDate: document.querySelector("#first-pay-date"),
  incomeStatus: document.querySelector("#income-status"),
  estimatorForm: document.querySelector("#estimator-form"),
  useEstimator: document.querySelector("#use-estimator"),
  hoursWorked: document.querySelector("#hours-worked"),
  hourlyRate: document.querySelector("#hourly-rate"),
  overtimeHours: document.querySelector("#overtime-hours"),
  overtimeMultiplier: document.querySelector("#overtime-multiplier"),
  stateCode: document.querySelector("#state-code"),
  filingStatus: document.querySelector("#filing-status"),
  deductionHealth: document.querySelector("#deduction-health"),
  deduction401k: document.querySelector("#deduction-401k"),
  deductionOther: document.querySelector("#deduction-other"),
  estimatePreview: document.querySelector("#estimate-preview"),
  incomesTableBody: document.querySelector("#incomes-table-body"),
  billForm: document.querySelector("#bill-form"),
  billName: document.querySelector("#bill-name"),
  billAmount: document.querySelector("#bill-amount"),
  billCategory: document.querySelector("#bill-category"),
  billDueDay: document.querySelector("#bill-due-day"),
  billSubmitBtn: document.querySelector("#bill-submit-btn"),
  billCancelEdit: document.querySelector("#bill-cancel-edit"),
  billsTableBody: document.querySelector("#bills-table-body"),
  billsTotal: document.querySelector("#bills-total"),
  incomeRollup: document.querySelector("#income-rollup"),
  timeline: document.querySelector("#timeline"),
  totals: document.querySelector("#totals"),
  previewCount: document.querySelector("#preview-count"),
  emptyTemplate: document.querySelector("#empty-template")
};

init();

function init() {
  hydrateFromStorage();
  bindEvents();
  reflectStateToInputs();
  updateEstimatorUI();
  render();
}

function bindEvents() {
  el.incomeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = el.incomeName.value.trim();
    const enteredAmount = Number(el.payAmount.value);
    let amount = enteredAmount;
    const frequency = el.payFrequency.value;
    const firstPayDate = el.firstPayDate.value;
    const filingStatus = el.filingStatus.value === "married" ? "married" : "single";
    const stateCode = normalizeStateCode(el.stateCode.value);
    const deductions = getDeductionInputs();

    const estimate = getEstimatorValue();
    if (el.useEstimator.checked) {
      if (!estimate) {
        el.incomeStatus.textContent = "Complete estimator fields to calculate pay amount.";
        return;
      }
      amount = estimate.periodNet;
    } else {
      amount = roundCurrency(Math.max(0, amount - deductions.total));
    }

    if (!name || !amount || amount <= 0 || !firstPayDate) {
      el.incomeStatus.textContent = "Enter a valid income name, amount, and payday.";
      return;
    }

    state.incomes.push({
      id: crypto.randomUUID(),
      name,
      amount,
      frequency,
      firstPayDate,
      estimated: Boolean(el.useEstimator.checked),
      grossAmount: el.useEstimator.checked && estimate ? estimate.periodGross : enteredAmount,
      taxAmount: el.useEstimator.checked && estimate ? estimate.periodTaxes : null,
      stateCode,
      filingStatus,
      deductions
    });

    state.incomes.sort((a, b) => parseDateLocal(a.firstPayDate) - parseDateLocal(b.firstPayDate));

    saveToStorage();
    render();

    el.incomeStatus.textContent = "Income added.";
    el.incomeForm.reset();
    el.estimatorForm.reset();
    el.payFrequency.value = "weekly";
    el.overtimeMultiplier.value = "1.5";
    el.filingStatus.value = "single";
    updateEstimatorUI();
  });

  const estimatorInputs = [
    el.useEstimator,
    el.hoursWorked,
    el.hourlyRate,
    el.overtimeHours,
    el.overtimeMultiplier,
    el.stateCode,
    el.filingStatus,
    el.deductionHealth,
    el.deduction401k,
    el.deductionOther,
    el.payFrequency
  ];

  for (const input of estimatorInputs) {
    input.addEventListener("input", updateEstimatorUI);
    input.addEventListener("change", updateEstimatorUI);
  }

  el.billForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = el.billName.value.trim();
    const category = el.billCategory.value.trim();
    const amount = Number(el.billAmount.value);
    const dueDay = Number(el.billDueDay.value);

    if (!name || !category || !amount || amount <= 0 || dueDay < 1 || dueDay > 31) {
      return;
    }

    if (state.editingBillId) {
      state.bills = state.bills.map((bill) => {
        if (bill.id !== state.editingBillId) {
          return bill;
        }

        return {
          ...bill,
          name,
          category,
          amount,
          dueDay
        };
      });
    } else {
      state.bills.push({
        id: crypto.randomUUID(),
        name,
        category,
        amount,
        dueDay,
        paid: false
      });
    }

    state.bills.sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name));
    resetBillEditState();

    saveToStorage();
    renderBillsTable();
    renderTimeline();

    el.billForm.reset();
  });

  el.billCancelEdit.addEventListener("click", () => {
    resetBillEditState();
    el.billForm.reset();
  });

  el.billsTableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches(".bill-delete")) {
      const id = target.getAttribute("data-id");
      state.bills = state.bills.filter((bill) => bill.id !== id);

      if (state.editingBillId === id) {
        resetBillEditState();
        el.billForm.reset();
      }

      saveToStorage();
      render();
    }

    if (target.matches(".bill-edit")) {
      const id = target.getAttribute("data-id");
      const bill = state.bills.find((item) => item.id === id);
      if (!bill) {
        return;
      }

      state.editingBillId = bill.id;
      el.billName.value = bill.name;
      el.billAmount.value = String(bill.amount);
      el.billCategory.value = bill.category;
      el.billDueDay.value = String(bill.dueDay);
      el.billSubmitBtn.textContent = "Update Bill";
      el.billCancelEdit.hidden = false;
      el.billName.focus();
    }
  });

  el.timeline.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches(".timeline-toggle-paid")) {
      const id = target.getAttribute("data-id");
      state.bills = state.bills.map((bill) => {
        if (bill.id !== id) {
          return bill;
        }

        return {
          ...bill,
          paid: !bill.paid
        };
      });

      saveToStorage();
      render();
    }
  });

  el.incomesTableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches(".income-delete")) {
      const id = target.getAttribute("data-id");
      state.incomes = state.incomes.filter((income) => income.id !== id);

      saveToStorage();
      render();
    }
  });

  el.previewCount.addEventListener("input", () => {
    const value = Number(el.previewCount.value);
    state.previewCount = Number.isInteger(value) ? clamp(value, 1, 24) : 8;
    saveToStorage();
    renderTimeline();
  });
}

function render() {
  renderIncomesTable();
  renderBillsTable();
  renderIncomeRollup();
  renderTimeline();
}

function renderIncomesTable() {
  el.incomesTableBody.innerHTML = "";

  if (state.incomes.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan=\"5\">No income schedules added yet.</td>";
    el.incomesTableBody.append(row);
    return;
  }

  for (const income of state.incomes) {
    const row = document.createElement("tr");
    const deductionTotal = getDeductionTotal(income.deductions);
    row.innerHTML = `
      <td>${escapeHtml(income.name)}</td>
      <td>${formatFrequencyLabel(income.frequency)}</td>
      <td>${formatDate(parseDateLocal(income.firstPayDate))}</td>
      <td>${formatCurrency(income.amount)}${income.estimated ? " (est.)" : ""}<br /><small>${income.stateCode || "Default"} / ${income.filingStatus === "married" ? "Married" : "Single"} / Deductions ${formatCurrency(deductionTotal)}</small></td>
      <td><button class="income-delete" data-id="${income.id}">Remove</button></td>
    `;
    el.incomesTableBody.append(row);
  }
}

function renderBillsTable() {
  el.billsTableBody.innerHTML = "";
  const totalAmount = state.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const unpaidAmount = state.bills.reduce((sum, bill) => sum + (bill.paid ? 0 : bill.amount), 0);
  el.billsTotal.textContent = `Total recurring bills: ${formatCurrency(totalAmount)} | Remaining unpaid: ${formatCurrency(unpaidAmount)}`;

  if (state.bills.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan=\"7\">No bills added yet.</td>";
    el.billsTableBody.append(row);
    return;
  }

  for (const bill of state.bills) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(bill.name)}</td>
      <td>${escapeHtml(bill.category)}</td>
      <td>Day ${bill.dueDay}</td>
      <td>${formatCurrency(bill.amount)}</td>
      <td>${bill.paid ? "Paid" : "Unpaid"}</td>
      <td><button class="bill-edit" data-id="${bill.id}">Edit</button></td>
      <td><button class="bill-delete" data-id="${bill.id}">Remove</button></td>
    `;
    row.className = bill.paid ? "bill-row-paid" : "";
    el.billsTableBody.append(row);
  }
}

function renderIncomeRollup() {
  if (state.incomes.length === 0) {
    el.incomeRollup.innerHTML = "";
    return;
  }

  const summary = getIncomeSummary();

  el.incomeRollup.innerHTML = `
    <h3>Income Totals Across All Jobs</h3>
    <p class="rollup-meta">Jobs: <strong>${summary.jobs}</strong> | Estimated yearly taxes: <strong>${formatCurrency(summary.yearly.taxes)}</strong> | Yearly deductions: <strong>${formatCurrency(summary.yearly.deductions)}</strong></p>
    <table class="rollup-table" aria-label="Income rollup">
      <thead>
        <tr>
          <th>Period</th>
          <th>Taxes Taken Out (Net)</th>
          <th>Taxes Not Taken Out (Gross)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Weekly</td>
          <td>${formatCurrency(summary.weekly.net)}</td>
          <td>${formatCurrency(summary.weekly.gross)}</td>
        </tr>
        <tr>
          <td>Biweekly</td>
          <td>${formatCurrency(summary.biweekly.net)}</td>
          <td>${formatCurrency(summary.biweekly.gross)}</td>
        </tr>
        <tr>
          <td>Monthly</td>
          <td>${formatCurrency(summary.monthly.net)}</td>
          <td>${formatCurrency(summary.monthly.gross)}</td>
        </tr>
        <tr>
          <td>Yearly</td>
          <td>${formatCurrency(summary.yearly.net)}</td>
          <td>${formatCurrency(summary.yearly.gross)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function getIncomeSummary() {
  let yearlyNet = 0;
  let yearlyGross = 0;
  let yearlyTaxes = 0;
  let yearlyDeductions = 0;

  for (const income of state.incomes) {
    const periodsPerYear = getPeriodsPerYear(income.frequency);
    const grossPeriod = Number(income.grossAmount) || Number(income.amount) || 0;
    const deductionPeriod = getDeductionTotal(income.deductions);
    let taxPeriod = 0;
    let netPeriod = Number(income.amount) || 0;

    if (!income.estimated) {
      const derived = estimateTaxesFromGross({
        periodGross: grossPeriod,
        frequency: income.frequency,
        filingStatus: income.filingStatus,
        stateCode: income.stateCode
      });
      taxPeriod = derived.periodTaxes;
      netPeriod = Math.max(0, grossPeriod - taxPeriod - deductionPeriod);
    } else {
      taxPeriod = Number(income.taxAmount) || 0;
      netPeriod = Math.max(0, grossPeriod - taxPeriod - deductionPeriod);
    }

    yearlyNet += netPeriod * periodsPerYear;
    yearlyGross += grossPeriod * periodsPerYear;
    yearlyTaxes += taxPeriod * periodsPerYear;
    yearlyDeductions += deductionPeriod * periodsPerYear;
  }

  return {
    jobs: state.incomes.length,
    weekly: {
      net: yearlyNet / 52,
      gross: yearlyGross / 52
    },
    biweekly: {
      net: yearlyNet / 26,
      gross: yearlyGross / 26
    },
    monthly: {
      net: yearlyNet / 12,
      gross: yearlyGross / 12
    },
    yearly: {
      net: yearlyNet,
      gross: yearlyGross,
      taxes: yearlyTaxes,
      deductions: yearlyDeductions
    }
  };
}

function renderTimeline() {
  el.timeline.innerHTML = "";
  el.totals.innerHTML = "";

  if (state.incomes.length === 0) {
    const clone = el.emptyTemplate.content.cloneNode(true);
    el.timeline.append(clone);
    return;
  }

  const periods = buildPeriods(state.previewCount);

  const allBillsTotal = periods.reduce((sum, period) => sum + period.totalBills, 0);
  const allIncomeTotal = periods.reduce((sum, period) => sum + period.payAmount, 0);
  const net = allIncomeTotal - allBillsTotal;

  el.totals.append(
    createTotalCard("Projected income", formatCurrency(allIncomeTotal)),
    createTotalCard("Projected bills", formatCurrency(allBillsTotal)),
    createTotalCard("Projected net", formatCurrency(net), net < 0 ? "negative" : "positive")
  );

  for (const period of periods) {
    const card = document.createElement("article");
    card.className = "period-card";

    const header = document.createElement("header");
    header.className = "period-header";
    header.innerHTML = `
      <div>
        <strong>Payday: ${formatDate(period.payDate)}</strong><br />
        <small>${formatDate(period.startDate)} - ${formatDate(period.endDate)}</small>
      </div>
      <div class="balance ${period.balance < 0 ? "negative" : "positive"}">
        Left after bills: ${formatCurrency(period.balance)}
      </div>
    `;

    const body = document.createElement("div");
    body.className = "period-body";

    const sourceLine = document.createElement("p");
    sourceLine.innerHTML = `<strong>Income this payday:</strong> ${period.sources
      .map((source) => `${escapeHtml(source.name)} (${formatCurrency(source.amount)})`)
      .join(", ")}`;
    body.append(sourceLine);

    if (period.bills.length === 0) {
      const noBills = document.createElement("p");
      noBills.textContent = "No bill due in this pay period.";
      body.append(noBills);
    } else {
      for (const billItem of period.bills) {
        const line = document.createElement("div");
        line.className = "bill-line";
        line.innerHTML = `
          <div>
            <strong>${escapeHtml(billItem.name)}</strong>
            <span class="badge">${escapeHtml(billItem.category)}</span>
            ${billItem.paid ? '<span class="badge paid-badge">Paid</span>' : ""}
            <div><small>Due ${formatDate(billItem.dueDate)}</small></div>
          </div>
          <div>
            <div>${billItem.paid ? formatCurrency(0) : formatCurrency(billItem.amount)}</div>
            <button class="timeline-toggle-paid" data-id="${billItem.id}">${billItem.paid ? "Mark Unpaid" : "Mark Paid"}</button>
          </div>
        `;
        body.append(line);
      }
    }

    const footer = document.createElement("p");
    footer.innerHTML = `<strong>Bill total this period:</strong> ${formatCurrency(period.totalBills)}`;
    body.append(footer);

    card.append(header, body);
    el.timeline.append(card);
  }
}

function buildPeriods(count) {
  const mergedPaydays = getMergedPaydays(count + 1);
  const periods = [];

  for (let index = 0; index < Math.min(count, mergedPaydays.length); index += 1) {
    const current = mergedPaydays[index];
    const next = mergedPaydays[index + 1];
    const startDate = new Date(current.date);
    const endDate = next ? addDays(next.date, -1) : addDays(startDate, 6);

    const bills = collectBillsInRange(startDate, endDate);
    const totalBills = bills.reduce((sum, item) => sum + (item.paid ? 0 : item.amount), 0);

    periods.push({
      payDate: new Date(current.date),
      startDate,
      endDate,
      bills,
      totalBills,
      payAmount: current.payAmount,
      sources: current.sources,
      balance: current.payAmount - totalBills
    });
  }

  return periods;
}

function getMergedPaydays(minCount) {
  const merged = new Map();
  const generations = 90;

  for (const income of state.incomes) {
    const anchorDay = parseDateLocal(income.firstPayDate).getDate();
    let payDate = parseDateLocal(income.firstPayDate);

    for (let index = 0; index < generations; index += 1) {
      const key = toDateKey(payDate);
      const existing = merged.get(key) || {
        date: new Date(payDate),
        payAmount: 0,
        sources: []
      };

      existing.payAmount += income.amount;
      existing.sources.push({ name: income.name, amount: income.amount });
      merged.set(key, existing);

      payDate = getNextPayDate(payDate, income.frequency, anchorDay);
    }
  }

  const sorted = [...merged.values()].sort((a, b) => a.date - b.date);
  return sorted.slice(0, Math.max(minCount, state.previewCount));
}

function collectBillsInRange(startDate, endDate) {
  const billsInRange = [];

  for (const bill of state.bills) {
    const dueDates = monthlyDueDatesInRange(bill.dueDay, startDate, endDate);

    for (const dueDate of dueDates) {
      billsInRange.push({
        ...bill,
        dueDate
      });
    }
  }

  billsInRange.sort((a, b) => a.dueDate - b.dueDate || a.name.localeCompare(b.name));
  return billsInRange;
}

function monthlyDueDatesInRange(dueDay, startDate, endDate) {
  const dates = [];

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= lastMonth) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const maxDay = new Date(year, month + 1, 0).getDate();
    const validDay = Math.min(dueDay, maxDay);
    const dueDate = new Date(year, month, validDay);

    if (dueDate >= startDate && dueDate <= endDate) {
      dates.push(dueDate);
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return dates;
}

function createTotalCard(label, value, modifier = "") {
  const div = document.createElement("article");
  div.className = `total-card ${modifier}`;
  div.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return div;
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed?.incomes)) {
      state.incomes = parsed.incomes
        .map((income) => ({
          id: income.id || crypto.randomUUID(),
          name: String(income.name || "").trim(),
          amount: Number(income.amount),
          frequency: normalizeFrequency(income.frequency),
          firstPayDate: String(income.firstPayDate || ""),
          estimated: Boolean(income.estimated),
          grossAmount: Number(income.grossAmount),
          taxAmount: Number(income.taxAmount),
          stateCode: normalizeStateCode(income.stateCode),
          filingStatus: income.filingStatus === "married" ? "married" : "single",
          deductions: normalizeDeductions(income.deductions)
        }))
        .filter((income) => income.name && income.amount > 0 && isIsoDate(income.firstPayDate));

      state.incomes = state.incomes.map((income) => ({
        ...income,
        grossAmount: income.grossAmount > 0 ? income.grossAmount : income.amount,
        taxAmount: Number.isFinite(income.taxAmount) && income.taxAmount >= 0 ? income.taxAmount : null,
        stateCode: income.stateCode,
        filingStatus: income.filingStatus,
        deductions: normalizeDeductions(income.deductions)
      }));
    } else if (parsed?.income?.amount > 0 && isIsoDate(parsed?.income?.firstPayDate)) {
      // Backward compatibility for previous single-income storage.
      state.incomes = [{
        id: crypto.randomUUID(),
        name: "Primary Income",
        amount: Number(parsed.income.amount),
        frequency: normalizeFrequency(parsed.income.frequency),
        firstPayDate: parsed.income.firstPayDate,
        estimated: false,
        grossAmount: Number(parsed.income.amount),
        taxAmount: null,
        stateCode: "",
        filingStatus: "single",
        deductions: normalizeDeductions(null)
      }];
    }

    if (Array.isArray(parsed?.bills)) {
      state.bills = parsed.bills
        .map((bill) => ({
          id: bill.id || crypto.randomUUID(),
          name: String(bill.name || "").trim(),
          category: String(bill.category || "Other").trim(),
          amount: Number(bill.amount),
          dueDay: Number(bill.dueDay),
          paid: Boolean(bill.paid)
        }))
        .filter((bill) => bill.name && bill.amount > 0 && bill.dueDay >= 1 && bill.dueDay <= 31);
    }

    state.previewCount = clamp(Number(parsed?.previewCount) || 8, 1, 24);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function reflectStateToInputs() {
  el.payFrequency.value = "weekly";
  el.previewCount.value = state.previewCount;
  el.overtimeMultiplier.value = "1.5";
  el.filingStatus.value = "single";
  el.deductionHealth.value = "";
  el.deduction401k.value = "";
  el.deductionOther.value = "";
}

function updateEstimatorUI() {
  const isUsingEstimator = el.useEstimator.checked;
  el.payAmount.disabled = isUsingEstimator;

  if (!isUsingEstimator) {
    el.estimatePreview.textContent = "";
    return;
  }

  const estimate = getEstimatorValue();
  if (!estimate) {
    el.estimatePreview.textContent = "Fill in hours, hourly rate, and a valid 2-letter state code to estimate net pay.";
    return;
  }

  el.payAmount.value = estimate.periodNet.toFixed(2);
  el.estimatePreview.textContent = `Estimated take-home: ${formatCurrency(estimate.periodNet)} | Gross: ${formatCurrency(estimate.periodGross)} | Taxes+FICA: ${formatCurrency(estimate.periodTaxes)} | Deductions: ${formatCurrency(estimate.periodDeductions)}`;
}

function getEstimatorValue() {
  const hoursWorked = Number(el.hoursWorked.value);
  const hourlyRate = Number(el.hourlyRate.value);
  const overtimeHours = Number(el.overtimeHours.value || 0);
  const overtimeMultiplier = Number(el.overtimeMultiplier.value || 1.5);
  const filingStatus = el.filingStatus.value === "married" ? "married" : "single";
  const state = normalizeStateCode(el.stateCode.value);
  const frequency = normalizeFrequency(el.payFrequency.value);
  const deductions = getDeductionInputs();

  if (hoursWorked <= 0 || hourlyRate <= 0 || overtimeHours < 0 || overtimeMultiplier < 1) {
    return null;
  }

  if (!/^[A-Z]{2}$/.test(state)) {
    return null;
  }

  const periodGross = roundCurrency((hoursWorked * hourlyRate) + (overtimeHours * hourlyRate * overtimeMultiplier));
  const taxResult = estimateTaxesFromGross({
    periodGross,
    frequency,
    filingStatus,
    stateCode: state
  });

  return {
    periodGross,
    periodTaxes: taxResult.periodTaxes,
    periodDeductions: deductions.total,
    periodNet: roundCurrency(Math.max(0, periodGross - taxResult.periodTaxes - deductions.total))
  };
}

function estimateTaxesFromGross({ periodGross, frequency, filingStatus, stateCode }) {
  const periodsPerYear = getPeriodsPerYear(frequency);
  const annualGross = periodGross * periodsPerYear;
  const annualTaxable = Math.max(0, annualGross - STANDARD_DEDUCTION[filingStatus]);
  const federalAnnual = calculateProgressiveTax(annualTaxable, FEDERAL_BRACKETS[filingStatus]);
  const stateAnnual = annualTaxable * (STATE_TAX_RATES[stateCode] ?? DEFAULT_STATE_TAX_RATE);
  const ficaAnnual = annualGross * 0.0765;
  const annualTaxes = federalAnnual + stateAnnual + ficaAnnual;

  return {
    annualTaxes,
    periodTaxes: roundCurrency(annualTaxes / periodsPerYear)
  };
}

function calculateProgressiveTax(taxableIncome, brackets) {
  let remaining = taxableIncome;
  let previousCap = 0;
  let totalTax = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) {
      break;
    }

    const bracketWidth = bracket.cap - previousCap;
    const taxableAtThisRate = Math.min(remaining, bracketWidth);
    totalTax += taxableAtThisRate * bracket.rate;
    remaining -= taxableAtThisRate;
    previousCap = bracket.cap;
  }

  return totalTax;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function parseDateLocal(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeStateCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function normalizeMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return roundCurrency(amount);
}

function normalizeDeductions(value) {
  const health = normalizeMoney(value?.health);
  const retirement401k = normalizeMoney(value?.retirement401k);
  const other = normalizeMoney(value?.other);

  return {
    health,
    retirement401k,
    other,
    total: roundCurrency(health + retirement401k + other)
  };
}

function getDeductionInputs() {
  return normalizeDeductions({
    health: el.deductionHealth.value,
    retirement401k: el.deduction401k.value,
    other: el.deductionOther.value
  });
}

function getDeductionTotal(deductions) {
  return normalizeDeductions(deductions).total;
}

function resetBillEditState() {
  state.editingBillId = null;
  el.billSubmitBtn.textContent = "Add Bill";
  el.billCancelEdit.hidden = true;
}

function normalizeFrequency(value) {
  if (value === "biweekly") {
    return "biweekly";
  }

  if (value === "monthly") {
    return "monthly";
  }

  return "weekly";
}

function formatFrequencyLabel(frequency) {
  if (frequency === "biweekly") {
    return "Biweekly";
  }

  if (frequency === "monthly") {
    return "Monthly";
  }

  return "Weekly";
}

function getPeriodsPerYear(frequency) {
  if (frequency === "biweekly") {
    return 26;
  }

  if (frequency === "monthly") {
    return 12;
  }

  return 52;
}

function getNextPayDate(currentDate, frequency, anchorDay) {
  if (frequency === "biweekly") {
    return addDays(currentDate, 14);
  }

  if (frequency === "monthly") {
    return addMonthsWithAnchor(currentDate, 1, anchorDay);
  }

  return addDays(currentDate, 7);
}

function addMonthsWithAnchor(date, months, anchorDay) {
  const target = new Date(date);
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(anchorDay, maxDay));
  return target;
}
