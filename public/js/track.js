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
    trackBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin" style="animation:spin 1s linear infinite; margin-right:0.35rem;" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path></svg>
      Searching...
    `;

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
        resCreatedDate.textContent = `Intake Registered: ${new Date(data.created_at).toLocaleString()}`;

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

        // Update Timeline Progression with checkmarks and active states
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
        trackBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:0.2rem;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          Track Pickup
        `;
      });
  }

  function updateTimeline(status) {
    const steps = [
      { el: step1, num: '1' },
      { el: step2, num: '2' },
      { el: step3, num: '3' },
      { el: step4, num: '4' }
    ];

    // Reset all
    steps.forEach(s => {
      s.el.className = 'timeline-step';
      const node = s.el.querySelector('.timeline-node');
      if (node) node.textContent = s.num;
    });

    const setCompleted = (step) => {
      step.el.className = 'timeline-step completed';
      const node = step.el.querySelector('.timeline-node');
      if (node) node.innerHTML = '&#10003;';
    };

    const setActive = (step) => {
      step.el.className = 'timeline-step active';
    };

    const setFailed = (step) => {
      step.el.className = 'timeline-step failed';
      const node = step.el.querySelector('.timeline-node');
      if (node) node.innerHTML = '&#10007;';
    };

    if (status === 'SUBMITTED') {
      setActive(steps[0]);
    } else if (status === 'READY') {
      setCompleted(steps[0]);
      setActive(steps[1]);
    } else if (status === 'SCHEDULED') {
      setCompleted(steps[0]);
      setCompleted(steps[1]);
      setActive(steps[2]);
    } else if (status === 'COLLECTED') {
      setCompleted(steps[0]);
      setCompleted(steps[1]);
      setCompleted(steps[2]);
      setCompleted(steps[3]);
    } else if (status === 'UNSUCCESSFUL') {
      setCompleted(steps[0]);
      setCompleted(steps[1]);
      setFailed(steps[2]);
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
