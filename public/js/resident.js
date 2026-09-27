document.addEventListener('DOMContentLoaded', () => {
  let categoriesData = [];
  let selectedCategory = null;

  // Form Elements
  const pickupForm = document.getElementById('pickup-form');
  const categoryContainer = document.getElementById('category-container');
  const selectedCatInput = document.getElementById('selected-category-id');
  const itemDescInput = document.getElementById('item-description');
  const itemQtyInput = document.getElementById('item-quantity');
  const prepSection = document.getElementById('prep-section');
  const prepRulesContainer = document.getElementById('prep-rules-container');
  const prepCheck = document.getElementById('prep-confirm-check');
  const addressInput = document.getElementById('address');
  const accessNotesInput = document.getElementById('access-notes');
  const zoneSelect = document.getElementById('zone-select');
  const windowSelect = document.getElementById('window-select');
  const windowSlotContainer = document.getElementById('window-slot-container');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  // Confirmation Elements
  const bookingSection = document.getElementById('booking-section');
  const confirmationSection = document.getElementById('confirmation-section');
  const confirmTrackingCode = document.getElementById('confirm-tracking-code');
  const confirmWindow = document.getElementById('confirm-window');
  const confirmZone = document.getElementById('confirm-zone');
  const confirmPrepReminder = document.getElementById('confirm-prep-reminder');
  const trackLinkBtn = document.getElementById('track-link-btn');
  const copyCodeBtn = document.getElementById('copy-code-btn');
  const newRequestBtn = document.getElementById('new-request-btn');

  // Readiness Gauge Elements
  const readinessBanner = document.getElementById('readiness-status-banner');
  const readinessBannerText = document.getElementById('readiness-banner-text');
  const gaugeCategory = document.getElementById('gauge-category');
  const gaugeItem = document.getElementById('gauge-item');
  const gaugePrep = document.getElementById('gauge-prep');
  const gaugeAddress = document.getElementById('gauge-address');
  const gaugeWindow = document.getElementById('gauge-window');

  // Category Icon SVGs
  const CATEGORY_ICONS = {
    'cat-ewaste': `
      <svg viewBox="0 0 24 24">
        <path d="M4 6h16v10H4zM2 18h20v2H2zM10 16v2h4v-2zM6 8h3v2H6V8zm5 0h7v2h-7V8z"/>
      </svg>
    `,
    'cat-bulky': `
      <svg viewBox="0 0 24 24">
        <path d="M20 10V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3a4 4 0 0 0-2 4v5h2v-2h16v2h2v-5a4 4 0 0 0-2-4zm-8-3h6v3h-6V7zm-8 3V7h6v3H4zm16 6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v2z"/>
      </svg>
    `,
    'cat-recyclable': `
      <svg viewBox="0 0 24 24">
        <path d="M12 2L8.5 7h7L12 2zm-7.5 9L1 17h6l2-4-4.5-2zm15 0l-4.5 2 2 4h6l-3.5-6z"/>
      </svg>
    `,
    'cat-organic': `
      <svg viewBox="0 0 24 24">
        <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5c0 2 1 4 4 4s7-4 11-9.5z"/>
      </svg>
    `
  };

  const DEFAULT_ICON = `
    <svg viewBox="0 0 24 24">
      <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zm3-9h2v8H9v-8zm4 0h2v8h-2v-8z"/>
    </svg>
  `;

  const CATEGORY_TAGS = {
    'cat-bulky': 'Heavy & Furnishings',
    'cat-ewaste': 'Hazardous Components',
    'cat-recyclable': 'Dry Commodities',
    'cat-organic': 'Yard & Garden'
  };

  // 1. Fetch Categories
  fetch('/api/categories')
    .then(res => res.json())
    .then(categories => {
      categoriesData = categories;
      categoryContainer.innerHTML = '';

      categories.forEach(cat => {
        const iconSvg = CATEGORY_ICONS[cat.id] || DEFAULT_ICON;
        const tagText = CATEGORY_TAGS[cat.id] || 'Eligible Waste';

        const card = document.createElement('div');
        card.className = `category-card category-${cat.id}`;
        card.dataset.id = cat.id;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'radio');
        card.setAttribute('aria-checked', 'false');
        card.innerHTML = `
          <div class="category-card-top">
            <div class="category-icon-box" aria-hidden="true">${iconSvg}</div>
            <span class="category-tag">${tagText}</span>
          </div>
          <div class="category-card-body">
            <div class="category-name">${escapeHtml(cat.name)}</div>
            <div class="category-desc">${escapeHtml(cat.description || '')}</div>
          </div>
          <div class="category-card-footer">
            <span class="category-select-label">Select Category</span>
            <span class="category-check-icon">✓</span>
          </div>
        `;

        card.addEventListener('click', () => selectCategory(cat));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectCategory(cat);
          }
        });

        categoryContainer.appendChild(card);
      });
    })
    .catch(() => {
      categoryContainer.innerHTML = `<div class="callout callout-danger">Unable to load collection categories. Please refresh.</div>`;
    });

  // 2. Select Category & Render Readiness Checklist
  function selectCategory(cat) {
    selectedCategory = cat;
    selectedCatInput.value = cat.id;

    document.querySelectorAll('.category-card').forEach(el => {
      const isMatch = el.dataset.id === cat.id;
      el.classList.toggle('selected', isMatch);
      el.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    prepRulesContainer.innerHTML = '';
    const rules = cat.rules || [];

    if (rules.length === 0) {
      prepSection.style.display = 'none';
      prepCheck.required = false;
      prepCheck.checked = true;
    } else {
      prepSection.style.display = 'block';
      prepCheck.required = true;
      prepCheck.checked = false;

      rules.forEach(rule => {
        const isMandatory = rule.required === 1;
        const row = document.createElement('div');
        row.className = 'prep-rule-row';
        row.innerHTML = `
          <span class="rule-badge ${isMandatory ? 'rule-badge-mandatory' : 'rule-badge-guideline'}">
            ${isMandatory ? 'Mandatory' : 'Guideline'}
          </span>
          <div>${escapeHtml(rule.instruction)}</div>
        `;
        prepRulesContainer.appendChild(row);
      });
    }

    updateReadinessGauge();
  }

  // 3. Fetch Zones
  fetch('/api/zones')
    .then(res => res.json())
    .then(zones => {
      zoneSelect.innerHTML = '<option value="">-- Select Service Zone --</option>';
      zones.forEach(zone => {
        const opt = document.createElement('option');
        opt.value = zone.id;
        opt.textContent = `${zone.name} — ${zone.description}`;
        zoneSelect.appendChild(opt);
      });
    });

  // 4. Handle Zone Change -> Load Windows with Interactive Tile Slots
  zoneSelect.addEventListener('change', () => {
    const zoneId = zoneSelect.value;
    windowSelect.innerHTML = '<option value="">-- Select Window --</option>';
    windowSelect.value = '';
    windowSlotContainer.innerHTML = '';

    if (!zoneId) {
      windowSlotContainer.innerHTML = `
        <div style="color:var(--color-slate-500); font-size:0.875rem; grid-column:1/-1; padding:1.25rem; text-align:center; background:var(--color-slate-50); border:1px dashed var(--color-slate-300); border-radius:var(--radius-sm);">
          Please select a service zone above to view available scheduling windows.
        </div>
      `;
      updateReadinessGauge();
      return;
    }

    windowSlotContainer.innerHTML = `
      <div style="color:var(--color-slate-500); font-size:0.875rem; grid-column:1/-1; padding:1.25rem; text-align:center;">
        Loading available sector corridor windows...
      </div>
    `;

    fetch(`/api/windows?zoneId=${encodeURIComponent(zoneId)}`)
      .then(res => res.json())
      .then(windows => {
        windowSlotContainer.innerHTML = '';
        windowSelect.innerHTML = '<option value="">-- Select Window --</option>';

        if (windows.length === 0) {
          windowSlotContainer.innerHTML = `
            <div style="color:var(--color-slate-500); font-size:0.875rem; grid-column:1/-1; padding:1.25rem; text-align:center; background:var(--color-slate-50); border:1px dashed var(--color-slate-300); border-radius:var(--radius-sm);">
              No collection windows currently active for this sector corridor.
            </div>
          `;
          return;
        }

        windows.forEach(win => {
          const opt = document.createElement('option');
          opt.value = win.id;
          opt.textContent = `${formatDate(win.collection_date)} (${win.start_time} - ${win.end_time})`;
          if (win.available_slots <= 0) opt.disabled = true;
          windowSelect.appendChild(opt);

          const isAvailable = win.available_slots > 0;
          const card = document.createElement('div');
          card.className = `window-slot-card ${isAvailable ? '' : 'disabled'}`;
          card.dataset.id = win.id;
          card.setAttribute('tabindex', isAvailable ? '0' : '-1');
          card.setAttribute('role', 'radio');
          card.setAttribute('aria-checked', 'false');

          const dParts = parseDateParts(win.collection_date);

          const pillHtml = isAvailable
            ? `<span class="slot-capacity-pill pill-open">${win.available_slots} slot${win.available_slots > 1 ? 's' : ''} available</span>`
            : `<span class="slot-capacity-pill pill-full">Capacity Full</span>`;

          card.innerHTML = `
            <div class="slot-card-header">
              <span class="slot-day-badge">${dParts.weekday}</span>
              ${pillHtml}
            </div>
            <div class="slot-date-large">${dParts.monthDay}</div>
            <div class="slot-time-row">
              <span class="slot-time-icon" aria-hidden="true">🕒</span>
              <span>${win.start_time} – ${win.end_time}</span>
            </div>
            <div class="slot-select-indicator">
              <span>Select Corridor</span>
              <span class="slot-check-icon">✓</span>
            </div>
          `;

          if (isAvailable) {
            card.addEventListener('click', () => selectSlot(win.id));
            card.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectSlot(win.id);
              }
            });
          }

          windowSlotContainer.appendChild(card);
        });
      })
      .catch(() => {
        windowSlotContainer.innerHTML = `<div class="callout callout-danger" style="grid-column:1/-1;">Failed to load collection windows.</div>`;
      });

    updateReadinessGauge();
  });

  function selectSlot(windowId) {
    windowSelect.value = windowId;

    document.querySelectorAll('.window-slot-card').forEach(el => {
      const isMatch = el.dataset.id === windowId;
      el.classList.toggle('selected', isMatch);
      el.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    updateReadinessGauge();
  }

  // 5. Input Listeners for Live Readiness Gauge Updates
  itemDescInput.addEventListener('input', updateReadinessGauge);
  prepCheck.addEventListener('change', updateReadinessGauge);
  addressInput.addEventListener('input', updateReadinessGauge);

  function updateReadinessGauge() {
    const hasCategory = Boolean(selectedCatInput.value);
    const hasItem = Boolean(itemDescInput.value.trim().length >= 3);
    const hasPrep = Boolean(prepCheck.checked);
    const hasAddress = Boolean(addressInput.value.trim().length >= 5);
    const hasWindow = Boolean(windowSelect.value);

    // Update gauge item classes
    setGaugeState(gaugeCategory, hasCategory);
    setGaugeState(gaugeItem, hasItem);
    setGaugeState(gaugePrep, hasPrep);
    setGaugeState(gaugeAddress, hasAddress);
    setGaugeState(gaugeWindow, hasWindow);

    // Calculate count out of 5
    const count = [hasCategory, hasItem, hasPrep, hasAddress, hasWindow].filter(Boolean).length;
    const countText = document.getElementById('readiness-count-text');
    const ringCircle = document.getElementById('readiness-ring-circle');
    const summaryLine = document.getElementById('readiness-summary-line');

    if (countText) countText.textContent = `${count}/5`;
    if (ringCircle) {
      const circumference = 213.6;
      ringCircle.style.strokeDashoffset = (circumference * (1 - count / 5)).toFixed(1);
      ringCircle.style.stroke = count === 5 ? 'var(--color-brand)' : 'var(--color-slate-400)';
    }

    // Step progress bar on main flow
    updateProgressBar(hasCategory, hasItem, hasPrep, hasAddress, hasWindow);

    const isAllReady = count === 5;
    if (isAllReady) {
      readinessBanner.className = 'readiness-status-banner status-ready';
      readinessBannerText.textContent = 'READY FOR DISPATCH';
      if (summaryLine) summaryLine.textContent = 'All requirements verified for route dispatch';
    } else {
      readinessBanner.className = 'readiness-status-banner status-incomplete';
      readinessBannerText.textContent = 'Awaiting Requirements';
      const remaining = 5 - count;
      if (summaryLine) summaryLine.textContent = `${remaining} required verification${remaining > 1 ? 's' : ''} pending`;
    }
  }

  function setGaugeState(el, isDone) {
    if (!el) return;
    el.classList.toggle('verified', isDone);
    el.classList.toggle('unverified', !isDone);
  }

  function updateProgressBar(c1, c2, c3, c4, c5) {
    setProgStep('prog-step-1', c1, true);
    setProgStep('prog-step-2', c2, c1);
    setProgStep('prog-step-3', c3, c1 && c2);
    setProgStep('prog-step-4', c4, c1 && c2 && c3);
    setProgStep('prog-step-5', c5, c1 && c2 && c3 && c4);
  }

  function setProgStep(id, isDone, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('completed', isDone);
    el.classList.toggle('active', isActive && !isDone);
  }

  // 6. Submit Pickup Request
  pickupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    formError.style.display = 'none';
    formError.textContent = '';

    const categoryId = selectedCatInput.value;
    const itemDescription = itemDescInput.value.trim();
    const quantity = parseInt(itemQtyInput.value, 10);
    const address = addressInput.value.trim();
    const accessNotes = accessNotesInput.value.trim();
    const zoneId = zoneSelect.value;
    const windowId = windowSelect.value;
    const prepConfirmed = prepCheck.checked;

    if (!categoryId) {
      showError('Please select an eligible waste category.');
      return;
    }

    if (!windowId) {
      showError('Please select an available collection corridor window.');
      return;
    }

    if (!prepConfirmed) {
      showError('You must acknowledge and certify the collection readiness checklist.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying Readiness & Slotting...';

    const payload = {
      category_id: categoryId,
      item_description: itemDescription,
      quantity: quantity,
      zone_id: zoneId,
      address: address,
      access_notes: accessNotes,
      prep_confirmed: true,
      requested_window_id: windowId
    };

    fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Failed to submit request');
        }
        return data;
      })
      .then(data => {
        bookingSection.style.display = 'none';
        confirmationSection.style.display = 'block';

        confirmTrackingCode.textContent = data.tracking_code;
        confirmWindow.textContent = `${formatDate(data.collection_date)} (${data.collection_window})`;
        confirmZone.textContent = data.zone_name;

        confirmPrepReminder.innerHTML = '';
        (data.prep_reminder || []).forEach(r => {
          const li = document.createElement('li');
          li.textContent = r;
          confirmPrepReminder.appendChild(li);
        });

        trackLinkBtn.href = `/track?code=${encodeURIComponent(data.tracking_code)}`;

        copyCodeBtn.onclick = () => {
          navigator.clipboard.writeText(data.tracking_code).then(() => {
            copyCodeBtn.textContent = 'Copied!';
            setTimeout(() => { copyCodeBtn.textContent = 'Copy Code'; }, 2000);
          });
        };

        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(err => {
        showError(err.message);
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Collection Request';
      });
  });

  newRequestBtn.addEventListener('click', () => {
    pickupForm.reset();
    selectedCategory = null;
    selectedCatInput.value = '';
    prepSection.style.display = 'none';
    windowSelect.innerHTML = '<option value="">-- Select Window --</option>';
    windowSlotContainer.innerHTML = `
      <div style="color:var(--color-slate-500); font-size:0.875rem; grid-column:1/-1; padding:1.25rem; text-align:center; background:var(--color-slate-50); border:1px dashed var(--color-slate-300); border-radius:var(--radius-sm);">
        Please select a service zone above to view available scheduling windows.
      </div>
    `;
    document.querySelectorAll('.category-card').forEach(el => el.classList.remove('selected'));

    confirmationSection.style.display = 'none';
    bookingSection.style.display = 'block';
    updateReadinessGauge();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function showError(msg) {
    formError.textContent = msg;
    formError.style.display = 'block';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(dStr) {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dStr;
    }
  }

  function parseDateParts(dStr) {
    if (!dStr) return { weekday: 'Slot', monthDay: '' };
    try {
      const parts = dStr.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return {
        weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
        monthDay: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      };
    } catch {
      return { weekday: 'Date', monthDay: dStr };
    }
  }
});
