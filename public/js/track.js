document.addEventListener('DOMContentLoaded', () => {
  const trackForm = document.getElementById('track-form');
  const trackingInput = document.getElementById('tracking-input');
  const trackBtn = document.getElementById('track-btn');
  const trackError = document.getElementById('track-error');
  const resultsCard = document.getElementById('results-card');

  const resTrackingCode = document.getElementById('res-tracking-code');
  const resCreatedDate = document.getElementById('res-created-date');
  const resStatusBadge = document.getElementById('res-status-badge');
  const resCategory = document.getElementById('res-category');
  const resItem = document.getElementById('res-item');
  const resZone = document.getElementById('res-zone');
  const resWindow = document.getElementById('res-window');
  const resAddress = document.getElementById('res-address');
  const resPrepRules = document.getElementById('res-prep-rules');

  const exceptionCallout = document.getElementById('exception-callout');
  const exceptionReasonBadge = document.getElementById('exception-reason-badge');
  const exceptionResolutionText = document.getElementById('exception-resolution-text');

  // Timeline Step Elements
  const step1 = document.getElementById('timeline-step-1');
  const step2 = document.getElementById('timeline-step-2');
  const step3 = document.getElementById('timeline-step-3');
  const step4 = document.getElementById('timeline-step-4');

  // Sample code quick-click handlers
  document.querySelectorAll('.test-code-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const code = link.dataset.code;
      trackingInput.value = code;
      performLookup(code);
    });
  });

  // Check URL query params for ?code=...
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  if (codeParam) {
    trackingInput.value = codeParam.trim();
    performLookup(codeParam.trim());
  }

  trackForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = trackingInput.value.trim().toUpperCase();
    if (code) {
      performLookup(code);
    }
  });

  function performLookup(code) {
    trackError.style.display = 'none';
    resultsCard.style.display = 'none';
    exceptionCallout.style.display = 'none';
    trackBtn.disabled = true;
    trackBtn.textContent = 'Searching...';

    fetch(`/api/track/${encodeURIComponent(code)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Tracking reference not found');
        }
        return data;
      })
      .then(data => {
        resultsCard.style.display = 'block';

        resTrackingCode.textContent = data.tracking_code;
        resCreatedDate.textContent = `Submitted: ${new Date(data.created_at).toLocaleString()}`;

        // Status Badge
        resStatusBadge.className = `badge badge-${data.status}`;
        resStatusBadge.textContent = getStatusLabel(data.status);

        resCategory.textContent = data.category_name;
        resItem.textContent = `${data.item_description} (Qty: ${data.quantity})`;
        resZone.textContent = data.zone_name;
        resWindow.textContent = `${formatDate(data.collection_date)} (${data.collection_window})`;
        resAddress.textContent = data.masked_address;

        // Prep Rules
        resPrepRules.innerHTML = '';
        (data.prep_rules || []).forEach(rule => {
          const li = document.createElement('li');
          li.textContent = rule;
          resPrepRules.appendChild(li);
        });

        // Update Timeline Progression
        updateTimeline(data.status);

        // Exception Handling if UNSUCCESSFUL
        if (data.status === 'UNSUCCESSFUL' && data.exception) {
          exceptionCallout.style.display = 'block';
          exceptionReasonBadge.textContent = data.exception.reason_code;
          exceptionResolutionText.textContent = data.exception.resolution_instruction;
        }

        // Update browser URL without reload
        const newUrl = `${window.location.pathname}?code=${encodeURIComponent(code)}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      })
      .catch(err => {
        trackError.textContent = err.message;
        trackError.style.display = 'block';
      })
      .finally(() => {
        trackBtn.disabled = false;
        trackBtn.textContent = 'Track';
      });
  }

  function updateTimeline(status) {
    // Reset all steps
    [step1, step2, step3, step4].forEach(s => {
      s.className = 'timeline-step';
    });

    if (status === 'SUBMITTED') {
      step1.className = 'timeline-step active';
    } else if (status === 'READY') {
      step1.className = 'timeline-step completed';
      step2.className = 'timeline-step active';
    } else if (status === 'SCHEDULED') {
      step1.className = 'timeline-step completed';
      step2.className = 'timeline-step completed';
      step3.className = 'timeline-step active';
    } else if (status === 'COLLECTED') {
      step1.className = 'timeline-step completed';
      step2.className = 'timeline-step completed';
      step3.className = 'timeline-step completed';
      step4.className = 'timeline-step completed';
    } else if (status === 'UNSUCCESSFUL') {
      step1.className = 'timeline-step completed';
      step2.className = 'timeline-step completed';
      step3.className = 'timeline-step failed';
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'SUBMITTED': return 'Intake Review';
      case 'READY': return 'Ready for Dispatch';
      case 'SCHEDULED': return 'Scheduled on Run Sheet';
      case 'COLLECTED': return 'Completed & Collected';
      case 'UNSUCCESSFUL': return 'Curbside Exception';
      default: return status;
    }
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
