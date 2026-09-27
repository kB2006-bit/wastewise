document.addEventListener('DOMContentLoaded', () => {
  let adminKey = sessionStorage.getItem('wastewise_admin_key') || '';

  const adminKeyInput = document.getElementById('admin-key-input');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const authStatusIndicator = document.getElementById('auth-status-indicator');
  const adminError = document.getElementById('admin-error');

  const statActive = document.getElementById('stat-active');
  const statReady = document.getElementById('stat-ready');
  const statScheduled = document.getElementById('stat-scheduled');
  const statCollected = document.getElementById('stat-collected');
  const statUnsuccessful = document.getElementById('stat-unsuccessful');

  const filterStatus = document.getElementById('filter-status');
  const filterZone = document.getElementById('filter-zone');
  const filterCategory = document.getElementById('filter-category');
  const refreshBtn = document.getElementById('refresh-btn');
  const requestsTbody = document.getElementById('requests-tbody');

  // Modal elements
  const exceptionModal = document.getElementById('exception-modal');
  const exceptionForm = document.getElementById('exception-form');
  const modalRequestId = document.getElementById('modal-request-id');
  const reasonCodeSelect = document.getElementById('reason-code-select');
  const operatorNoteInput = document.getElementById('operator-note-input');
  const resolutionPreviewBox = document.getElementById('resolution-preview-box');
  const resolutionPreviewText = document.getElementById('resolution-preview-text');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');

  const RESOLUTION_PREVIEWS = {
    INACCESSIBLE: 'Ensure gate is unlocked, vehicles are moved, or provide clear access instructions for the next scheduled pickup.',
    NOT_PRESENT: 'Place the item at the curbside or declared pickup location by 07:00 AM on the rescheduled collection date.',
    PREP_INCOMPLETE: 'Complete the required preparation checklist (e.g. tape terminals, drain fluids, wrap item) before requesting re-dispatch.',
    INCORRECT_CATEGORY: 'Re-classify your item under the appropriate waste category or request specialized handling.',
    CAPACITY_UNAVAILABLE: 'Truck capacity was exceeded during this collection run. Your request has priority for the next available window in your zone.',
    OTHER: 'Review operator notes and contact municipal dispatch to coordinate collection requirements.'
  };

  if (adminKey) {
    adminKeyInput.value = adminKey;
    updateAuthUI(true);
    initData();
  }

  saveKeyBtn.addEventListener('click', () => {
    const val = adminKeyInput.value.trim();
    if (!val) {
      showError('Please enter an admin key.');
      return;
    }
    adminKey = val;
    sessionStorage.setItem('wastewise_admin_key', adminKey);
    updateAuthUI(true);
    initData();
  });

  function updateAuthUI(isAuthed) {
    if (isAuthed) {
      authStatusIndicator.textContent = 'Authenticated (Key Loaded)';
      authStatusIndicator.style.color = 'var(--color-success)';
    } else {
      authStatusIndicator.textContent = 'Status: Not Authenticated';
      authStatusIndicator.style.color = 'var(--color-text-muted)';
    }
  }

  function initData() {
    loadFilters();
    loadDashboard();
  }

  function loadFilters() {
    fetch('/api/zones')
      .then(res => res.json())
      .then(zones => {
        filterZone.innerHTML = '<option value="">All Service Zones</option>';
        zones.forEach(z => {
          const opt = document.createElement('option');
          opt.value = z.id;
          opt.textContent = z.name;
          filterZone.appendChild(opt);
        });
      });

    fetch('/api/categories')
      .then(res => res.json())
      .then(cats => {
        filterCategory.innerHTML = '<option value="">All Waste Categories</option>';
        cats.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          filterCategory.appendChild(opt);
        });
      });
  }

  function loadDashboard() {
    clearError();
    if (!adminKey) {
      requestsTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2rem; color:var(--color-text-muted);">
            Please enter your ADMIN_KEY in the header to view and manage dispatch requests.
          </td>
        </tr>
      `;
      return;
    }

    // Load Stats
    fetch('/api/admin/stats', {
      headers: { 'x-admin-key': adminKey }
    })
      .then(res => {
        if (res.status === 401) throw new Error('Unauthorized: Invalid ADMIN_KEY.');
        return res.json();
      })
      .then(stats => {
        statActive.textContent = stats.total_active;
        statReady.textContent = stats.ready;
        statScheduled.textContent = stats.scheduled;
        statCollected.textContent = stats.collected;
        statUnsuccessful.textContent = stats.unsuccessful;
      })
      .catch(err => {
        showError(err.message);
      });

    // Load Filtered Requests
    const params = new URLSearchParams();
    if (filterStatus.value) params.append('status', filterStatus.value);
    if (filterZone.value) params.append('zone_id', filterZone.value);
    if (filterCategory.value) params.append('category_id', filterCategory.value);

    fetch(`/api/admin/requests?${params.toString()}`, {
      headers: { 'x-admin-key': adminKey }
    })
      .then(res => {
        if (res.status === 401) throw new Error('Unauthorized: Invalid ADMIN_KEY.');
        return res.json();
      })
      .then(requests => {
        renderRequestsTable(requests);
      })
      .catch(err => {
        showError(err.message);
      });
  }

  function renderRequestsTable(requests) {
    requestsTbody.innerHTML = '';
    if (!requests || requests.length === 0) {
      requestsTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2rem; color:var(--color-text-muted);">
            No pickup requests match the current filters.
          </td>
        </tr>
      `;
      return;
    }

    requests.forEach(req => {
      const tr = document.createElement('tr');

      // Prep state indicator
      const prepBadge = req.prep_confirmed
        ? `<span class="badge" style="background-color:#dcfce7; color:#166534;">Verified Ready</span>`
        : `<span class="badge" style="background-color:#fee2e2; color:#991b1b;">Unverified</span>`;

      // Status badge
      const statusBadge = `<span class="badge badge-${req.status}">${req.status}</span>`;

      // Action buttons based on current state
      let actionButtons = '';
      if (req.status === 'SUBMITTED') {
        actionButtons = `<button class="btn btn-primary btn-sm" onclick="window.updateStatus('${req.id}', 'READY')">Mark Ready</button>`;
      } else if (req.status === 'READY') {
        actionButtons = `<button class="btn btn-primary btn-sm" onclick="window.updateStatus('${req.id}', 'SCHEDULED')">Schedule Run</button>`;
      } else if (req.status === 'SCHEDULED') {
        actionButtons = `
          <div style="display:flex; gap:0.35rem; justify-content:flex-end;">
            <button class="btn btn-primary btn-sm" style="background-color:var(--color-success);" onclick="window.updateStatus('${req.id}', 'COLLECTED')">Collected</button>
            <button class="btn btn-danger btn-sm" onclick="window.openExceptionModal('${req.id}')">Unsuccessful</button>
          </div>
        `;
      } else if (req.status === 'UNSUCCESSFUL') {
        actionButtons = `
          <div style="display:flex; gap:0.35rem; justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="window.updateStatus('${req.id}', 'READY')">Re-Open</button>
            <button class="btn btn-primary btn-sm" onclick="window.updateStatus('${req.id}', 'SCHEDULED')">Re-Schedule</button>
          </div>
        `;
      } else if (req.status === 'COLLECTED') {
        actionButtons = `<span style="font-size:0.8rem; color:var(--color-text-muted); font-weight:600;">Dispatched & Closed</span>`;
      }

      // Exception display if any
      let exceptionInfo = '';
      if (req.status === 'UNSUCCESSFUL' && req.exception_reason) {
        exceptionInfo = `
          <div style="margin-top:0.4rem; padding:0.4rem; background:#fee2e2; border-radius:3px; font-size:0.75rem; color:#991b1b;">
            <strong>Exception:</strong> ${escapeHtml(req.exception_reason)}<br>
            <em>${escapeHtml(req.exception_operator_note || '')}</em>
          </div>
        `;
      }

      tr.innerHTML = `
        <td style="font-family:monospace; font-weight:700;">
          <a href="/track?code=${encodeURIComponent(req.tracking_code)}" target="_blank" style="color:var(--color-brand); text-decoration:none;">
            ${escapeHtml(req.tracking_code)}
          </a>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(req.category_name)}</div>
          <div style="font-size:0.8rem; color:var(--color-text-secondary);">${escapeHtml(req.item_description)} (Qty: ${req.quantity})</div>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(req.zone_name)}</div>
          <div style="font-size:0.8rem; color:var(--color-text-secondary);">${formatDate(req.collection_date)} (${req.window_start} - ${req.window_end})</div>
        </td>
        <td>
          <div>${escapeHtml(req.address)}</div>
          ${req.access_notes ? `<div style="font-size:0.775rem; color:var(--color-text-muted); margin-top:0.2rem;">Note: ${escapeHtml(req.access_notes)}</div>` : ''}
        </td>
        <td>${prepBadge}</td>
        <td>
          ${statusBadge}
          ${exceptionInfo}
        </td>
        <td style="text-align:right;">${actionButtons}</td>
      `;

      requestsTbody.appendChild(tr);
    });
  }

  // Global window functions for table action buttons
  window.updateStatus = function(id, targetStatus) {
    if (!confirm(`Confirm transitioning request status to '${targetStatus}'?`)) return;

    fetch(`/api/admin/requests/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({ status: targetStatus })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);
        return data;
      })
      .then(() => {
        loadDashboard();
      })
      .catch(err => {
        showError(err.message);
      });
  };

  window.openExceptionModal = function(id) {
    modalRequestId.value = id;
    reasonCodeSelect.value = '';
    operatorNoteInput.value = '';
    resolutionPreviewBox.style.display = 'none';
    exceptionModal.style.display = 'flex';
  };

  // Preview resolution text when selecting reason
  reasonCodeSelect.addEventListener('change', () => {
    const reason = reasonCodeSelect.value;
    if (reason && RESOLUTION_PREVIEWS[reason]) {
      resolutionPreviewText.textContent = RESOLUTION_PREVIEWS[reason];
      resolutionPreviewBox.style.display = 'block';
    } else {
      resolutionPreviewBox.style.display = 'none';
    }
  });

  // Modal Cancel / Close
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  function closeModal() {
    exceptionModal.style.display = 'none';
  }

  // Submit Exception
  exceptionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = modalRequestId.value;
    const reasonCode = reasonCodeSelect.value;
    const operatorNote = operatorNoteInput.value.trim();

    if (!reasonCode) {
      alert('Please select an exception reason code.');
      return;
    }

    fetch(`/api/admin/requests/${id}/exception`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({
        reason_code: reasonCode,
        operator_note: operatorNote
      })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);
        return data;
      })
      .then(() => {
        closeModal();
        loadDashboard();
      })
      .catch(err => {
        alert(err.message);
      });
  });

  // Filter events
  filterStatus.addEventListener('change', loadDashboard);
  filterZone.addEventListener('change', loadDashboard);
  filterCategory.addEventListener('change', loadDashboard);
  refreshBtn.addEventListener('click', loadDashboard);

  function showError(msg) {
    adminError.textContent = msg;
    adminError.style.display = 'block';
  }

  function clearError() {
    adminError.textContent = '';
    adminError.style.display = 'none';
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
