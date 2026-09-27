document.addEventListener('DOMContentLoaded', () => {
  let categoriesData = [];
  let selectedCategory = null;

  const categoryContainer = document.getElementById('category-container');
  const selectedCatInput = document.getElementById('selected-category-id');
  const prepSection = document.getElementById('prep-section');
  const prepRulesContainer = document.getElementById('prep-rules-container');
  const prepCheck = document.getElementById('prep-confirm-check');
  const zoneSelect = document.getElementById('zone-select');
  const windowSelect = document.getElementById('window-select');
  const capacityIndicator = document.getElementById('capacity-indicator');
  const pickupForm = document.getElementById('pickup-form');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  const bookingSection = document.getElementById('booking-section');
  const confirmationSection = document.getElementById('confirmation-section');
  const confirmTrackingCode = document.getElementById('confirm-tracking-code');
  const confirmWindow = document.getElementById('confirm-window');
  const confirmZone = document.getElementById('confirm-zone');
  const confirmPrepReminder = document.getElementById('confirm-prep-reminder');
  const trackLinkBtn = document.getElementById('track-link-btn');
  const newRequestBtn = document.getElementById('new-request-btn');

  // 1. Load Categories
  fetch('/api/categories')
    .then(res => res.json())
    .then(categories => {
      categoriesData = categories;
      categoryContainer.innerHTML = '';

      categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-option';
        card.dataset.id = cat.id;
        card.innerHTML = `
          <div class="category-option-name">${escapeHtml(cat.name)}</div>
          <div class="category-option-desc">${escapeHtml(cat.description || '')}</div>
        `;

        card.addEventListener('click', () => selectCategory(cat));
        categoryContainer.appendChild(card);
      });
    })
    .catch(err => {
      categoryContainer.innerHTML = `<div class="callout callout-danger">Failed to load categories. Please refresh.</div>`;
    });

  // 2. Select Category & Render Readiness Checklist
  function selectCategory(cat) {
    selectedCategory = cat;
    selectedCatInput.value = cat.id;

    // Highlight card
    document.querySelectorAll('.category-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === cat.id);
    });

    // Render Readiness Rules
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
        const item = document.createElement('div');
        item.className = 'prep-rule-item';
        const isMandatory = rule.required === 1;
        item.innerHTML = `
          <span class="prep-rule-badge ${isMandatory ? 'prep-badge-mandatory' : 'prep-badge-recommended'}">
            ${isMandatory ? 'Mandatory' : 'Guideline'}
          </span>
          <div>${escapeHtml(rule.instruction)}</div>
        `;
        prepRulesContainer.appendChild(item);
      });
    }
  }

  // 3. Load Zones
  fetch('/api/zones')
    .then(res => res.json())
    .then(zones => {
      zoneSelect.innerHTML = '<option value="">-- Select Service Zone --</option>';
      zones.forEach(zone => {
        const opt = document.createElement('option');
        opt.value = zone.id;
        opt.textContent = `${zone.name} - ${zone.description}`;
        zoneSelect.appendChild(opt);
      });
    })
    .catch(err => {
      console.error('Failed to load zones:', err);
    });

  // 4. Handle Zone Change -> Load Collection Windows with Capacity
  zoneSelect.addEventListener('change', () => {
    const zoneId = zoneSelect.value;
    windowSelect.innerHTML = '<option value="">-- Select Collection Window --</option>';
    capacityIndicator.textContent = '';

    if (!zoneId) {
      windowSelect.disabled = true;
      return;
    }

    windowSelect.disabled = false;
    windowSelect.innerHTML = '<option value="">Loading available windows...</option>';

    fetch(`/api/windows?zoneId=${encodeURIComponent(zoneId)}`)
      .then(res => res.json())
      .then(windows => {
        windowSelect.innerHTML = '<option value="">-- Select Collection Window --</option>';
        if (windows.length === 0) {
          windowSelect.innerHTML = '<option value="">No windows currently scheduled</option>';
          windowSelect.disabled = true;
          return;
        }

        windows.forEach(win => {
          const opt = document.createElement('option');
          opt.value = win.id;
          const slots = win.available_slots;
          const dateStr = formatDate(win.collection_date);

          if (slots <= 0) {
            opt.disabled = true;
            opt.textContent = `${dateStr} (${win.start_time} - ${win.end_time}) [CAPACITY FULL]`;
          } else {
            opt.textContent = `${dateStr} (${win.start_time} - ${win.end_time}) [${slots} slot${slots > 1 ? 's' : ''} left]`;
          }
          windowSelect.appendChild(opt);
        });
      })
      .catch(err => {
        windowSelect.innerHTML = '<option value="">Error loading windows</option>';
      });
  });

  // 5. Handle Window Select Change
  windowSelect.addEventListener('change', () => {
    capacityIndicator.textContent = '';
  });

  // 6. Submit Pickup Request
  pickupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    formError.style.display = 'none';
    formError.textContent = '';

    const categoryId = selectedCatInput.value;
    const itemDescription = document.getElementById('item-description').value.trim();
    const quantity = parseInt(document.getElementById('item-quantity').value, 10);
    const address = document.getElementById('address').value.trim();
    const accessNotes = document.getElementById('access-notes').value.trim();
    const zoneId = zoneSelect.value;
    const windowId = windowSelect.value;
    const prepConfirmed = prepCheck.checked;

    if (!categoryId) {
      showError('Please select a waste category.');
      return;
    }

    if (!windowId) {
      showError('Please select an available collection window.');
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
        // Show Confirmation
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
    windowSelect.innerHTML = '<option value="">-- First Select Zone --</option>';
    windowSelect.disabled = true;
    document.querySelectorAll('.category-option').forEach(el => el.classList.remove('selected'));

    confirmationSection.style.display = 'none';
    bookingSection.style.display = 'block';
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
});
