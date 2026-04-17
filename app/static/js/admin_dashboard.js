/* QUALIHOME — Dashboard JavaScript
   Shared by: admin.html, client.html, agent.html
   Loaded after main.js via {% block scripts %} in each dashboard template.
*/
// Guard helper — silently skips addEventListener when the element is absent
// (admin_dashboard.js is shared with client & agent dashboards which lack admin-only DOM nodes)
function _bind(id, evt, fn) { var el = document.getElementById(id); if (el) el.addEventListener(evt, fn); }
function csrfToken() { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; }
function parseApiResponse(response) {
  return response.text().then(function(text) {
    var data = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      data = null;
    }
    return { ok: response.ok, status: response.status, data: data, text: text || '' };
  });
}
function getApiErrorMessage(res, fallback) {
  if (res && res.data) {
    return res.data.detail || res.data.error || fallback;
  }
  if (res && res.text) {
    var plain = res.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain) return plain;
  }
  return fallback;
}

function _escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _formatPeso(amount) {
  var value = Number(amount);
  if (!isFinite(value)) value = 0;
  return '₱' + value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

function _readNumberInput(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  var value = parseFloat(String(el.value || '').replace(/,/g, ''));
  return isFinite(value) ? value : 0;
}

function _setPreviewText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _syncPropertyPricingPreview(prefix) {
  var price = _readNumberInput(prefix + '_price');
  var promo = _readNumberInput(prefix + '_promo_discount_rate');
  var downpayment = _readNumberInput(prefix + '_downpayment_rate');
  var vat = _readNumberInput(prefix + '_vat_rate');
  var lmf = _readNumberInput(prefix + '_lmf_rate');

  var promoAmount = price * (promo / 100);
  var netSellingPrice = Math.max(price - promoAmount, 0);
  var vatAmount = netSellingPrice * (vat / 100);
  var lmfAmount = netSellingPrice * (lmf / 100);
  var totalContractPrice = netSellingPrice + vatAmount + lmfAmount;
  var downpaymentAmount = totalContractPrice * (downpayment / 100);

  _setPreviewText(prefix + '_promo_discount_preview', price > 0 || promo > 0 ? 'Approx. discount: ' + _formatPeso(promoAmount) : 'Enter TCP to preview the amount.');
  _setPreviewText(prefix + '_downpayment_preview', price > 0 || downpayment > 0 ? 'Approx. downpayment: ' + _formatPeso(downpaymentAmount) : 'Based on the net contract price.');
  _setPreviewText(prefix + '_vat_preview', price > 0 || vat > 0 ? 'Approx. VAT: ' + _formatPeso(vatAmount) : 'Based on the net selling price.');
  _setPreviewText(prefix + '_lmf_preview', price > 0 || lmf > 0 ? 'Approx. LMF: ' + _formatPeso(lmfAmount) : 'Based on the net selling price.');

  // Update full breakdown as well
  _updateFullPricingBreakdown(prefix);
}

function _updateFullPricingBreakdown(prefix) {
  var price = _readNumberInput(prefix + '_price');
  var promo = _readNumberInput(prefix + '_promo_discount_rate');
  var downpaymentRate = _readNumberInput(prefix + '_downpayment_rate');
  var vat = _readNumberInput(prefix + '_vat_rate');
  var lmf = _readNumberInput(prefix + '_lmf_rate');
  var interestRate = _readNumberInput(prefix + '_interest_rate');
  var reservationFee = _readNumberInput(prefix + '_reservation_fee');
  var dpTermsMonths = _readNumberInput(prefix + '_downpayment_terms_months') || 24;
  var loanablePercent = _readNumberInput(prefix + '_loanable_percentage') || 80;
  if (!isFinite(interestRate) || interestRate <= 0) interestRate = 8.5;

  // Calculate amounts
  var promoAmount = price * (promo / 100);
  var netSellingPrice = Math.max(price - promoAmount, 0);
  var vatAmount = netSellingPrice * (vat / 100);
  var lmfAmount = netSellingPrice * (lmf / 100);
  var totalContractPrice = netSellingPrice + vatAmount + lmfAmount;
  var downpaymentAmount = totalContractPrice * (downpaymentRate / 100);
  var monthlyDownpayment = downpaymentAmount / dpTermsMonths;
  var loanableAmount = totalContractPrice * (loanablePercent / 100);

  // Update SELLING PRICES
  _setPreviewText(prefix + '_bd_tsp', _formatPeso(price));
  _setPreviewText(prefix + '_bd_promo', _formatPeso(promoAmount));
  _setPreviewText(prefix + '_bd_vat', _formatPeso(vatAmount));
  _setPreviewText(prefix + '_bd_lmf', _formatPeso(lmfAmount));
  _setPreviewText(prefix + '_bd_vat_rate', '(' + vat.toFixed(2) + '%)');
  _setPreviewText(prefix + '_bd_lmf_rate', '(' + lmf.toFixed(2) + '%)');

  // Update MISCELLANEOUS
  _setPreviewText(prefix + '_bd_tcp', _formatPeso(totalContractPrice));
  _setPreviewText(prefix + '_bd_resv', _formatPeso(reservationFee));
  _setPreviewText(prefix + '_bd_dp_total', _formatPeso(downpaymentAmount));
  _setPreviewText(prefix + '_bd_dp_monthly', _formatPeso(monthlyDownpayment));
  _setPreviewText(prefix + '_bd_dp_months', '(' + Math.round(dpTermsMonths) + ' mos)');
  _setPreviewText(prefix + '_bd_loanable', _formatPeso(loanableAmount));
  _setPreviewText(prefix + '_bd_annual_int', interestRate.toFixed(2) + '%');
  _setPreviewText(prefix + '_bd_interest_rate_label', '(' + interestRate.toFixed(2) + '%)');

  // Update AMORTIZATION (monthly payments using simple amortization formula)
  var annualRate = interestRate / 100;
  var monthlyRate = annualRate / 12;
  var terms = [5, 10, 15, 20];
  terms.forEach(function(years) {
    var months = years * 12;
    var monthlyPayment = loanableAmount > 0 ? (loanableAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1) : 0;
    _setPreviewText(prefix + '_bd_amort_' + years, _formatPeso(monthlyPayment));
  });

  // Update REQUIRED INCOME (typically monthly payment * 3 for DTI of 35%)
  terms.forEach(function(years) {
    var months = years * 12;
    var monthlyPayment = loanableAmount > 0 ? (loanableAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1) : 0;
    var requiredIncome = monthlyPayment * 3; // Assuming 35% DTI threshold
    _setPreviewText(prefix + '_bd_income_' + years, _formatPeso(requiredIncome));
  });
}

document.addEventListener('DOMContentLoaded', function () {

  function hardenAddressAutofill(ids) {
    (ids || []).forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var isTextEntry = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
      el.setAttribute('autocomplete', isTextEntry ? 'section-sqh new-password' : 'off');
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', 'off');
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('aria-autocomplete', 'none');
      el.setAttribute('data-form-type', 'other');
      el.setAttribute('data-lpignore', 'true');
      el.setAttribute('data-1p-ignore', 'true');
      el.setAttribute('data-bwignore', 'true');
      el.setAttribute('name', 'sqh_' + id);
      if (isTextEntry && !el.value) el.setAttribute('readonly', 'readonly');
      function unlock() { el.removeAttribute('readonly'); }
      if (isTextEntry) {
        el.addEventListener('focus', unlock);
        el.addEventListener('mousedown', unlock);
        el.addEventListener('touchstart', unlock, { passive: true });
      }
    });
  }

  hardenAddressAutofill([
    'subSiteNotes', 'editSubSiteNotes', 'sp_site_notes', 'ep_site_notes',
    'ep_street', 'ep_block', 'ep_lot_no',
    'subRegionSelect', 'subProvinceSelect', 'subCitymunSelect', 'subBarangaySelect',
    'editSubRegionSelect', 'editSubProvinceSelect', 'editSubCitymunSelect', 'editSubBarangaySelect',
    'sp_region_select', 'sp_province_select', 'sp_citymun_select', 'sp_barangay_select',
    'ep_region_select', 'ep_province_select', 'ep_citymun_select', 'ep_barangay_select'
  ]);

  ['acp', 'ep'].forEach(function (prefix) {
    var interestInput = document.getElementById(prefix + '_interest_rate');
    if (interestInput && !String(interestInput.value || '').trim()) {
      interestInput.value = '8.5';
    }
    ['price', 'promo_discount_rate', 'downpayment_rate', 'vat_rate', 'lmf_rate', 'interest_rate'].forEach(function (field) {
      _bind(prefix + '_' + field, 'input', function () {
        _syncPropertyPricingPreview(prefix);
      });
    });
    // Also bind additional fields for full breakdown updates
    ['reservation_fee', 'downpayment_terms_months', 'loanable_percentage'].forEach(function (field) {
      _bind(prefix + '_' + field, 'input', function () {
        _updateFullPricingBreakdown(prefix);
      });
    });
    _syncPropertyPricingPreview(prefix);
  });

  // Pricing Breakdown Toggle Buttons
  ['acp', 'ep'].forEach(function (prefix) {
    var toggleBtn = document.getElementById(prefix + 'BreakdownToggle');
    var toggleIcon = document.getElementById(prefix + 'BreakdownToggleIcon');
    var contentDiv = document.getElementById(prefix + 'BreakdownContent');
    if (toggleBtn && contentDiv) {
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        contentDiv.classList.toggle('d-none');
        if (toggleIcon) {
          var isHidden = contentDiv.classList.contains('d-none');
          toggleIcon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // 1. ADMIN — Single-page section switching via data-page links
  // ══════════════════════════════════════════════════════════════

  var pages        = document.querySelectorAll('.dash-page');
  var sidebarLinks = document.querySelectorAll('.sqh-sidebar .sidebar-link[data-page]');
  var gotoLinks    = document.querySelectorAll('[data-goto]');

  function showPage(pageId) {
    // Clear project filter when navigating away from subdivisions
    if (pageId !== 'subdivisions') {
      _selectedProjectIdForSubdivisions = null;
      _selectedProjectLocationForSubdivisions = null;
    }
    if (pageId !== 'properties') {
      _selectedSubdivisionNameForModels = '';
    }
    
    // Hide all pages (fetch dynamically to ensure all are included)
    var allPages = document.querySelectorAll('.dash-page');
    allPages.forEach(function (p) { p.classList.add('d-none'); });
    var target = document.getElementById('page-' + pageId);
    if (target) {
      target.classList.remove('d-none');

      // Update topbar title / subtitle
      var titleEl    = document.getElementById('topbar-title');
      var subtitleEl = document.getElementById('topbar-subtitle');
      if (titleEl)    titleEl.innerHTML = target.getAttribute('data-title') || '';
      if (subtitleEl) subtitleEl.textContent = target.getAttribute('data-subtitle') || '';
    }

    // Update sidebar active state
    sidebarLinks.forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-page') === pageId);
    });

    // Persist so a page reload returns to the same section
    try { sessionStorage.setItem('activeDashPage', pageId); } catch(e) {}

    // Scroll content to top
    var content = document.querySelector('.dashboard-content');
    if (content) content.scrollTop = 0;
    window.scrollTo(0, 0);
  }
  window.showPage = showPage; // expose globally so client/agent scripts can wrap it

  // Sidebar link clicks
  sidebarLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var pg = this.getAttribute('data-page');
      // Allow an external hook (e.g. unsaved-changes guard) to block navigation.
      if (typeof window._navGuard === 'function' && window._navGuard(pg) === false) return;
      showPage(pg);
    });
  });

  // "View All" / shortcut links inside pages
  gotoLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      showPage(this.getAttribute('data-goto'));
    });
  });


  // ══════════════════════════════════════════════════════════════
  // 2. Sidebar: active link for non-SPA dashboards (client/agent)
  // ══════════════════════════════════════════════════════════════

  if (sidebarLinks.length === 0) {
    var currentPath = window.location.pathname;
    document.querySelectorAll('.sqh-sidebar .sidebar-link').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href !== '#' && href === currentPath) {
        link.classList.add('active');
      }
    });
  }


  // ══════════════════════════════════════════════════════════════
  // 3. Sidebar: collapse/expand on mobile
  // ══════════════════════════════════════════════════════════════

  var sidebarToggle = document.getElementById('sidebarToggle');
  var sidebar       = document.querySelector('.sqh-sidebar');
  var sidebarBackdrop = document.getElementById('sidebarBackdrop');
  if (sidebarToggle && sidebar) {
    function setSidebarOpen(open) {
      sidebar.classList.toggle('sqh-sidebar--open', !!open);
      document.body.classList.toggle('sidebar-open', !!open);
      sidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    sidebarToggle.addEventListener('click', function () {
      setSidebarOpen(!sidebar.classList.contains('sqh-sidebar--open'));
    });

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', function () {
        setSidebarOpen(false);
      });
    }

    sidebar.querySelectorAll('.sidebar-link[data-page]').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 991) setSidebarOpen(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('sqh-sidebar--open')) {
        setSidebarOpen(false);
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 991 && sidebar.classList.contains('sqh-sidebar--open')) {
        setSidebarOpen(false);
      }
    });

    document.addEventListener('show.bs.modal', function () {
      setSidebarOpen(false);
    });

    document.addEventListener('click', function (e) {
      if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
        setSidebarOpen(false);
      }
    });
  }


  // ══════════════════════════════════════════════════════════════
  // 4. Client-side table search & filter helpers
  // ══════════════════════════════════════════════════════════════

  /**
   * Show/hide a "no results" empty state row when filtering leaves nothing visible.
   */
  function showEmptyFilterRow(table, visibleCount, term) {
    var tbody = table.querySelector('tbody');
    var existing = tbody.querySelector('.empty-filter-row');
    var noDataRow = tbody.querySelector('.no-data-row');
    if (visibleCount === 0 && term) {
      if (noDataRow) noDataRow.style.display = 'none';
      if (!existing) {
        var cols = table.querySelectorAll('thead th').length || 1;
        var row = document.createElement('tr');
        row.className = 'empty-filter-row';
        row.innerHTML = '<td colspan="' + cols + '" class="text-center text-muted py-5">'
          + '<i class="fas fa-search fa-2x mb-2 d-block" style="color:var(--clr-border);"></i>'
          + '<span class="fw-semibold d-block mb-1">No results found</span>'
          + '<span class="small">Try adjusting your search or filter criteria.</span>'
          + '</td>';
        tbody.appendChild(row);
      }
    } else {
      if (existing) existing.remove();
      if (noDataRow) noDataRow.style.display = '';
    }
  }

  /**
   * Attach live search to an input: filters rows of a table by text in
   * cells matching `colSelector` (or all cells if null).
   */
  function filterTable(inputId, tableId, colSelector) {
    var input = document.getElementById(inputId);
    var table = document.getElementById(tableId);
    if (!input || !table) return;
    input.addEventListener('input', function () {
      var term = this.value.trim().toLowerCase();
      var visibleCount = 0;
      table.querySelectorAll('tbody tr:not(.empty-filter-row)').forEach(function (row) {
        if (row.cells.length <= 1) return;
        var hay;
        if (colSelector) {
          var cell = row.querySelector(colSelector);
          hay = cell ? cell.textContent.toLowerCase() : '';
        } else {
          hay = row.textContent.toLowerCase();
        }
        var show = hay.includes(term);
        row.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      showEmptyFilterRow(table, visibleCount, term);
    });
  }


  // ── Properties: search name/location + status + project filter (card grid) ────────────────
  (function () {
    var input  = document.getElementById('propSearch');
    var sel    = document.getElementById('propStatusFilter');
    var selSub = document.getElementById('propSubdivisionFilter');
    var grid   = document.getElementById('propCardsGrid');
    if (!input || !grid) return;

    function apply() {
      var term   = input.value.trim().toLowerCase();
      var status = sel    ? sel.value.toLowerCase()    : '';
      var subdiv = selSub ? selSub.value               : '';
      var selSubOpt = (selSub && selSub.selectedOptions && selSub.selectedOptions.length)
        ? selSub.selectedOptions[0]
        : null;
      var subdivId = selSubOpt ? String(selSubOpt.getAttribute('data-sub-id') || '') : '';
      var visibleCount = 0;
      grid.querySelectorAll('.prop-card-col').forEach(function (col) {
        var name  = (col.getAttribute('data-prop-name')   || '').toLowerCase();
        var loc   = (col.getAttribute('data-prop-loc')    || '').toLowerCase();
        var st    = (col.getAttribute('data-status')      || '').toLowerCase();
        var sub   = (col.getAttribute('data-prop-subdiv') || '');
        var subId = String(col.getAttribute('data-prop-subdiv-id') || '');
        var textMatch   = !term   || name.includes(term) || loc.includes(term);
        var statusMatch = !status || st === status;
        var subdivMatch = !subdiv || (
          subdiv === '__none__'
            ? sub === ''
            : (sub === subdiv || (subdivId && subId && subId === subdivId))
        );
        var show = textMatch && statusMatch && subdivMatch;
        col.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      var emptyEl = document.getElementById('propFilterEmpty');
      if (emptyEl) emptyEl.classList.toggle('d-none', visibleCount > 0);
    }
    input.addEventListener('input', apply);
    if (sel)    sel.addEventListener('change', apply);
    if (selSub) selSub.addEventListener('change', apply);
    window._applyPropertyFilters = apply;
  })();


  // ── Users: search name/email + status dropdown ─────────────
  (function () {
    var input  = document.getElementById('userSearch');
    var sel    = document.getElementById('userStatusFilter');
    var table  = document.getElementById('usersTable');
    if (!table) return;

    function apply() {
      var term   = input ? input.value.trim().toLowerCase() : '';
      var status = sel   ? sel.value.toLowerCase()          : '';
      var visibleCount = 0;
      table.querySelectorAll('tbody tr:not(.empty-filter-row)').forEach(function (row) {
        if (row.cells.length <= 1) return;
        var hay = row.textContent.toLowerCase();
        var st  = (row.querySelector('.user-status-badge') || {});
        var rowStatus = (st.dataset && st.dataset.status || '').toLowerCase();
        var textMatch   = !term   || hay.includes(term);
        var statusMatch = !status || rowStatus === status;
        var show = textMatch && statusMatch;
        row.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      showEmptyFilterRow(table, visibleCount, term || status);
    }
    if (input) input.addEventListener('input', apply);
    if (sel)   sel.addEventListener('change', apply);
  })();


  // ── Agents: search name/email + status dropdown ───────────────
  (function () {
    var input  = document.getElementById('agentSearch');
    var sel    = document.getElementById('agentStatusFilter');
    var table  = document.getElementById('agentsTable');
    if (!table) return;

    function apply() {
      var term   = input ? input.value.trim().toLowerCase() : '';
      var status = sel   ? sel.value.toLowerCase()          : '';
      var visibleCount = 0;
      table.querySelectorAll('tbody tr:not(.empty-filter-row)').forEach(function (row) {
        if (row.cells.length <= 1) return;
        var hay = row.textContent.toLowerCase();
        var st  = (row.querySelector('.user-status-badge') || {});
        var rowStatus = (st.dataset && st.dataset.status || '').toLowerCase();
        var textMatch   = !term   || hay.includes(term);
        var statusMatch = !status || rowStatus === status;
        var show = textMatch && statusMatch;
        row.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      showEmptyFilterRow(table, visibleCount, term || status);
    }
    if (input) input.addEventListener('input', apply);
    if (sel)   sel.addEventListener('change', apply);
  })();


  // ── Agent Availability Calendar Modal (admin view-only) ───────────────
  (function () {
    var modalEl = document.getElementById('adminAgentCalendarModal');
    if (!modalEl) return;

    var titleEl = document.getElementById('adminAgentCalendarTitle');
    var monthLabel = document.getElementById('adminAvailMonthLabel');
    var gridEl = document.getElementById('adminAvailCalendarGrid');
    var prevBtn = document.getElementById('adminAvailPrevMonthBtn');
    var nextBtn = document.getElementById('adminAvailNextMonthBtn');
    var selectedDateEl = document.getElementById('adminAvailSelectedDateLabel');
    var entryCountEl = document.getElementById('adminAvailDateEntryCount');
    var entriesEl = document.getElementById('adminAvailEntriesList');
    var errorEl = document.getElementById('adminAvailError');

    if (!titleEl || !monthLabel || !gridEl || !prevBtn || !nextBtn || !selectedDateEl || !entryCountEl || !entriesEl || !errorEl) return;

    var state = {
      agentId: null,
      agentName: '',
      year: (new Date()).getFullYear(),
      month: (new Date()).getMonth(),
      selectedDate: null,
      entries: []
    };

    function toIsoDate(d) {
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    function formatLongDate(isoDate) {
      if (!isoDate) return '—';
      var d = new Date(isoDate + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' });
    }

    function formatTime(hhmm) {
      var parts = String(hhmm || '').split(':');
      if (parts.length < 2) return hhmm || '';
      var h = parseInt(parts[0], 10);
      var m = parts[1];
      if (Number.isNaN(h)) return hhmm || '';
      var ampm = h >= 12 ? 'PM' : 'AM';
      var hour12 = h % 12 || 12;
      return hour12 + ':' + m + ' ' + ampm;
    }

    function esc(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function showError(message) {
      if (!message) {
        errorEl.classList.add('d-none');
        errorEl.textContent = '';
        return;
      }
      errorEl.textContent = message;
      errorEl.classList.remove('d-none');
    }

    function groupedByDate() {
      var grouped = {};
      state.entries.forEach(function (item) {
        if (!grouped[item.available_date]) grouped[item.available_date] = [];
        grouped[item.available_date].push(item);
      });
      return grouped;
    }

    function dateStatus(isoDate) {
      var rows = groupedByDate()[isoDate] || [];
      if (!rows.length) return 'none';
      if (rows.some(function (r) { return (r.availability_status || 'available') === 'not_available'; })) return 'not_available';
      return 'available';
    }

    function renderEntries(isoDate) {
      var rows = (groupedByDate()[isoDate] || []).slice().sort(function (a, b) {
        return String(a.start_time || '').localeCompare(String(b.start_time || ''));
      });

      entryCountEl.textContent = rows.length + ' entr' + (rows.length === 1 ? 'y' : 'ies');

      if (!rows.length) {
        entriesEl.innerHTML = '<div class="text-muted small">No entries for this date.</div>';
        return;
      }

entriesEl.innerHTML = rows.map(function (row) {
  var status = (row.availability_status || 'available');
  var badgeClass = status === 'not_available' ? 'badge-not-qualified' : 'badge-qualified';
  var timeHtml = status === 'not_available'
    ? '<div class="small text-muted fw-bold">Full day blocked</div>'
    : '<div class="small text-muted fw-bold">' + formatTime(row.start_time) + ' - ' + formatTime(row.end_time) + '</div>';
  var submittedLabel = row.created_at ? String(row.created_at) : '';
  if (!submittedLabel && row.available_date) {
    var sd = new Date(String(row.available_date) + 'T00:00:00');
    submittedLabel = Number.isNaN(sd.getTime())
      ? String(row.available_date)
      : sd.toLocaleDateString('en-PH', { month: 'short', day: '2-digit' });
  }
  var noteHtml = ''
    + '<div class="cp-trip-note cp-trip-note-home mt-2">'
    + '  <div class="cp-trip-note-header">'
    + '    <span class="cp-trip-note-label"><i class="fas fa-comment-dots me-1"></i>Agent Note</span>'
    + '  </div>'
    + '  <span class="cp-trip-note-text">' + esc(row.notes || 'None') + '</span>'
    + '</div>';
  return ''
    + '<div class="avail-entry-card">'
    + '  <div class="d-flex flex-column">'
    + '    <div class="d-flex align-items-center justify-content-between">'
    + '      <span class="sqh-badge ' + badgeClass + '">' + (status === 'not_available' ? 'Not Available' : 'Available') + '</span>'
    +        timeHtml
    + '    </div>'
    +      noteHtml
    + '  </div>'
    + '</div>';
}).join('');
    }

    function renderCalendar() {
      var first = new Date(state.year, state.month, 1);
      var startDay = first.getDay();
      var daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
      var prevDays = new Date(state.year, state.month, 0).getDate();

      monthLabel.textContent = first.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
      gridEl.innerHTML = '';

      for (var i = startDay - 1; i >= 0; i--) {
        var prevCell = document.createElement('button');
        prevCell.type = 'button';
        prevCell.className = 'avail-day-cell is-muted';
        prevCell.disabled = true;
        prevCell.innerHTML = '<span class="avail-day-number">' + (prevDays - i) + '</span>';
        gridEl.appendChild(prevCell);
      }

      var todayIso = toIsoDate(new Date());
      for (var day = 1; day <= daysInMonth; day++) {
        var d = new Date(state.year, state.month, day);
        var iso = toIsoDate(d);
        var status = dateStatus(iso);
        var cls = 'avail-day-cell ';
        if (status === 'none') cls += ' has-none';
        if (status === 'available') cls += ' has-available';
        if (status === 'not_available') cls += ' has-not-available';
        if (iso === state.selectedDate) cls += ' is-selected';
        if (iso === todayIso) cls += ' is-today';

        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = cls;
        cell.setAttribute('data-date', iso);
        cell.innerHTML = '<span class="avail-day-number">' + day + '</span><span class="avail-day-dot"></span>';
        gridEl.appendChild(cell);
      }

      var totalCells = startDay + daysInMonth;
      var trailing = (7 - (totalCells % 7)) % 7;
      for (var t = 1; t <= trailing; t++) {
        var nextCell = document.createElement('button');
        nextCell.type = 'button';
        nextCell.className = 'avail-day-cell is-muted';
        nextCell.disabled = true;
        nextCell.innerHTML = '<span class="avail-day-number">' + t + '</span>';
        gridEl.appendChild(nextCell);
      }
    }

    function renderAll() {
      selectedDateEl.textContent = formatLongDate(state.selectedDate);
      renderEntries(state.selectedDate);
      renderCalendar();
    }

    function pickInitialDate() {
      var today = toIsoDate(new Date());
      var grouped = groupedByDate();
      if (grouped[today]) return today;
      var dates = Object.keys(grouped).sort();
      return dates.length ? dates[0] : today;
    }

    function openForAgent(agentId, fallbackName) {
      state.agentId = agentId;
      state.agentName = fallbackName || 'Agent';
      state.entries = [];
      showError('');
      titleEl.textContent = 'Availability Calendar — ' + state.agentName;

      fetch('/admin/agent/' + encodeURIComponent(agentId) + '/availability', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(parseApiResponse)
        .then(function (res) {
          if (!res.ok || !res.data || res.data.ok === false) {
            showError(getApiErrorMessage(res, 'Unable to load agent availability.'));
            state.entries = [];
            state.selectedDate = toIsoDate(new Date());
            renderAll();
            return;
          }

          state.agentName = res.data.agent_name || fallbackName || state.agentName;
          titleEl.textContent = 'Availability Calendar — ' + state.agentName;
          state.entries = Array.isArray(res.data.items) ? res.data.items : [];
          state.selectedDate = pickInitialDate();

          if (state.selectedDate) {
            var d = new Date(state.selectedDate + 'T00:00:00');
            if (!Number.isNaN(d.getTime())) {
              state.year = d.getFullYear();
              state.month = d.getMonth();
            }
          }
          renderAll();
        })
        .catch(function () {
          showError('Network error while loading availability.');
          state.entries = [];
          state.selectedDate = toIsoDate(new Date());
          renderAll();
        });

      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.open-agent-calendar-btn');
      if (!btn) return;
      e.preventDefault();
      var agentId = parseInt(btn.getAttribute('data-agent-id'), 10);
      if (!agentId) return;
      openForAgent(agentId, btn.getAttribute('data-agent-name') || 'Agent');
    });

    prevBtn.addEventListener('click', function () {
      state.month -= 1;
      if (state.month < 0) {
        state.month = 11;
        state.year -= 1;
      }
      renderCalendar();
    });

    nextBtn.addEventListener('click', function () {
      state.month += 1;
      if (state.month > 11) {
        state.month = 0;
        state.year += 1;
      }
      renderCalendar();
    });

    gridEl.addEventListener('click', function (e) {
      var cell = e.target.closest('.avail-day-cell[data-date]');
      if (!cell) return;
      state.selectedDate = cell.getAttribute('data-date') || state.selectedDate;
      renderAll();
    });
  })();


  // ── C5.0: search is handled in admin.html (also covers the status filter) ──

  // ── Activity: search + type + role dropdown ──────────────────────────
  (function () {
    var input   = document.getElementById('actSearch');
    var sel     = document.getElementById('actTypeFilter');
    var roleSel = document.getElementById('actRoleFilter');
    var table   = document.getElementById('actTable');
    if (!table) return;

    function apply() {
      var term = input   ? input.value.trim().toLowerCase() : '';
      var type = sel     ? sel.value.toLowerCase()          : '';
      var role = roleSel ? roleSel.value.toLowerCase()      : '';
      var visibleCount = 0;
      table.querySelectorAll('tbody tr:not(.empty-filter-row)').forEach(function (row) {
        if (row.cells.length <= 1) return;
        var nameEl  = row.querySelector('.act-name');
        var nameStr = nameEl ? nameEl.textContent.toLowerCase() : '';
        var rowType = (row.getAttribute('data-type') || '').toLowerCase();
        var rowRole = (row.getAttribute('data-role') || '').toLowerCase();
        var show = ((!term || nameStr.includes(term)) && (!type || rowType === type) && (!role || rowRole === role));
        row.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      showEmptyFilterRow(table, visibleCount, term || type || role);
    }
    if (input)   input.addEventListener('input', apply);
    if (sel)     sel.addEventListener('change', apply);
    if (roleSel) roleSel.addEventListener('change', apply);
  })();


  // ── Projects: search by name + location dropdown (card grid) ──
  (function () {
    var input = document.getElementById('subSearch');
    var sel   = document.getElementById('subLocationFilter');
    var grid  = document.getElementById('subdivisionsGrid');
    var noRes = document.getElementById('subNoResults');
    if (!grid) return;

    function apply() {
      var term = input ? input.value.trim().toLowerCase() : '';
      var loc  = sel   ? sel.value.toLowerCase() : '';
      var projectId = _selectedProjectIdForSubdivisions;
      var visibleCount = 0;
      grid.querySelectorAll('.sub-card-col').forEach(function (col) {
        var name   = (col.getAttribute('data-sub-name') || '').toLowerCase();
        var rowLoc = (col.getAttribute('data-location') || '').toLowerCase();
        var subCard = col.querySelector('.sub-card');
        var rowProjId = subCard ? (subCard.getAttribute('data-sub-project-id') || '') : '';
        var textMatch = !term || name.includes(term);
        var locMatch  = !loc  || rowLoc === loc;
        var projMatch = !projectId || rowProjId === projectId;
        var show = textMatch && locMatch && projMatch;
        col.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      if (noRes) noRes.classList.toggle('d-none', visibleCount > 0 || (!term && !loc && !projectId));
    }
    if (input) input.addEventListener('input', apply);
    if (sel)   sel.addEventListener('change', apply);
    window._applySubdivisionFilters = apply;
  })();

  // Helper function to set the location filter
  window._setLocationFilter = function(location) {
    var sel = document.getElementById('subLocationFilter');
    if (!sel) return;
    sel.value = location || '';
    // Trigger the change event to apply filtering
    var event = new Event('change', { bubbles: true });
    sel.dispatchEvent(event);
  };

  window._setPropertySubdivisionFilter = function(subdivisionName, subdivisionId) {
    var sel = document.getElementById('propSubdivisionFilter');
    if (!sel) return;

    var targetName = String(subdivisionName || '').trim();
    var targetId = String(subdivisionId || '').trim();

    if (targetId) {
      var optById = Array.prototype.find.call(sel.options, function(opt) {
        return String(opt.getAttribute('data-sub-id') || '') === targetId;
      });
      if (optById) {
        sel.value = optById.value;
        return;
      }
    }

    sel.value = targetName;
  };

  window._openModelsWithFilters = function(projectName, subdivisionName) {
    _selectedSubdivisionNameForModels = subdivisionName || '';
    if (typeof showPage === 'function') showPage('properties');
    _setPropertySubdivisionFilter(_selectedSubdivisionNameForModels);
    if (typeof _applyPropertyFilters === 'function') _applyPropertyFilters();
  };

  // Restore the last active page after a reload (e.g. after saving a project)
  try {
    // First, check if there's a page query parameter in the URL
    var urlParams = new URLSearchParams(window.location.search);
    var pageFromUrl = urlParams.get('page');
    var pageToShow = pageFromUrl || sessionStorage.getItem('activeDashPage');
    
    if (pageToShow && document.getElementById('page-' + pageToShow)) {
      showPage(pageToShow);
      // Remove the query parameter from the URL so it doesn't persist on reload
      if (pageFromUrl) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  } catch(e) {}

});

/* 
   Admin-specific JavaScript  moved from admin.html inline <script>
    */

/* ── Admin: user detail modal + account toggle ──────────────── */
var _udmUserId = null;

function openUserModal(userId) {
  _udmUserId = userId;
  var loadingEl = document.getElementById('cdm-loading');
  var contentEl = document.getElementById('cdm-body');
  if (!loadingEl || !contentEl) return;
  loadingEl.innerHTML = '<div class="spinner-border" style="color:var(--clr-primary);" role="status"></div>';
  loadingEl.classList.remove('d-none');
  contentEl.classList.add('d-none');
  contentEl.innerHTML = '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('clientDetailModal')).show();

  fetch('/admin/user/' + userId + '/profile')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      renderUserModal(data);
      loadingEl.classList.add('d-none');
      contentEl.classList.remove('d-none');
    })
    .catch(function() {
      loadingEl.innerHTML = '<p class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>Failed to load user data.</p>';
    });
}

function renderUserModal(d) {
  var avatarEl = document.getElementById('cdm-avatar');
  if (!avatarEl) return;
  if (d.avatar_url) {
    avatarEl.textContent = '';
    avatarEl.style.background = 'transparent';
    var img = document.createElement('img');
    img.src = d.avatar_url;
    img.alt = d.full_name;
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = d.initials || 'U';
    avatarEl.style.background = '';
  }
  document.getElementById('cdm-name').textContent   = d.full_name;

  if (d.role === 'client') {
    var statusCls = '';
    if (d.assessment) {
      statusCls = d.assessment.status === 'Qualified' ? 'badge-qualified'
        : d.assessment.status === 'Conditionally Qualified' ? 'badge-conditional'
        : 'badge-not-qualified';
    }
    document.getElementById('cdm-meta').innerHTML =
      '<span class="sqh-badge" style="background:rgba(255,255,255,.18);color:#fff;border:1.5px solid rgba(255,255,255,.3);">'
      + '<i class="fas fa-user me-1"></i>Client</span>'
      + (d.assessment ? '<span class="sqh-badge ' + statusCls + '">' + d.assessment.status + '</span>' : '');
  } else {
    var roleIcon = d.role === 'agent' ? 'fa-user-tie' : (d.role === 'admin' ? 'fa-user-shield' : 'fa-user');
    var roleLabel = String(d.role || 'user').replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    var acctBadgeClass = d.is_active ? 'badge-qualified' : 'badge-not-qualified';
    var acctBadgeLabel = d.is_active ? 'Active' : 'Suspended';
    document.getElementById('cdm-meta').innerHTML =
      '<span class="sqh-badge" style="background:rgba(255,255,255,.18);color:#fff;border:1.5px solid rgba(255,255,255,.3);">'
      + '<i class="fas ' + roleIcon + ' me-1"></i>' + roleLabel + '</span>'
      + '<span class="sqh-badge ' + acctBadgeClass + '">' + acctBadgeLabel + '</span>';
  }

  var html = '';

  if (d.role === 'client') {
    html += '<div class="form-section-title"><i class="fas fa-id-card me-2"></i>Identity</div>';
    html += '<div class="row g-3 mb-3">';
    html += _cdmField('First Name', d.first_name);
    html += _cdmField('Middle Name', d.middle_name || '—');
    html += _cdmField('Last Name', d.last_name);
    html += _cdmField('Username', d.username || '—');
    html += _cdmField('Email', d.email);
    html += _cdmField('Contact Number', d.contact_number);
    html += _cdmField('Joined', d.joined_at || d.joined);
    html += '</div>';

    if (d.profile) {
      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-user me-2"></i>Personal Information</div>';
      html += '<div class="row g-3 mb-3">';
      html += _cdmField('Civil Status', d.profile.civil_status);
      html += _cdmField('Citizenship', d.profile.citizenship);
      html += _cdmField('Gender', d.profile.gender);
      html += _cdmField('Dependents', d.profile.dependents);
      html += _cdmField('Birth Date', d.profile.birth_date);
      html += _cdmField('Birthplace', d.profile.birthplace);
      html += '</div>';

      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-map-marker-alt me-2"></i>Address Details</div>';
      html += '<div class="row g-3 mb-3">';
      html += _cdmField('Address Line', d.profile.address_line);
      html += _cdmField('Street', d.profile.street);
      html += _cdmField('Blk', d.profile.blk);
      html += _cdmField('Lot', d.profile.lot);
      html += _cdmField('Subdivision', d.profile.subdivision_name);
      html += _cdmField('Barangay', d.profile.home_barangay_name);
      html += _cdmField('City / Municipality', d.profile.home_citymun_name);
      html += _cdmField('Province', d.profile.home_province_name);
      html += _cdmField('Region', d.profile.home_region_name);
      html += _cdmField('Country', d.profile.country);
      html += _cdmField('Zip Code', d.profile.zip_code);
      html += '</div>';

      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-briefcase me-2"></i>Employment & Financial</div>';
      html += '<div class="row g-3 mb-3">';
      html += _cdmField('Employment Type', d.profile.employment_type);
      html += _cdmField('Employer Name', d.profile.employer_name);
      html += _cdmField('Employer Phone', d.profile.employer_phone);
      html += _cdmField('Employer Email', d.profile.employer_email);
      html += _cdmField('Business Address', d.profile.employer_business_address);
      html += _cdmField('Tenure (Months)', d.profile.tenure_months);
      html += _cdmField('SSS/GSIS/UMID', d.profile.sss_gsis_umid);
      html += _cdmField('TIN', d.profile.tin_no);
      html += _cdmField('Gross Income', d.profile.gross_income);
      html += _cdmField('Monthly Loans', d.profile.monthly_loans);
      html += _cdmField('Other Deductions', d.profile.other_deductions);
      html += _cdmField('Preferred Type', d.profile.preferred_type);
      html += _cdmField('Budget Min', d.profile.budget_min);
      html += _cdmField('Budget Max', d.profile.budget_max);
      html += '</div>';

      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-hashtag me-2"></i>Social Media</div>';
      html += '<div class="row g-3 mb-3">';
      html += _cdmField('Instagram', d.profile.social_instagram);
      html += _cdmField('Twitter / X', d.profile.social_twitter_x);
      html += _cdmField('Viber', d.profile.social_viber);
      html += _cdmField('WhatsApp', d.profile.social_whatsapp);
      html += '</div>';
    }

    if (d.documents) {
      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-folder-open me-2"></i>Documentation</div>';
      html += '<div class="table-responsive cdm-doc-table-wrap"><table class="table sqh-table mb-0 small"><thead><tr><th>Document</th><th>Filename</th><th>Status</th><th>Action</th></tr></thead><tbody>';
      html += _cdmDocRow(d.documents.valid_id || { label: 'Valid ID', has_file: false, filename: '—', view_url: null });
      html += _cdmDocRow(d.documents.income_proof || { label: 'Proof of Income', has_file: false, filename: '—', view_url: null });
      html += '</tbody></table></div>';
    }

    if (d.assessment) {
      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-brain me-2"></i>Latest Assessment</div>';
      html += '<div class="row g-3 mb-3">';
      html += _cdmField('Assessment Date', d.assessment.date);
      html += _cdmField('Status', d.assessment.status);
      html += _cdmField('DTI Ratio', d.assessment.dti);
      html += _cdmField('Max Loanable', d.assessment.max_loanable);
      html += _cdmField('Similarity', d.assessment.similarity);
      html += '</div>';
    }

    if (d.assessments && d.assessments.length) {
      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-history me-2"></i>Recent Assessments</div>';
      html += '<div class="table-responsive cdm-assess-table-wrap"><table class="table sqh-table mb-0 small"><thead><tr><th>Date</th><th>Assessment Type</th><th>Result</th><th>DTI</th><th>Max Loanable</th><th>Similarity</th></tr></thead><tbody>';
      d.assessments.forEach(function (row) {
        var resultCls = row.status === 'Qualified' ? 'badge-qualified'
          : row.status === 'Conditionally Qualified' ? 'badge-conditional'
          : 'badge-not-qualified';
        html += '<tr>'
          + '<td>' + _cdmValue(row.date) + '</td>'
          + '<td>' + _cdmAssessmentTypeBadge(row.assessment_mode) + '</td>'
          + '<td><span class="sqh-badge ' + resultCls + '">' + _cdmValue(row.status) + '</span></td>'
          + '<td>' + _cdmValue(row.dti) + '</td>'
          + '<td>' + _cdmValue(row.max_loanable) + '</td>'
          + '<td>' + _cdmValue(row.similarity) + '</td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
    }

    if (!d.assessment) {
      html += '<p class="text-muted small mt-3"><i class="fas fa-info-circle me-1"></i>No qualification assessment on record.</p>';
    }
  } else {
    html += '<div class="form-section-title"><i class="fas fa-id-card me-2"></i>Identity</div>';
    html += '<div class="row g-3 mb-3">';
    html += _cdmField('First Name', d.first_name);
    html += _cdmField('Middle Name', d.middle_name || '—');
    html += _cdmField('Last Name', d.last_name);
    html += _cdmField('Username', d.username || '—');
    html += _cdmField('Email', d.email || '—');
    html += _cdmField('Contact Number', d.contact_number || '—');
    html += _cdmField('Joined', d.joined || '—');
    html += '</div>';

    if (d.agent) {
      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-user-tie me-2"></i>Agent Information</div>';
      html += '<div class="row g-3 mb-3">';
      html += _cdmField('License No.', d.agent.license_no);
      html += _cdmField('Contact No.', d.agent.contact_no);
      html += _cdmField('Bio', d.agent.bio);
      html += '</div>';
    }

    if (d.sold_properties && d.sold_properties.length) {
      html += '<hr class="my-3">';
      html += '<div class="form-section-title"><i class="fas fa-handshake me-2"></i>Sold Properties</div>';
      html += '<div class="table-responsive cdm-assess-table-wrap"><table class="table sqh-table mb-0 small"><thead><tr><th>Property</th><th>Buyer</th><th>Sold At</th><th>Price</th></tr></thead><tbody>';
      d.sold_properties.forEach(function (row) {
        html += '<tr>'
          + '<td>' + _cdmValue(row.property) + '</td>'
          + '<td>' + _cdmValue(row.buyer) + '</td>'
          + '<td>' + _cdmValue(row.sold_at) + '</td>'
          + '<td>' + _cdmValue(row.price) + '</td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
    }
  }

  document.getElementById('cdm-body').innerHTML = html;
}

function _cdmField(label, value) {
  return '<div class="col-md-6">'
    + '<div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--clr-muted);margin-bottom:.25rem;">' + label + '</div>'
    + '<div class="fw-semibold">' + _cdmValue(value) + '</div>'
    + '</div>';
}

function _cdmValue(value) {
  var raw = (value !== undefined && value !== null) ? String(value) : '\u2014';
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _cdmAssessmentTypeBadge(mode) {
  if ((mode || '').toLowerCase() === 'new') {
    return '<span class="sqh-badge" style="background:rgba(40,167,69,.12);color:#1a7a35;">New</span>';
  }
  return '<span class="sqh-badge" style="background:rgba(26,38,153,.12);color:var(--clr-blue);">Re-Assess</span>';
}

function _cdmDocRow(doc) {
  var hasFile = !!(doc && doc.has_file);
  var statusBadge = hasFile
    ? '<span class="sqh-badge" style="background:rgba(40,167,69,.12);color:#1a7a35;">Uploaded</span>'
    : '<span class="sqh-badge" style="background:rgba(139,26,26,.08);color:var(--clr-primary);">Not Uploaded</span>';
  var actionHtml = hasFile && doc.view_url
    ? '<a href="' + doc.view_url + '" target="_blank" rel="noopener" class="btn btn-outline-blue btn-sm prof-doc-view-btn">View</a>'
    : '<button type="button" class="btn btn-outline-blue btn-sm prof-doc-view-btn" disabled>View</button>';
  return '<tr>'
    + '<td>' + _cdmValue(doc && doc.label ? doc.label : '\u2014') + '</td>'
    + '<td>' + _cdmValue(doc && doc.filename ? doc.filename : '\u2014') + '</td>'
    + '<td>' + statusBadge + '</td>'
    + '<td>' + actionHtml + '</td>'
    + '</tr>';
}

// Toggle from table rows
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.toggle-status-btn');
  if (!btn) return;
  var userId   = btn.dataset.userId;
  var userName = btn.dataset.userName || 'this user';
  var isActive = btn.dataset.active === 'true';
  openToggleModal(userId, isActive, userName, 'table');
});

// ── Row action dropdowns (mobile ⋮ menu) ───────────────────────
document.addEventListener('click', function(e) {
  var toggleBtn = e.target.closest('.sqh-row-actions-btn');
  if (toggleBtn) {
    e.stopPropagation();
    var menu = toggleBtn.nextElementSibling;
    var isOpen = menu.classList.contains('open');
    // Close all other open menus first
    document.querySelectorAll('.sqh-row-actions-menu.open').forEach(function(m) {
      m.classList.remove('open');
      m.previousElementSibling.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      menu.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    return;
  }
  // Close on outside click
  document.querySelectorAll('.sqh-row-actions-menu.open').forEach(function(m) {
    m.classList.remove('open');
    m.previousElementSibling.setAttribute('aria-expanded', 'false');
  });
});

/* ── Suspend/Activate Confirmation Modal helpers ─────────────── */
var _togglePending = { userId: null, source: null };

function openToggleModal(userId, isActive, userName, source) {
  _togglePending.userId = userId;
  _togglePending.source = source;

  var iconEl    = document.getElementById('toggleModalIcon');
  var titleEl   = document.getElementById('toggleModalTitle');
  var descEl    = document.getElementById('toggleModalDesc');
  var confirmEl = document.getElementById('toggleModalConfirmBtn');

  if (isActive) {
    iconEl.innerHTML  = '<i class="fas fa-ban"></i>';
    iconEl.style.color = 'var(--clr-danger)';
    titleEl.textContent = 'Suspend ' + (userName || 'this account') + '?';
    descEl.textContent  = 'This user will no longer be able to log in until reactivated.';
    confirmEl.className = 'btn btn-crimson px-4';
    confirmEl.innerHTML = 'Suspend';
  } else {
    iconEl.innerHTML  = '<i class="fas fa-check-circle"></i>';
    iconEl.style.color = 'var(--clr-accent-dk)';
    titleEl.textContent = 'Activate ' + (userName || 'this account') + '?';
    descEl.textContent  = 'This user will regain access and be able to log in.';
    confirmEl.className = 'btn btn-crimson px-4';
    confirmEl.innerHTML = '<i class="fas fa-check me-1"></i> Activate';
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('toggleAccountModal')).show();
}

_bind('toggleModalConfirmBtn', 'click', function() {
  var userId = _togglePending.userId;
  if (!userId) return;

  fetch('/admin/user/' + userId + '/toggle', { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      bootstrap.Modal.getInstance(document.getElementById('toggleAccountModal')).hide();
      // If triggered from user detail modal, also hide it and refresh badges
      if (_togglePending.source === 'modal') {
        var udm = bootstrap.Modal.getInstance(document.getElementById('clientDetailModal'));
        if (udm) udm.hide();
      }
      updateRowStatus(data.user_id, data.is_active);
    });
});

function updateRowStatus(userId, isActive) {
  document.querySelectorAll('.toggle-status-btn[data-user-id="' + userId + '"]').forEach(function(btn) {
    btn.dataset.active = isActive ? 'true' : 'false';
    if (isActive) {
      btn.className = 'btn btn-sm toggle-status-btn btn-outline-crimson';
      btn.title     = 'Suspend';
      btn.innerHTML = '<i class="fas fa-ban"></i>';
    } else {
      btn.className = 'btn btn-sm toggle-status-btn btn-outline-crimson';
      btn.title     = 'Activate';
      btn.innerHTML = '<i class="fas fa-check"></i>';
    }
    var statusCell = btn.closest('tr') && btn.closest('tr').querySelector('.user-status-badge');
    if (statusCell) {
      statusCell.innerHTML = isActive
        ? '<span class="sqh-badge badge-qualified">Active</span>'
        : '<span class="sqh-badge badge-not-qualified">Suspended</span>';
      statusCell.dataset.status = isActive ? 'active' : 'suspended';
    }
  });
}

/* ── Add Agent Modal ─────────────────────────────────────────── */
_bind('addAgentSubmitBtn', 'click', function() {
  var btn = this;
  var errEl = document.getElementById('addAgentError');
  errEl.classList.add('d-none');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creating…';

  var payload = {
    first_name:     document.getElementById('agentFirstName').value.trim(),
    last_name:      document.getElementById('agentLastName').value.trim(),
    email:          document.getElementById('agentEmail').value.trim(),
    contact_number: document.getElementById('agentContact').value.trim(),
    license_no:     document.getElementById('agentLicense').value.trim(),
    password:       document.getElementById('agentPassword').value
  };

  fetch('/admin/agent/create', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrfToken()},
    body: JSON.stringify(payload)
  })
  .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, data: d}; }); })
  .then(function(res) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus me-1"></i> Create Agent';
    if (!res.ok) {
      errEl.textContent = res.data.error || 'An error occurred.';
      errEl.classList.remove('d-none');
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById('addAgentModal')).hide();
    // Clear form
    ['agentFirstName','agentLastName','agentEmail','agentContact','agentLicense','agentPassword'].forEach(function(id) { document.getElementById(id).value = ''; });
    location.reload();
  })
  .catch(function() {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus me-1"></i> Create Agent';
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('d-none');
  });
});

/* ── Add Client Modal ────────────────────────────────────────── */
_bind('addClientSubmitBtn', 'click', function() {
  var btn = this;
  var errEl = document.getElementById('addClientError');
  errEl.classList.add('d-none');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creating…';

  var payload = {
    first_name:     document.getElementById('clientFirstName').value.trim(),
    last_name:      document.getElementById('clientLastName').value.trim(),
    email:          document.getElementById('clientEmail').value.trim(),
    contact_number: document.getElementById('clientContact').value.trim(),
    password:       document.getElementById('clientPassword').value
  };

  fetch('/admin/client/create', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrfToken()},
    body: JSON.stringify(payload)
  })
  .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, data: d}; }); })
  .then(function(res) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus me-1"></i> Create Client';
    if (!res.ok) {
      errEl.textContent = res.data.error || 'An error occurred.';
      errEl.classList.remove('d-none');
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById('addClientModal')).hide();
    ['clientFirstName','clientLastName','clientEmail','clientContact','clientPassword'].forEach(function(id) { document.getElementById(id).value = ''; });
    location.reload();
  })
  .catch(function() {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus me-1"></i> Create Client';
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('d-none');
  });
});

/* ── Project card DOM helpers ───────────────────────────────── */
function _escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _addSubLocationOption(loc) {
  if (!loc) return;
  var sel = document.getElementById('subLocationFilter');
  if (!sel) return;
  var exists = Array.prototype.some.call(sel.options, function(o) { return o.value === loc; });
  if (!exists) {
    var opt = document.createElement('option');
    opt.value = loc; opt.textContent = loc;
    sel.appendChild(opt);
  }
}
function _addSubProjectOption(projectId, projectName, locMeta) {
  if (!projectId || !projectName) return;
  locMeta = locMeta || {};
  ['subProject', 'editSubProject'].forEach(function (id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var pid = String(projectId);
    var exists = Array.prototype.some.call(sel.options, function (o) { return String(o.value) === pid; });
    if (!exists) {
      var opt = document.createElement('option');
      opt.value = pid;
      opt.textContent = String(projectName);
      opt.dataset.regionCode = locMeta.regionCode || '';
      opt.dataset.regionName = locMeta.regionName || '';
      opt.dataset.provinceCode = locMeta.provinceCode || '';
      opt.dataset.provinceName = locMeta.provinceName || '';
      opt.dataset.citymunCode = locMeta.citymunCode || '';
      opt.dataset.citymunName = locMeta.citymunName || '';
      opt.dataset.barangayCode = locMeta.barangayCode || '';
      opt.dataset.barangayName = locMeta.barangayName || '';
      opt.dataset.location = locMeta.location || '';
      sel.appendChild(opt);
    }
  });
}

var _pendingProjFiles = [];

_bind('projImagesWrap', 'click', function(e) {
  var btn = e.target.closest('.sub-img-tile-del');
  if (!btn) return;
  var tile = btn.closest('.sub-img-tile');
  var idx = tile ? tile.dataset.newIdx : null;
  if (idx !== null && idx !== undefined) {
    _pendingProjFiles[parseInt(idx, 10)] = null;
  }
  if (tile) tile.remove();
  var fnEl = document.getElementById('projImagesFilenames');
  if (fnEl) {
    var names = _pendingProjFiles.filter(Boolean).map(function (f) { return f.name; });
    fnEl.value = names.join(', ');
  }
});

_bind('projImages', 'change', function() {
  var files = this.files;
  if (!files || !files.length) return;
  var wrap = document.getElementById('projImagesWrap');
  if (!wrap) return;

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var arrIdx = _pendingProjFiles.length;
    _pendingProjFiles.push(f);
    var tile = document.createElement('div');
    tile.className = 'sub-img-tile';
    tile.dataset.newIdx = arrIdx;
    tile.innerHTML =
      '<img src="' + URL.createObjectURL(f) + '" class="sub-img-tile-img" alt="">' +
      '<button type="button" class="sub-img-tile-del" title="Remove"><i class="fas fa-times"></i></button>';
    wrap.appendChild(tile);
  }

  var fnEl = document.getElementById('projImagesFilenames');
  if (fnEl) {
    var names = _pendingProjFiles.filter(Boolean).map(function (f) { return f.name; });
    fnEl.value = names.join(', ');
  }
  this.value = '';
});
function _buildSubCard(subId, name, loc, desc, imageIds, propCount, locMeta, projectId, projectName) {
  locMeta = locMeta || {};
  var col = document.createElement('div');
  col.className = 'col-12 col-sm-6 col-xl-4 sub-card-col';
  col.dataset.subName  = name;
  col.dataset.location = loc || '';
  var propLabel = propCount + ' Propert' + (propCount !== 1 ? 'ies' : 'y');
  var imgCountHtml = imageIds.length > 1
    ? '<span class="prop-card-img-count"><i class="fas fa-images me-1"></i>' + imageIds.length + '</span>'
    : '';
  var imgHtml = imageIds.length
    ? '<img src="/admin/subdivision-image/' + encodeURIComponent(imageIds[0]) + '" alt="' + _escAttr(name) + '" class="sub-card-img">'
    : '<div class="sub-card-img-placeholder"><i class="fas fa-city"></i></div>';
  col.innerHTML =
    '<div class="sub-card"' +
      ' data-sub-id="' + subId + '"' +
      ' data-sub-name="' + _escAttr(name) + '"' +
      ' data-sub-project-id="' + _escAttr(projectId || '') + '"' +
      ' data-sub-project-name="' + _escAttr(projectName || '') + '"' +
      ' data-sub-location="' + _escAttr(loc || '') + '"' +
      ' data-sub-region-code="' + _escAttr(locMeta.regionCode || '') + '"' +
      ' data-sub-region-name="' + _escAttr(locMeta.regionName || '') + '"' +
      ' data-sub-province-code="' + _escAttr(locMeta.provinceCode || '') + '"' +
      ' data-sub-province-name="' + _escAttr(locMeta.provinceName || '') + '"' +
      ' data-sub-citymun-code="' + _escAttr(locMeta.citymunCode || '') + '"' +
      ' data-sub-citymun-name="' + _escAttr(locMeta.citymunName || '') + '"' +
      ' data-sub-barangay-code="' + _escAttr(locMeta.barangayCode || '') + '"' +
      ' data-sub-barangay-name="' + _escAttr(locMeta.barangayName || '') + '"' +
      ' data-sub-description="' + _escAttr(desc || '') + '"' +
      ' data-sub-images="' + _escAttr(JSON.stringify(imageIds)) + '"' +
      ' data-sub-props="' + propCount + '">' +
      '<div class="sub-card-img-wrap sub-card-preview-trigger" data-sub-id="' + subId + '" style="cursor:pointer;">' +
        imgHtml +
        imgCountHtml +
        '<div class="sub-card-actions">' +
          '<button type="button" class="sub-card-action-btn sub-edit-btn" data-sub-id="' + subId + '" title="Edit"><i class="fas fa-pencil-alt"></i></button>' +
          '<button type="button" class="sub-card-action-btn sub-card-action-delete sub-delete-btn" data-sub-id="' + subId + '" data-sub-name="' + _escAttr(name) + '" data-has-props="false" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="sub-card-body sub-card-preview-trigger" data-sub-id="' + subId + '" style="cursor:pointer;">' +
        '<div class="sub-card-name sub-name">' + _escHtml(name) + '</div>' +
        (projectName ? '<div class="sub-card-loc"><i class="fas fa-building me-1"></i>' + _escHtml(projectName) + '</div>' : '') +
        (loc ? '<div class="sub-card-loc"><i class="fas fa-map-marker-alt me-1"></i>' + _escHtml(loc) + '</div>' : '') +
        '<div class="sub-card-footer">' +
          '<span class="sub-card-badge">' + propLabel + '</span>' +
          '<a href="#" class="sub-card-manage" data-goto="properties" data-model-subdivision="' + _escAttr(name) + '" data-model-subdivision-id="' + _escAttr(subId) + '">Manage <i class="fas fa-arrow-right ms-1"></i></a>' +
        '</div>' +
      '</div>' +
    '</div>';
  return col;
}
function _ensureSubGrid() {
  var grid = document.getElementById('subdivisionsGrid');
  if (!grid) {
    var wrap = document.querySelector('#page-subdivisions .sqh-card');
    if (!wrap) return null;
    wrap.innerHTML =
      '<div class="row g-4" id="subdivisionsGrid"></div>' +
      '<div id="subNoResults" class="text-center py-5 d-none">' +
        '<i class="fas fa-search fa-2x mb-2 d-block" style="color:var(--clr-border);"></i>' +
        '<span class="fw-semibold d-block mb-1">No results found</span>' +
        '<span class="small text-muted">Try adjusting your search or filter criteria.</span>' +
      '</div>';
    grid = document.getElementById('subdivisionsGrid');
  }
  return grid;
}

var _pendingSubFiles = [];

_bind('subImagesWrap', 'click', function(e) {
  var btn = e.target.closest('.sub-img-tile-del');
  if (!btn) return;
  var tile = btn.closest('.sub-img-tile');
  var idx = tile ? tile.dataset.newIdx : null;
  if (idx !== null && idx !== undefined) {
    _pendingSubFiles[parseInt(idx, 10)] = null;
  }
  if (tile) tile.remove();
  var fnEl = document.getElementById('subImagesFilenames');
  if (fnEl) {
    var names = _pendingSubFiles.filter(Boolean).map(function (f) { return f.name; });
    fnEl.value = names.join(', ');
  }
});

_bind('subImages', 'change', function() {
  var files = this.files;
  if (!files || !files.length) return;
  var wrap = document.getElementById('subImagesWrap');
  if (!wrap) return;

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var arrIdx = _pendingSubFiles.length;
    _pendingSubFiles.push(f);
    var tile = document.createElement('div');
    tile.className = 'sub-img-tile';
    tile.dataset.newIdx = arrIdx;
    tile.innerHTML =
      '<img src="' + URL.createObjectURL(f) + '" class="sub-img-tile-img" alt="">' +
      '<button type="button" class="sub-img-tile-del" title="Remove"><i class="fas fa-times"></i></button>';
    wrap.appendChild(tile);
  }

  var fnEl = document.getElementById('subImagesFilenames');
  if (fnEl) {
    var names = _pendingSubFiles.filter(Boolean).map(function (f) { return f.name; });
    fnEl.value = names.join(', ');
  }
});

_bind('addSubdivisionModal', 'hidden.bs.modal', function() {
  _pendingSubFiles = [];
  var wrap = document.getElementById('subImagesWrap');
  if (wrap) wrap.innerHTML = '';
  var fnEl = document.getElementById('subImagesFilenames');
  if (fnEl) fnEl.value = '';
  var inputEl = document.getElementById('subImages');
  if (inputEl) inputEl.value = '';
  ['subSiteNotes','subLocation','subProjectLocationDisplay','subRegionCode','subRegionName','subProvinceCode','subProvinceName','subCitymunCode','subCitymunName','subBarangayCode','subBarangayName'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  ['subProject','subRegionSelect','subProvinceSelect','subCitymunSelect','subBarangaySelect'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  _syncSubdivisionLocationFromProject();
});

function _subResetSelect(sel, placeholder) {
  if (!sel) return;
  sel.innerHTML = '';
  var opt = document.createElement('option');
  opt.value = '';
  opt.textContent = placeholder;
  sel.appendChild(opt);
}

function _subFillSelect(sel, items, placeholder, selectedValue) {
  if (!sel) return;
  _subResetSelect(sel, placeholder);
  (items || []).forEach(function (it) {
    var opt = document.createElement('option');
    opt.value = it.code || '';
    opt.textContent = it.name || '';
    sel.appendChild(opt);
  });
  if (selectedValue) {
    sel.value = selectedValue;
    if (sel.value !== selectedValue) {
      var fallback = document.createElement('option');
      fallback.value = selectedValue;
      fallback.textContent = selectedValue;
      sel.appendChild(fallback);
      sel.value = selectedValue;
    }
  }
}

function _subGetItems(url) {
  return fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (res) {
      if (res.ok && res.data && res.data.ok) {
        return Array.isArray(res.data.items) ? res.data.items : [];
      }
      var apiBase = 'https://psgc.gitlab.io/api';
      var mReg = url.match(/\/api\/psgc\/provinces\?region_code=([^&]+)/);
      var mCity = url.match(/\/api\/psgc\/cities\?(?:province_code=([^&]+)|region_code=([^&]+))/);
      var mBrgy = url.match(/\/api\/psgc\/barangays\?city_mun_code=([^&]+)/);
      var directUrl = '';
      if (url.indexOf('/api/psgc/regions') === 0) directUrl = apiBase + '/regions/';
      else if (mReg) directUrl = apiBase + '/regions/' + decodeURIComponent(mReg[1]) + '/provinces/';
      else if (mCity && mCity[1]) directUrl = apiBase + '/provinces/' + decodeURIComponent(mCity[1]) + '/cities-municipalities/';
      else if (mCity && mCity[2]) directUrl = apiBase + '/regions/' + decodeURIComponent(mCity[2]) + '/cities-municipalities/';
      else if (mBrgy) directUrl = apiBase + '/cities-municipalities/' + decodeURIComponent(mBrgy[1]) + '/barangays/';
      if (!directUrl) throw new Error((res.data && res.data.error) || 'PSGC unavailable');
      return fetch(directUrl)
        .then(function (r2) {
          if (!r2.ok) throw new Error('PSGC unavailable');
          return r2.json();
        })
        .then(function (items2) {
          return Array.isArray(items2)
            ? items2.map(function (it) {
                return { code: String(it.code || ''), name: String(it.name || '') };
              }).filter(function (it) { return it.code && it.name; })
            : [];
        });
    });
}

function _syncSubdivisionLocation() {
  var regionSel = document.getElementById('subRegionSelect');
  var provinceSel = document.getElementById('subProvinceSelect');
  var citySel = document.getElementById('subCitymunSelect');
  var brgySel = document.getElementById('subBarangaySelect');
  function txt(sel) {
    if (!sel || !sel.value || !sel.selectedOptions || !sel.selectedOptions.length) return '';
    return (sel.selectedOptions[0].textContent || '').trim();
  }
  var regionName = txt(regionSel);
  var provinceName = txt(provinceSel);
  var cityName = txt(citySel);
  var brgyName = txt(brgySel);
  var line = ((document.getElementById('subSiteNotes') || {}).value || '').trim();
  var tail = [brgyName, cityName, provinceName, regionName].filter(Boolean).join(', ');
  var loc = [line, tail].filter(Boolean).join(', ');
  var setVal = function(id, val){ var el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('subLocation', loc);
  setVal('subRegionCode', regionSel ? regionSel.value : '');
  setVal('subRegionName', regionName);
  setVal('subProvinceCode', provinceSel ? provinceSel.value : '');
  setVal('subProvinceName', provinceName);
  setVal('subCitymunCode', citySel ? citySel.value : '');
  setVal('subCitymunName', cityName);
  setVal('subBarangayCode', brgySel ? brgySel.value : '');
  setVal('subBarangayName', brgyName);
}

function _syncSubdivisionLocationFromProject() {
  var projectSel = document.getElementById('subProject');
  var regionSel = document.getElementById('subRegionSelect');
  var provinceSel = document.getElementById('subProvinceSelect');
  var citySel = document.getElementById('subCitymunSelect');
  var brgySel = document.getElementById('subBarangaySelect');
  var display = document.getElementById('subProjectLocationDisplay');
  if (!projectSel || !regionSel || !provinceSel || !citySel || !brgySel) return;

  var opt = projectSel.selectedOptions && projectSel.selectedOptions.length ? projectSel.selectedOptions[0] : null;
  var regionCode = (opt && opt.dataset.regionCode) || '';
  var regionName = (opt && opt.dataset.regionName) || '';
  var provinceCode = (opt && opt.dataset.provinceCode) || '';
  var provinceName = (opt && opt.dataset.provinceName) || '';
  var citymunCode = (opt && opt.dataset.citymunCode) || '';
  var citymunName = (opt && opt.dataset.citymunName) || '';
  var barangayCode = (opt && opt.dataset.barangayCode) || '';
  var barangayName = (opt && opt.dataset.barangayName) || '';
  var location = (opt && opt.dataset.location) || '';

  _subFillSelect(regionSel, regionCode ? [{ code: regionCode, name: regionName || regionCode }] : [], '-- Select --', regionCode);
  _subFillSelect(provinceSel, provinceCode ? [{ code: provinceCode, name: provinceName || provinceCode }] : [], '-- Select --', provinceCode);
  _subFillSelect(citySel, citymunCode ? [{ code: citymunCode, name: citymunName || citymunCode }] : [], '-- Select --', citymunCode);
  _subFillSelect(brgySel, barangayCode ? [{ code: barangayCode, name: barangayName || barangayCode }] : [], '-- Select --', barangayCode);

  if (display) display.value = location;
  _syncSubdivisionLocation();
}
function initSubdivisionPsgc() {
  var projectSel = document.getElementById('subProject');
  if (!projectSel) return;
  projectSel.addEventListener('change', _syncSubdivisionLocationFromProject);
  _syncSubdivisionLocationFromProject();
}
initSubdivisionPsgc();

function _syncEditSubdivisionLocation() {
  var regionSel = document.getElementById('editSubRegionSelect');
  var provinceSel = document.getElementById('editSubProvinceSelect');
  var citySel = document.getElementById('editSubCitymunSelect');
  var brgySel = document.getElementById('editSubBarangaySelect');
  function txt(sel) {
    if (!sel || !sel.value || !sel.selectedOptions || !sel.selectedOptions.length) return '';
    return (sel.selectedOptions[0].textContent || '').trim();
  }
  var regionName = txt(regionSel);
  var provinceName = txt(provinceSel);
  var cityName = txt(citySel);
  var brgyName = txt(brgySel);
  var streetVal = ((document.getElementById('editSubStreet') || {}).value || '').trim();
  var blockVal = ((document.getElementById('editSubBlock') || {}).value || '').trim();
  var lotVal = ((document.getElementById('editSubLotNo') || {}).value || '').trim();
  var legacyLine = ((document.getElementById('editSubSiteNotes') || {}).value || '').trim();
  var line = [streetVal, blockVal, lotVal].filter(Boolean).join(', ') || legacyLine;
  var tail = [brgyName, cityName, provinceName, regionName].filter(Boolean).join(', ');
  var loc = [line, tail].filter(Boolean).join(', ');
  var setVal = function(id, val){ var el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('editSubLocation', loc);
  setVal('editSubRegionCode', regionSel ? regionSel.value : '');
  setVal('editSubRegionName', regionName);
  setVal('editSubProvinceCode', provinceSel ? provinceSel.value : '');
  setVal('editSubProvinceName', provinceName);
  setVal('editSubCitymunCode', citySel ? citySel.value : '');
  setVal('editSubCitymunName', cityName);
  setVal('editSubBarangayCode', brgySel ? brgySel.value : '');
  setVal('editSubBarangayName', brgyName);
}

function initEditSubdivisionPsgc() {
  var regionSel = document.getElementById('editSubRegionSelect');
  var provinceSel = document.getElementById('editSubProvinceSelect');
  var citySel = document.getElementById('editSubCitymunSelect');
  var brgySel = document.getElementById('editSubBarangaySelect');
  if (!regionSel || !provinceSel || !citySel || !brgySel) return;

  regionSel.addEventListener('change', function () {
    if (!regionSel.value) {
      _subResetSelect(provinceSel, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncEditSubdivisionLocation();
      return;
    }
    _subGetItems('/api/psgc/provinces?region_code=' + encodeURIComponent(regionSel.value)).then(function (items) {
      _subFillSelect(provinceSel, items, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncEditSubdivisionLocation();
    });
  });

  provinceSel.addEventListener('change', function () {
    var q = provinceSel.value
      ? ('province_code=' + encodeURIComponent(provinceSel.value))
      : ('region_code=' + encodeURIComponent(regionSel.value));
    _subGetItems('/api/psgc/cities?' + q).then(function (items) {
      _subFillSelect(citySel, items, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncEditSubdivisionLocation();
    });
  });

  citySel.addEventListener('change', function () {
    if (!citySel.value) {
      _subResetSelect(brgySel, '-- Select --');
      _syncEditSubdivisionLocation();
      return;
    }
    _subGetItems('/api/psgc/barangays?city_mun_code=' + encodeURIComponent(citySel.value)).then(function (items) {
      _subFillSelect(brgySel, items, '-- Select --');
      _syncEditSubdivisionLocation();
    });
  });

  brgySel.addEventListener('change', _syncEditSubdivisionLocation);
  _bind('editSubSiteNotes', 'input', _syncEditSubdivisionLocation);
  _bind('editSubStreet', 'input', _syncEditSubdivisionLocation);
  _bind('editSubBlock', 'input', _syncEditSubdivisionLocation);
  _bind('editSubLotNo', 'input', _syncEditSubdivisionLocation);
}
initEditSubdivisionPsgc();

function _preselectEditSubdivisionPsgc(codes) {
  var regionSel = document.getElementById('editSubRegionSelect');
  var provinceSel = document.getElementById('editSubProvinceSelect');
  var citySel = document.getElementById('editSubCitymunSelect');
  var brgySel = document.getElementById('editSubBarangaySelect');
  if (!regionSel || !provinceSel || !citySel || !brgySel) return;

  var regionCode = (codes && codes.regionCode) || '';
  var regionName = (codes && codes.regionName) || '';
  var provinceCode = (codes && codes.provinceCode) || '';
  var provinceName = (codes && codes.provinceName) || '';
  var citymunCode = (codes && codes.citymunCode) || '';
  var citymunName = (codes && codes.citymunName) || '';
  var barangayCode = (codes && codes.barangayCode) || '';
  var barangayName = (codes && codes.barangayName) || '';

  function seedSelect(sel, code, name) {
    if (!sel) return;
    _subResetSelect(sel, '-- Select --');
    if (!code || !name) return;
    var opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    sel.appendChild(opt);
    sel.value = code;
  }

  seedSelect(regionSel, regionCode, regionName);
  seedSelect(provinceSel, provinceCode, provinceName);
  seedSelect(citySel, citymunCode, citymunName);
  seedSelect(brgySel, barangayCode, barangayName);
  _syncEditSubdivisionLocation();

  return _subGetItems('/api/psgc/regions').then(function (regions) {
    _subFillSelect(regionSel, regions, '-- Select --', regionCode);
    if (!regionCode) {
      _subResetSelect(provinceSel, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncEditSubdivisionLocation();
      return Promise.resolve();
    }
    return _subGetItems('/api/psgc/provinces?region_code=' + encodeURIComponent(regionCode)).then(function (provinces) {
      _subFillSelect(provinceSel, provinces, '-- Select --', provinceCode);
      if (!provinceCode && !citymunCode) {
        _subResetSelect(citySel, '-- Select --');
        _subResetSelect(brgySel, '-- Select --');
        _syncEditSubdivisionLocation();
        return Promise.resolve();
      }
      var cityQ = provinceCode
        ? ('province_code=' + encodeURIComponent(provinceCode))
        : ('region_code=' + encodeURIComponent(regionCode));
      return _subGetItems('/api/psgc/cities?' + cityQ).then(function (cities) {
        _subFillSelect(citySel, cities, '-- Select --', citymunCode);
        if (!citymunCode) {
          _subResetSelect(brgySel, '-- Select --');
          _syncEditSubdivisionLocation();
          return Promise.resolve();
        }
        return _subGetItems('/api/psgc/barangays?city_mun_code=' + encodeURIComponent(citymunCode)).then(function (barangays) {
          _subFillSelect(brgySel, barangays, '-- Select --', barangayCode);
          _syncEditSubdivisionLocation();
        });
      });
    });
  }).catch(function () {
    _syncEditSubdivisionLocation();
  });
}

function _syncProjectLocation() {
  var regionSel = document.getElementById('projRegionSelect');
  var provinceSel = document.getElementById('projProvinceSelect');
  var citySel = document.getElementById('projCitymunSelect');
  var brgySel = document.getElementById('projBarangaySelect');
  function txt(sel) {
    if (!sel || !sel.value || !sel.selectedOptions || !sel.selectedOptions.length) return '';
    return (sel.selectedOptions[0].textContent || '').trim();
  }
  var regionName = txt(regionSel);
  var provinceName = txt(provinceSel);
  var cityName = txt(citySel);
  var brgyName = txt(brgySel);

  var loc = [brgyName, cityName, provinceName, regionName].filter(Boolean).join(', ');

  var setVal = function(id, val){ var el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('projLocation', loc);
  setVal('projRegionCode', regionSel ? regionSel.value : '');
  setVal('projRegionName', regionName);
  setVal('projProvinceCode', provinceSel ? provinceSel.value : '');
  setVal('projProvinceName', provinceName);
  setVal('projCitymunCode', citySel ? citySel.value : '');
  setVal('projCitymunName', cityName);
  setVal('projBarangayCode', brgySel ? brgySel.value : '');
  setVal('projBarangayName', brgyName);
}

function initProjectPsgc() {
  var regionSel = document.getElementById('projRegionSelect');
  var provinceSel = document.getElementById('projProvinceSelect');
  var citySel = document.getElementById('projCitymunSelect');
  var brgySel = document.getElementById('projBarangaySelect');
  if (!regionSel || !provinceSel || !citySel || !brgySel) return;

  regionSel.addEventListener('change', function () {
    if (!regionSel.value) {
      _subResetSelect(provinceSel, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncProjectLocation();
      return;
    }
    _subGetItems('/api/psgc/provinces?region_code=' + encodeURIComponent(regionSel.value)).then(function (items) {
      _subFillSelect(provinceSel, items, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncProjectLocation();
    });
  });

  provinceSel.addEventListener('change', function () {
    if (!provinceSel.value && !regionSel.value) return;
    var q = provinceSel.value
      ? ('province_code=' + encodeURIComponent(provinceSel.value))
      : ('region_code=' + encodeURIComponent(regionSel.value));
    _subGetItems('/api/psgc/cities?' + q).then(function (items) {
      _subFillSelect(citySel, items, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncProjectLocation();
    });
  });

  citySel.addEventListener('change', function () {
    if (!citySel.value) {
      _subResetSelect(brgySel, '-- Select --');
      _syncProjectLocation();
      return;
    }
    _subGetItems('/api/psgc/barangays?city_mun_code=' + encodeURIComponent(citySel.value)).then(function (items) {
      _subFillSelect(brgySel, items, '-- Select --');
      _syncProjectLocation();
    });
  });

  brgySel.addEventListener('change', _syncProjectLocation);
  _subGetItems('/api/psgc/regions')
    .then(function (items) { _subFillSelect(regionSel, items, '-- Select --'); _syncProjectLocation(); })
    .catch(function () {});
}
initProjectPsgc();

var _activeProjectEditId = null;

function _seedProjectLocationSelects(data) {
  var regionSel = document.getElementById('projRegionSelect');
  var provinceSel = document.getElementById('projProvinceSelect');
  var citySel = document.getElementById('projCitymunSelect');
  var brgySel = document.getElementById('projBarangaySelect');
  if (!regionSel || !provinceSel || !citySel || !brgySel) return;

  function seed(sel, code, name) {
    _subResetSelect(sel, '-- Select --');
    if (!code) return;
    var opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name || code;
    sel.appendChild(opt);
    sel.value = code;
  }

  seed(regionSel, data.region_code || '', data.region_name || '');
  seed(provinceSel, data.province_code || '', data.province_name || '');
  seed(citySel, data.citymun_code || '', data.citymun_name || '');
  seed(brgySel, data.barangay_code || '', data.barangay_name || '');
  _syncProjectLocation();
}

function _openProjectEditModal(projectId) {
  if (!projectId) return;
  fetch('/admin/project/' + encodeURIComponent(projectId) + '/detail', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(parseApiResponse)
    .then(function(res) {
      if (!res.ok || !res.data || !res.data.success) {
        throw new Error(getApiErrorMessage(res, 'Failed to load project details.'));
      }
      var data = res.data;
      _activeProjectEditId = String(projectId);
      var titleEl = document.getElementById('addProjectLabel');
      if (titleEl) titleEl.textContent = 'Edit Project';
      var submitBtn = document.getElementById('addProjectSubmitBtn');
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save me-1"></i> Save Changes';

      var nameEl = document.getElementById('projectName');
      var descEl = document.getElementById('projDescription');
      if (nameEl) nameEl.value = data.name || '';
      if (descEl) descEl.value = data.description || '';
      _seedProjectLocationSelects(data);

      var wrap = document.getElementById('projImagesWrap');
      if (wrap) {
        wrap.innerHTML = '';
        (data.image_ids || []).forEach(function(imgId) {
          var tile = document.createElement('div');
          tile.className = 'sub-img-tile';
          tile.innerHTML = '<img src="/admin/subdivision-image/' + encodeURIComponent(imgId) + '" class="sub-img-tile-img" alt="">';
          wrap.appendChild(tile);
        });
      }

      var namesEl = document.getElementById('projImagesFilenames');
      if (namesEl) namesEl.value = '';
      _pendingProjFiles = [];

      bootstrap.Modal.getOrCreateInstance(document.getElementById('addProjectModal')).show();
    })
    .catch(function(err) {
      showToast((err && err.message) || 'Failed to load project details.', 'danger');
    });
}

_bind('addProjectModal', 'hidden.bs.modal', function() {
  _pendingProjFiles = [];
  _activeProjectEditId = null;
  var titleEl = document.getElementById('addProjectLabel');
  if (titleEl) titleEl.textContent = 'Add New Project';
  var submitBtn = document.getElementById('addProjectSubmitBtn');
  if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus me-1"></i> Create Project';
  var projWrap = document.getElementById('projImagesWrap');
  if (projWrap) projWrap.innerHTML = '';
  var projNames = document.getElementById('projImagesFilenames');
  if (projNames) projNames.value = '';
  var projInput = document.getElementById('projImages');
  if (projInput) projInput.value = '';
  [
    'projectName', 'projDescription', 'projLocation',
    'projRegionCode', 'projRegionName', 'projProvinceCode', 'projProvinceName',
    'projCitymunCode', 'projCitymunName', 'projBarangayCode', 'projBarangayName'
  ].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['projRegionSelect','projProvinceSelect','projCitymunSelect','projBarangaySelect'].forEach(function(id){
    var el = document.getElementById(id);
    if (!el) return;
    if (id === 'projRegionSelect') {
      _subGetItems('/api/psgc/regions').then(function (items) { _subFillSelect(el, items, '-- Select --'); });
    } else {
      _subResetSelect(el, '-- Select --');
    }
  });
  var errEl = document.getElementById('addProjectError');
  if (errEl) errEl.classList.add('d-none');
});

/* ── Add Project Modal ───────────────────────────────────────── */
_bind('addProjectSubmitBtn', 'click', function() {
  var btn = this;
  var errEl = document.getElementById('addProjectError');
  if (errEl) errEl.classList.add('d-none');

  var name = (document.getElementById('projectName').value || '').trim();
  if (!name) {
    if (errEl) {
      errEl.textContent = 'Project name is required.';
      errEl.classList.remove('d-none');
    }
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creating…';

  var fd = new FormData();
  _syncProjectLocation();
  fd.append('name', name);
  fd.append('street', '');
  fd.append('block', '');
  fd.append('lot_no', '');
  fd.append('region_code', (document.getElementById('projRegionCode').value || '').trim());
  fd.append('region_name', (document.getElementById('projRegionName').value || '').trim());
  fd.append('province_code', (document.getElementById('projProvinceCode').value || '').trim());
  fd.append('province_name', (document.getElementById('projProvinceName').value || '').trim());
  fd.append('citymun_code', (document.getElementById('projCitymunCode').value || '').trim());
  fd.append('citymun_name', (document.getElementById('projCitymunName').value || '').trim());
  fd.append('barangay_code', (document.getElementById('projBarangayCode').value || '').trim());
  fd.append('barangay_name', (document.getElementById('projBarangayName').value || '').trim());
  fd.append('description', (document.getElementById('projDescription').value || '').trim());

  _pendingProjFiles.filter(Boolean).forEach(function(f) { fd.append('image_files', f); });
  fd.append('csrf_token', csrfToken());

  var endpoint = _activeProjectEditId
    ? ('/admin/project/' + encodeURIComponent(_activeProjectEditId) + '/edit')
    : '/admin/project/create';

  fetch(endpoint, { method: 'POST', body: fd })
    .then(parseApiResponse)
    .then(function(res) {
      btn.disabled = false;
      btn.innerHTML = _activeProjectEditId
        ? '<i class="fas fa-save me-1"></i> Save Changes'
        : '<i class="fas fa-plus me-1"></i> Create Project';
      if (!res.ok || !res.data || !res.data.success) {
        if (errEl) {
          errEl.textContent = getApiErrorMessage(res, 'Failed to create project.');
          errEl.classList.remove('d-none');
        }
        return;
      }
      if (_activeProjectEditId) {
        bootstrap.Modal.getInstance(document.getElementById('addProjectModal')).hide();
        showToast('Project updated successfully.', 'success');
        location.reload();
        return;
      }
      _addSubProjectOption(res.data.id, res.data.name, {
        location: res.data.location || '',
        regionCode: res.data.region_code || '',
        regionName: res.data.region_name || '',
        provinceCode: res.data.province_code || '',
        provinceName: res.data.province_name || '',
        citymunCode: res.data.citymun_code || '',
        citymunName: res.data.citymun_name || '',
        barangayCode: res.data.barangay_code || '',
        barangayName: res.data.barangay_name || ''
      });
      bootstrap.Modal.getInstance(document.getElementById('addProjectModal')).hide();
      showToast('Project created successfully.', 'success');
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = _activeProjectEditId
        ? '<i class="fas fa-save me-1"></i> Save Changes'
        : '<i class="fas fa-plus me-1"></i> Create Project';
      if (errEl) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.classList.remove('d-none');
      }
    });
});

/* ── Add Subdivision Modal ───────────────────────────────────── */
_bind('addSubSubmitBtn', 'click', function() {
  var btn = this;
  var errEl = document.getElementById('addSubError');
  errEl.classList.add('d-none');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creating…';

  var newSubName = document.getElementById('subName').value.trim();
  var newSubProjectId = (document.getElementById('subProject').value || '').trim();
  var subProjectSel = document.getElementById('subProject');
  var newSubProjectName = (subProjectSel && subProjectSel.selectedOptions && subProjectSel.selectedOptions.length)
    ? (subProjectSel.selectedOptions[0].textContent || '').trim()
    : '';
  var newSubDesc = document.getElementById('subDescription').value.trim();
  _syncSubdivisionLocation();
  var newSubLoc  = document.getElementById('subLocation').value.trim();
  var newSubMeta = {
    regionCode: document.getElementById('subRegionCode').value.trim(),
    regionName: document.getElementById('subRegionName').value.trim(),
    provinceCode: document.getElementById('subProvinceCode').value.trim(),
    provinceName: document.getElementById('subProvinceName').value.trim(),
    citymunCode: document.getElementById('subCitymunCode').value.trim(),
    citymunName: document.getElementById('subCitymunName').value.trim(),
    barangayCode: document.getElementById('subBarangayCode').value.trim(),
    barangayName: document.getElementById('subBarangayName').value.trim()
  };
  var fd = new FormData();
  fd.append('project_id',  newSubProjectId);
  fd.append('name',        newSubName);
  fd.append('location',    newSubLoc);
  fd.append('region_code', document.getElementById('subRegionCode').value.trim());
  fd.append('region_name', document.getElementById('subRegionName').value.trim());
  fd.append('province_code', document.getElementById('subProvinceCode').value.trim());
  fd.append('province_name', document.getElementById('subProvinceName').value.trim());
  fd.append('citymun_code', document.getElementById('subCitymunCode').value.trim());
  fd.append('citymun_name', document.getElementById('subCitymunName').value.trim());
  fd.append('barangay_code', document.getElementById('subBarangayCode').value.trim());
  fd.append('barangay_name', document.getElementById('subBarangayName').value.trim());
  fd.append('description', newSubDesc);
  _pendingSubFiles.filter(Boolean).forEach(function (f) { fd.append('image_files', f); });
  fd.append('csrf_token', csrfToken());

  fetch('/admin/subdivision/create', { method: 'POST', body: fd })
  .then(parseApiResponse)
  .then(function(res) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus me-1"></i> Create Subdivision';
    if (!res.ok) {
      errEl.textContent = getApiErrorMessage(res, 'An error occurred.');
      errEl.classList.remove('d-none');
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById('addSubdivisionModal')).hide();
    ['subName','subSiteNotes','subLocation','subDescription','subRegionCode','subRegionName','subProvinceCode','subProvinceName','subCitymunCode','subCitymunName','subBarangayCode','subBarangayName'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    ['subProject','subRegionSelect','subProvinceSelect','subCitymunSelect','subBarangaySelect'].forEach(function(id) { var el = document.getElementById(id); if (el) el.selectedIndex = 0; });
    var wrapEl = document.getElementById('subImagesWrap');
    if (wrapEl) wrapEl.innerHTML = '';
    var fnEl = document.getElementById('subImagesFilenames');
    if (fnEl) fnEl.value = '';
    document.getElementById('subImages').value = '';
    _pendingSubFiles = [];
    // Insert new card into grid without reloading
    var grid = _ensureSubGrid();
    if (grid) {
      var col = _buildSubCard(res.data.id, newSubName, newSubLoc, newSubDesc, res.data.image_ids || [], 0, newSubMeta, newSubProjectId, newSubProjectName);
      grid.appendChild(col);
      _addSubLocationOption(newSubLoc);
    }
    showToast('Subdivision created successfully.', 'success');
  })
  .catch(function() {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus me-1"></i> Create Subdivision';
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('d-none');
  });
});

/* ── Delete Project ──────────────────────────────────────────── */
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.sub-delete-btn');
  if (!btn) return;
  var isProject = !!(btn.dataset.projectId);
  var targetId = isProject ? btn.dataset.projectId : btn.dataset.subId;
  var targetName = isProject ? btn.dataset.projectName : btn.dataset.subName;
  var hasChildren = isProject
    ? (btn.dataset.hasSubs === 'true')
    : (btn.dataset.hasProps === 'true');

  if (!targetId) return;

  if (hasChildren) {
    if (isProject) {
      alert('Cannot delete "' + targetName + '" — it still has subdivisions assigned.');
    } else {
      alert('Cannot delete "' + targetName + '" — it still has properties assigned.');
    }
    return;
  }

  var iconEl    = document.getElementById('toggleModalIcon');
  var titleEl   = document.getElementById('toggleModalTitle');
  var descEl    = document.getElementById('toggleModalDesc');
  var confirmEl = document.getElementById('toggleModalConfirmBtn');
  iconEl.innerHTML = '<i class="fas fa-trash"></i>';
  iconEl.style.color = 'var(--clr-danger)';
  titleEl.textContent = 'Delete "' + targetName + '"?';
  descEl.textContent  = isProject
    ? 'This project will be permanently removed.'
    : 'This subdivision will be permanently removed.';
  confirmEl.className = 'btn btn-crimson px-4';
  confirmEl.innerHTML = '<i class="fas fa-trash me-1"></i> Delete';
  _togglePending.userId = null;
  _togglePending.source = isProject ? 'project' : 'subdivision';
  _togglePending._deleteId = targetId;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('toggleAccountModal')).show();
});

_bind('toggleModalConfirmBtn', 'click', function() {
  var source = _togglePending.source;
  if (source !== 'subdivision' && source !== 'project') return;

  var isProject = source === 'project';
  var deleteId = _togglePending._deleteId;
  if (!deleteId) return;

  var endpoint = isProject
    ? ('/admin/project/' + encodeURIComponent(deleteId) + '/delete')
    : ('/admin/subdivision/' + encodeURIComponent(deleteId) + '/delete');

  fetch(endpoint, { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      bootstrap.Modal.getInstance(document.getElementById('toggleAccountModal')).hide();
      if (data.success) {
        var cardSelector = isProject
          ? ('.sub-card[data-project-id="' + deleteId + '"]')
          : ('.sub-card[data-sub-id="' + deleteId + '"]');
        var card = document.querySelector(cardSelector);
        if (card) {
          var colEl = card.closest('.sub-card-col');
          if (colEl) colEl.remove();
        }

        var grid = isProject
          ? document.getElementById('projectsGrid')
          : document.getElementById('subdivisionsGrid');
        if (grid && grid.querySelectorAll('.sub-card-col').length === 0) {
          var wrap = isProject
            ? document.querySelector('#page-projects .sqh-card')
            : document.querySelector('#page-subdivisions .sqh-card');
          grid.remove();
          var noRes = document.getElementById(isProject ? 'projNoResults' : 'subNoResults');
          if (noRes) noRes.remove();
          var emptyDiv = document.createElement('div');
          emptyDiv.className = 'text-center py-5 text-muted';
          emptyDiv.innerHTML = isProject
            ? '<i class="fas fa-building fa-2x mb-2 d-block" style="color:var(--clr-border);"></i>No projects yet.'
            : '<i class="fas fa-city fa-2x mb-2 d-block" style="color:var(--clr-border);"></i>No subdivisions yet.';
          if (wrap) wrap.appendChild(emptyDiv);
        }

        showToast(isProject ? 'Project deleted successfully.' : 'Subdivision deleted successfully.', 'success');
      } else {
        showToast(data.error || (isProject ? 'Failed to delete project.' : 'Failed to delete subdivision.'), 'danger');
      }
    })
    .catch(function() {
      bootstrap.Modal.getInstance(document.getElementById('toggleAccountModal')).hide();
      showToast('Network error. Please try again.', 'danger');
    });
});

/* ── Edit Project ────────────────────────────────────────────── */
var _editSubId = null;
var _editDeleteQueue = []; // image IDs staged for deletion on Save
var _pendingEditSubFiles = [];

function openSubdivisionEditor(card) {
  if (!card) return;
  _editSubId = card.dataset.subId;
  _editDeleteQueue = [];
  _pendingEditSubFiles = [];

  function populateSubdivisionEditForm(data) {
    document.getElementById('editSubName').value = data.name || '';
    var editProjectSel = document.getElementById('editSubProject');
    if (editProjectSel) {
      var pid = String(data.project_id || '');
      if (pid) {
        var exists = Array.prototype.some.call(editProjectSel.options, function (o) { return String(o.value) === pid; });
        if (!exists) {
          var opt = document.createElement('option');
          opt.value = pid;
          opt.textContent = String(data.project_name || ('Project #' + pid));
          editProjectSel.appendChild(opt);
        }
      }
      editProjectSel.value = pid;
    }
    var fullLoc = (data.location || '').trim();
    var tailParts = [data.barangay_name, data.citymun_name, data.province_name, data.region_name]
      .filter(function (x) { return (x || '').trim(); })
      .map(function (x) { return (x || '').trim(); });
    var tail = tailParts.join(', ');
    var lineOnly = fullLoc;
    if (tail) {
      var fullLc = fullLoc.toLowerCase();
      var tailLc = tail.toLowerCase();
      if (fullLc === tailLc) {
        lineOnly = '';
      } else {
        var suff = ', ' + tail;
        if (fullLc.endsWith(suff.toLowerCase())) {
          lineOnly = fullLoc.slice(0, fullLoc.length - suff.length).trim();
        }
      }
    }
    var setVal = function(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val || '';
    };
    setVal('editSubStreet', data.street || '');
    setVal('editSubBlock', data.block || '');
    setVal('editSubLotNo', data.lot_no || '');
    setVal('editSubSiteNotes', lineOnly);
    setVal('editSubLocation', fullLoc);
    setVal('editSubDescription', data.description || '');
    setVal('editSubRegionCode', data.region_code || '');
    setVal('editSubRegionName', data.region_name || '');
    setVal('editSubProvinceCode', data.province_code || '');
    setVal('editSubProvinceName', data.province_name || '');
    setVal('editSubCitymunCode', data.citymun_code || '');
    setVal('editSubCitymunName', data.citymun_name || '');
    setVal('editSubBarangayCode', data.barangay_code || '');
    setVal('editSubBarangayName', data.barangay_name || '');
    var imageIds = data.image_ids || [];
    var wrap = document.getElementById('editSubImagesWrap');
    wrap.innerHTML = '';
    imageIds.forEach(function(imgId) {
      var tile = document.createElement('div');
      tile.className = 'sub-img-tile';
      tile.dataset.imgId = imgId;
      tile.innerHTML =
        '<img src="/admin/subdivision-image/' + encodeURIComponent(imgId) + '" class="sub-img-tile-img" alt="">' +
        '<button type="button" class="sub-img-tile-del" data-img-id="' + imgId + '" title="Remove">' +
          '<i class="fas fa-times"></i>' +
        '</button>';
      wrap.appendChild(tile);
    });
    ['editSubRegionSelect','editSubProvinceSelect','editSubCitymunSelect','editSubBarangaySelect'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.selectedIndex = 0;
    });
    _preselectEditSubdivisionPsgc({
      regionCode: data.region_code || '',
      regionName: data.region_name || '',
      provinceCode: data.province_code || '',
      provinceName: data.province_name || '',
      citymunCode: data.citymun_code || '',
      citymunName: data.citymun_name || '',
      barangayCode: data.barangay_code || '',
      barangayName: data.barangay_name || ''
    });
  }

  ['editSubRegionSelect','editSubProvinceSelect','editSubCitymunSelect','editSubBarangaySelect'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  document.getElementById('editSubImages').value = '';
  var editFnEl = document.getElementById('editSubImagesFilenames');
  if (editFnEl) editFnEl.value = '';
  document.getElementById('editSubError').classList.add('d-none');

  fetch('/admin/subdivision/' + encodeURIComponent(_editSubId) + '/detail', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      if (!res.ok || !res.data || !res.data.success) throw new Error((res.data && res.data.error) || 'Failed to load project details.');
      populateSubdivisionEditForm(res.data);
      bootstrap.Modal.getOrCreateInstance(document.getElementById('editSubdivisionModal')).show();
    })
    .catch(function() {
      populateSubdivisionEditForm({
        name: card.dataset.subName || '',
        project_id: card.dataset.subProjectId || '',
        street: card.dataset.subStreet || '',
        block: card.dataset.subBlock || '',
        lot_no: card.dataset.subLotNo || '',
        location: card.dataset.subLocation || '',
        region_code: card.dataset.subRegionCode || '',
        region_name: card.dataset.subRegionName || '',
        province_code: card.dataset.subProvinceCode || '',
        province_name: card.dataset.subProvinceName || '',
        citymun_code: card.dataset.subCitymunCode || '',
        citymun_name: card.dataset.subCitymunName || '',
        barangay_code: card.dataset.subBarangayCode || '',
        barangay_name: card.dataset.subBarangayName || '',
        description: card.dataset.subDescription || '',
        image_ids: JSON.parse(card.dataset.subImages || '[]')
      });
      bootstrap.Modal.getOrCreateInstance(document.getElementById('editSubdivisionModal')).show();
      showToast('Loaded project details from card cache.', 'warning');
    });
}

document.addEventListener('click', function(e) {
  var btn = e.target.closest('.sub-edit-btn');
  if (!btn) return;
  var card = btn.closest('.sub-card');
  openSubdivisionEditor(card);
});

// X button: stage for deletion (no network call yet)
_bind('editSubImagesWrap', 'click', function(e) {
  var btn = e.target.closest('.sub-img-tile-del');
  if (!btn) return;
  var tile = btn.closest('.sub-img-tile');
  var newIdx = tile ? tile.dataset.newIdx : null;
  if (newIdx !== null && newIdx !== undefined) {
    _pendingEditSubFiles[parseInt(newIdx, 10)] = null;
    var fnEl = document.getElementById('editSubImagesFilenames');
    if (fnEl) {
      var names = _pendingEditSubFiles.filter(Boolean).map(function(f) { return f.name; });
      fnEl.value = names.join(', ');
    }
  } else {
    var imgId = String(btn.dataset.imgId);
    _editDeleteQueue.push(imgId);
  }
  btn.closest('.sub-img-tile').remove();
});

_bind('editSubImages', 'change', function() {
  var files = this.files;
  if (!files || !files.length) return;
  var wrap = document.getElementById('editSubImagesWrap');
  if (!wrap) return;

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var arrIdx = _pendingEditSubFiles.length;
    _pendingEditSubFiles.push(f);
    var tile = document.createElement('div');
    tile.className = 'sub-img-tile';
    tile.dataset.newIdx = arrIdx;
    tile.innerHTML =
      '<img src="' + URL.createObjectURL(f) + '" class="sub-img-tile-img" alt="">' +
      '<button type="button" class="sub-img-tile-del" title="Remove"><i class="fas fa-times"></i></button>';
    wrap.appendChild(tile);
  }

  var fnEl = document.getElementById('editSubImagesFilenames');
  if (fnEl) {
    var names = _pendingEditSubFiles.filter(Boolean).map(function(f) { return f.name; });
    fnEl.value = names.join(', ');
  }
});

// Cancel / close: discard the queue so nothing gets deleted
_bind('editSubdivisionModal', 'hidden.bs.modal', function() {
  _editDeleteQueue = [];
  _pendingEditSubFiles = [];
  ['editSubSiteNotes','editSubStreet','editSubBlock','editSubLotNo','editSubLocation','editSubRegionCode','editSubRegionName','editSubProvinceCode','editSubProvinceName','editSubCitymunCode','editSubCitymunName','editSubBarangayCode','editSubBarangayName'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  ['editSubRegionSelect','editSubProvinceSelect','editSubCitymunSelect','editSubBarangaySelect'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  var inputEl = document.getElementById('editSubImages');
  if (inputEl) inputEl.value = '';
  var fnEl = document.getElementById('editSubImagesFilenames');
  if (fnEl) fnEl.value = '';
});

_bind('editSubSubmitBtn', 'click', function() {
  var btn = this;
  if (!_editSubId) return;
  var errEl = document.getElementById('editSubError');
  errEl.classList.add('d-none');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

  // Capture form values before the async chain
  var _savedName = document.getElementById('editSubName').value.trim();
  _syncEditSubdivisionLocation();
  var _savedLoc  = document.getElementById('editSubLocation').value.trim();
  var _savedDesc = document.getElementById('editSubDescription').value.trim();

  // Step 1: delete staged images, then Step 2: save edits + new files
  var deletePromises = _editDeleteQueue.map(function(imgId) {
    return fetch('/admin/subdivision-image/' + encodeURIComponent(imgId) + '/delete', { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } });
  });

  Promise.all(deletePromises).then(function() {
    var fd = new FormData();
    fd.append('project_id',  (document.getElementById('editSubProject').value || '').trim());
    fd.append('name',        _savedName);
    fd.append('location',    _savedLoc);
    fd.append('street',      (document.getElementById('editSubStreet').value || '').trim());
    fd.append('block',       (document.getElementById('editSubBlock').value || '').trim());
    fd.append('lot_no',      (document.getElementById('editSubLotNo').value || '').trim());
    fd.append('region_code', document.getElementById('editSubRegionCode').value.trim());
    fd.append('region_name', document.getElementById('editSubRegionName').value.trim());
    fd.append('province_code', document.getElementById('editSubProvinceCode').value.trim());
    fd.append('province_name', document.getElementById('editSubProvinceName').value.trim());
    fd.append('citymun_code', document.getElementById('editSubCitymunCode').value.trim());
    fd.append('citymun_name', document.getElementById('editSubCitymunName').value.trim());
    fd.append('barangay_code', document.getElementById('editSubBarangayCode').value.trim());
    fd.append('barangay_name', document.getElementById('editSubBarangayName').value.trim());
    fd.append('description', _savedDesc);
    _pendingEditSubFiles.filter(Boolean).forEach(function(f) { fd.append('image_files', f); });
    fd.append('csrf_token', csrfToken());

    return fetch('/admin/subdivision/' + _editSubId + '/edit', { method: 'POST', body: fd });
  })
  .then(parseApiResponse)
  .then(function(res) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-1"></i> Save Changes';
    if (!res.ok) {
      errEl.textContent = getApiErrorMessage(res, 'An error occurred.');
      errEl.classList.remove('d-none');
      return;
    }
    _editDeleteQueue = [];
    bootstrap.Modal.getInstance(document.getElementById('editSubdivisionModal')).hide();
    // Update the card in-place without reloading
    var card = document.querySelector('.sub-card[data-sub-id="' + _editSubId + '"]');
    if (card) {
      var imageIds = res.data.image_ids || [];
      var projectSel = document.getElementById('editSubProject');
      var projectName = (projectSel && projectSel.selectedOptions && projectSel.selectedOptions.length)
        ? (projectSel.selectedOptions[0].textContent || '').trim()
        : '';
      // Update data attributes
      card.dataset.subName        = _savedName;
      card.dataset.subProjectId   = (document.getElementById('editSubProject').value || '').trim();
      card.dataset.subProjectName = projectName;
      card.dataset.subLocation    = _savedLoc;
      card.dataset.subRegionCode  = document.getElementById('editSubRegionCode').value.trim();
      card.dataset.subRegionName  = document.getElementById('editSubRegionName').value.trim();
      card.dataset.subProvinceCode = document.getElementById('editSubProvinceCode').value.trim();
      card.dataset.subProvinceName = document.getElementById('editSubProvinceName').value.trim();
      card.dataset.subCitymunCode = document.getElementById('editSubCitymunCode').value.trim();
      card.dataset.subCitymunName = document.getElementById('editSubCitymunName').value.trim();
      card.dataset.subBarangayCode = document.getElementById('editSubBarangayCode').value.trim();
      card.dataset.subBarangayName = document.getElementById('editSubBarangayName').value.trim();
      card.dataset.subDescription = _savedDesc;
      card.dataset.subImages      = JSON.stringify(imageIds);
      // Update col filter attributes
      var colEl = card.closest('.sub-card-col');
      if (colEl) { colEl.dataset.subName = _savedName; colEl.dataset.location = _savedLoc; }
      // Update visible name
      var nameEl = card.querySelector('.sub-card-name');
      if (nameEl) nameEl.textContent = _savedName;
      // Update location line
      var locEl = card.querySelector('.sub-card-loc .fa-map-marker-alt') ? card.querySelector('.sub-card-loc .fa-map-marker-alt').parentElement : null;
      var projectEl = card.querySelector('.sub-card-loc .fa-building') ? card.querySelector('.sub-card-loc .fa-building').parentElement : null;
      if (projectName) {
        if (projectEl) {
          projectEl.innerHTML = '<i class="fas fa-building me-1"></i>' + _escHtml(projectName);
        } else {
          var addProjectEl = document.createElement('div');
          addProjectEl.className = 'sub-card-loc';
          addProjectEl.innerHTML = '<i class="fas fa-building me-1"></i>' + _escHtml(projectName);
          var bodyForProject = card.querySelector('.sub-card-body');
          var ftForProject = card.querySelector('.sub-card-footer');
          if (bodyForProject && ftForProject) bodyForProject.insertBefore(addProjectEl, ftForProject);
        }
      }
      if (_savedLoc) {
        if (locEl) {
          locEl.innerHTML = '<i class="fas fa-map-marker-alt me-1"></i>' + _escHtml(_savedLoc);
        } else {
          var newLocEl = document.createElement('div');
          newLocEl.className = 'sub-card-loc';
          newLocEl.innerHTML = '<i class="fas fa-map-marker-alt me-1"></i>' + _escHtml(_savedLoc);
          var bodyEl = card.querySelector('.sub-card-body');
          var ftEl = card.querySelector('.sub-card-footer');
          if (bodyEl && ftEl) bodyEl.insertBefore(newLocEl, ftEl);
        }
      } else if (locEl) {
        locEl.remove();
      }
      // Update card image
      var imgWrap = card.querySelector('.sub-card-img-wrap');
      if (imgWrap) {
        if (imageIds.length) {
          var existImg = imgWrap.querySelector('.sub-card-img');
          if (existImg) {
            existImg.src = '/admin/subdivision-image/' + encodeURIComponent(imageIds[0]);
          } else {
            var ph = imgWrap.querySelector('.sub-card-img-placeholder');
            if (ph) ph.remove();
            var newImg = document.createElement('img');
            newImg.src = '/admin/subdivision-image/' + encodeURIComponent(imageIds[0]);
            newImg.alt = _savedName;
            newImg.className = 'sub-card-img';
            imgWrap.insertBefore(newImg, imgWrap.firstChild);
          }
        } else {
          var existImg2 = imgWrap.querySelector('.sub-card-img');
          if (existImg2) {
            existImg2.remove();
            var newPh = document.createElement('div');
            newPh.className = 'sub-card-img-placeholder';
            newPh.innerHTML = '<i class="fas fa-city"></i>';
            imgWrap.insertBefore(newPh, imgWrap.firstChild);
          }
        }
      }
      // Update delete button data-sub-name
      var delBtn = card.querySelector('.sub-delete-btn');
      if (delBtn) delBtn.dataset.subName = _savedName;
      // Add location to filter dropdown if new
      _addSubLocationOption(_savedLoc);
    }
  })
  .catch(function() {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-1"></i> Save Changes';
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('d-none');
  });
});

/* ── Project Preview Modal ───────────────────────────────────── */
var _previewImages = [];
var _previewIdx    = 0;
var _previewSubId  = null;
var _previewSubCard = null;

function _openSubdivisionEditorFromPreview(subId) {
  var card = _previewSubCard || document.querySelector('.sub-card[data-sub-id="' + subId + '"]');
  if (!card) return;
  var previewModalEl = document.getElementById('subPreviewModal');
  if (previewModalEl && previewModalEl.classList.contains('show')) {
    previewModalEl.addEventListener('hidden.bs.modal', function onHidden() {
      openSubdivisionEditor(card);
    }, { once: true });
    bootstrap.Modal.getOrCreateInstance(previewModalEl).hide();
    return;
  }
  openSubdivisionEditor(card);
}

function _showPreviewSlide(idx) {
  _previewIdx = idx;
  var imgEl       = document.getElementById('subPreviewImg');
  var imgWrap     = document.getElementById('subPreviewImgWrap');
  var placeholder = document.getElementById('subPreviewPlaceholder');
  var prevBtn     = document.getElementById('subPreviewPrev');
  var nextBtn     = document.getElementById('subPreviewNext');

  if (_previewImages.length === 0) {
    imgWrap.style.display = 'none';
    placeholder.style.setProperty('display', 'flex', 'important');
  } else {
    imgWrap.style.display = 'block';
    placeholder.style.setProperty('display', 'none', 'important');
    // Fade out → swap src → fade in
    imgEl.style.opacity = '0';
    var newSrc = '/admin/subdivision-image/' + encodeURIComponent(_previewImages[idx]);
    imgEl.onload = function() { imgEl.style.opacity = '1'; };
    imgEl.src = newSrc;
    // If browser serves from cache, onload may already have fired
    if (imgEl.complete) imgEl.style.opacity = '1';
  }
  var multi = _previewImages.length > 1;
  prevBtn.classList.toggle('d-none', !multi);
  nextBtn.classList.toggle('d-none', !multi);
  document.querySelectorAll('#subPreviewDots .sub-preview-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === idx);
  });
}

_bind('subPreviewPrev', 'click', function() {
  if (_previewImages.length < 2) return;
  _showPreviewSlide((_previewIdx - 1 + _previewImages.length) % _previewImages.length);
});
_bind('subPreviewNext', 'click', function() {
  if (_previewImages.length < 2) return;
  _showPreviewSlide((_previewIdx + 1) % _previewImages.length);
});
_bind('subPreviewDots', 'click', function(e) {
  var dot = e.target.closest('.sub-preview-dot');
  if (!dot) return;
  _showPreviewSlide(parseInt(dot.dataset.idx, 10));
});

document.addEventListener('click', function(e) {
  var trigger = e.target.closest('.sub-card-preview-trigger');
  if (!trigger) return;
  if (e.target.closest('.sub-card-actions')) return;
  if (e.target.closest('.sub-card-manage')) return;
  if (e.target.closest('.sub-card-body')) return;

  var card = trigger.closest('.sub-card');
  if (!card) return;

  var name  = card.dataset.subName        || '';
  var loc   = card.dataset.subLocation    || '';
  var desc  = card.dataset.subDescription || '';
  var props = card.dataset.subProps       || '0';
  var subId = card.dataset.subId;
  _previewSubId = subId;
  _previewSubCard = card;

  _previewImages = JSON.parse(card.dataset.subImages || '[]');
  _previewIdx    = 0;

  document.getElementById('subPreviewName').textContent = name;
  document.getElementById('subPreviewLocation').innerHTML = loc
    ? '<i class="fas fa-map-marker-alt me-1" style="color:var(--clr-primary);"></i>' + loc : '';
  document.getElementById('subPreviewDescription').textContent = desc;
  var propCount = parseInt(props, 10);
  document.getElementById('subPreviewProps').textContent = propCount + ' Propert' + (propCount !== 1 ? 'ies' : 'y');

  // Build dots
  var dotsEl = document.getElementById('subPreviewDots');
  dotsEl.innerHTML = _previewImages.length > 1
    ? _previewImages.map(function(_, i) {
        return '<span class="sub-preview-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></span>';
      }).join('')
    : '';

  _showPreviewSlide(0);

  var previewEditBtn = document.getElementById('subPreviewEditBtn');
  if (previewEditBtn) {
    previewEditBtn.dataset.subId = subId;
    previewEditBtn.onclick = function() {
      _openSubdivisionEditorFromPreview(subId);
    };
  }
  document.getElementById('subPreviewDeleteBtn').onclick = function() {
    bootstrap.Modal.getInstance(document.getElementById('subPreviewModal')).hide();
    var delCardBtn = document.querySelector('.sub-delete-btn[data-sub-id="' + subId + '"]');
    if (delCardBtn) delCardBtn.click();
  };
  document.getElementById('subPreviewManageLink').onclick = function(ev) {
    ev.preventDefault();
    bootstrap.Modal.getInstance(document.getElementById('subPreviewModal')).hide();
    var manageLink = document.querySelector('.sub-card[data-sub-id="' + subId + '"] .sub-card-manage[data-goto]');
    if (manageLink) manageLink.click();
  };

  bootstrap.Modal.getOrCreateInstance(document.getElementById('subPreviewModal')).show();
});

document.addEventListener('click', function(e) {
  var btn = e.target.closest('#subPreviewEditBtn');
  if (!btn) return;
  var subId = btn.dataset.subId || _previewSubId;
  if (!subId) return;
  e.preventDefault();
  _openSubdivisionEditorFromPreview(subId);
});

document.addEventListener('click', function(e) {
  var navBody = e.target.closest('.sub-card-body.sub-card-preview-trigger');
  if (navBody) {
    var navCard = navBody.closest('.sub-card');
    if (!navCard) return;
    if (e.target.closest('.sub-card-actions')) return;
    if (e.target.closest('.sub-card-manage')) return;
    e.preventDefault();
    _selectedSubdivisionNameForModels = navCard.dataset.subName || '';
    var subdivisionIdFromCard = navCard.dataset.subId || '';
    _setPropertySubdivisionFilter(_selectedSubdivisionNameForModels, subdivisionIdFromCard);
    if (typeof showPage === 'function') showPage('properties');
    if (typeof _applyPropertyFilters === 'function') _applyPropertyFilters();
    return;
  }

  var manage = e.target.closest('.sub-card-manage[data-goto="properties"]');
  if (!manage) return;
  e.preventDefault();
  var subdivisionName = manage.getAttribute('data-model-subdivision') || '';
  var subdivisionId = manage.getAttribute('data-model-subdivision-id') || '';
  _selectedSubdivisionNameForModels = subdivisionName;
  if (typeof showPage === 'function') showPage('properties');
  _setPropertySubdivisionFilter(_selectedSubdivisionNameForModels, subdivisionId);
  if (typeof _applyPropertyFilters === 'function') _applyPropertyFilters();
});

/* ── Project cards: preview modal handlers ──────────────────── */
var _projectPreviewImages = [];
var _projectPreviewIdx = 0;
var _selectedProjectIdForSubdivisions = null;
var _selectedProjectLocationForSubdivisions = null;
var _selectedSubdivisionNameForModels = '';

function _showProjectPreviewSlide(idx) {
  _projectPreviewIdx = idx;
  var imgEl = document.getElementById('projectPreviewImg');
  var imgWrap = document.getElementById('projectPreviewImgWrap');
  var placeholder = document.getElementById('projectPreviewPlaceholder');
  var prevBtn = document.getElementById('projectPreviewPrev');
  var nextBtn = document.getElementById('projectPreviewNext');

  if (!imgEl || !imgWrap || !placeholder || !prevBtn || !nextBtn) return;

  if (_projectPreviewImages.length === 0) {
    imgWrap.style.display = 'none';
    placeholder.style.setProperty('display', 'flex', 'important');
  } else {
    imgWrap.style.display = 'block';
    placeholder.style.setProperty('display', 'none', 'important');
    imgEl.style.opacity = '0';
    var newSrc = '/admin/subdivision-image/' + encodeURIComponent(_projectPreviewImages[idx]);
    imgEl.onload = function() { imgEl.style.opacity = '1'; };
    imgEl.src = newSrc;
    if (imgEl.complete) imgEl.style.opacity = '1';
  }

  var multi = _projectPreviewImages.length > 1;
  prevBtn.classList.toggle('d-none', !multi);
  nextBtn.classList.toggle('d-none', !multi);
  document.querySelectorAll('#projectPreviewDots .sub-preview-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === idx);
  });
}

_bind('projectPreviewPrev', 'click', function() {
  if (_projectPreviewImages.length < 2) return;
  _showProjectPreviewSlide((_projectPreviewIdx - 1 + _projectPreviewImages.length) % _projectPreviewImages.length);
});

_bind('projectPreviewNext', 'click', function() {
  if (_projectPreviewImages.length < 2) return;
  _showProjectPreviewSlide((_projectPreviewIdx + 1) % _projectPreviewImages.length);
});

_bind('projectPreviewDots', 'click', function(e) {
  var dot = e.target.closest('.sub-preview-dot');
  if (!dot) return;
  _showProjectPreviewSlide(parseInt(dot.dataset.idx, 10));
});

// Navigate to subdivisions when clicking on project card body/name
document.addEventListener('click', function(e) {
  var bodyTrigger = e.target.closest('.sub-card-body.project-card-preview-trigger');
  if (!bodyTrigger) return;
  
  var card = bodyTrigger.closest('.sub-card');
  if (!card || !card.dataset.projectId) return;
  
  e.preventDefault();
  _selectedProjectIdForSubdivisions = card.dataset.projectId;
  _selectedProjectLocationForSubdivisions = card.dataset.projectLocation || '';
  if (typeof showPage === 'function') {
    showPage('subdivisions');
    setTimeout(function() { 
      _applySubdivisionFilters();
      _setLocationFilter(_selectedProjectLocationForSubdivisions);
    }, 100);
  }
});

document.addEventListener('click', function(e) {
  var trigger = e.target.closest('.project-card-preview-trigger, .project-preview-btn');
  if (!trigger) return;
  if (e.target.closest('.sub-card-action-delete')) return;
  
  // Skip if clicking on card body - that's handled by the navigation handler above
  if (e.target.closest('.sub-card-body')) return;

  var card = trigger.closest('.sub-card');
  if (!card || !card.dataset.projectId) return;

  var projectId = card.dataset.projectId || '';
  var name = card.dataset.projectName || '';
  var loc = card.dataset.projectLocation || '';
  var desc = card.dataset.projectDescription || '';
  var subs = parseInt(card.dataset.projectSubs || '0', 10);

  _projectPreviewImages = JSON.parse(card.dataset.projectImages || '[]');
  _projectPreviewIdx = 0;

  var nameEl = document.getElementById('projectPreviewName');
  var locEl = document.getElementById('projPreviewLocation');
  var descEl = document.getElementById('projPreviewDescription');
  var subsEl = document.getElementById('projectPreviewSubs');
  var dotsEl = document.getElementById('projectPreviewDots');

  if (nameEl) nameEl.textContent = name;
  if (locEl) {
    locEl.innerHTML = loc
      ? '<i class="fas fa-map-marker-alt me-1" style="color:var(--clr-primary);"></i>' + loc
      : '';
  }
  if (descEl) descEl.textContent = desc;
  if (subsEl) subsEl.textContent = subs + ' Subdivision' + (subs !== 1 ? 's' : '');

  if (dotsEl) {
    dotsEl.innerHTML = _projectPreviewImages.length > 1
      ? _projectPreviewImages.map(function(_, i) {
          return '<span class="sub-preview-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></span>';
        }).join('')
      : '';
  }

  _showProjectPreviewSlide(0);

  var editBtn = document.getElementById('projPreviewEditBtn');
  if (editBtn) {
    editBtn.classList.remove('d-none');
    editBtn.dataset.projectId = projectId;
  }

  var deleteBtn = document.getElementById('projPreviewDeleteBtn');
  if (deleteBtn) {
    deleteBtn.onclick = function() {
      bootstrap.Modal.getInstance(document.getElementById('projectPreviewModal'))?.hide();
      var delCardBtn = document.querySelector('.sub-delete-btn[data-project-id="' + projectId + '"]');
      if (delCardBtn) delCardBtn.click();
    };
  }

  var manageLink = document.getElementById('projectPreviewManageLink');
  if (manageLink) {
    manageLink.onclick = function(ev) {
      ev.preventDefault();
      bootstrap.Modal.getInstance(document.getElementById('projectPreviewModal'))?.hide();
      _selectedProjectIdForSubdivisions = projectId;
      _selectedProjectLocationForSubdivisions = loc || '';
      if (typeof showPage === 'function') showPage('subdivisions');
      setTimeout(function() { 
        _applySubdivisionFilters();
        _setLocationFilter(_selectedProjectLocationForSubdivisions);
      }, 100);
    };
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('projectPreviewModal')).show();
});

document.addEventListener('click', function(e) {
  var btn = e.target.closest('#projPreviewEditBtn');
  if (!btn) return;
  var projectId = btn.dataset.projectId;
  if (!projectId) return;
  e.preventDefault();
  bootstrap.Modal.getInstance(document.getElementById('projectPreviewModal'))?.hide();
  _openProjectEditModal(projectId);
});

/* ── Property Approval / Rejection ───────────────────────────── */
var _propApprovalPending = { propId: null, action: null };

document.addEventListener('click', function(e) {
  var approveBtn = e.target.closest('.prop-approve-btn');
  var rejectBtn  = e.target.closest('.prop-reject-btn');
  if (!approveBtn && !rejectBtn) return;

  var propId = (approveBtn || rejectBtn).dataset.propId;
  var isApprove = !!approveBtn;
  _propApprovalPending.propId = propId;
  _propApprovalPending.action = isApprove ? 'approve' : 'reject';

  var iconEl    = document.getElementById('propApprovalIcon');
  var titleEl   = document.getElementById('propApprovalTitle');
  var descEl    = document.getElementById('propApprovalDesc');
  var confirmEl = document.getElementById('propApprovalConfirmBtn');

  if (isApprove) {
    iconEl.innerHTML  = '<i class="fas fa-check-circle" style="color: var(--clr-accent);"></i>';
    titleEl.textContent = 'Approve this property?';
    descEl.textContent  = 'This property will be released and visible on the website for clients.';
    confirmEl.className = 'btn btn-lime px-4';
    confirmEl.innerHTML = '<i class="fas fa-check me-1"></i> Approve';
  } else {
    iconEl.innerHTML  = '<i class="fas fa-times-circle" style="color: var(--clr-primary);"></i>';
    titleEl.textContent = 'Reject this property?';
    descEl.textContent  = 'This property will not be published. The agent can resubmit after corrections.';
    confirmEl.className = 'btn btn-crimson px-4';
    confirmEl.innerHTML = '<i class="fas fa-times me-1"></i> Reject';
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('propApprovalModal')).show();
});

_bind('propApprovalConfirmBtn', 'click', function() {
  var propId = _propApprovalPending.propId;
  var action = _propApprovalPending.action;
  if (!propId || !action) return;

  function _setCardApprovalVisual(card, nextStatus) {
    if (!card) return;
    var bodyHeader = card.querySelector('.prop-card-body .prop-card-header');
    if (bodyHeader) {
      bodyHeader.querySelectorAll('.sqh-badge').forEach(function(b) { b.remove(); });
      var listingStatus = (card.dataset.propListingStatus || '').toLowerCase();
      var listingBadge = document.createElement('span');
      if (listingStatus === 'sold') {
        listingBadge.className = 'sqh-badge badge-not-qualified';
        listingBadge.textContent = 'Sold';
      } else {
        listingBadge.className = 'sqh-badge badge-qualified';
        listingBadge.textContent = 'Available';
      }
      bodyHeader.appendChild(listingBadge);
    }

    var actionsWrap = card.querySelector('.prop-card-actions');
    if (actionsWrap) {
      var html = '<button type="button" class="sub-card-action-btn prop-view-btn-icon" title="View details"><i class="fas fa-eye"></i></button>';
      html += '<button type="button" class="sub-card-action-btn sub-card-action-delete pvm-delete-btn" data-prop-id="' + propId + '" title="Delete"><i class="fas fa-trash"></i></button>';
      actionsWrap.innerHTML = html;
    }

    card.dataset.propStatus = nextStatus;
    var col = card.closest('.prop-card-col');
    if (col) {
      col.dataset.status = (card.dataset.propListingStatus || 'available').toLowerCase();
    }
  }

  function _removePropertyCard(propIdToRemove) {
    var card = document.querySelector('.prop-card[data-prop-id="' + propIdToRemove + '"]');
    if (!card) return;
    var col = card.closest('.prop-card-col');
    if (!col) return;
    col.style.transition = 'opacity .2s ease, transform .2s ease';
    col.style.opacity = '0';
    col.style.transform = 'scale(.98)';
    setTimeout(function() { col.remove(); }, 200);
  }

  function _refreshPropertyGridView() {
    var searchEl = document.getElementById('propSearch');
    if (searchEl) searchEl.dispatchEvent(new Event('input', { bubbles: true }));
    var grid = document.getElementById('propCardsGrid');
    if (!grid) return;
    var hasCards = grid.querySelectorAll('.prop-card-col').length > 0;
    var emptyState = document.getElementById('propEmptyState');
    if (!hasCards && !emptyState) {
      var emptyCol = document.createElement('div');
      emptyCol.className = 'col-12 text-center text-muted py-5';
      emptyCol.id = 'propEmptyState';
      emptyCol.innerHTML = '<i class="fas fa-home fa-2x mb-2 d-block" style="color:var(--clr-border);"></i>No properties found.';
      grid.appendChild(emptyCol);
    }
    if (hasCards && emptyState) emptyState.remove();
  }

  fetch('/admin/property/' + propId + '/' + action, { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      bootstrap.Modal.getInstance(document.getElementById('propApprovalModal')).hide();
      if (!data.success) {
        showToast(data.error || 'Unable to update property right now.', 'danger');
        return;
      }
      var card = document.querySelector('.prop-card[data-prop-id="' + propId + '"]');
      if (action === 'delete') {
        _removePropertyCard(propId);
        _refreshPropertyGridView();
        showToast('Property deleted successfully.', 'success');
        return;
      }
      if (card) _setCardApprovalVisual(card, data.approval_status || action);
      _refreshPropertyGridView();
      if (action === 'approve') {
        showToast('Property approved successfully.', 'success');
      } else {
        showToast('Property rejected successfully.', 'info');
      }
    })
    .catch(function() {
      bootstrap.Modal.getInstance(document.getElementById('propApprovalModal')).hide();
      showToast('Network error. Please try again.', 'danger');
    });
});

/* ── Edit Property Modal (Agent-style in Admin) ───────────────── */
var _lemImages = [];
var _lemIdx = 0;
var _editPropId = null;
var _pendingNewFiles = [];
var _pvmCurrentData = null;
var _pendingDetailsState = { propertyId: null, propertyName: '', action: null, requestId: null, historyId: null };
var _purchaseListState = { propertyId: null, propertyName: '', rows: [] };
var _purchaseFormViewState = { tripId: null, row: null };
var _purchaseFormActionState = { tripId: null, action: '', row: null };
var _purchaseSoldConfirmState = { returnToView: false, actionCompleted: false };
var _purchaseFormDecorated = false;
var _purchaseEsigState = { scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 };

function _purchaseFormFieldIcon(labelText) {
  var t = String(labelText || '').toLowerCase();
  if (t.indexOf('name') !== -1) return 'fas fa-user';
  if (t.indexOf('birth') !== -1 || t.indexOf('date') !== -1) return 'fas fa-calendar-day';
  if (t.indexOf('mobile') !== -1 || t.indexOf('telephone') !== -1 || t.indexOf('tel') !== -1) return 'fas fa-phone';
  if (t.indexOf('email') !== -1) return 'fas fa-envelope';
  if (t.indexOf('gender') !== -1 || t.indexOf('civil') !== -1 || t.indexOf('citizenship') !== -1) return 'fas fa-id-card';
  if (t.indexOf('country') !== -1 || t.indexOf('address') !== -1 || t.indexOf('location') !== -1) return 'fas fa-location-dot';
  if (t.indexOf('occupation') !== -1 || t.indexOf('position') !== -1 || t.indexOf('employment') !== -1) return 'fas fa-briefcase';
  if (t.indexOf('price') !== -1 || t.indexOf('fee') !== -1 || t.indexOf('amount') !== -1 || t.indexOf('loan') !== -1 || t.indexOf('downpayment') !== -1) return 'fas fa-coins';
  if (t.indexOf('unit') !== -1 || t.indexOf('or/pr') !== -1 || t.indexOf('booking') !== -1) return 'fas fa-hashtag';
  if (t.indexOf('viber') !== -1) return 'fab fa-viber';
  if (t.indexOf('whatsapp') !== -1) return 'fab fa-whatsapp';
  return 'fas fa-circle-dot';
}

function _decoratePurchaseFormInputs() {
  if (_purchaseFormDecorated) return;
  var wrap = document.getElementById('purchaseFormViewBody');
  if (!wrap) return;
  wrap.querySelectorAll('input.form-control, select.form-select, textarea.form-control').forEach(function (el) {
    if (!el || el.closest('.input-group')) return;
    var col = el.closest('.col-12, .col-md-3, .col-md-4, .col-md-6') || el.parentElement;
    if (!col) return;
    var labelEl = col.querySelector('label.form-label');
    var icon = _purchaseFormFieldIcon(labelEl ? labelEl.textContent : '');
    var group = document.createElement('div');
    group.className = 'input-group sqh-input-group';
    var prefix = document.createElement('span');
    prefix.className = 'input-group-text sqh-ig-text';
    prefix.innerHTML = '<i class="' + icon + '"></i>';
    el.parentNode.insertBefore(group, el);
    group.appendChild(prefix);
    group.appendChild(el);
  });
  _purchaseFormDecorated = true;
}

function _applyPurchaseEsigTransform() {
  var img = document.getElementById('purchaseFormEsigImage');
  var lbl = document.getElementById('purchaseFormEsigZoomLabel');
  if (!img) return;
  img.style.transform = 'translate(' + _purchaseEsigState.x + 'px, ' + _purchaseEsigState.y + 'px) scale(' + _purchaseEsigState.scale + ')';
  if (lbl) lbl.textContent = Math.round(_purchaseEsigState.scale * 100) + '%';
}

function _resetPurchaseEsigTransform() {
  _purchaseEsigState.scale = 1;
  _purchaseEsigState.x = 0;
  _purchaseEsigState.y = 0;
  _purchaseEsigState.dragging = false;
  _applyPurchaseEsigTransform();
}

function _initPurchaseFormEsigInteractions() {
  var viewport = document.getElementById('purchaseFormEsigViewport');
  var img = document.getElementById('purchaseFormEsigImage');
  var zoomIn = document.getElementById('purchaseFormEsigZoomIn');
  var zoomOut = document.getElementById('purchaseFormEsigZoomOut');
  var resetBtn = document.getElementById('purchaseFormEsigReset');
  if (!viewport || !img) return;

  if (zoomIn) {
    zoomIn.addEventListener('click', function () {
      _purchaseEsigState.scale = Math.min(4, _purchaseEsigState.scale + 0.1);
      _applyPurchaseEsigTransform();
    });
  }
  if (zoomOut) {
    zoomOut.addEventListener('click', function () {
      _purchaseEsigState.scale = Math.max(0.4, _purchaseEsigState.scale - 0.1);
      _applyPurchaseEsigTransform();
    });
  }
  if (resetBtn) resetBtn.addEventListener('click', _resetPurchaseEsigTransform);

  viewport.addEventListener('mousedown', function (e) {
    if (!img.getAttribute('src')) return;
    _purchaseEsigState.dragging = true;
    _purchaseEsigState.startX = e.clientX - _purchaseEsigState.x;
    _purchaseEsigState.startY = e.clientY - _purchaseEsigState.y;
    img.classList.add('is-dragging');
  });
  document.addEventListener('mousemove', function (e) {
    if (!_purchaseEsigState.dragging) return;
    _purchaseEsigState.x = e.clientX - _purchaseEsigState.startX;
    _purchaseEsigState.y = e.clientY - _purchaseEsigState.startY;
    _applyPurchaseEsigTransform();
  });
  document.addEventListener('mouseup', function () {
    if (!_purchaseEsigState.dragging) return;
    _purchaseEsigState.dragging = false;
    img.classList.remove('is-dragging');
  });
  viewport.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? -0.08 : 0.08;
    _purchaseEsigState.scale = Math.max(0.4, Math.min(4, _purchaseEsigState.scale + delta));
    _applyPurchaseEsigTransform();
  }, { passive: false });

  img.addEventListener('load', _resetPurchaseEsigTransform);
}

function _lemShowSlide(idx) {
  var imgEl = document.getElementById('lemImg');
  if (!imgEl || !_lemImages.length) return;
  _lemIdx = (idx + _lemImages.length) % _lemImages.length;
  imgEl.style.opacity = '0';
  setTimeout(function() {
    imgEl.src = '/uploads/' + _lemImages[_lemIdx];
    imgEl.style.opacity = '1';
  }, 120);
  document.querySelectorAll('#lemDots .sub-preview-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === _lemIdx);
  });
}

// View property details in modal
function _openPropertyDetailsModal(propId) {
  if (!propId) return;
  
  var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('propertyDetailsModal'));
  var loadingEl = document.getElementById('pdm-loading');
  var contentEl = document.getElementById('pdm-content');
  
  if (!loadingEl || !contentEl) return;
  
  loadingEl.innerHTML = '<div class="spinner-border" style="color:var(--clr-primary);" role="status"></div>';
  loadingEl.classList.remove('d-none');
  contentEl.classList.add('d-none');
  contentEl.innerHTML = '';
  
  modal.show();
  
  // Fetch property details from API
  fetch('/api/admin/property/' + encodeURIComponent(propId))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.ok) throw new Error(data.error || 'Failed to load property');
      _renderPropertyDetailsModal(data.data);
      loadingEl.classList.add('d-none');
      contentEl.classList.remove('d-none');
    })
    .catch(function(err) {
      loadingEl.innerHTML = '<p class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>Failed to load property details: ' + (err.message || 'Unknown error') + '</p>';
    });
}

function _renderPropertyDetailsModal(prop) {
  var contentEl = document.getElementById('pdm-content');
  if (!contentEl) return;
  
  // Parse numeric values
  var tcp = parseFloat(prop.price) || 0;
  var promo = parseFloat(prop.promo_discount_rate) || 0;
  var vat = parseFloat(prop.vat_rate) || 12;
  var lmf = parseFloat(prop.lmf_rate) || 2;
  var downpay = parseFloat(prop.downpayment_rate) || 20;
  var downpay_months = parseInt(prop.downpayment_terms_months) || 24;
  var loanable = parseFloat(prop.loanable_percentage) || 80;
  var resv_fee = parseFloat(prop.reservation_fee) || 0;
  var interest_rate = parseFloat(prop.interest_rate) || parseFloat(prop.annual_interest_rate) || 8.5;
  
  // Calculate pricing
  var promo_amount = tcp * (promo / 100);
  var net_price = tcp - promo_amount;
  var vat_amount = net_price * (vat / 100);
  var lmf_amount = net_price * (lmf / 100);
  var total_contract_price = net_price + vat_amount + lmf_amount;
  var total_downpay = total_contract_price * (downpay / 100);
  var monthly_downpay = total_downpay / downpay_months;
  var total_loanable = total_contract_price * (loanable / 100);
  
  // Format currency
  function fmt(n) { return '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', {maximumFractionDigits: 0}); }
  function fmt2(n) { return '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', {maximumFractionDigits: 2}); }
  
  // Calculate monthly payment for different terms (years)
  function monthlyPayment(principal, annualRate, years) {
    var monthlyRate = annualRate / 100 / 12;
    var numPayments = years * 12;
    if (monthlyRate === 0) return principal / numPayments;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  }
  
  function requiredIncome(monthlyPayment) {
    return monthlyPayment / 0.30; // 30% DTI
  }
  
  // Get property metadata
  var location = prop.location || '—';
  var bedrooms = prop.bedrooms || '—';
  var bathrooms = prop.bathrooms || '—';
  var storeys = prop.storeys || '—';
  var floor_area = prop.floor_area || '—';
  var lot_area = prop.lot_area || '—';
  var unit_type = (prop.unit_type || '').replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  var project = prop.subdivision || '—';
  
  // Get property images
  var images = (prop.images || '').split(',').filter(function(x) { return x.trim(); });
  var firstImage = images.length > 0 ? '/uploads/' + images[0].trim() : null;
  var imageHtml = '<div class="pdm-image-container mb-3">'
    + (firstImage 
      ? '<img src="' + firstImage + '" alt="' + (prop.name || 'Property') + '" class="pdm-property-image" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
      : '')
    + '<div class="pdm-image-placeholder" style="' + (firstImage ? 'display:none;' : 'display:flex;') + '"><i class="fas fa-image" style="font-size:2rem;"></i></div>'
    + '</div>';
  
  // Build HTML
  var html = '<div class="pdm-container">'
    + imageHtml
    + '<div class="pdm-header mb-2">'
    + '  <div class="d-flex justify-content-between align-items-start mb-2">'
    + '    <div><h5 class="m-0">' + (prop.name || 'Property') + '</h5>'
    + '    <small class="text-muted"><i class="fas fa-map-marker-alt me-1"></i>' + location + '</small></div>'
    + '    <div class="text-end"><span class="badge bg-success text-white me-1">' + (prop.status ? prop.status.toUpperCase() : 'AVAILABLE') + '</span>'
    + '<span class="badge bg-info text-white">' + unit_type + '</span></div>'
    + '  </div>'
    + '</div>'
    
    // Key specs row
    + '<div class="pdm-specs-row mb-3 pb-3 border-bottom">'
    + '  <div class="pdm-spec-item"><i class="fas fa-bed text-primary me-1"></i><strong>' + bedrooms + '</strong> Beds</div>'
    + '  <div class="pdm-spec-item"><i class="fas fa-bath text-primary me-1"></i><strong>' + bathrooms + '</strong> Baths</div>'
    + '  <div class="pdm-spec-item"><i class="fas fa-layer-group text-primary me-1"></i><strong>' + storeys + '</strong> Storeys</div>'
    + '  <div class="pdm-spec-item"><i class="fas fa-ruler-combined text-primary me-1"></i><strong>' + floor_area + '</strong> sqm floor</div>'
    + '  <div class="pdm-spec-item"><i class="fas fa-square text-primary me-1"></i><strong>' + lot_area + '</strong> sqm lot</div>'
    + '</div>'
    
    // Property metadata
    + '<div class="row g-3 mb-4 pdm-metadata">'
    + '  <div class="col-6"><div class="pdm-info-box"><strong class="d-block" style="font-size:0.75rem;text-transform:uppercase;color:var(--clr-text-secondary);">Model Type</strong><span>' + (prop.prop_type ? prop.prop_type.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }) : 'House And Lot') + '</span></div></div>'
    + '  <div class="col-6"><div class="pdm-info-box"><strong class="d-block" style="font-size:0.75rem;text-transform:uppercase;color:var(--clr-text-secondary);">Unit Type</strong><span>' + unit_type + '</span></div></div>'
    + '  <div class="col-6"><div class="pdm-info-box"><strong class="d-block" style="font-size:0.75rem;text-transform:uppercase;color:var(--clr-text-secondary);">TCP</strong><span>' + fmt(tcp) + '</span></div></div>'
    + '  <div class="col-6"><div class="pdm-info-box"><strong class="d-block" style="font-size:0.75rem;text-transform:uppercase;color:var(--clr-text-secondary);">Project</strong><span>' + project + '</span></div></div>'
    + '</div>'
    
    // Full Pricing Breakdown
    + '<h6 class="pdm-section-title"><i class="fas fa-calculator me-1"></i>Full Pricing Breakdown</h6>'
    
    // Selling Prices
    + '<div class="pdm-section mb-3">'
    + '  <h6 class="pdm-subsection-title">SELLING PRICES</h6>'
    + '  <div class="row g-2">'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>TOTAL SELLING PRICE</strong><span>' + fmt(tcp) + '</span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>PROMO DISCOUNT</strong><span class="text-success">' + promo.toFixed(2) + '%' + (promo_amount > 0 ? '<br><small>Not Saving ' + fmt(promo_amount) + '</small>' : '') + '</span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>VAT</strong><span class="text-danger">' + fmt(vat_amount) + '</span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>LMF</strong><span class="text-danger">' + fmt(lmf_amount) + '</span></div></div>'
    + '  </div>'
    + '</div>'
    
    // Miscellaneous
    + '<div class="pdm-section mb-3">'
    + '  <h6 class="pdm-subsection-title">MISCELLANEOUS</h6>'
    + '  <div class="row g-2">'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>TOTAL CONTRACT PRICE</strong><span class="text-primary">' + fmt(total_contract_price) + '</span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>RESERVATION FEE</strong><span>' + fmt(resv_fee) + '</span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>TOTAL DOWNPAYMENT</strong><span>' + fmt(total_downpay) + '</span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>MONTHLY DOWNPAYMENT</strong><span>' + fmt2(monthly_downpay) + '<br><small>(' + downpay_months + ' months)</small></span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>TOTAL LOANABLE AMOUNT</strong><span class="text-primary">' + fmt(total_loanable) + '</span></div></div>'
    + '    <div class="col-6"><div class="pdm-line-item"><strong>ANNUAL INTEREST</strong><span>' + interest_rate.toFixed(2) + '%</span></div></div>'
    + '  </div>'
    + '</div>'
    
    // Amortization
    + '<div class="row g-2 pvm-pb-amort">'
    + '  <h4>Amortization</h4>';
  [5, 10, 15, 20].forEach(function(years) {
    var monthly = monthlyPayment(total_loanable, interest_rate, years);
    html += '<div class="col-6 col-md-3">'
      + '<div class="pvm-pb-amort-card">'
      + '  <div class="pvm-pb-amort-term">' + years + ' YEARS</div>'
      + '  <div class="pvm-pb-amort-value">' + fmt2(monthly) + '</div>'
      + '  <div class="pvm-pb-amort-unit">/month</div>'
      + '</div>'
      + '</div>';
  });
  html += '</div>'
    
    // Required Income
    + '<div class="row g-2 pvm-pb-amort mt-1">'
    + '  <h4>Required Income</h4>';
  [5, 10, 15, 20].forEach(function(years) {
    var monthly = monthlyPayment(total_loanable, interest_rate, years);
    var income = requiredIncome(monthly);
    html += '<div class="col-6 col-md-3">'
      + '<div class="pvm-pb-amort-card">'
      + '  <div class="pvm-pb-amort-term">' + years + ' YEARS</div>'
      + '  <div class="pvm-pb-amort-value">' + fmt(income) + '</div>'
      + '  <div class="pvm-pb-amort-unit">/month</div>'
      + '</div>'
      + '</div>';
  });
  html += '</div></div>';
  
  contentEl.innerHTML = html;
}

function _openPendingDetailsForProperty(propId, propName) {
  _pendingDetailsState.propertyId = propId;
  _pendingDetailsState.propertyName = propName || 'Property';
  var nameEl = document.getElementById('pendingDetailsPropertyName');
  if (nameEl) nameEl.textContent = _pendingDetailsState.propertyName;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('pendingDetailsModal')).show();
  _loadPendingDetailsRequests();
}

function _openPurchaseListForProperty(propId, propName) {
  if (!propId) return;
  _purchaseListState.propertyId = String(propId);
  _purchaseListState.propertyName = propName || 'Property';
  _purchaseListState.rows = [];

  var modalEl = document.getElementById('purchaseListModal');
  if (!modalEl) return;
  var nameEl = document.getElementById('purchaseListPropertyName');
  var summaryEl = document.getElementById('purchaseListSummary');
  var bodyEl = document.getElementById('purchaseListTableBody');
  var emptyEl = document.getElementById('purchaseListEmpty');
  if (nameEl) nameEl.textContent = _purchaseListState.propertyName;
  if (summaryEl) summaryEl.textContent = 'Loading entries...';
  if (bodyEl) bodyEl.innerHTML = '';
  if (emptyEl) emptyEl.classList.add('d-none');

  bootstrap.Modal.getOrCreateInstance(modalEl).show();

  fetch('/admin/property/' + encodeURIComponent(_purchaseListState.propertyId) + '/purchase-list', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || 'Unable to load purchase list.');
      var rows = Array.isArray(data.rows) ? data.rows : [];
      _purchaseListState.rows = rows;
      if (nameEl) nameEl.textContent = data.property_name || _purchaseListState.propertyName;
      if (summaryEl) summaryEl.textContent = rows.length + ' candidate' + (rows.length === 1 ? '' : 's');

      if (!bodyEl) return;
      bodyEl.innerHTML = '';
      if (!rows.length) {
        if (emptyEl) emptyEl.classList.remove('d-none');
        return;
      }

      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        var status = (row.status || 'pending').toLowerCase();
        var statusCls = status === 'visited' ? 'badge-qualified' : (status === 'sold' ? 'badge-not-qualified' : 'badge-conditional');
        var formText = row.purchase_form_label || (row.purchase_form_submitted ? 'Submitted' : 'Not submitted yet');
        var purchaseStatus = String(row.purchase_status || '').toLowerCase();
        var purchaseLabel = 'No Submission';
        var purchaseCls = 'badge-conditional';
        if (purchaseStatus === 'approved') {
          purchaseLabel = 'Approved';
          purchaseCls = 'badge-qualified';
        } else if (purchaseStatus === 'pending') {
          purchaseLabel = 'Pending';
          purchaseCls = 'badge-conditional';
        } else if (purchaseStatus === 'rejected') {
          purchaseLabel = 'Rejected';
          purchaseCls = 'badge-not-qualified';
        }
        tr.innerHTML = ''
          + '<td>' + _escHtml(row.client_name || 'Client') + '</td>'
          + '<td>' + _escHtml(row.preferred_date || '—') + '</td>'
          + '<td>' + _escHtml(formText) + '</td>'
          + '<td><span class="sqh-badge ' + statusCls + '">' + _escHtml(status.charAt(0).toUpperCase() + status.slice(1)) + '</span></td>'
          + '<td><span class="sqh-badge ' + purchaseCls + '">' + _escHtml(purchaseLabel) + '</span></td>'
          + '<td>'
          + '  <div class="d-flex gap-2 flex-nowrap">'
          + '    <button type="button" class="btn btn-sm btn-outline-blue purchase-list-view-form-btn" data-trip-id="' + _escHtml(String(row.trip_id || '')) + '"' + (row.can_view_form ? '' : ' disabled') + '>'
          + '      <i class="fas fa-eye me-1"></i>'
          + '    </button>'
          + '    <button type="button" class="btn btn-sm btn-outline-crimson purchase-list-delete-form-btn" data-trip-id="' + _escHtml(String(row.trip_id || '')) + '"' + (row.can_view_form ? '' : ' disabled') + '>'
          + '      <i class="fas fa-trash me-1"></i>'
          + '    </button>'
          + '  </div>'
          + '</td>';
        bodyEl.appendChild(tr);
      });
    })
    .catch(function (err) {
      if (summaryEl) summaryEl.textContent = 'Unable to load entries.';
      if (bodyEl) bodyEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('d-none');
      if (typeof showToast === 'function') showToast((err && err.message) || 'Unable to load purchase list.', 'danger');
    });
}

function _openPurchaseFormActionConfirm(action, tripId) {
  var row = (_purchaseListState.rows || []).find(function (x) { return String(x.trip_id) === String(tripId); });
  if (!row) return;
  var normalizedAction = String(action || '').toLowerCase();
  if (!row.can_view_form) {
    showToast('No submitted purchase form to process.', 'warning');
    return;
  }
  if (normalizedAction === 'reject' && String(row.purchase_status || '').toLowerCase() === 'rejected') {
    showToast('This purchase form is already rejected.', 'info');
    return;
  }

  _purchaseFormActionState.tripId = row.trip_id;
  _purchaseFormActionState.action = normalizedAction;
  _purchaseFormActionState.row = row;
  _purchaseFormActionState.returnTo = 'list';
  _purchaseFormActionState.actionCompleted = false;

  var titleEl = document.getElementById('purchaseFormActionConfirmTitle');
  var iconEl = document.getElementById('purchaseFormActionConfirmIcon');
  var headingEl = document.getElementById('purchaseFormActionConfirmHeading');
  var descEl = document.getElementById('purchaseFormActionConfirmDesc');
  var btnEl = document.getElementById('purchaseFormActionConfirmBtn');
  if (!btnEl) return;

  var clientName = row.client_name || 'this client';
  var isDelete = _purchaseFormActionState.action === 'delete';
  var isReject = _purchaseFormActionState.action === 'reject';
  if (titleEl) titleEl.textContent = isDelete ? 'Delete Purchase Form' : (isReject ? 'Reject Purchase Form' : 'Confirm Action');
  if (iconEl) {
    iconEl.style.color = isDelete ? 'var(--clr-primary)' : (isReject ? '#b02a37' : 'var(--clr-blue)');
    iconEl.innerHTML = isDelete
      ? '<i class="fas fa-trash-can"></i>'
      : (isReject ? '<i class="fas fa-ban"></i>' : '<i class="fas fa-circle-question"></i>');
  }
  if (headingEl) headingEl.textContent = isDelete
    ? 'Delete submitted purchase form?'
    : (isReject ? 'Reject this purchase form?' : 'Proceed with this action?');
  if (descEl) {
    descEl.textContent = isDelete
      ? ('This will permanently remove the submitted purchase form for ' + clientName + '.')
      : (isReject
        ? ('This will mark the submitted purchase form as rejected for ' + clientName + '.')
        : 'This change will apply immediately.');
  }
  btnEl.classList.remove('btn-outline-blue', 'btn-outline-crimson', 'btn-lime', 'btn-crimson');
  btnEl.classList.add(isDelete || isReject ? 'btn-crimson' : 'btn-outline-blue');
  btnEl.innerHTML = isDelete
    ? '<i class="fas fa-trash me-1"></i> Delete'
    : (isReject ? '<i class="fas fa-ban me-1"></i> Reject' : 'Confirm');

  var listModalEl = document.getElementById('purchaseListModal');
  var viewModalEl = document.getElementById('purchaseFormViewModal');
  var listModalInst = bootstrap.Modal.getInstance(listModalEl);
  var viewModalInst = bootstrap.Modal.getInstance(viewModalEl);
  var isViewOpen = !!(viewModalEl && viewModalEl.classList.contains('show'));
  var isListOpen = !!(listModalEl && listModalEl.classList.contains('show'));
  if (isViewOpen) _purchaseFormActionState.returnTo = 'view';
  else if (isListOpen) _purchaseFormActionState.returnTo = 'list';
  if (listModalInst) listModalInst.hide();
  if (viewModalInst) viewModalInst.hide();

  setTimeout(function () {
    var confirmModalEl = document.getElementById('purchaseFormActionConfirmModal');
    var confirmModal = bootstrap.Modal.getOrCreateInstance(confirmModalEl);
    confirmModal.show();
    setTimeout(function () {
      confirmModalEl.style.zIndex = '1090';
      var backdrops = document.querySelectorAll('.modal-backdrop');
      if (backdrops.length) {
        backdrops[backdrops.length - 1].style.zIndex = '1080';
      }
    }, 0);
  }, 170);
}

_bind('purchaseFormActionConfirmBtn', 'click', function () {
  var btn = this;
  var tripId = _purchaseFormActionState.tripId;
  var action = _purchaseFormActionState.action;
  if (!tripId || !action) return;

  btn.disabled = true;
  var oldHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';

  fetch('/admin/trip/' + encodeURIComponent(tripId) + '/purchase-form-action', {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: action })
  })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (res) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
      if (!res.ok || !res.data || !res.data.ok) {
        showToast((res.data && res.data.error) || 'Unable to process purchase form action.', 'danger');
        return;
      }

      _purchaseFormActionState.actionCompleted = true;

      bootstrap.Modal.getInstance(document.getElementById('purchaseFormActionConfirmModal'))?.hide();
      bootstrap.Modal.getInstance(document.getElementById('purchaseFormViewModal'))?.hide();

      var successMsg = action === 'delete'
        ? 'Submitted purchase form deleted successfully.'
        : (action === 'reject'
          ? 'Submitted purchase form rejected successfully.'
          : 'Purchase form action applied successfully.');
      var toastType = action === 'reject' ? 'danger' : 'success';
      showToast(successMsg, toastType);

      _purchaseListState.rows = (_purchaseListState.rows || []).map(function(item) {
        if (String(item.trip_id) !== String(tripId)) return item;
        if (action === 'reject') {
          item.purchase_form_submitted = false;
          item.purchase_status = 'rejected';
          item.can_view_form = true;
        } else if (action === 'delete') {
          item.purchase_form_submitted = false;
          item.purchase_status = 'none';
          item.can_view_form = false;
          item.purchase_form_data = '';
          item.purchase_form_label = 'Not submitted yet';
        }
        return item;
      });

      _openPurchaseListForProperty(_purchaseListState.propertyId, _purchaseListState.propertyName);
    })
    .catch(function () {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
      showToast('Network error while processing purchase form action.', 'danger');
    });
});

(function initPurchaseFormActionConfirmFallback() {
  var confirmEl = document.getElementById('purchaseFormActionConfirmModal');
  if (!confirmEl) return;
  confirmEl.addEventListener('hidden.bs.modal', function () {
    if (_purchaseFormActionState.actionCompleted) {
      _purchaseFormActionState.returnTo = '';
      return;
    }
    if (_purchaseFormActionState.returnTo === 'view' && _purchaseFormViewState.tripId) {
      setTimeout(function () {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('purchaseFormViewModal')).show();
      }, 120);
    } else if (_purchaseFormActionState.returnTo === 'list' && _purchaseListState.propertyId) {
      setTimeout(function () {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('purchaseListModal')).show();
      }, 120);
    }
    _purchaseFormActionState.returnTo = '';
  });
})();

function _validateLoanDetailsForApproval() {
  var requiredIds = [
    'loanUnitId', 'loanSellingPrice', 'loanProcessingFee', 'loanAmount', 'loanDownpayment',
    'loanReservationFee', 'loanPromoDisc', 'loanOrPrNo', 'loanOrPrDate', 'loanBookingOfficer',
    'loanFinancing', 'loanDownpaymentTerm', 'loanTerm'
  ];

  for (var i = 0; i < requiredIds.length; i += 1) {
    var id = requiredIds[i];
    var el = document.getElementById(id);
    if (!el) continue;
    var val = String(el.value || '').trim();
    if (!val) {
      showToast('Please complete all Loan Details fields before marking this purchase as Sold.', 'warning');
      try { el.focus(); } catch (_) {}
      return false;
    }
  }

  var dateEl = document.getElementById('loanOrPrDate');
  if (dateEl) {
    var dateVal = String(dateEl.value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      showToast('Please provide a valid OR/PR Date before marking as Sold.', 'warning');
      try { dateEl.focus(); } catch (_) {}
      return false;
    }
  }

  return true;
}

function _openPurchaseFormView(tripId) {
  var row = (_purchaseListState.rows || []).find(function (x) { return String(x.trip_id) === String(tripId); });
  if (!row) return;
  _purchaseFormViewState.tripId = row.trip_id;
  _purchaseFormViewState.row = row;

  _decoratePurchaseFormInputs();
  _initPurchaseFormEsigInteractions();

  var listModalEl = document.getElementById('purchaseListModal');
  var listModal = listModalEl ? bootstrap.Modal.getInstance(listModalEl) : null;
  if (listModal) listModal.hide();

  var tripRefEl = document.getElementById('buyerInfoTripRef') || document.getElementById('purchaseFormViewTripRef');
  var statusBadgeEl = document.getElementById('purchaseFormStatusBadge');
  var clientEl = document.getElementById('purchaseFormViewClient');
  var submittedEl = document.getElementById('purchaseFormViewSubmittedAt');
  if (tripRefEl) tripRefEl.textContent = 'Trip #' + String(row.trip_id || '');
  if (clientEl) clientEl.textContent = row.client_name || 'Client';
  if (submittedEl) submittedEl.textContent = row.purchase_form_label || 'Submitted';

  var status = String(row.purchase_status || '').toLowerCase();
  if (!status) {
    status = row.is_sold ? 'approved' : (row.purchase_form_submitted ? 'pending' : (row.can_view_form ? 'rejected' : 'none'));
  }
  if (statusBadgeEl) {
    statusBadgeEl.className = 'sqh-badge';
    if (status === 'approved') {
      statusBadgeEl.classList.add('badge-qualified');
      statusBadgeEl.textContent = 'Approved';
      statusBadgeEl.classList.remove('d-none');
    } else if (status === 'rejected') {
      statusBadgeEl.classList.add('badge-not-qualified');
      statusBadgeEl.textContent = 'Rejected';
      statusBadgeEl.classList.remove('d-none');
    } else {
      statusBadgeEl.classList.add('d-none');
      statusBadgeEl.textContent = '—';
    }
  }

  var payload = {};
  try {
    payload = row.purchase_form_data ? JSON.parse(row.purchase_form_data) : {};
  } catch (_err) {
    payload = {};
  }
  var modalBody = document.getElementById('purchaseFormViewBody');
  var fallbacks = {
    pbViber: ['social_viber'],
    pbWhatsApp: ['social_whatsapp'],
    pbOccupationProfession: ['occupation'],
    pbOccupationalPosition: ['occupational_position'],
    pbEmployerBusinessName: ['employer_name'],
    pbEmployerEmail: ['employer_email'],
    pbTenure: ['tenure_months'],
    loanSellingPrice: ['selling_price']
  };
  var loanPlaceholders = {
    loanUnitId: 'Auto-generated',
    loanSellingPrice: 'PHP 0.00',
    loanProcessingFee: 'PHP 0.00',
    loanAmount: 'PHP 0.00',
    loanDownpayment: 'PHP 0.00',
    loanReservationFee: 'PHP 20,000.00',
    loanPromoDisc: 'PHP 0.00',
    loanOrPrNo: 'e.g. OR-2026-0001',
    loanOrPrDate: 'mm/dd/yyyy',
    loanBookingOfficer: 'Enter booking officer name'
  };

  function readPayloadValue(id) {
    if (Object.prototype.hasOwnProperty.call(payload, id)) return payload[id];
    var fb = fallbacks[id] || [];
    for (var i = 0; i < fb.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(payload, fb[i])) return payload[fb[i]];
    }
    return null;
  }

  function normText(v) {
    return v == null ? '' : String(v).trim();
  }

  function normalizeDateInputValue(v) {
    var raw = normText(v);
    if (!raw) return '';

    var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return raw;

    var mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mdy) {
      var mm = String(parseInt(mdy[1], 10));
      var dd = String(parseInt(mdy[2], 10));
      var yyyy = String(parseInt(mdy[3], 10));
      if (parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 && parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31) {
        return yyyy + '-' + mm.padStart(2, '0') + '-' + dd.padStart(2, '0');
      }
    }

    return '';
  }

  function baseKeyFromLabelText(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';
  }

  var autoBuckets = {};
  var autoBucketCursor = {};
  Object.keys(payload || {}).forEach(function(k) {
    if (!/^auto_[a-z0-9_]+_\d+$/i.test(k)) return;
    var m = String(k).match(/^auto_(.+)_(\d+)$/i);
    if (!m) return;
    var base = m[1];
    var idx = parseInt(m[2], 10) || 0;
    if (!autoBuckets[base]) autoBuckets[base] = [];
    autoBuckets[base].push({ idx: idx, value: payload[k] });
  });
  Object.keys(autoBuckets).forEach(function(base) {
    autoBuckets[base].sort(function(a, b) { return a.idx - b.idx; });
    autoBucketCursor[base] = 0;
  });

  function readAutoFallbackValue(el) {
    if (!el) return null;
    var host = el.closest('.col-12, .col-md-2, .col-md-3, .col-md-4, .col-md-6, td') || el.parentElement;
    var labelEl = host ? host.querySelector('label.form-label') : null;
    var base = baseKeyFromLabelText(labelEl ? labelEl.textContent : 'field');
    var arr = autoBuckets[base];
    if (!arr || !arr.length) return null;
    var pos = autoBucketCursor[base] || 0;
    if (pos >= arr.length) return null;
    autoBucketCursor[base] = pos + 1;
    return arr[pos].value;
  }

  function setSelectDisplay(selectId, value, text) {
    var el = document.getElementById(selectId);
    if (!el) return;
    var v = normText(value);
    var t = normText(text);
    if (!v && !t) {
      el.value = '';
      return;
    }
    var matched = null;
    Array.prototype.slice.call(el.options || []).forEach(function(opt) {
      if (matched) return;
      var ov = normText(opt.value);
      var ot = normText(opt.textContent);
      if ((v && ov.toLowerCase() === v.toLowerCase()) || (t && ot.toLowerCase() === t.toLowerCase())) {
        matched = opt;
      }
    });
    if (matched) {
      el.value = matched.value;
      return;
    }
    var opt = document.createElement('option');
    opt.value = v || t;
    opt.textContent = t || v;
    opt.selected = true;
    el.appendChild(opt);
    el.value = opt.value;
  }

  function setAddressSelects(prefix) {
    var regionCode = readPayloadValue(prefix + 'RegionCode');
    var regionName = readPayloadValue(prefix + 'RegionName');
    var provinceCode = readPayloadValue(prefix + 'ProvinceCode');
    var provinceName = readPayloadValue(prefix + 'ProvinceName');
    var cityCode = readPayloadValue(prefix + 'CityCode');
    var cityName = readPayloadValue(prefix + 'CityName');
    var barangayCode = readPayloadValue(prefix + 'BarangayCode');
    var barangayName = readPayloadValue(prefix + 'BarangayName');

    setSelectDisplay(prefix + 'RegionSelect', regionCode, regionName);
    setSelectDisplay(prefix + 'ProvinceSelect', provinceCode, provinceName);
    setSelectDisplay(prefix + 'CitySelect', cityCode, cityName);
    setSelectDisplay(prefix + 'BarangaySelect', barangayCode, barangayName);
  }

  if (modalBody) {
    modalBody.querySelectorAll('input, select, textarea').forEach(function(el) {
      if (!el || !el.id) return;
      var v = readPayloadValue(el.id);
      if (v == null || v === '') {
        v = readAutoFallbackValue(el);
      }
      if (el.id === 'buyerSubmitTripId' && (v == null || v === '')) {
        v = row.trip_id || '';
      }
      if (el.type === 'checkbox') {
        el.checked = !!v;
        return;
      }

      if (el.id === 'loanOrPrDate') {
        v = normalizeDateInputValue(v);
      }

      var isEmptyValue = v == null || (typeof v === 'string' && !v.trim());
      if (isEmptyValue) {
        if (el.tagName === 'SELECT') {
          el.value = '';
        } else if (el.type !== 'file') {
          el.value = '';
          if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'hidden')) {
            if (loanPlaceholders[el.id]) {
              el.placeholder = loanPlaceholders[el.id];
            } else {
              el.placeholder = '—';
            }
          }
        }
        return;
      }
      if (el.type !== 'file') {
        el.value = String(v);
        if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'hidden')) {
          el.placeholder = '';
        }
      }
    });
  }

  setAddressSelects('pbHome');
  setAddressSelects('pbEmp');
  setAddressSelects('pbMail');
  setAddressSelects('spEmp');

  var bankVal = readPayloadValue('pbBankName')
    || readPayloadValue('auto_with_which_bank_s_1')
    || readPayloadValue('auto_with_which_bank_s_2');
  if (Array.isArray(bankVal)) bankVal = bankVal[0] || '';
  setSelectDisplay('pbBankName', bankVal, bankVal);

  var esigFileEl = document.getElementById('buyerESignatureFile');
  if (esigFileEl) {
    esigFileEl.value = row.esignature_filename || row.esignature_url || '';
  }

  var editableLoanIds = {
    loanUnitId: 1,
    loanSellingPrice: 1,
    loanProcessingFee: 1,
    loanAmount: 1,
    loanDownpayment: 1,
    loanReservationFee: 1,
    loanPromoDisc: 1,
    loanOrPrNo: 1,
    loanOrPrDate: 1,
    loanBookingOfficer: 1,
    loanFinancing: 1,
    loanDownpaymentTerm: 1,
    loanTerm: 1
  };

  if (modalBody) {
    modalBody.querySelectorAll('input, select, textarea').forEach(function(el) {
      if (!el || !el.id || el.type === 'hidden') return;
      var allowLoanEdit = (status === 'pending');
      var allowEdit = !!editableLoanIds[el.id] && allowLoanEdit;
      if (el.type === 'file' || el.type === 'checkbox' || el.tagName === 'SELECT') {
        el.disabled = !allowEdit;
        el.classList.toggle('sqh-disabled-field', !allowEdit);
      } else {
        el.disabled = !allowEdit;
        el.readOnly = !allowEdit;
        el.classList.toggle('sqh-disabled-field', !allowEdit);
      }
    });
  }

  var esigBrowseBtn = document.getElementById('buyerESignatureBrowseBtn');
  var esigPicker = document.getElementById('buyerESignaturePicker');
  if (esigBrowseBtn) esigBrowseBtn.disabled = true;
  if (esigPicker) esigPicker.disabled = true;

  var soldBtn = document.getElementById('purchaseFormMarkSoldBtn');
  var rejectBtn = document.getElementById('purchaseFormRejectBtn');
  if (soldBtn) {
    var canMarkSold = !row.is_sold && status !== 'rejected' && status !== 'approved';
    soldBtn.classList.toggle('d-none', !canMarkSold);
    soldBtn.disabled = !canMarkSold;
  }
  if (rejectBtn) {
    var canReject = !row.is_sold && status === 'pending';
    rejectBtn.classList.toggle('d-none', !canReject);
    rejectBtn.disabled = !canReject;
    rejectBtn.dataset.tripId = String(row.trip_id || '');
  }

  var esigImg = document.getElementById('purchaseFormEsigImage');
  var esigEmpty = document.getElementById('purchaseFormEsigEmpty');
  if (esigImg) {
    var esigUrl = row.esignature_url || '';
    if (esigUrl) {
      esigImg.src = esigUrl + (esigUrl.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
      esigImg.style.display = 'block';
      if (esigEmpty) esigEmpty.style.display = 'none';
      esigImg.onerror = function () {
        esigImg.style.display = 'none';
        if (esigEmpty) esigEmpty.style.display = 'flex';
      };
    } else {
      esigImg.removeAttribute('src');
      esigImg.style.display = 'none';
      if (esigEmpty) esigEmpty.style.display = 'flex';
    }
  }

  setTimeout(function () {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('purchaseFormViewModal')).show();
  }, listModal ? 170 : 0);
}

_bind('purchaseFormMarkSoldBtn', 'click', function() {
  if (!_purchaseFormViewState.tripId) return;
  if (!_validateLoanDetailsForApproval()) return;
  var viewEl = document.getElementById('purchaseFormViewModal');
  var soldEl = document.getElementById('purchaseFormSoldConfirmModal');
  _purchaseSoldConfirmState.returnToView = !!(viewEl && viewEl.classList.contains('show'));
  _purchaseSoldConfirmState.actionCompleted = false;
  bootstrap.Modal.getInstance(viewEl)?.hide();
  setTimeout(function () {
    bootstrap.Modal.getOrCreateInstance(soldEl).show();
  }, 160);
});

_bind('purchaseFormRejectBtn', 'click', function() {
  var tripId = this.dataset.tripId || _purchaseFormViewState.tripId;
  if (!tripId) return;
  _openPurchaseFormActionConfirm('reject', tripId);
});

_bind('purchaseFormSoldConfirmBtn', 'click', function() {
  if (!_purchaseFormViewState.tripId) return;
  if (!_validateLoanDetailsForApproval()) return;
  var btn = this;
  var tripId = _purchaseFormViewState.tripId;
  var sellingPriceRaw = (document.getElementById('loanSellingPrice') || {}).value || '';
  var sellingPrice = parseFloat(String(sellingPriceRaw).replace(/[^0-9.]/g, ''));

  btn.disabled = true;
  var oldHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';

  fetch('/agent/trip/' + encodeURIComponent(tripId) + '/mark-bought', {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      selling_price: isNaN(sellingPrice) ? null : sellingPrice,
      note: 'Marked as sold from Purchase Form modal by admin.'
    })
  })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
      if (!res.ok || !res.data || res.data.error) {
        showToast((res.data && res.data.error) || 'Unable to mark this model as sold.', 'danger');
        return;
      }

      _purchaseSoldConfirmState.actionCompleted = true;

      bootstrap.Modal.getInstance(document.getElementById('purchaseFormSoldConfirmModal'))?.hide();
      bootstrap.Modal.getInstance(document.getElementById('purchaseFormViewModal'))?.hide();
      showToast('Model marked as sold successfully.', 'success');

      _purchaseListState.rows = (_purchaseListState.rows || []).map(function(item) {
        if (String(item.trip_id) === String(tripId)) {
          item.is_sold = true;
          item.status = 'sold';
        }
        return item;
      });
      _openPurchaseListForProperty(_purchaseListState.propertyId, _purchaseListState.propertyName);
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
      showToast('Network error while marking model as sold.', 'danger');
    });
});

(function initPurchaseSoldConfirmFallback() {
  var soldEl = document.getElementById('purchaseFormSoldConfirmModal');
  if (!soldEl) return;
  soldEl.addEventListener('hidden.bs.modal', function () {
    if (_purchaseSoldConfirmState.actionCompleted) {
      _purchaseSoldConfirmState.returnToView = false;
      return;
    }
    if (_purchaseSoldConfirmState.returnToView && _purchaseFormViewState.tripId) {
      setTimeout(function () {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('purchaseFormViewModal')).show();
      }, 120);
    }
    _purchaseSoldConfirmState.returnToView = false;
  });
})();

function _openAdminEditPropertyModal(d) {
  if (!d) return;
  _pvmCurrentData = d;
  _editPropId = d.propId;
  var isSoldListing = String(d.propListingStatus || '').toLowerCase() === 'sold';
  var cleanNumericText = function (val, fallback) {
    if (val === undefined || val === null || val === '') return fallback;
    return String(val).replace(/,/g, '');
  };
  var setVal = function (id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  document.getElementById('ep_name').value = d.propName || '';
  var fullLoc = (d.propLocation || '').trim();
  var tailParts = [d.propBarangayName, d.propCitymunName, d.propProvinceName, d.propRegionName]
    .filter(function (x) { return (x || '').trim(); })
    .map(function (x) { return (x || '').trim(); });
  var tail = tailParts.join(', ');
  var lineOnly = fullLoc;
  if (tail) {
    var fullLc = fullLoc.toLowerCase();
    var tailLc = tail.toLowerCase();
    if (fullLc === tailLc) {
      lineOnly = '';
    } else {
      var suffix = ', ' + tail;
      if (fullLc.endsWith(suffix.toLowerCase())) {
        lineOnly = fullLoc.slice(0, fullLoc.length - suffix.length).trim();
      }
    }
  }
  setVal('ep_site_notes', lineOnly);
  setVal('ep_street', d.propStreet || '');
  setVal('ep_block', d.propBlock || '');
  setVal('ep_lot_no', d.propLotNo || '');
  if (!d.propStreet && !d.propBlock && !d.propLotNo && !document.getElementById('ep_site_notes')) {
    setVal('ep_street', lineOnly);
  }
  setVal('ep_location', d.propLocation || '');
  setVal('ep_region', d.propRegion || '');
  setVal('ep_region_code', d.propRegionCode || '');
  setVal('ep_region_name', d.propRegionName || '');
  setVal('ep_province_code', d.propProvinceCode || '');
  setVal('ep_province_name', d.propProvinceName || '');
  setVal('ep_citymun_code', d.propCitymunCode || '');
  setVal('ep_citymun_name', d.propCitymunName || '');
  setVal('ep_barangay_code', d.propBarangayCode || '');
  setVal('ep_barangay_name', d.propBarangayName || '');
  document.getElementById('ep_prop_type').value = d.propType || '';
  document.getElementById('ep_unit_type').value = d.propUnitType || '';
  document.getElementById('ep_price').value = (d.propPrice || '').toString().replace(/,/g, '');
  document.getElementById('ep_promo_discount_rate').value = cleanNumericText(d.propPromoDiscountRate, '0');
  document.getElementById('ep_reservation_fee').value = cleanNumericText(d.propReservationFee, '0');
  document.getElementById('ep_downpayment_rate').value = cleanNumericText(d.propDownpaymentRate, '0');
  document.getElementById('ep_downpayment_terms_months').value = cleanNumericText(d.propDownpaymentTermsMonths, '0');
  document.getElementById('ep_loanable_percentage').value = cleanNumericText(d.propLoanablePercentage, '0');
  document.getElementById('ep_interest_rate').value = cleanNumericText(d.propInterestRate, '8.5');
  document.getElementById('ep_vat_rate').value = cleanNumericText(d.propVatRate, '0');
  document.getElementById('ep_lmf_rate').value = cleanNumericText(d.propLmfRate, '0');
  document.getElementById('ep_bedrooms').value = d.propBedrooms || '0';
  document.getElementById('ep_bathrooms').value = d.propBathrooms || '0';
  document.getElementById('ep_storeys').value = d.propStoreys || '1';
  document.getElementById('ep_floor_area').value = d.propFloorArea || '';
  document.getElementById('ep_lot_area').value = d.propLotArea || '';
  document.getElementById('ep_description').value = d.propDescription || '';
  document.getElementById('ep_subdivision').value = d.propSubdivisionId || '';
  document.getElementById('ep_unit_id').value = d.propUnitId || '';
  _syncPropertyPricingPreview('ep');
  _updateFullPricingBreakdown('ep');

  var listing = (d.propListingStatus || '').toLowerCase();
  var listingBadge = listing === 'sold'
    ? '<span class="sqh-badge badge-not-qualified">Sold</span>'
    : '<span class="sqh-badge badge-qualified">Available</span>';
  document.getElementById('lemStatusBadge').innerHTML = listingBadge;

  var chips = '';
  if (d.propBedrooms) chips += '<span class="pvm-icon-chip"><i class="fas fa-bed me-1"></i>' + d.propBedrooms + ' Bed' + (parseInt(d.propBedrooms) > 1 ? 's' : '') + '</span>';
  if (d.propBathrooms) chips += '<span class="pvm-icon-chip"><i class="fas fa-bath me-1"></i>' + d.propBathrooms + ' Bath' + (parseInt(d.propBathrooms) > 1 ? 's' : '') + '</span>';
  if (d.propStoreys) chips += '<span class="pvm-icon-chip"><i class="fas fa-layer-group me-1"></i>' + d.propStoreys + ' Storey' + (parseInt(d.propStoreys) > 1 ? 's' : '') + '</span>';
  if (d.propFloorArea) chips += '<span class="pvm-icon-chip"><i class="fas fa-ruler-combined me-1"></i>' + d.propFloorArea + ' sqm Floor Area</span>';
  if (d.propLotArea) chips += '<span class="pvm-icon-chip"><i class="fas fa-vector-square me-1"></i>' + d.propLotArea + ' sqm Lot Area</span>';
  if (d.propUnitId) chips += '<span class="pvm-icon-chip"><i class="fas fa-hashtag me-1"></i>Unit ' + d.propUnitId + '</span>';
  document.getElementById('lemIconChips').innerHTML = chips;

  _lemImages = (d.propImages || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  _lemIdx = 0;
  var wrap = document.getElementById('lemImgWrap');
  var holder = document.getElementById('lemImgPlaceholder');
  var img = document.getElementById('lemImg');
  var prev = document.getElementById('lemPrev');
  var next = document.getElementById('lemNext');
  var dots = document.getElementById('lemDots');
  if (_lemImages.length) {
    wrap.style.display = 'block';
    holder.style.display = 'none';
    img.src = '/uploads/' + _lemImages[0];
    img.style.opacity = '1';
    if (_lemImages.length > 1) {
      prev.classList.remove('d-none');
      next.classList.remove('d-none');
      dots.innerHTML = _lemImages.map(function(_, i) {
        return '<span class="sub-preview-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></span>';
      }).join('');
      dots.querySelectorAll('.sub-preview-dot').forEach(function(dot) {
        dot.addEventListener('click', function() { _lemShowSlide(parseInt(this.dataset.idx, 10)); });
      });
    } else {
      prev.classList.add('d-none');
      next.classList.add('d-none');
      dots.innerHTML = '';
    }
  } else {
    wrap.style.display = 'none';
    holder.style.display = 'flex';
    prev.classList.add('d-none');
    next.classList.add('d-none');
    dots.innerHTML = '';
  }

  var imgWrap = document.getElementById('ep_images_wrap');
  imgWrap.innerHTML = '';
  _pendingNewFiles = [];
  document.getElementById('ep_images').value = '';
  document.getElementById('ep_images_filenames').value = '';
  _lemImages.forEach(function(fname) {
    var tile = document.createElement('div');
    tile.className = 'sub-img-tile';
    tile.innerHTML =
      '<img src="/uploads/' + _escHtml(fname) + '" class="sub-img-tile-img" alt="">'
      + '<button type="button" class="sub-img-tile-del" data-fname="' + _escHtml(fname) + '"><i class="fas fa-times"></i></button>'
      + '<input type="hidden" name="existing_img" value="' + _escHtml(fname) + '">';
    imgWrap.appendChild(tile);
  });

  var soldWarn = document.getElementById('editPropSoldWarn');
  if (soldWarn) soldWarn.classList.toggle('d-none', !isSoldListing);

  var editModal = document.getElementById('editPropertyModal');
  if (editModal) {
    editModal.querySelectorAll('.sqh-form-control').forEach(function (el) {
      if (el.id === 'ep_region_select' || el.id === 'ep_province_select' || el.id === 'ep_citymun_select' || el.id === 'ep_barangay_select') {
        return;
      }
      if (el.type === 'hidden') return;
      el.disabled = isSoldListing;
      el.classList.toggle('sqh-disabled-field', isSoldListing);
    });
  }

  ['ep_region_select', 'ep_province_select', 'ep_citymun_select', 'ep_barangay_select'].forEach(function (id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.classList.add('sqh-disabled-field');
  });

  var browseBtn = document.getElementById('ep_images_browse_btn');
  if (browseBtn) browseBtn.disabled = isSoldListing;

  var saveBtn = document.getElementById('editPropBtn');
  if (saveBtn) {
    saveBtn.disabled = isSoldListing;
    saveBtn.classList.toggle('d-none', isSoldListing);
  }

  var closeBtn = document.getElementById('editPropCloseBtn');
  if (closeBtn) {
    closeBtn.textContent = isSoldListing ? 'Close' : 'Cancel';
    closeBtn.classList.toggle('ms-auto', isSoldListing);
  }

  var footerActions = document.getElementById('editPropFooterActions');
  if (footerActions) {
    footerActions.classList.toggle('ms-auto', isSoldListing);
  }

  var delBtnUi = document.getElementById('lemDeleteBtn');
  if (delBtnUi) {
    delBtnUi.disabled = isSoldListing;
    delBtnUi.classList.toggle('d-none', isSoldListing);
  }

  imgWrap.querySelectorAll('.sub-img-tile-del').forEach(function (btn) {
    btn.classList.toggle('d-none', isSoldListing);
    btn.disabled = isSoldListing;
  });

  var delBtn = document.getElementById('lemDeleteBtn');
  if (delBtn) delBtn.dataset.propId = d.propId || '';

  _prefillAdminEditPropertyPsgc({
    regionCode: d.propRegionCode || '',
    regionName: d.propRegionName || '',
    provinceCode: d.propProvinceCode || '',
    provinceName: d.propProvinceName || '',
    citymunCode: d.propCitymunCode || '',
    citymunName: d.propCitymunName || '',
    barangayCode: d.propBarangayCode || '',
    barangayName: d.propBarangayName || ''
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('editPropertyModal')).show();
}

_bind('lemPrev', 'click', function(e) { e.stopPropagation(); _lemShowSlide(_lemIdx - 1); });
_bind('lemNext', 'click', function(e) { e.stopPropagation(); _lemShowSlide(_lemIdx + 1); });

document.addEventListener('click', function(e) {
  if (!document.getElementById('editPropertyModal')) return;
  if (e.target.closest('.pvm-delete-btn') || e.target.closest('.prop-delete-btn')) return;
  if (e.target.closest('.prop-status-toggle') || e.target.closest('.prop-status-menu')) return;
  var viewBtn = e.target.closest('.prop-view-btn-icon');
  var cardClick = e.target.closest('.prop-card-clickable');
  var pendingBtn = e.target.closest('.pvm-full-details-btn');
  var purchaseBtn = e.target.closest('.pvm-purchase-list-btn');
  var purchaseViewBtn = e.target.closest('.purchase-list-view-form-btn');
  var purchaseDeleteBtn = e.target.closest('.purchase-list-delete-form-btn');
  var inModal = !!e.target.closest('#editPropertyModal');
  if (purchaseDeleteBtn) {
    _openPurchaseFormActionConfirm('delete', purchaseDeleteBtn.dataset.tripId);
    return;
  }
  if (purchaseViewBtn) {
    _openPurchaseFormView(purchaseViewBtn.dataset.tripId);
    return;
  }
  if (purchaseBtn && !inModal) {
    var purchaseCard = purchaseBtn.closest('.prop-card-clickable');
    if (purchaseCard) {
      _openPurchaseListForProperty(purchaseCard.dataset.propId, purchaseCard.dataset.propName || 'Property');
    }
    return;
  }
  if (pendingBtn && !inModal) {
    var cardFromBtn = pendingBtn.closest('.prop-card-clickable');
    if (cardFromBtn) {
      _openPendingDetailsForProperty(cardFromBtn.dataset.propId, cardFromBtn.dataset.propName || 'Property');
    }
    return;
  }
  if (viewBtn || cardClick) {
    // Don't open property modal if clicking on editable note
    if (e.target.closest('.editable-note')) {
      return;
    }
    var card = e.target.closest('.prop-card-clickable');
    if (card) _openAdminEditPropertyModal(card.dataset);
  }
});

document.addEventListener('keydown', function(e) {
  var statusToggle = e.target.closest ? e.target.closest('.prop-status-toggle') : null;
  var editableNote = e.target.closest ? e.target.closest('.editable-note') : null;
  
  if (statusToggle) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    statusToggle.click();
  } else if (editableNote && !editableNote.classList.contains('editing')) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    editableNote.click();
  }
});

function _syncAdminEditPropertyLocation() {
  var regionSel = document.getElementById('ep_region_select');
  var provinceSel = document.getElementById('ep_province_select');
  var citySel = document.getElementById('ep_citymun_select');
  var brgySel = document.getElementById('ep_barangay_select');
  function txt(sel) {
    if (!sel || !sel.value || !sel.selectedOptions || !sel.selectedOptions.length) return '';
    return (sel.selectedOptions[0].textContent || '').trim();
  }
  var regionName = txt(regionSel);
  var provinceName = txt(provinceSel);
  var cityName = txt(citySel);
  var brgyName = txt(brgySel);
  var siteNotesEl = document.getElementById('ep_site_notes');
  var streetEl = document.getElementById('ep_street');
  var blockEl = document.getElementById('ep_block');
  var lotEl = document.getElementById('ep_lot_no');
  var line = '';
  if (siteNotesEl) {
    line = (siteNotesEl.value || '').trim();
  } else {
    var street = ((streetEl || {}).value || '').trim();
    var block = ((blockEl || {}).value || '').trim();
    var lot = ((lotEl || {}).value || '').trim();
    if (block && !/^block\b/i.test(block)) block = 'Block ' + block;
    if (lot && !/^lot\b/i.test(lot)) lot = 'Lot ' + lot;
    line = [street, block, lot].filter(Boolean).join(', ');
  }
  var tail = [brgyName, cityName, provinceName, regionName].filter(Boolean).join(', ');
  var loc = [line, tail].filter(Boolean).join(', ');
  var setVal = function (id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('ep_location', loc);
  setVal('ep_region', regionName);
  setVal('ep_region_code', regionSel ? regionSel.value : '');
  setVal('ep_region_name', regionName);
  setVal('ep_province_code', provinceSel ? provinceSel.value : '');
  setVal('ep_province_name', provinceName);
  setVal('ep_citymun_code', citySel ? citySel.value : '');
  setVal('ep_citymun_name', cityName);
  setVal('ep_barangay_code', brgySel ? brgySel.value : '');
  setVal('ep_barangay_name', brgyName);
}

function _listingStatusMeta(status) {
  var s = String(status || 'available').toLowerCase();
  if (s !== 'sold' && s !== 'reserved' && s !== 'available') s = 'available';
  if (s === 'sold') {
    return { value: 'sold', label: 'Sold', badgeClass: 'badge-sold' };
  }
  if (s === 'reserved') {
    return { value: 'reserved', label: 'Reserved', badgeClass: 'badge-conditional' };
  }
  return { value: 'available', label: 'Available', badgeClass: 'badge-qualified' };
}

var _activeListingStatusMenu = null;

function _statusToggleHtml(propId, status) {
  var meta = _listingStatusMeta(status);
  return '<span class="sqh-badge ' + meta.badgeClass + ' prop-status-toggle"'
    + ' role="button" tabindex="0"'
    + ' data-prop-id="' + _escapeHtml(propId || '') + '"'
    + ' data-current-status="' + _escapeHtml(meta.value) + '"'
    + ' title="Change listing status">'
    + _escapeHtml(meta.label)
    + ' <i class="fas fa-caret-down ms-1"></i></span>';
}

function _closeListingStatusMenu() {
  if (_activeListingStatusMenu && _activeListingStatusMenu.parentNode) {
    _activeListingStatusMenu.parentNode.removeChild(_activeListingStatusMenu);
  }
  _activeListingStatusMenu = null;
}

function _editAvailabilityNote(noteEl) {
  if (!noteEl) return;
  
  var propId = String(noteEl.dataset.propId || '').trim();
  if (!propId || !/^\d+$/.test(propId)) {
    showToast('Invalid property ID for note edit.', 'danger');
    return;
  }
  
  var displaySpan = noteEl.querySelector('.note-display');
  if (!displaySpan) return;
  
  var currentText = displaySpan.textContent || '';
  var isEmptyState = !String(noteEl.dataset.customNote || '').trim();
  
  // Enter edit mode
  noteEl.classList.add('editing');
  
  // Create input field
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = currentText === 'Add note' ? '' : currentText;
  input.maxLength = '255';
  input.placeholder = isEmptyState ? 'Add availability note' : 'Edit availability note';
  
  // Replace display span with input, hide edit icon
  displaySpan.style.display = 'none';
  var editIcon = noteEl.querySelector('.edit-icon');
  if (editIcon) editIcon.style.display = 'none';
  noteEl.insertBefore(input, displaySpan);
  input.focus();
  input.select();
  
  // Prevent clicks on input from bubbling (to avoid triggering property view)
  input.addEventListener('click', function(e) {
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  });
  
  var finishEdit = function(save) {
    if (save) {
      // Call API to save
      fetch('/admin/property/' + propId + '/availability-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken()
        },
        body: JSON.stringify({ note: input.value })
      })
      .then(function(r) {
        if (r.status === 403) {
          showToast('You do not have permission to edit this note.', 'danger');
          return Promise.reject();
        }
        var ct = String((r.headers && r.headers.get && r.headers.get('content-type')) || '').toLowerCase();
        if (ct.indexOf('application/json') !== -1) {
          return r.json().then(function(d) {
            return { ok: r.ok, status: r.status, data: d };
          });
        }
        return r.text().then(function(t) {
          showToast('Server error: ' + (t || 'HTTP ' + r.status), 'danger');
          return Promise.reject();
        });
      })
      .then(function(res) {
        if (!res || !res.ok || !res.data || !res.data.success) {
          var msg = (res && res.data && (res.data.error || res.data.message)) || 'Failed to save note.';
          showToast(msg, 'danger');
          return;
        }
        // Exit edit mode successfully
        noteEl.classList.remove('editing');
        var newText = res.data.custom_note || 'Add note';
        noteEl.dataset.customNote = res.data.custom_note || '';
        displaySpan.textContent = newText;
        displaySpan.style.display = '';
        if (editIcon) editIcon.style.display = '';
        if (input.parentNode) input.parentNode.removeChild(input);
        showToast('Availability note saved!', 'success');
      })
      .catch(function(err) {
        // On error, exit edit mode but revert changes
        noteEl.classList.remove('editing');
        displaySpan.style.display = '';
        if (editIcon) editIcon.style.display = '';
        if (input.parentNode) input.parentNode.removeChild(input);
        if (err) {
          var msg = 'Error saving note.';
          if (err.message) msg = msg + ' ' + err.message;
          showToast(msg, 'danger');
        }
      });
    } else {
      // Cancel edit
      noteEl.classList.remove('editing');
      displaySpan.style.display = '';
      if (editIcon) editIcon.style.display = '';
      if (input.parentNode) input.parentNode.removeChild(input);
    }
  };
  
  // Save on Enter, cancel on Escape
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEdit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finishEdit(false);
    }
  });
  
  // Save on blur
  input.addEventListener('blur', function() {
    finishEdit(true);
  });
}

function _openListingStatusMenu(anchorEl, currentStatus, onPick) {
  _closeListingStatusMenu();

  var curr = _listingStatusMeta(currentStatus).value;
  var values = ['available', 'reserved', 'sold'];
  var menu = document.createElement('div');
  menu.className = 'prop-status-menu';
  menu.innerHTML = values.map(function (statusVal) {
    var meta = _listingStatusMeta(statusVal);
    var active = curr === statusVal ? ' is-active' : '';
    return '<button type="button" class="prop-status-menu-item' + active + '" data-status="' + _escapeHtml(meta.value) + '">' + _escapeHtml(meta.label) + '</button>';
  }).join('');

  document.body.appendChild(menu);
  _activeListingStatusMenu = menu;

  var rect = anchorEl.getBoundingClientRect();
  var top = rect.bottom + window.scrollY + 6;
  var left = rect.left + window.scrollX;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';

  var menuRect = menu.getBoundingClientRect();
  var maxRight = window.scrollX + document.documentElement.clientWidth - 8;
  if (left + menuRect.width > maxRight) {
    menu.style.left = Math.max(window.scrollX + 8, maxRight - menuRect.width) + 'px';
  }

  var maxBottom = window.scrollY + document.documentElement.clientHeight - 8;
  if (top + menuRect.height > maxBottom) {
    menu.style.top = Math.max(window.scrollY + 8, (rect.top + window.scrollY) - menuRect.height - 6) + 'px';
  }

  menu.addEventListener('click', function (evt) {
    var opt = evt.target.closest('.prop-status-menu-item');
    if (!opt) return;
    var picked = String(opt.dataset.status || '').toLowerCase();
    _closeListingStatusMenu();
    if (picked) onPick(picked);
  });
}

function _propModelKeyFromCard(card) {
  if (!card) return '';
  var key = String(card.dataset.propModelKey || '').trim();
  if (key) return key;
  var subdivisionId = String(card.dataset.propSubdivisionId || '').trim();
  var modelName = String(card.dataset.propName || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return subdivisionId + ':' + modelName;
}

function _refreshAvailabilityNotes() {
  var cards = Array.prototype.slice.call(document.querySelectorAll('#page-properties .prop-card-clickable'));
  if (!cards.length) return;

  cards.forEach(function(card) {
    var status = String(card.dataset.propListingStatus || 'available').toLowerCase();
    var customNote = String(card.dataset.propCustomAvailabilityNote || '').trim();

    var body = card.querySelector('.prop-card-body');
    if (!body) return;
    var noteEl = body.querySelector('.prop-availability-note');

    if (status === 'available') {
      if (!noteEl) {
        var header = body.querySelector('.prop-card-header');
        if (header) {
          header.insertAdjacentHTML('afterend', '<div class="prop-availability-note editable-note" role="button" tabindex="0" data-prop-id="' + _escapeHtml(card.dataset.propId || '') + '" data-custom-note=""><span class="note-display">Add note</span><i class="fas fa-edit edit-icon ms-1" style="opacity: 0; transition: opacity 0.2s;"></i></div>');
          noteEl = body.querySelector('.prop-availability-note');
        }
      }
      if (noteEl) {
        var displaySpan = noteEl.querySelector('.note-display');
        if (displaySpan) displaySpan.textContent = customNote || 'Add note';
        noteEl.dataset.customNote = customNote;
        noteEl.classList.toggle('empty-note', !customNote);
        noteEl.title = customNote ? 'Click to edit availability note' : 'Click to add availability note';
        var editIcon = noteEl.querySelector('.edit-icon');
        if (editIcon) editIcon.style.display = '';
      }
    } else if (noteEl) {
      noteEl.remove();
    }
  });
}

function _syncListingStatusCard(card, nextStatus) {
  if (!card) return;
  var meta = _listingStatusMeta(nextStatus);
  card.dataset.propListingStatus = meta.value;

  var col = card.closest('.prop-card-col');
  if (col) col.dataset.status = meta.value;

  var bodyHeader = card.querySelector('.prop-card-body .prop-card-header');
  if (bodyHeader) {
    var oldToggle = bodyHeader.querySelector('.prop-status-toggle') || bodyHeader.querySelector('.sqh-badge');
    if (oldToggle) {
      oldToggle.outerHTML = _statusToggleHtml(card.dataset.propId || '', meta.value);
    } else {
      bodyHeader.insertAdjacentHTML('beforeend', _statusToggleHtml(card.dataset.propId || '', meta.value));
    }
  }

  var actionsWrap = card.querySelector('.prop-card-actions');
  if (actionsWrap) {
    var propId = card.dataset.propId || '';
    var html = '<button type="button" class="sub-card-action-btn prop-view-btn-icon" title="View details"><i class="fas fa-eye"></i></button>';
    if (meta.value !== 'sold') {
      html += '<button type="button" class="sub-card-action-btn sub-card-action-delete pvm-delete-btn" data-prop-id="' + _escapeHtml(propId) + '" title="Delete"><i class="fas fa-trash"></i></button>';
    }
    actionsWrap.innerHTML = html;
  }

  _refreshAvailabilityNotes();
}

function initAdminEditPropertyPsgc() {
  var regionSel = document.getElementById('ep_region_select');
  var provinceSel = document.getElementById('ep_province_select');
  var citySel = document.getElementById('ep_citymun_select');
  var brgySel = document.getElementById('ep_barangay_select');
  if (!regionSel || !provinceSel || !citySel || !brgySel) return;

  regionSel.addEventListener('change', function () {
    if (!regionSel.value) {
      _subResetSelect(provinceSel, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncAdminEditPropertyLocation();
      return;
    }
    _subGetItems('/api/psgc/provinces?region_code=' + encodeURIComponent(regionSel.value))
      .then(function (items) {
        _subFillSelect(provinceSel, items, '-- Select --');
        _subResetSelect(citySel, '-- Select --');
        _subResetSelect(brgySel, '-- Select --');
        _syncAdminEditPropertyLocation();
      });
  });

  provinceSel.addEventListener('change', function () {
    if (!provinceSel.value && !regionSel.value) return;
    var q = provinceSel.value
      ? ('province_code=' + encodeURIComponent(provinceSel.value))
      : ('region_code=' + encodeURIComponent(regionSel.value));
    _subGetItems('/api/psgc/cities?' + q)
      .then(function (items) {
        _subFillSelect(citySel, items, '-- Select --');
        _subResetSelect(brgySel, '-- Select --');
        _syncAdminEditPropertyLocation();
      });
  });

  citySel.addEventListener('change', function () {
    if (!citySel.value) {
      _subResetSelect(brgySel, '-- Select --');
      _syncAdminEditPropertyLocation();
      return;
    }
    _subGetItems('/api/psgc/barangays?city_mun_code=' + encodeURIComponent(citySel.value))
      .then(function (items) {
        _subFillSelect(brgySel, items, '-- Select --');
        _syncAdminEditPropertyLocation();
      });
  });

  brgySel.addEventListener('change', _syncAdminEditPropertyLocation);
  _bind('ep_site_notes', 'input', _syncAdminEditPropertyLocation);
  _bind('ep_street', 'input', _syncAdminEditPropertyLocation);
  _bind('ep_block', 'input', _syncAdminEditPropertyLocation);
  _bind('ep_lot_no', 'input', _syncAdminEditPropertyLocation);

  _subGetItems('/api/psgc/regions').then(function (items) {
    _subFillSelect(regionSel, items, '-- Select --');
  });
}
initAdminEditPropertyPsgc();

function _prefillAdminEditPropertyPsgc(codes) {
  var regionSel = document.getElementById('ep_region_select');
  var provinceSel = document.getElementById('ep_province_select');
  var citySel = document.getElementById('ep_citymun_select');
  var brgySel = document.getElementById('ep_barangay_select');
  if (!regionSel || !provinceSel || !citySel || !brgySel) return;

  var regionCode = (codes && codes.regionCode) || '';
  var regionName = (codes && codes.regionName) || '';
  var provinceCode = (codes && codes.provinceCode) || '';
  var provinceName = (codes && codes.provinceName) || '';
  var citymunCode = (codes && codes.citymunCode) || '';
  var citymunName = (codes && codes.citymunName) || '';
  var barangayCode = (codes && codes.barangayCode) || '';
  var barangayName = (codes && codes.barangayName) || '';

  function seedSelect(sel, code, name) {
    if (!sel) return;
    _subResetSelect(sel, '-- Select --');
    if (!code || !name) return;
    var opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    sel.appendChild(opt);
    sel.value = code;
  }

  seedSelect(regionSel, regionCode, regionName);
  seedSelect(provinceSel, provinceCode, provinceName);
  seedSelect(citySel, citymunCode, citymunName);
  seedSelect(brgySel, barangayCode, barangayName);
  _syncAdminEditPropertyLocation();

  return _subGetItems('/api/psgc/regions').then(function (regions) {
    _subFillSelect(regionSel, regions, '-- Select --', regionCode);
    if (!regionCode) {
      _subResetSelect(provinceSel, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncAdminEditPropertyLocation();
      return Promise.resolve();
    }
    return _subGetItems('/api/psgc/provinces?region_code=' + encodeURIComponent(regionCode)).then(function (provinces) {
      _subFillSelect(provinceSel, provinces, '-- Select --', provinceCode);
      var cityQ = provinceCode
        ? ('province_code=' + encodeURIComponent(provinceCode))
        : ('region_code=' + encodeURIComponent(regionCode));
      return _subGetItems('/api/psgc/cities?' + cityQ).then(function (cities) {
        _subFillSelect(citySel, cities, '-- Select --', citymunCode);
        if (!citymunCode) {
          _subResetSelect(brgySel, '-- Select --');
          _syncAdminEditPropertyLocation();
          return Promise.resolve();
        }
        return _subGetItems('/api/psgc/barangays?city_mun_code=' + encodeURIComponent(citymunCode)).then(function (barangays) {
          _subFillSelect(brgySel, barangays, '-- Select --', barangayCode);
          _syncAdminEditPropertyLocation();
        });
      });
    });
  }).catch(function () {
    _syncAdminEditPropertyLocation();
  });
}

_bind('ep_images_wrap', 'click', function(e) {
  var btn = e.target.closest('.sub-img-tile-del');
  if (!btn) return;
  var tile = btn.closest('.sub-img-tile');
  if (!tile) return;
  var newIdx = tile.dataset.newIdx;
  if (newIdx !== undefined) _pendingNewFiles[parseInt(newIdx, 10)] = null;
  tile.remove();
});

_bind('ep_images', 'change', function() {
  var files = this.files;
  if (!files || !files.length) return;
  var wrap = document.getElementById('ep_images_wrap');
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var idx = _pendingNewFiles.length;
    _pendingNewFiles.push(f);
    var url = URL.createObjectURL(f);
    var tile = document.createElement('div');
    tile.className = 'sub-img-tile';
    tile.dataset.newIdx = idx;
    tile.innerHTML = '<img src="' + url + '" class="sub-img-tile-img" alt=""><button type="button" class="sub-img-tile-del"><i class="fas fa-times"></i></button>';
    wrap.appendChild(tile);
  }
  document.getElementById('ep_images_filenames').value = _pendingNewFiles.filter(Boolean).map(function(f) { return f.name; }).join(', ');
});

_bind('editPropBtn', 'click', function() {
  if (!_editPropId) return;
  var errEl = document.getElementById('editPropError');
  if (errEl) { errEl.textContent = ''; errEl.classList.add('d-none'); }

  _syncAdminEditPropertyLocation();

  var name = (document.getElementById('ep_name').value || '').trim();
  var unitId = (document.getElementById('ep_unit_id').value || '').trim();
  var siteNotesEl = document.getElementById('ep_site_notes');
  var fallbackLine = siteNotesEl ? (siteNotesEl.value || '').trim() : '';
  var location = (document.getElementById('ep_location').value || '').trim() || fallbackLine;
  var unitType = (document.getElementById('ep_unit_type').value || '').trim();
  var price = (document.getElementById('ep_price').value || '').trim();
  if (!name || !unitId || !unitType || !price) {
    if (errEl) {
      errEl.textContent = 'Name, unit ID, unit type, and price are required.';
      errEl.classList.remove('d-none');
    }
    return;
  }

  var btn = this;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';
  var fd = new FormData();
  fd.append('name', name);
  fd.append('region', (document.getElementById('ep_region').value || '').trim());
  fd.append('region_code', (document.getElementById('ep_region_code').value || '').trim());
  fd.append('region_name', (document.getElementById('ep_region_name').value || '').trim());
  fd.append('province_code', (document.getElementById('ep_province_code').value || '').trim());
  fd.append('province_name', (document.getElementById('ep_province_name').value || '').trim());
  fd.append('citymun_code', (document.getElementById('ep_citymun_code').value || '').trim());
  fd.append('citymun_name', (document.getElementById('ep_citymun_name').value || '').trim());
  fd.append('barangay_code', (document.getElementById('ep_barangay_code').value || '').trim());
  fd.append('barangay_name', (document.getElementById('ep_barangay_name').value || '').trim());
  fd.append('street', (document.getElementById('ep_street').value || '').trim());
  fd.append('block', (document.getElementById('ep_block').value || '').trim());
  fd.append('lot_no', (document.getElementById('ep_lot_no').value || '').trim());
  fd.append('unit_type', unitType);
  fd.append('price', price);
  fd.append('promo_discount_rate', document.getElementById('ep_promo_discount_rate').value || '0');
  fd.append('reservation_fee', document.getElementById('ep_reservation_fee').value || '0');
  fd.append('downpayment_rate', document.getElementById('ep_downpayment_rate').value || '0');
  fd.append('downpayment_terms_months', document.getElementById('ep_downpayment_terms_months').value || '0');
  fd.append('loanable_percentage', document.getElementById('ep_loanable_percentage').value || '0');
  fd.append('interest_rate', document.getElementById('ep_interest_rate').value || '8.5');
  fd.append('vat_rate', document.getElementById('ep_vat_rate').value || '0');
  fd.append('lmf_rate', document.getElementById('ep_lmf_rate').value || '0');
  fd.append('bedrooms', document.getElementById('ep_bedrooms').value || '0');
  fd.append('bathrooms', document.getElementById('ep_bathrooms').value || '0');
  fd.append('storeys', document.getElementById('ep_storeys').value || '1');
  fd.append('floor_area', document.getElementById('ep_floor_area').value || '');
  fd.append('lot_area', document.getElementById('ep_lot_area').value || '');
  fd.append('subdivision_id', document.getElementById('ep_subdivision').value || '');
  fd.append('unit_id', document.getElementById('ep_unit_id').value || '');
  fd.append('description', document.getElementById('ep_description').value || '');
  document.querySelectorAll('#ep_images_wrap input[name="existing_img"]').forEach(function(inp) {
    fd.append('existing_images', inp.value);
  });
  var original = (_pvmCurrentData && _pvmCurrentData.propImages ? _pvmCurrentData.propImages : '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var kept = [];
  document.querySelectorAll('#ep_images_wrap input[name="existing_img"]').forEach(function(inp) { kept.push(inp.value); });
  original.forEach(function(fname) {
    if (kept.indexOf(fname) === -1) fd.append('remove_images', fname);
  });
  _pendingNewFiles.filter(Boolean).forEach(function(f) { fd.append('images', f); });
  fd.append('csrf_token', csrfToken());

  fetch('/agent/property/' + encodeURIComponent(_editPropId) + '/edit', { method: 'POST', body: fd })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i> Save Changes';
      if (!res.ok || !res.data || res.data.error) {
        if (errEl) {
          errEl.textContent = (res.data && res.data.error) || 'Failed to save property.';
          errEl.classList.remove('d-none');
        }
        return;
      }
      bootstrap.Modal.getInstance(document.getElementById('editPropertyModal'))?.hide();
      showToast('Property updated successfully.', 'success');
      setTimeout(function() { window.location.reload(); }, 250);
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i> Save Changes';
      if (errEl) {
        errEl.textContent = 'Network error while saving property.';
        errEl.classList.remove('d-none');
      }
    });
});

function _pendingDetailsStatusBadge(status) {
  status = (status || '').toLowerCase();
  if (status === 'approved') return '<span class="sqh-badge badge-qualified">Approved</span>';
  if (status === 'rejected') return '<span class="sqh-badge badge-not-qualified">Rejected</span>';
  return '<span class="sqh-badge badge-pending">Pending</span>';
}

function _loadPendingDetailsRequests() {
  var propId = _pendingDetailsState.propertyId;
  if (!propId) return;
  var bodyEl = document.getElementById('pendingDetailsTableBody');
  var emptyEl = document.getElementById('pendingDetailsEmpty');
  var summaryEl = document.getElementById('pendingDetailsSummary');
  if (bodyEl) bodyEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Loading…</td></tr>';
  if (summaryEl) summaryEl.textContent = 'Loading requests…';

  fetch('/agent/property/' + encodeURIComponent(propId) + '/full-detail-requests', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      if (!res.ok || !res.data || !res.data.ok) {
        if (bodyEl) bodyEl.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Failed to load requests.</td></tr>';
        if (summaryEl) summaryEl.textContent = 'Unable to load requests';
        return;
      }
      var rows = Array.isArray(res.data.requests) ? res.data.requests : [];
      if (summaryEl) summaryEl.textContent = rows.length + ' request' + (rows.length === 1 ? '' : 's');
      if (emptyEl) emptyEl.classList.toggle('d-none', rows.length > 0);
      if (!bodyEl) return;
      if (!rows.length) {
        bodyEl.innerHTML = '';
        return;
      }
      bodyEl.innerHTML = rows.map(function(row) {
        var status = (row.status || '').toLowerCase();
        var note = row.agent_note ? _escHtml(row.agent_note) : '—';
        var actions = '';
        if (status === 'pending' && row.request_id) {
          actions += '<button type="button" class="btn btn-sm btn-lime me-1 pd-approve-btn" data-request-id="' + row.request_id + '"><i class="fas fa-check"></i></button>';
          actions += '<button type="button" class="btn btn-sm btn-outline-crimson pd-reject-btn" data-request-id="' + row.request_id + '"><i class="fas fa-times"></i></button>';
        } else if (status === 'approved' || status === 'rejected') {
          actions += '<button type="button" class="btn btn-sm btn-outline-crimson pd-delete-btn" data-history-id="' + row.id + '"><i class="fas fa-trash"></i></button>';
        } else {
          actions = '<span class="text-muted small">—</span>';
        }
        return '<tr>'
          + '<td class="fw-semibold">' + _escHtml(row.client_name || 'Client') + '</td>'
          + '<td>' + _escHtml(row.created_at || '—') + '</td>'
          + '<td>' + _pendingDetailsStatusBadge(status) + '</td>'
          + '<td class="small">' + note + '</td>'
          + '<td>' + actions + '</td>'
          + '</tr>';
      }).join('');
    })
    .catch(function() {
      if (bodyEl) bodyEl.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Network error while loading requests.</td></tr>';
      if (summaryEl) summaryEl.textContent = 'Unable to load requests';
    });
}

document.addEventListener('click', function(e) {
  var approveBtn = e.target.closest('.pd-approve-btn');
  var rejectBtn = e.target.closest('.pd-reject-btn');
  var deleteBtn = e.target.closest('.pd-delete-btn');
  if (!approveBtn && !rejectBtn && !deleteBtn) return;

  var iconEl = document.getElementById('pendingDetailsConfirmIcon');
  var titleEl = document.getElementById('pendingDetailsConfirmTitle');
  var descEl = document.getElementById('pendingDetailsConfirmDesc');
  var noteWrap = document.getElementById('pendingDetailsConfirmNoteWrap');
  var noteEl = document.getElementById('pendingDetailsConfirmNote');
  var confirmBtn = document.getElementById('pendingDetailsConfirmBtn');
  if (!iconEl || !titleEl || !descEl || !noteWrap || !confirmBtn) return;

  _pendingDetailsState.action = approveBtn ? 'approve' : (rejectBtn ? 'reject' : 'delete');
  _pendingDetailsState.requestId = approveBtn ? approveBtn.dataset.requestId : (rejectBtn ? rejectBtn.dataset.requestId : null);
  _pendingDetailsState.historyId = deleteBtn ? deleteBtn.dataset.historyId : null;

  if (_pendingDetailsState.action === 'approve') {
    iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
    iconEl.style.color = 'var(--clr-accent-dk)';
    titleEl.textContent = 'Approve this detail request?';
    descEl.textContent = 'The client will be notified that full pending details were approved.';
    noteWrap.classList.remove('d-none');
    if (noteEl) noteEl.value = '';
    confirmBtn.className = 'btn btn-lime px-4';
    confirmBtn.innerHTML = '<i class="fas fa-check me-1"></i>Approve';
  } else if (_pendingDetailsState.action === 'reject') {
    iconEl.innerHTML = '<i class="fas fa-times-circle"></i>';
    iconEl.style.color = 'var(--clr-primary)';
    titleEl.textContent = 'Reject this detail request?';
    descEl.textContent = 'The client will be notified that full pending details were rejected.';
    noteWrap.classList.remove('d-none');
    if (noteEl) noteEl.value = '';
    confirmBtn.className = 'btn btn-crimson px-4';
    confirmBtn.innerHTML = '<i class="fas fa-times me-1"></i>Reject';
  } else {
    iconEl.innerHTML = '<i class="fas fa-trash"></i>';
    iconEl.style.color = 'var(--clr-primary)';
    titleEl.textContent = 'Delete this request record?';
    descEl.textContent = 'Only decided requests can be deleted. This cannot be undone.';
    noteWrap.classList.add('d-none');
    confirmBtn.className = 'btn btn-crimson px-4';
    confirmBtn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
  }

  var listModalEl = document.getElementById('pendingDetailsModal');
  var listModal = bootstrap.Modal.getInstance(listModalEl);
  if (listModal) listModal.hide();
  setTimeout(function() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('pendingDetailsConfirmModal')).show();
  }, 180);
});

_bind('pendingDetailsConfirmBtn', 'click', function() {
  if (!_pendingDetailsState.action) return;
  var btn = this;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing…';
  var action = _pendingDetailsState.action;
  var endpoint = '';
  var options = { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } };

  if (action === 'approve' || action === 'reject') {
    endpoint = '/agent/full-details-request/' + encodeURIComponent(_pendingDetailsState.requestId) + '/' + action;
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ note: (document.getElementById('pendingDetailsConfirmNote').value || '').trim() });
  } else {
    endpoint = '/agent/full-details-history/' + encodeURIComponent(_pendingDetailsState.historyId) + '/delete';
  }

  fetch(endpoint, options)
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      btn.disabled = false;
      if (action === 'approve') btn.innerHTML = '<i class="fas fa-check me-1"></i>Approve';
      else if (action === 'reject') btn.innerHTML = '<i class="fas fa-times me-1"></i>Reject';
      else btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';

      if (!res.ok || !res.data || res.data.ok === false || res.data.error) {
        showToast((res.data && (res.data.error || res.data.detail)) || 'Unable to process request.', 'danger');
        return;
      }

      bootstrap.Modal.getInstance(document.getElementById('pendingDetailsConfirmModal'))?.hide();
      if (action === 'approve') showToast('Detail request approved and client notified.', 'success');
      else if (action === 'reject') showToast('Detail request rejected and client notified.', 'info');
      else showToast('Detail request record deleted.', 'success');
      _pendingDetailsState.action = null;
      _pendingDetailsState.requestId = null;
      _pendingDetailsState.historyId = null;
      _loadPendingDetailsRequests();
    })
    .catch(function() {
      btn.disabled = false;
      if (action === 'approve') btn.innerHTML = '<i class="fas fa-check me-1"></i>Approve';
      else if (action === 'reject') btn.innerHTML = '<i class="fas fa-times me-1"></i>Reject';
      else btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
      showToast('Network error while processing request.', 'danger');
    });
});

var _pendingDetailsConfirmModalEl = document.getElementById('pendingDetailsConfirmModal');
if (_pendingDetailsConfirmModalEl) {
  _pendingDetailsConfirmModalEl.addEventListener('hidden.bs.modal', function() {
    if (_pendingDetailsState.propertyId) {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('pendingDetailsModal')).show();
    }
  });
}

// Approve / reject / delete triggered from inside the view modal or card
document.addEventListener('click', function(e) {
  var approveBtn = e.target.closest('.pvm-approve-btn');
  var rejectBtn  = e.target.closest('.pvm-reject-btn');
  var deleteBtn  = e.target.closest('.pvm-delete-btn') || e.target.closest('.prop-delete-btn');
  if (!approveBtn && !rejectBtn && !deleteBtn) return;

  var propId = (approveBtn || rejectBtn || deleteBtn).dataset.propId;
  _propApprovalPending.propId  = propId;

  var viewModalInstance = bootstrap.Modal.getInstance(document.getElementById('editPropertyModal'));
  if (viewModalInstance) viewModalInstance.hide();

  var iconEl    = document.getElementById('propApprovalIcon');
  var titleEl   = document.getElementById('propApprovalTitle');
  var descEl    = document.getElementById('propApprovalDesc');
  var confirmEl = document.getElementById('propApprovalConfirmBtn');

  if (deleteBtn) {
    _propApprovalPending.action = 'delete';
    iconEl.innerHTML    = '<i class="fas fa-trash" style="color:var(--clr-primary);"></i>';
    titleEl.textContent = 'Delete this property?';
    descEl.textContent  = 'This will permanently remove the listing and all its images. This cannot be undone.';
    confirmEl.className = 'btn btn-crimson px-4';
    confirmEl.innerHTML = '<i class="fas fa-trash me-1"></i> Delete';
  } else if (approveBtn) {
    _propApprovalPending.action = 'approve';
    iconEl.innerHTML    = '<i class="fas fa-check-circle" style="color: var(--clr-accent);"></i>';
    titleEl.textContent = 'Approve this property?';
    descEl.textContent  = 'This property will be released and visible on the website for clients.';
    confirmEl.className = 'btn btn-lime px-4';
    confirmEl.innerHTML = '<i class="fas fa-check me-1"></i> Approve';
  } else {
    _propApprovalPending.action = 'reject';
    iconEl.innerHTML    = '<i class="fas fa-times-circle" style="color:var(--clr-primary);"></i>';
    titleEl.textContent = 'Reject this property?';
    descEl.textContent  = 'This property will not be published. The agent can resubmit after corrections.';
    confirmEl.className = 'btn btn-crimson px-4';
    confirmEl.innerHTML = '<i class="fas fa-times me-1"></i> Reject';
  }

  setTimeout(function() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('propApprovalModal')).show();
  }, 250);
});

/* ── Notification Dropdown ──────────────────────────────────── */
(function() {
  var wrap = document.getElementById('dashNotifWrap');
  var btn  = document.getElementById('dashNotifBtn');
  var dropdown = document.getElementById('dashNotifDropdown');
  if (!wrap || !btn || !dropdown) return;

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', function(e) {
    if (!wrap.contains(e.target)) {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  wrap.querySelectorAll('.dash-notif-item[data-goto-page]').forEach(function(item) {
    item.addEventListener('click', function(e) {
      if (e.target.closest('.dash-notif-read-btn')) return;
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      var pageId = this.dataset.gotoPage;
      if (typeof showPage === 'function') showPage(pageId);
    });
  });
})();

/* ── Notification mark-as-read ──────────────────────────────── */
function _notifShowEmpty() {
  var body = document.getElementById('dashNotifBody');
  if (!body) return;
  var totalItems = body.querySelectorAll('.dash-notif-item').length;
  if (totalItems === 0) {
    body.innerHTML = '<div class="dash-notif-empty">'
      + '<i class="fas fa-check-circle" style="color:var(--clr-accent);font-size:1.6rem;"></i>'
      + '<span>All caught up!</span>'
      + '</div>';
  }
}
function _notifUpdateBadge() {
  var body = document.getElementById('dashNotifBody');
  var remaining = body
    ? body.querySelectorAll('.dash-notif-item:not([data-notif-read="true"])').length
    : 0;
  var badge = document.getElementById('dashNotifBadge');
  var pill  = document.getElementById('dashNotifPill');
  var readAllBtn = document.getElementById('dashNotifReadAll');
  if (badge) {
    badge.textContent = remaining;
    remaining === 0 ? badge.classList.add('d-none') : badge.classList.remove('d-none');
  }
  if (pill) {
    if (remaining === 0) pill.style.display = 'none';
    else pill.textContent = remaining + ' unread';
  }
  if (readAllBtn && remaining === 0) readAllBtn.style.display = 'none';
}
function _markNotifItemRead(item) {
  if (!item || item.dataset.notifRead === 'true') return;
  item.dataset.notifRead = 'true';
  item.classList.add('notif-read');
  // Persist read state to localStorage
  var notifType = item.dataset.notifType;
  var notifId   = item.dataset.notifId;
  if (notifType && notifId) {
    var _layout = document.querySelector('.dashboard-layout');
    var _uid    = (_layout && _layout.dataset && _layout.dataset.userId) || 'default';
    try {
      var _lsKey = 'sqhAdminNotifRead:' + _uid;
      var _lsSet = new Set(JSON.parse(localStorage.getItem(_lsKey) || '[]'));
      _lsSet.add(notifType + '-' + notifId);
      localStorage.setItem(_lsKey, JSON.stringify(Array.from(_lsSet)));
    } catch (_) {}
  }
  var readBtn = item.querySelector('.dash-notif-read-btn');
  if (readBtn && readBtn.parentNode) {
    var badge = document.createElement('span');
    badge.className = 'dash-notif-read-badge';
    badge.innerHTML = '<i class="fas fa-check-double"></i>';
    readBtn.parentNode.replaceChild(badge, readBtn);
  }
  _notifUpdateBadge();
}
function _isAdminNotifContext() {
  var layout = document.querySelector('.dashboard-layout');
  if (layout && layout.dataset && layout.dataset.role) {
    return layout.dataset.role === 'admin';
  }
  return !!document.getElementById('adminSidebar');
}
// Restore admin notification read state from localStorage on page load
(function initAdminNotifReadState() {
  if (!_isAdminNotifContext()) return;
  var body = document.getElementById('dashNotifBody');
  if (!body) return;
  var layout = document.querySelector('.dashboard-layout');
  var userId = (layout && layout.dataset && layout.dataset.userId) || 'default';
  try {
    var readSet = new Set(JSON.parse(localStorage.getItem('sqhAdminNotifRead:' + userId) || '[]'));
    body.querySelectorAll('.dash-notif-item[data-notif-type][data-notif-id]').forEach(function (item) {
      if (readSet.has(item.dataset.notifType + '-' + item.dataset.notifId)) _markNotifItemRead(item);
    });
  } catch (_) {}
})();
document.addEventListener('click', function(e) {
  if (!_isAdminNotifContext()) return;
  var readBtn = e.target.closest('.dash-notif-read-btn');
  if (readBtn) {
    var _notifItem = readBtn.closest('.dash-notif-item');
    if (_notifItem && _notifItem.dataset.tripId) return; // agent_dashboard.js handles trip notifications
    e.stopPropagation();
    var notifType = _notifItem ? _notifItem.dataset.notifType : null;
    var notifId   = _notifItem ? parseInt(_notifItem.dataset.notifId, 10) : null;
    _markNotifItemRead(_notifItem);
    if (notifType && notifId) {
      fetch('/admin/notif/dismiss', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrfToken()},
        body: JSON.stringify({type: notifType, id: notifId})
      });
    }
    return;
  }
  var readAll = e.target.closest('#dashNotifReadAll');
  if (readAll) {
    e.stopPropagation();
    var body = document.getElementById('dashNotifBody');
    if (body) {
      body.querySelectorAll('.dash-notif-item').forEach(function(item) {
        _markNotifItemRead(item);
      });
    }
    fetch('/admin/notif/dismiss', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrfToken()},
      body: JSON.stringify({dismiss_all: true})
    });
  }
});

/* ── Toast notification helper ──────────────────────────────── */
function showToast(message, type) {
  var container = document.getElementById('sqhToastContainer');
  if (!container) return;
  type = type || 'success';
  var icons = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
  var colors = { success: 'var(--clr-accent-dk,#2e7d32)', danger: 'var(--clr-primary,#8b1a1a)', info: 'var(--clr-blue,#1a26a0)', warning: '#b36200' };
  var toast = document.createElement('div');
  toast.className = 'sqh-toast sqh-toast-' + type;
  toast.innerHTML = '<i class="fas ' + (icons[type] || icons.success) + ' me-2" style="color:' + (colors[type] || colors.success) + ';flex-shrink:0;"></i><span>' + message + '</span><button class="sqh-toast-close" aria-label="Close">&times;</button>';
  toast.querySelector('.sqh-toast-close').addEventListener('click', function () { dismissToast(toast); });
  container.appendChild(toast);
  void toast.offsetWidth;
  toast.classList.add('sqh-toast-show');
  var timer = setTimeout(function () { dismissToast(toast); }, 4500);
  toast._sqhTimer = timer;
}
function dismissToast(toast) {
  clearTimeout(toast._sqhTimer);
  toast.classList.remove('sqh-toast-show');
  toast.classList.add('sqh-toast-hide');
  setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
}

/* ── Qualification Reports Page ─────────────────────────────── */
(function () {
  var rptSearch = document.getElementById('rptSearch');
  var rptFilter = document.getElementById('rptFilterStatus');
  function filterRptTable() {
    var q = rptSearch ? rptSearch.value.toLowerCase() : '';
    var s = rptFilter ? rptFilter.value : '';
    var visibleCount = 0;
    document.querySelectorAll('#reportsTable tbody tr[data-status]').forEach(function (row) {
      var name   = (row.querySelector('.rpt-name') || {textContent: ''}).textContent.toLowerCase();
      var status = row.dataset.status || '';
      var show = (!q || name.includes(q)) && (!s || status === s);
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    var noResults = document.getElementById('reportsNoResults');
    if (noResults) noResults.classList.toggle('d-none', visibleCount > 0);
  }
  if (rptSearch) rptSearch.addEventListener('input', filterRptTable);
  if (rptFilter) rptFilter.addEventListener('change', filterRptTable);
})();

document.getElementById('topbarAvatar') && document.getElementById('topbarAvatar').addEventListener('click', function () {
  if (typeof showPage === 'function') showPage('profile');
});

var _activityDeleteBtn = null;

document.addEventListener('click', function (e) {
  var btn = e.target.closest('.activity-delete-btn');
  var statusToggle = e.target.closest('.prop-status-toggle');
  var editableNote = e.target.closest('.editable-note');
  
  if (!statusToggle && _activeListingStatusMenu && !e.target.closest('.prop-status-menu')) {
    _closeListingStatusMenu();
  }
  
  // Handle editable availability note click
  if (editableNote && !editableNote.classList.contains('editing')) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    _editAvailabilityNote(editableNote);
    return;
  }
  
  if (statusToggle) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    var cardForStatus = statusToggle.closest('.prop-card-clickable');
    if (!cardForStatus) return;
    var propIdForStatus = cardForStatus.dataset.propId || statusToggle.dataset.propId;
    if (!propIdForStatus || !/^\d+$/.test(String(propIdForStatus))) {
      showToast('Invalid property id for status update.', 'danger');
      return;
    }

    var currentStatus = String(statusToggle.dataset.currentStatus || cardForStatus.dataset.propListingStatus || 'available').toLowerCase();
    _openListingStatusMenu(statusToggle, currentStatus, function(nextStatus) {
      if (nextStatus !== 'available' && nextStatus !== 'reserved' && nextStatus !== 'sold') return;
      if (nextStatus === currentStatus) return;

      fetch('/admin/property/' + propIdForStatus + '/listing-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken()
        },
        body: JSON.stringify({ status: nextStatus })
      })
      .then(function(r) {
        var ct = String((r.headers && r.headers.get && r.headers.get('content-type')) || '').toLowerCase();
        if (ct.indexOf('application/json') !== -1) {
          return r.json().then(function(d) {
            return { ok: r.ok, status: r.status, data: d, nonJsonText: '' };
          });
        }
        return r.text().then(function(t) {
          return { ok: r.ok, status: r.status, data: null, nonJsonText: t || '' };
        });
      })
      .then(function(res) {
        if (!res.ok || !res.data || !res.data.success) {
          var err = (res.data && (res.data.error || res.data.message)) || '';
          if (!err && !res.data) {
            err = 'Server returned HTTP ' + String(res.status || 0) + ' for listing status update.';
          }
          showToast(err || 'Unable to update listing status.', 'danger');
          return;
        }
        _syncListingStatusCard(cardForStatus, res.data.listing_status || nextStatus);
        var searchEl = document.getElementById('propSearch');
        if (searchEl) searchEl.dispatchEvent(new Event('input', { bubbles: true }));
        showToast('Listing status updated to ' + _listingStatusMeta(res.data.listing_status || nextStatus).label + '.', 'success');
      })
      .catch(function(err) {
        var msg = 'Network error while updating listing status.';
        if (err && err.message) msg = msg + ' ' + err.message;
        showToast(msg, 'danger');
      });
    });
    return;
  }
  if (!btn) return;
  e.preventDefault();
  _activityDeleteBtn = btn;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('activityDeleteModal')).show();
});

_bind('confirmActivityDeleteBtn', 'click', function () {
  var triggerBtn = _activityDeleteBtn;
  if (!triggerBtn) return;
  var logId = triggerBtn.dataset.logId;
  if (!logId) return;

  var confirmBtn = this;
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Deleting…';

  fetch('/admin/activity/' + logId + '/delete', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrfToken() }
  })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (res) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fas fa-trash me-1"></i> Delete';
      bootstrap.Modal.getInstance(document.getElementById('activityDeleteModal')).hide();

      if (!res.ok || !res.data.ok) {
        showToast((res.data && res.data.error) || 'Failed to delete activity log.', 'danger');
        return;
      }

      var row = triggerBtn.closest('tr');
      if (row) row.remove();
      var table = document.getElementById('actTable');
      if (table && !table.querySelector('tbody tr[data-type]')) {
        var tbody = table.querySelector('tbody');
        if (tbody) {
          var empty = document.createElement('tr');
          empty.className = 'no-data-row';
          empty.innerHTML = '<td colspan="6" class="text-center text-muted py-5">'
            + '<i class="fas fa-clipboard-list fa-2x mb-2 d-block" style="color:var(--clr-border);"></i>'
            + 'No activity recorded yet.</td>';
          tbody.appendChild(empty);
        }
      }
      showToast('Activity log deleted.', 'success');
      _activityDeleteBtn = null;
    })
    .catch(function () {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fas fa-trash me-1"></i> Delete';
      showToast('Network error while deleting activity log.', 'danger');
    });
});

// Show Save Criteria button only when Criteria tab is active
(function () {
  var saveWrap = document.getElementById('saveCriteriaWrap');
  if (!saveWrap) return;
  function syncSaveBtn(activeHref) {
    if (activeHref === '#rptTabCriteria') {
      saveWrap.classList.remove('d-none');
    } else {
      saveWrap.classList.add('d-none');
    }
  }
  document.querySelectorAll('#rptTabs .nav-link').forEach(function (tab) {
    tab.addEventListener('shown.bs.tab', function (e) { syncSaveBtn(e.target.getAttribute('href')); });
  });
})();

/* -- Save Qualification Criteria -- */
function _doSaveCriteria() {
  var btn = document.getElementById('saveCriteriaBtn');
  var confirmBtn = document.getElementById('saveCriteriaConfirmBtn');
  var msg = document.getElementById('criteriaSaveMsg');
  var qEl   = document.getElementById('crit_dti_qualified_max');
  var cEl   = document.getElementById('crit_dti_conditional_max');
  var confEl = document.getElementById('crit_confidence_threshold');
  var tenEl = document.getElementById('crit_min_tenure_months');
  var incEl = document.getElementById('crit_min_gross_income');
  if (!qEl || !cEl || !confEl || !tenEl || !incEl) return;
  var payload = {
    dti_qualified_max:    parseFloat(qEl.value),
    dti_conditional_max:  parseFloat(cEl.value),
    confidence_threshold: parseFloat(confEl.value),
    min_tenure_months:    parseInt(tenEl.value),
    min_gross_income:     parseFloat(incEl.value),
    stability_employed:                 parseInt(document.getElementById('crit_stability_employed').value || 5),
    stability_ofw_landbased:            parseInt(document.getElementById('crit_stability_ofw_landbased').value || 4),
    stability_ofw_seafarer:             parseInt(document.getElementById('crit_stability_ofw_seafarer').value || 4),
    stability_licensed_professional:    parseInt(document.getElementById('crit_stability_licensed_professional').value || 5),
    stability_with_financial_support:   parseInt(document.getElementById('crit_stability_with_financial_support').value || 3),
    stability_with_attorney_in_fact:    parseInt(document.getElementById('crit_stability_with_attorney_in_fact').value || 3),
    stability_with_co_borrower:         parseInt(document.getElementById('crit_stability_with_co_borrower').value || 4),
  };
  if (payload.dti_qualified_max >= payload.dti_conditional_max) {
    msg.className = 'small text-danger';
    msg.textContent = 'Qualified max DTI must be less than Conditional max DTI.';
    return;
  }
  // Close confirmation modal and show spinner on main button
  bootstrap.Modal.getInstance(document.getElementById('saveCriteriaModal')).hide();
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving…'; }
  if (confirmBtn) { confirmBtn.disabled = true; }
  fetch('/admin/criteria/save', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrfToken()},
    body: JSON.stringify(payload)
  })
  .then(parseApiResponse)
  .then(function (res) {
    if (res.ok && res.data && res.data.success) {
      msg.className = '';
      msg.textContent = '';
      window._criteriaDirty = false;
      showToast('Criteria saved and applied to the C5.0 engine.', 'success');
      /* sync the disabled "Not Qualified" input */
      var notQEl = document.querySelector('#rptTabCriteria input[disabled]');
      if (notQEl) notQEl.value = payload.dti_conditional_max;
    } else {
      msg.className = 'small text-danger';
      msg.textContent = getApiErrorMessage(res, 'Save failed.');
    }
  })
  .catch(function () { msg.className = 'small text-danger'; msg.textContent = 'Network error.'; })
  .finally(function () {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save me-1"></i>Save Criteria'; }
    if (confirmBtn) { confirmBtn.disabled = false; }
    setTimeout(function () { msg.textContent = ''; }, 5000);
  });
}

document.getElementById('saveCriteriaBtn') && document.getElementById('saveCriteriaBtn').addEventListener('click', function () {
  var msg = document.getElementById('criteriaSaveMsg');
  var qEl = document.getElementById('crit_dti_qualified_max');
  var cEl = document.getElementById('crit_dti_conditional_max');
  // Pre-validate before opening the modal
  if (qEl && cEl && parseFloat(qEl.value) >= parseFloat(cEl.value)) {
    msg.className = 'small text-danger';
    msg.textContent = 'Qualified max DTI must be less than Conditional max DTI.';
    return;
  }
  if (msg) { msg.textContent = ''; }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('saveCriteriaModal')).show();
});

document.getElementById('saveCriteriaConfirmBtn') && document.getElementById('saveCriteriaConfirmBtn').addEventListener('click', function () {
  _doSaveCriteria();
});

// Sync "Not Qualified" derived field when Conditional max changes
document.getElementById('crit_dti_conditional_max') && document.getElementById('crit_dti_conditional_max').addEventListener('input', function (e) {
  var nqField = document.getElementById('crit_dti_not_qualified_min');
  if (nqField) {
    nqField.value = e.target.value;
  }
});

/* ── C5.0 Assessments Page ──────────────────────────────────── */
(function() {

  /* -- Assessment results: search + status filter -- */
  function filterC50Table() {
    var q      = (document.getElementById('c50Search')       || {value:''}).value.toLowerCase();
    var status = (document.getElementById('c50FilterStatus') || {value:''}).value;
    document.querySelectorAll('#c50Table tbody tr[data-status]').forEach(function(row) {
      var name   = (row.querySelector('.c50-name') || {textContent:''}).textContent.toLowerCase();
      var rowSts = row.dataset.status || '';
      var matchQ = !q      || name.includes(q);
      var matchS = !status || rowSts === status;
      row.style.display = (matchQ && matchS) ? '' : 'none';
    });
  }

  var srch = document.getElementById('c50Search');
  if (srch) srch.addEventListener('input', filterC50Table);
  var filt = document.getElementById('c50FilterStatus');
  if (filt) filt.addEventListener('change', filterC50Table);

  /* -- Factors modal -- */
  window.showC50Factors = function(btn) {
    var raw = btn.dataset.factors;
    var factors = [];
    try { factors = JSON.parse(raw); } catch(e) {}
    var body = document.getElementById('c50FactorsBody');
    if (!body) return;
    if (!factors.length) { body.innerHTML = '<p class="text-muted">No factor data available.</p>'; }
    else {
      var html = '<div class="d-flex flex-column gap-3">';
      factors.forEach(function(f) {
        var cls = f.flag === 'success' ? 'text-success' : (f.flag === 'danger' ? 'text-danger' : (f.flag === 'warning' ? 'text-warning' : 'text-info'));
        html += '<div class="d-flex gap-3 align-items-start">'
             +    '<div class="c50-factor-icon ' + cls + '"><i class="fas fa-chart-bar"></i></div>'
             +    '<div><div class="fw-semibold small">' + f.key + ' &mdash; <span class="' + cls + '">' + f.value + '</span></div>'
             +    '<div class="text-muted" style="font-size:.78rem;">' + f.note + '</div></div>'
             + '</div>';
      });
      html += '</div>';
      body.innerHTML = html;
    }
    new bootstrap.Modal(document.getElementById('c50FactorsModal')).show();
  };

  /* -- Training data: search + filter -- */
  function filterTdTable() {
    var q = (document.getElementById('tdSearch') || {value:''}).value.toLowerCase();
    var o = (document.getElementById('tdFilterOutcome') || {value:''}).value;
    var visible = 0;
    document.querySelectorAll('#tdTable tbody tr[id^="td-row-"]').forEach(function(row) {
      var match = (!q || row.textContent.toLowerCase().includes(q)) && (!o || (row.dataset.outcome || '') === o);
      row.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    var noRes = document.getElementById('td-no-results-row');
    var total = document.querySelectorAll('#tdTable tbody tr[id^="td-row-"]').length;
    if (noRes) noRes.style.display = (visible === 0 && total > 0) ? '' : 'none';
  }
  var tdSrch = document.getElementById('tdSearch');
  if (tdSrch) tdSrch.addEventListener('input', filterTdTable);
  var tdFiltOut = document.getElementById('tdFilterOutcome');
  if (tdFiltOut) tdFiltOut.addEventListener('change', filterTdTable);

  function filterTdHistoryTable() {
    var q = (document.getElementById('tdHistorySearch') || {value:''}).value.toLowerCase();
    var o = (document.getElementById('tdHistoryFilterOutcome') || {value:''}).value;
    var visible = 0;
    document.querySelectorAll('#tdHistoryTable tbody tr[id^="tdh-row-"]').forEach(function(row) {
      var match = (!q || row.textContent.toLowerCase().includes(q)) && (!o || (row.dataset.outcome || '') === o);
      row.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    var noRes = document.getElementById('tdh-no-results-row');
    var total = document.querySelectorAll('#tdHistoryTable tbody tr[id^="tdh-row-"]').length;
    if (noRes) noRes.style.display = (visible === 0 && total > 0) ? '' : 'none';
  }
  var tdHistSrch = document.getElementById('tdHistorySearch');
  if (tdHistSrch) tdHistSrch.addEventListener('input', filterTdHistoryTable);
  var tdHistFilt = document.getElementById('tdHistoryFilterOutcome');
  if (tdHistFilt) tdHistFilt.addEventListener('change', filterTdHistoryTable);

  /* -- Add training record: live validation -- */
  function _tdValidate(isSubmit) {
    var grossEl  = document.getElementById('td_gross');
    var ageEl    = document.getElementById('td_age');
    var loansEl  = document.getElementById('td_loans');
    var grossErr = document.getElementById('td_gross_err');
    var ageErr   = document.getElementById('td_age_err');
    var loansErr = document.getElementById('td_loans_err');
    var empEl    = document.getElementById('td_employment');
    var civEl    = document.getElementById('td_civil');
    var outEl    = document.getElementById('td_outcome');
    var empErr   = document.getElementById('td_emp_err');
    var civErr   = document.getElementById('td_civ_err');
    var outErr   = document.getElementById('td_out_err');
    var ok = true;
    if (grossErr && grossEl) {
      var gv = grossEl.value.trim();
      if (gv === '' && !isSubmit) { grossErr.style.display = 'none'; grossEl.classList.remove('is-invalid'); }
      else if (gv === '' || parseFloat(gv) <= 0) { grossErr.textContent = 'Required — must be greater than ₱0.'; grossErr.style.display = ''; grossEl.classList.add('is-invalid'); ok = false; }
      else { grossErr.style.display = 'none'; grossEl.classList.remove('is-invalid'); }
    }
    if (ageErr && ageEl) {
      var av = ageEl.value.trim(); var an = parseInt(av);
      if (av === '' && !isSubmit) { ageErr.style.display = 'none'; ageEl.classList.remove('is-invalid'); }
      else if (av === '' || an < 18 || an > 80) { ageErr.textContent = av === '' ? 'Age is required.' : 'Must be between 18 and 80.'; ageErr.style.display = ''; ageEl.classList.add('is-invalid'); ok = false; }
      else { ageErr.style.display = 'none'; ageEl.classList.remove('is-invalid'); }
    }
    if (loansErr && loansEl) {
      var lv = loansEl.value.trim(); var ln = parseFloat(lv);
      if (lv === '' && !isSubmit) { loansErr.style.display = 'none'; loansEl.classList.remove('is-invalid'); }
      else if (lv !== '' && (isNaN(ln) || ln < 0)) { loansErr.textContent = 'Cannot be negative.'; loansErr.style.display = ''; loansEl.classList.add('is-invalid'); ok = false; }
      else { loansErr.style.display = 'none'; loansEl.classList.remove('is-invalid'); }
    }
    if (isSubmit) {
      if (empErr && empEl) {
        if (!empEl.value) { empErr.textContent = 'Please select employment type.'; empErr.style.display = ''; empEl.classList.add('is-invalid'); ok = false; }
        else { empErr.style.display = 'none'; empEl.classList.remove('is-invalid'); }
      }
      if (civErr && civEl) {
        if (!civEl.value) { civErr.textContent = 'Please select civil status.'; civErr.style.display = ''; civEl.classList.add('is-invalid'); ok = false; }
        else { civErr.style.display = 'none'; civEl.classList.remove('is-invalid'); }
      }
      if (outErr && outEl) {
        if (!outEl.value) { outErr.textContent = 'Please select an outcome.'; outErr.style.display = ''; outEl.classList.add('is-invalid'); ok = false; }
        else { outErr.style.display = 'none'; outEl.classList.remove('is-invalid'); }
      }
    }
    return ok;
  }
  function _tdResetValidation() {
    ['td_gross','td_age','td_loans','td_employment','td_civil','td_outcome'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.classList.remove('is-invalid');
    });
    ['td_gross_err','td_age_err','td_loans_err','td_emp_err','td_civ_err','td_out_err'].forEach(function(id) {
      var el = document.getElementById(id); if (el) { el.textContent = ''; el.style.display = 'none'; }
    });
  }
  ['td_gross','td_age','td_loans'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function() { _tdValidate(false); });
  });

  /* -- Add Record button: open modal -- */
  document.getElementById('c50AddRecordBtn') && document.getElementById('c50AddRecordBtn').addEventListener('click', function() {
    _tdResetValidation();
    document.getElementById('td_gross').value  = '';
    document.getElementById('td_loans').value  = '';
    document.getElementById('td_age').value    = '';
    document.getElementById('td_dep').value    = '0';
    document.getElementById('td_tenure').value = '';
    document.getElementById('td_employment').selectedIndex = 0;
    document.getElementById('td_civil').selectedIndex      = 0;
    document.getElementById('td_outcome').selectedIndex    = 0;
    var errEl = document.getElementById('addTdModalErr');
    if (errEl) errEl.classList.add('d-none');
    new bootstrap.Modal(document.getElementById('addTdModal')).show();
  });

  /* -- Add Training Record modal: confirm submit -- */
  document.getElementById('addTdConfirmBtn') && document.getElementById('addTdConfirmBtn').addEventListener('click', function() {
    if (!_tdValidate(true)) return;
    var confirmBtn = this;
    var modalEl    = document.getElementById('addTdModal');
    var payload = {
      employment_type: document.getElementById('td_employment').value,
      civil_status:    document.getElementById('td_civil').value,
      age:             parseInt(document.getElementById('td_age').value || 0),
      dependents:      parseInt(document.getElementById('td_dep').value || 0),
      tenure_months:   parseInt(document.getElementById('td_tenure').value || 0),
      gross_income:    parseFloat(document.getElementById('td_gross').value || 0),
      monthly_loans:   parseFloat(document.getElementById('td_loans').value || 0),
      outcome:         document.getElementById('td_outcome').value,
    };
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving…';
    fetch('/admin/c50/training-data/add-only', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-CSRFToken': document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : ''},
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fas fa-plus me-1"></i>Confirm &amp; Add';
      if (d.error) {
        var errEl = document.getElementById('addTdModalErr');
        if (errEl) { errEl.textContent = d.error; errEl.classList.remove('d-none'); }
        return;
      }
      var modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      if (msg) { msg.textContent = 'Record added. Model not retrained yet.'; msg.className = 'small text-success'; setTimeout(function(){ msg.textContent = ''; msg.className = 'small'; }, 4000); }
      var empty = document.getElementById('td-empty-row');
      if (empty) empty.remove();
      var tbody = document.getElementById('tdTableBody');
      var dti    = payload.gross_income > 0 ? (payload.monthly_loans / payload.gross_income * 100) : 0;
      var dtiCls = dti < 35 ? 'text-success' : (dti <= 42 ? 'text-warning' : 'text-danger');
      var outBadge = payload.outcome === 'Qualified' ? 'badge-qualified' : (payload.outcome === 'Conditionally Qualified' ? 'badge-conditional' : 'badge-not-qualified');
      var outTxt   = payload.outcome === 'Conditionally Qualified' ? 'Conditional' : payload.outcome;
      var rowN = tbody.querySelectorAll('tr[id^="td-row-"]').length + 1;
      var row  = document.createElement('tr');
      row.id   = 'td-row-' + d.id;
      row.dataset.outcome    = payload.outcome;
      row.dataset.employment = payload.employment_type;
      row.dataset.civil      = payload.civil_status;
      row.dataset.age        = payload.age;
      row.dataset.dep        = payload.dependents;
      row.dataset.tenure     = payload.tenure_months;
      row.dataset.gross      = payload.gross_income;
      row.dataset.loans      = payload.monthly_loans;
      row.dataset.notes      = payload.notes || '';
      var eBtnS = 'class="btn btn-sm btn-outline-blue"';
      var dBtnS = 'class="btn btn-sm btn-outline-crimson"';
      row.innerHTML = '<td class="text-muted small">' + rowN + '</td>'
        + '<td>' + payload.employment_type.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();}) + '</td>'
        + '<td>' + payload.civil_status.charAt(0).toUpperCase() + payload.civil_status.slice(1) + '</td>'
        + '<td>' + payload.age + '</td>'
        + '<td>' + payload.tenure_months + ' mo</td>'
        + '<td>₱' + payload.gross_income.toLocaleString('en-PH', {maximumFractionDigits:0}) + '</td>'
        + '<td>₱' + payload.monthly_loans.toLocaleString('en-PH', {maximumFractionDigits:0}) + '</td>'
        + '<td><span class="fw-semibold ' + dtiCls + '">' + dti.toFixed(1) + '%</span></td>'
        + '<td><span class="sqh-badge ' + outBadge + '">' + outTxt + '</span></td>'
        + '<td><div class="d-flex gap-1"><button ' + eBtnS + ' onclick="openEditTdModal(' + d.id + ')" title="Edit record"><i class="fas fa-eye"></i></button><button ' + dBtnS + ' onclick="openDeleteTdModal(' + d.id + ')" title="Delete record"><i class="fas fa-ban"></i></button></div></td>';
      tbody.appendChild(row);
      document.getElementById('td_gross').value  = '';
      document.getElementById('td_loans').value  = '';
      document.getElementById('td_age').value    = '';
      document.getElementById('td_dep').value    = '0';
      document.getElementById('td_tenure').value = '';
      document.getElementById('td_employment').selectedIndex = 0;
      document.getElementById('td_civil').selectedIndex      = 0;
      document.getElementById('td_outcome').selectedIndex    = 0;
      _tdResetValidation();
      _updateModelBar(d.meta);
      filterTdTable();
    })
    .catch(function() { confirmBtn.disabled = false; confirmBtn.innerHTML = '<i class="fas fa-plus me-1"></i>Confirm &amp; Add'; });
  });

  /* -- Delete training record (modal) -- */
  window.openDeleteTdModal = function(id) {
    var confirmBtn = document.getElementById('deleteTdConfirmBtn');
    if (confirmBtn) confirmBtn.dataset.targetId = id;
    new bootstrap.Modal(document.getElementById('deleteTdModal')).show();
  };

  document.getElementById('deleteTdConfirmBtn') && document.getElementById('deleteTdConfirmBtn').addEventListener('click', function() {
    var id  = parseInt(this.dataset.targetId);
    var btn = this;
    var modalEl = document.getElementById('deleteTdModal');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Deleting…';
    fetch('/admin/c50/training-data/' + id + '/delete', {
      method: 'POST',
      headers: {'X-CSRFToken': document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : ''}
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
      if (d.error) { alert(d.error); return; }
      var modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      var row = document.getElementById('td-row-' + id);
      if (row) row.remove();
      _updateModelBar(d.meta);
      filterTdTable();
    })
    .catch(function() { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete'; });
  });

  /* -- Edit training record (modal) -- */
  window.openEditTdModal = function(id) {
    var row = document.getElementById('td-row-' + id);
    if (!row) return;
    document.getElementById('editTd_id').value         = id;
    document.getElementById('editTd_notes').value      = row.dataset.notes      || '';
    document.getElementById('editTd_employment').value = row.dataset.employment || 'employed';
    document.getElementById('editTd_civil').value      = row.dataset.civil      || 'single';
    document.getElementById('editTd_age').value        = row.dataset.age        || 30;
    document.getElementById('editTd_dep').value        = row.dataset.dep        || 0;
    document.getElementById('editTd_tenure').value     = row.dataset.tenure     || 0;
    document.getElementById('editTd_gross').value      = row.dataset.gross      || '';
    document.getElementById('editTd_loans').value      = row.dataset.loans      || 0;
    document.getElementById('editTd_outcome').value    = row.dataset.outcome    || 'Qualified';

    document.getElementById('editTdError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('editTdModal')).show();
  };

  document.getElementById('editTdSaveBtn') && document.getElementById('editTdSaveBtn').addEventListener('click', function() {
    var id    = parseInt(document.getElementById('editTd_id').value);
    var btn   = this;
    var errEl = document.getElementById('editTdError');
    var gross = parseFloat(document.getElementById('editTd_gross').value);
    var loans = parseFloat(document.getElementById('editTd_loans').value || 0);
    if (!gross || gross <= 0) {
      errEl.textContent = 'Gross income must be greater than 0.';
      errEl.classList.remove('d-none');
      return;
    }
    errEl.classList.add('d-none');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving…';
    var payload = {
      employment_type: document.getElementById('editTd_employment').value,
      civil_status:    document.getElementById('editTd_civil').value,
      age:             parseInt(document.getElementById('editTd_age').value),
      dependents:      parseInt(document.getElementById('editTd_dep').value),
      tenure_months:   parseInt(document.getElementById('editTd_tenure').value),
      gross_income:    gross,
      monthly_loans:   loans,
      outcome:         document.getElementById('editTd_outcome').value,
      notes:           document.getElementById('editTd_notes').value,
    };
    fetch('/admin/c50/training-data/' + id + '/edit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-CSRFToken': document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : ''},
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes';
      if (d.error) { errEl.textContent = d.error; errEl.classList.remove('d-none'); return; }
      var modal = bootstrap.Modal.getInstance(document.getElementById('editTdModal'));
      if (modal) modal.hide();
      var row = document.getElementById('td-row-' + id);
      if (!row) return;
      var rec  = d.record;
      var dtiR = parseFloat(rec.dti_ratio || 0);
      var dtiC = dtiR < 35 ? 'text-success' : (dtiR <= 42 ? 'text-warning' : 'text-danger');
      var outB = rec.outcome === 'Qualified' ? 'badge-qualified' : (rec.outcome === 'Conditionally Qualified' ? 'badge-conditional' : 'badge-not-qualified');
      var outT = rec.outcome === 'Conditionally Qualified' ? 'Conditional' : rec.outcome;
      row.dataset.outcome    = rec.outcome;
      row.dataset.employment = rec.employment_type;
      row.dataset.civil      = rec.civil_status;
      row.dataset.age        = rec.age;
      row.dataset.dep        = rec.dependents || 0;
      row.dataset.tenure     = rec.tenure_months;
      row.dataset.gross      = rec.gross_income;
      row.dataset.loans      = rec.monthly_loans;
      row.dataset.notes      = rec.notes || '';
      var cells = row.querySelectorAll('td');
      cells[1].textContent = rec.employment_type.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
      cells[2].textContent = rec.civil_status.charAt(0).toUpperCase() + rec.civil_status.slice(1);
      cells[3].textContent = rec.age;
      cells[4].textContent = rec.tenure_months + ' mo';
      cells[5].textContent = '₱' + parseFloat(rec.gross_income).toLocaleString('en-PH',{maximumFractionDigits:0});
      cells[6].textContent = '₱' + parseFloat(rec.monthly_loans||0).toLocaleString('en-PH',{maximumFractionDigits:0});
      cells[7].innerHTML   = '<span class="fw-semibold ' + dtiC + '">' + dtiR.toFixed(1) + '%</span>';
      cells[8].innerHTML   = '<span class="sqh-badge ' + outB + '">' + outT + '</span>';
      _updateModelBar(d.meta);
      filterTdTable();
    })
    .catch(function() { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes'; });
  });

  /* -- Retrain button — shows confirmation modal -- */
  document.getElementById('c50RetrainBtn') && document.getElementById('c50RetrainBtn').addEventListener('click', function() {
    new bootstrap.Modal(document.getElementById('c50RetrainModal')).show();
  });

  /* -- Retrain confirm button -- */
  document.getElementById('c50RetrainConfirmBtn') && document.getElementById('c50RetrainConfirmBtn').addEventListener('click', function() {
    var retrainBtn = document.getElementById('c50RetrainBtn');
    var modalEl = document.getElementById('c50RetrainModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    if (retrainBtn) { retrainBtn.disabled = true; retrainBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Retraining…'; }
    fetch('/admin/c50/retrain', {
      method: 'POST',
      headers: {'X-CSRFToken': document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : ''}
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (retrainBtn) { retrainBtn.disabled = false; retrainBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Retrain'; }
      if (d.meta) _updateModelBar(d.meta);
      _loadC50SyncStatus();
    })
    .catch(function() {
      if (retrainBtn) { retrainBtn.disabled = false; retrainBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Retrain'; }
    });
  });

  /* -- Seed button — shows confirmation modal -- */
  document.getElementById('c50SeedBtn') && document.getElementById('c50SeedBtn').addEventListener('click', function() {
    var modalEl = document.getElementById('c50SeedModal');
    if (modalEl) {
      new bootstrap.Modal(modalEl).show();
    }
  });

  /* -- Seed confirm button -- */
  document.getElementById('c50SeedConfirmBtn') && document.getElementById('c50SeedConfirmBtn').addEventListener('click', function() {
    var btn = document.getElementById('c50SeedBtn');
    var modalEl = document.getElementById('c50SeedModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Seeding…';
    fetch('/admin/c50/seed', {
      method: 'POST',
      headers: {'X-CSRFToken': document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : ''}
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-database me-1"></i>Seed Sample Data';
      if (d.error) {
        if (d.error === 'Training data already exists. Delete records first or retrain.') {
          showToast(d.error, 'warning');
        } else {
          showToast(d.error, 'danger');
        }
        return;
      }
      btn.remove();
      if (d.meta) _updateModelBar(d.meta);
      showToast('Seeded ' + d.seeded + ' records. Model trained with ' + (d.meta && d.meta.train_accuracy ? d.meta.train_accuracy + '% accuracy' : 'success') + '. Refreshing page…', 'success');
      location.reload();
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-database me-1"></i>Seed Sample Data';
      showToast('Unable to seed sample data right now. Please try again.', 'danger');
    });
  });

  function _renderC50SyncStatus(data) {
    var el = document.getElementById('c50SyncStatus');
    if (!el) return;
    var textEl = el.querySelector('.c50-sync-text');
    var badgeWrap = el.querySelector('.c50-sync-badges');
    var syncedBadge = document.getElementById('c50SyncBadgeSynced');
    var unsyncedBadge = document.getElementById('c50SyncBadgeUnsynced');

    el.classList.remove('is-ok', 'is-warn', 'is-error');

    if (!data || data.error) {
      el.classList.add('is-error');
      if (textEl) textEl.textContent = 'Sync status unavailable right now.';
      if (badgeWrap) badgeWrap.classList.add('d-none');
      return;
    }

    var synced = parseInt(data.synced || 0, 10);
    var total = parseInt(data.total || 0, 10);
    var unsynced = parseInt(data.unsynced || 0, 10);

    if (unsynced > 0) {
      el.classList.add('is-warn');
    } else {
      el.classList.add('is-ok');
    }

    if (textEl) {
      textEl.textContent = 'Historical sync: ' + synced + ' of ' + total + ' sale records mapped to training data.';
    }

    if (syncedBadge) {
      syncedBadge.className = 'badge c50-badge-synced';
      syncedBadge.textContent = 'Synced: ' + synced;
    }

    if (unsyncedBadge) {
      unsyncedBadge.className = 'badge ' + (unsynced > 0 ? 'c50-badge-unsynced-alert' : 'c50-badge-unsynced-ok');
      unsyncedBadge.textContent = 'Unsynced: ' + unsynced;
    }

    if (badgeWrap) badgeWrap.classList.remove('d-none');
  }

  function _loadC50SyncStatus() {
    if (!document.getElementById('c50SyncStatus')) return;
    fetch('/admin/c50/sync-status', {
      method: 'GET',
      headers: {'X-CSRFToken': document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : ''}
    })
    .then(function(r) { return r.json(); })
    .then(function(d) { _renderC50SyncStatus(d); })
    .catch(function() { _renderC50SyncStatus({error: true}); });
  }

  document.getElementById('c50SyncBtn') && document.getElementById('c50SyncBtn').addEventListener('click', function() {
    var modalEl = document.getElementById('c50SyncModal');
    if (modalEl) {
      new bootstrap.Modal(modalEl).show();
    }
  });

  document.getElementById('c50SyncConfirmBtn') && document.getElementById('c50SyncConfirmBtn').addEventListener('click', function() {
    var btn = document.getElementById('c50SyncBtn');
    var modalEl = document.getElementById('c50SyncModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Syncing…';
    fetch('/admin/c50/sync-historical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : ''
      },
      body: JSON.stringify({dry_run: false})
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-link me-1"></i>Sync Historical';
      if (d.error) {
        showToast(d.error, 'danger');
        _loadC50SyncStatus();
        return;
      }

      var summary = 'Sync complete: ' + (d.inserted || 0) + ' inserted, ' + (d.duplicates || 0) + ' duplicates skipped.';
      if (d.missing_sale_ids) summary += ' ' + d.missing_sale_ids + ' skipped (missing sale id).';
      summary += d.retrain_started ? ' Retrain started in background.' : ' Retrain already running or no new rows.';
      showToast(summary, 'success');
      _loadC50SyncStatus();
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-link me-1"></i>Sync Historical';
      showToast('Unable to sync historical records right now.', 'danger');
      _loadC50SyncStatus();
    });
  });

  _loadC50SyncStatus();

  /* -- Model status bar updater -- */
  function _updateModelBar(meta) {
    var bar = document.querySelector('.c50-model-dot');
    if (!bar) return;
    if (meta && meta.trained) {
      bar.classList.remove('untrained');
      bar.classList.add('trained');
      var info = bar.nextElementSibling;
      if (info) {
        info.querySelector('.fw-bold.small').textContent =
          'C5.0 Model Active — ' + meta.n_samples + ' training records • ' + meta.train_accuracy + '% accuracy • depth ' + meta.tree_depth;
        var sub = info.querySelector('.text-muted');
        if (sub) sub.innerHTML = '<span class="text-success">' + meta.n_qualified + ' Qualified</span> &nbsp;•&nbsp; '
          + '<span class="text-warning">' + meta.n_conditional + ' Conditional</span> &nbsp;•&nbsp; '
          + '<span class="text-danger">' + meta.n_not_qualified + ' Not Qualified</span>';
      }
    }
  }

})();

/* ── Settings Page ─────────────────────────────────────────────── */
(function () {
  /* -- Show/hide Save Changes button based on active settings tab -- */
  var saveSettWrap = document.getElementById('saveSettingsWrap');
  var c50Wrap      = document.getElementById('c50StatusWrap');
  function syncSettingsSaveBtn(activeTarget) {
    if (saveSettWrap) saveSettWrap.classList.toggle('d-none', activeTarget !== '#pane-settings');
    if (c50Wrap)      c50Wrap.classList.toggle('d-none',     activeTarget !== '#pane-sysinfo');
  }
  document.querySelectorAll('#settingsTabs .nav-link').forEach(function (tab) {
    tab.addEventListener('shown.bs.tab', function (e) {
      syncSettingsSaveBtn(e.target.getAttribute('data-bs-target'));
    });
  });

  /* -- Save Settings: open confirmation modal -- */
  var settBtn = document.getElementById('saveSettingsBtn');
  if (settBtn) {
    settBtn.addEventListener('click', function () {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('saveSettingsConfirmModal')).show();
    });
  }

  /* -- Save Settings: confirmed -- save general then security -- */
  var confirmSettBtn = document.getElementById('confirmSaveSettingsBtn');
  if (confirmSettBtn) {
    confirmSettBtn.addEventListener('click', function () {
      var msg = document.getElementById('settingsSaveMsg');
      if (settBtn) { settBtn.disabled = true; settBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving…'; }

      var genPayload = {
        company_name:   document.getElementById('set_company_name').value.trim(),
        platform_name:  document.getElementById('set_platform_name').value.trim(),
        contact_email:  document.getElementById('set_contact_email').value.trim(),
        contact_phone:  document.getElementById('set_contact_phone').value.trim(),
        office_address: document.getElementById('set_office_address').value.trim(),
      };
      var secPayload = {
        max_login_attempts:   parseInt(document.getElementById('set_max_login_attempts').value) || 5,
        max_forgot_password_attempts: parseInt(document.getElementById('set_max_forgot_password_attempts').value) || 5,
        session_timeout_mins: parseInt(document.getElementById('set_session_timeout_mins').value) || 60,
        min_password_length:  parseInt(document.getElementById('set_min_password_length').value) || 8,
      };

      var postJSON = function (url, data) {
        return fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken()
          },
          body: JSON.stringify(data)
        })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
      };

      Promise.all([
        postJSON('/admin/settings/general',  genPayload),
        postJSON('/admin/settings/security', secPayload),
      ])
      .then(function (results) {
        if (settBtn) { settBtn.disabled = false; settBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes'; }
        var allOk = results.every(function (r) { return r.ok && r.data.success; });
        if (allOk) {
          if (msg) { msg.className = ''; msg.textContent = ''; }
          window._settingsDirty = false;
          showToast('Settings saved successfully.', 'success');
        } else {
          var errs = results.filter(function (r) { return !r.ok || !r.data.success; })
                            .map(function (r) { return r.data.error || 'Save failed.'; });
          showToast(errs.join(' / '), 'danger');
        }
      })
      .catch(function () {
        if (settBtn) { settBtn.disabled = false; settBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes'; }
        if (msg) { msg.className = 'small text-danger'; msg.textContent = 'Network error.'; }
      });
    });
  }
  /* -- System Info loader -- */
  function loadSystemInfo() {
    var loadingEl   = document.getElementById('sysInfoLoading');
    var contentEl   = document.getElementById('sysInfoContent');
    if (!loadingEl || !contentEl) return;

    var refreshIcon = document.querySelector('#refreshSysInfoBtn i');
    var refreshBtn  = document.getElementById('refreshSysInfoBtn');
    var isFirstLoad = contentEl.classList.contains('d-none');

    /* Start spinning icon + lock button */
    if (refreshIcon) refreshIcon.classList.add('sqh-spinning');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1 sqh-spinning"></i> Refreshing…';
    }

    if (isFirstLoad) {
      loadingEl.classList.remove('d-none');
    } else {
      /* Fade content out noticeably — fast fade to near-zero */
      contentEl.style.transition = 'opacity 0.3s ease';
      contentEl.style.opacity    = '0.08';
    }

    /* Enforce a minimum visual duration (600ms) so the animation is always seen */
    var minDelay = new Promise(function (resolve) { setTimeout(resolve, 600); });

    Promise.all([
      fetch('/admin/settings/system-info').then(function (r) { return r.json(); }),
      minDelay
    ]).then(function (results) {
      var d = results[0];

      /* Write new values while content is still dimmed / hidden */
      document.getElementById('si_python').textContent      = d.python_version || '—';
      document.getElementById('si_os').textContent           = d.os_platform || '—';
      document.getElementById('si_db').textContent           = (d.db_engine || '—').toUpperCase();
      document.getElementById('si_users').textContent        = d.total_users;
      document.getElementById('si_properties').textContent   = d.total_properties;
      document.getElementById('si_subdivisions').textContent = d.total_subdivisions;
      document.getElementById('si_assessments').textContent  = d.total_assessments;
      document.getElementById('si_training').textContent     = d.total_training;
      document.getElementById('si_model_acc').textContent    = d.model_trained ? d.model_accuracy + '%' : 'N/A';
      var sizeEl = document.getElementById('backupDbSize');
      if (sizeEl) sizeEl.textContent = d.db_size || '—';

      var dot       = document.getElementById('si_model_dot');
      var status    = document.getElementById('si_model_status');
      var topDot    = document.getElementById('topbar_model_dot');
      var topStatus = document.getElementById('topbar_model_status');
      if (d.model_trained) {
        if (dot)    { dot.classList.remove('untrained'); dot.classList.add('trained'); }
        if (topDot) { topDot.classList.remove('untrained'); topDot.classList.add('trained'); }
        if (topStatus) { topStatus.textContent = 'C5.0 Active — ' + d.model_accuracy + '% accuracy'; topStatus.style.color = 'var(--clr-accent-dk)'; }
      } else {
        if (dot)    { dot.classList.remove('trained'); dot.classList.add('untrained'); }
        if (topDot) { topDot.classList.remove('trained'); topDot.classList.add('untrained'); }
        if (status)    status.textContent = 'Model not trained — using rule-based fallback';
        if (topStatus) { topStatus.textContent = 'C5.0 — not trained'; topStatus.style.color = 'var(--clr-muted)'; }
      }

      /* Restore button */
      if (refreshBtn) {
        refreshBtn.disabled  = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Refresh';
      }

      if (isFirstLoad) {
        loadingEl.classList.add('d-none');
        contentEl.style.transition = 'none';
        contentEl.style.opacity    = '0';
        contentEl.classList.remove('d-none');
        void contentEl.offsetWidth; /* force reflow */
        contentEl.style.transition = 'opacity 0.5s ease';
        contentEl.style.opacity    = '1';
      } else {
        /* Fade back in smoothly */
        contentEl.style.transition = 'opacity 0.5s ease';
        contentEl.style.opacity    = '1';
      }
    }).catch(function () {
      if (refreshBtn) {
        refreshBtn.disabled  = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Refresh';
      }
      if (isFirstLoad) {
        loadingEl.innerHTML = '<p class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>Failed to load system info.</p>';
      } else {
        contentEl.style.transition = 'opacity 0.5s ease';
        contentEl.style.opacity    = '1';
      }
    });
  }

  /* Load system info when System Status tab is first shown */
  var sysTab = document.getElementById('tab-sysinfo');
  if (sysTab) {
    sysTab.addEventListener('shown.bs.tab', function () { loadSystemInfo(); });
  }

  var refreshBtn = document.getElementById('refreshSysInfoBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () { loadSystemInfo(); });
  }

  /* -- Database Backup -- */
  var backupBtn = document.getElementById('backupDbBtn');
  if (backupBtn) {
    backupBtn.addEventListener('click', function () {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('backupDbConfirmModal')).show();
    });
  }
  var confirmBackupBtn = document.getElementById('confirmBackupDbBtn');
  if (confirmBackupBtn) {
    confirmBackupBtn.addEventListener('click', function () {
      var msg = document.getElementById('backupMsg');
      msg.className = '';
      msg.textContent = '';
      showToast('Preparing download…', 'info');
      window.location.href = '/admin/settings/backup-db';
    });
  }

  /* -- Data-attribute-based event delegation (avoids Jinja2-in-onclick) -- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.open-user-modal-btn');
    if (btn) { openUserModal(parseInt(btn.dataset.userId)); }
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.open-edit-td-btn');
    if (btn) { openEditTdModal(parseInt(btn.dataset.tdId)); }
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.open-delete-td-btn');
    if (btn) { openDeleteTdModal(parseInt(btn.dataset.tdId)); }
  });

})();

/* ═══════════════════════════════════════════════════════════════
   ADMIN PROFILE — Avatar / Banner Upload + Preview + Delete
   ═══════════════════════════════════════════════════════════════ */

/* ── Topbar avatar helpers (shared with profile avatar sync) ── */
function _syncAdminTopbarAvatar(url) {
  var ta = document.getElementById('topbarAvatar');
  if (!ta) return;
  ta.innerHTML = '';
  var img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
  ta.appendChild(img);
}
function _clearAdminTopbarAvatar() {
  var ta = document.getElementById('topbarAvatar');
  if (!ta) return;
  var nameEl = document.querySelector('.dash-topbar-name');
  var name   = nameEl ? nameEl.textContent.trim() : '';
  ta.innerHTML = name.substring(0, 2).toUpperCase();
}

/* ── Avatar upload ─────────────────────────────────────────── */
document.getElementById('adminAvatarFileInput') && document.getElementById('adminAvatarFileInput').addEventListener('change', function () {
  var file = this.files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append('avatar', file);
  fetch('/admin/profile/upload-avatar', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrfToken() },
    body: fd
  })
    .then(parseApiResponse)
    .then(function (res) {
      if (!res.ok) { showToast(getApiErrorMessage(res, 'Upload failed.'), 'danger'); return; }
      var wrap = document.getElementById('adminProfAvatarLg');
      if (!wrap) return;
      var existingIcon = document.getElementById('adminProfAvatarIcon');
      if (existingIcon) existingIcon.remove();
      var freshUrl = res.data.url + '?t=' + Date.now();
      var existingImg = document.getElementById('adminProfAvatarImg');
      if (existingImg) {
        existingImg.src = freshUrl;
      } else {
        var img = document.createElement('img');
        img.id  = 'adminProfAvatarImg';
        img.src = freshUrl;
        img.alt = 'Profile photo';
        var label = wrap.querySelector('.prof-avatar-upload-btn');
        wrap.insertBefore(img, label);
      }
      var prevBtn = document.getElementById('adminAvatarPreviewBtn');
      if (prevBtn) prevBtn.style.display = '';
      _syncAdminTopbarAvatar(freshUrl);
      var modalImg = document.getElementById('adminImgPreviewSrc');
      if (modalImg && _adminPreviewType === 'avatar') modalImg.src = freshUrl;
      showToast('Profile photo updated!', 'success');
    })
    .catch(function () { showToast('Upload failed. Please try again.', 'danger'); });
});

/* ── Banner upload ─────────────────────────────────────────── */
document.getElementById('adminBannerFileInput') && document.getElementById('adminBannerFileInput').addEventListener('change', function () {
  var file = this.files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append('banner', file);
  fetch('/admin/profile/upload-banner', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrfToken() },
    body: fd
  })
    .then(parseApiResponse)
    .then(function (res) {
      if (!res.ok) { showToast(getApiErrorMessage(res, 'Upload failed.'), 'danger'); return; }
      var banner = document.getElementById('adminProfHeroBanner');
      if (banner) {
        var freshBannerUrl = res.data.url + '?t=' + Date.now();
        banner.style.backgroundImage    = 'url(\'' + freshBannerUrl + '\')';
        banner.style.backgroundSize     = 'cover';
        banner.style.backgroundPosition = 'center';
      }
      var prevBtn = document.getElementById('adminBannerPreviewBtn');
      if (prevBtn) prevBtn.style.display = '';
      var modalImg = document.getElementById('adminImgPreviewSrc');
      if (modalImg && _adminPreviewType === 'banner') modalImg.src = freshBannerUrl;
      showToast('Cover photo updated!', 'success');
    })
    .catch(function () { showToast('Upload failed. Please try again.', 'danger'); });
});

/* ── Image Preview Modal ───────────────────────────────────── */
var _adminPreviewType = null; // 'avatar' or 'banner'

(function () {
  var _adminPreviewRestoreModalId = null;
  var _adminPreviewZoomScale = 1;
  var _adminPreviewPanX = 0;
  var _adminPreviewPanY = 0;
  var _adminPreviewIsDragging = false;
  var _adminPreviewDragStartX = 0;
  var _adminPreviewDragStartY = 0;

  function _applyDarkModalBackdrops() {
    var backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(function(el) { el.classList.add('sqh-dark-backdrop'); });
  }

  function _applyAdminPreviewTransform() {
    var imgEl = document.getElementById('adminImgPreviewSrc');
    if (!imgEl) return;
    _clampAdminPreviewPan();
    imgEl.style.transform = 'translate(' + _adminPreviewPanX + 'px, ' + _adminPreviewPanY + 'px) scale(' + _adminPreviewZoomScale + ')';
    imgEl.style.transformOrigin = 'center center';
    imgEl.style.cursor = _adminPreviewIsDragging ? 'grabbing' : 'grab';
  }

  function _clampAdminPreviewPan() {
    var frameEl = document.querySelector('#adminImgPreviewModal .img-preview-body');
    var imgEl = document.getElementById('adminImgPreviewSrc');
    if (!frameEl || !imgEl) return;
    var frameW = frameEl.clientWidth;
    var frameH = frameEl.clientHeight;
    var scaledW = imgEl.clientWidth * _adminPreviewZoomScale;
    var scaledH = imgEl.clientHeight * _adminPreviewZoomScale;
    var maxX = Math.max(0, (scaledW - frameW) / 2);
    var maxY = Math.max(0, (scaledH - frameH) / 2);
    _adminPreviewPanX = Math.max(-maxX, Math.min(maxX, _adminPreviewPanX));
    _adminPreviewPanY = Math.max(-maxY, Math.min(maxY, _adminPreviewPanY));
    if (_adminPreviewZoomScale <= 1.0001) {
      _adminPreviewPanX = 0;
      _adminPreviewPanY = 0;
    }
  }

  function _setAdminPreviewZoomScale(nextScale) {
    var imgEl = document.getElementById('adminImgPreviewSrc');
    if (!imgEl) return;
    _adminPreviewZoomScale = Math.max(1, Math.min(4, nextScale));
    _applyAdminPreviewTransform();
    var resetBtn = document.getElementById('adminImgPreviewZoomReset');
    if (resetBtn) resetBtn.textContent = Math.round(_adminPreviewZoomScale * 100) + '%';
  }

  function _resetAdminPreviewZoom() {
    _adminPreviewPanX = 0;
    _adminPreviewPanY = 0;
    _adminPreviewIsDragging = false;
    _setAdminPreviewZoomScale(1);
  }

  function _startAdminPreviewDrag(clientX, clientY) {
    _adminPreviewIsDragging = true;
    _adminPreviewDragStartX = clientX - _adminPreviewPanX;
    _adminPreviewDragStartY = clientY - _adminPreviewPanY;
    _applyAdminPreviewTransform();
  }

  function _moveAdminPreviewDrag(clientX, clientY) {
    if (!_adminPreviewIsDragging) return;
    _adminPreviewPanX = clientX - _adminPreviewDragStartX;
    _adminPreviewPanY = clientY - _adminPreviewDragStartY;
    _applyAdminPreviewTransform();
  }

  function _endAdminPreviewDrag() {
    if (!_adminPreviewIsDragging) return;
    _adminPreviewIsDragging = false;
    _applyAdminPreviewTransform();
  }

  function _ensureAdminPreviewZoomControls() {
    var bodyEl = document.querySelector('#adminImgPreviewModal .img-preview-body');
    if (!bodyEl || document.getElementById('adminImgPreviewZoomControls')) return;
    var controls = document.createElement('div');
    controls.className = 'img-preview-zoom-controls';
    controls.id = 'adminImgPreviewZoomControls';
    controls.innerHTML = ''
      + '<button type="button" class="img-preview-zoom-btn" id="adminImgPreviewZoomOut" aria-label="Zoom out"><i class="fas fa-search-minus"></i></button>'
      + '<button type="button" class="img-preview-zoom-btn img-preview-zoom-reset" id="adminImgPreviewZoomReset" aria-label="Reset zoom">100%</button>'
      + '<button type="button" class="img-preview-zoom-btn" id="adminImgPreviewZoomIn" aria-label="Zoom in"><i class="fas fa-search-plus"></i></button>';
    bodyEl.appendChild(controls);

    var zoomInBtn = document.getElementById('adminImgPreviewZoomIn');
    var zoomOutBtn = document.getElementById('adminImgPreviewZoomOut');
    var zoomResetBtn = document.getElementById('adminImgPreviewZoomReset');
    if (zoomInBtn) zoomInBtn.addEventListener('click', function() { _setAdminPreviewZoomScale(_adminPreviewZoomScale + 0.25); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function() { _setAdminPreviewZoomScale(_adminPreviewZoomScale - 0.25); });
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', function() { _resetAdminPreviewZoom(); });

    var imgEl = document.getElementById('adminImgPreviewSrc');
    if (imgEl) {
      imgEl.addEventListener('load', function() {
        _adminPreviewPanX = 0;
        _adminPreviewPanY = 0;
        _applyAdminPreviewTransform();
      });
      imgEl.addEventListener('mousedown', function(e) {
        e.preventDefault();
        _startAdminPreviewDrag(e.clientX, e.clientY);
      });
      imgEl.addEventListener('touchstart', function(e) {
        if (!e.touches || !e.touches.length) return;
        _startAdminPreviewDrag(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      imgEl.addEventListener('wheel', function(e) {
        e.preventDefault();
        _setAdminPreviewZoomScale(_adminPreviewZoomScale + (e.deltaY < 0 ? 0.2 : -0.2));
      }, { passive: false });
    }

    window.addEventListener('mousemove', function(e) {
      _moveAdminPreviewDrag(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', function() {
      _endAdminPreviewDrag();
    });
    window.addEventListener('touchmove', function(e) {
      if (!e.touches || !e.touches.length) return;
      if (_adminPreviewIsDragging) e.preventDefault();
      _moveAdminPreviewDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchend', function() {
      _endAdminPreviewDrag();
    });
    window.addEventListener('resize', function() {
      _applyAdminPreviewTransform();
    });
  }

  function _setAdminPreviewActionsVisible(visible) {
    var actionsEl = document.querySelector('#adminImgPreviewModal .img-preview-actions');
    var gradientEl = document.querySelector('#adminImgPreviewModal .img-preview-gradient');
    if (actionsEl) actionsEl.style.display = visible ? 'flex' : 'none';
    if (gradientEl) gradientEl.style.display = visible ? '' : 'none';
  }

  function openAdminPreview(type, imgUrl) {
    _adminPreviewType = type;
    _adminPreviewRestoreModalId = null;
    var imgEl = document.getElementById('adminImgPreviewSrc');
    if (imgEl) imgEl.src = imgUrl;
    _setAdminPreviewActionsVisible(true);
    _resetAdminPreviewZoom();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('adminImgPreviewModal')).show();
  }

  function openAdminReadOnlyPreview(imgUrl, sourceModalId) {
    _adminPreviewType = null;
    var imgEl = document.getElementById('adminImgPreviewSrc');
    if (imgEl) imgEl.src = imgUrl;
    _setAdminPreviewActionsVisible(false);
    _resetAdminPreviewZoom();
    var previewModalEl = document.getElementById('adminImgPreviewModal');
    var showPreview = function() {
      bootstrap.Modal.getOrCreateInstance(previewModalEl).show();
    };
    var sourceEl = sourceModalId ? document.getElementById(sourceModalId) : null;
    if (sourceEl && sourceEl.classList.contains('show')) {
      _adminPreviewRestoreModalId = sourceModalId;
      sourceEl.addEventListener('hidden.bs.modal', function onSourceHidden() {
        showPreview();
      }, { once: true });
      bootstrap.Modal.getOrCreateInstance(sourceEl).hide();
    } else {
      _adminPreviewRestoreModalId = null;
      showPreview();
    }
  }

  var previewModalEl = document.getElementById('adminImgPreviewModal');
  if (previewModalEl) {
    _ensureAdminPreviewZoomControls();
    previewModalEl.addEventListener('show.bs.modal', function() {
      _resetAdminPreviewZoom();
    });
    previewModalEl.addEventListener('hidden.bs.modal', function() {
      if (!_adminPreviewRestoreModalId) return;
      var restoreEl = document.getElementById(_adminPreviewRestoreModalId);
      _adminPreviewRestoreModalId = null;
      if (restoreEl) bootstrap.Modal.getOrCreateInstance(restoreEl).show();
    });
  }

  var avatarPrev = document.getElementById('adminAvatarPreviewBtn');
  if (avatarPrev) {
    avatarPrev.addEventListener('click', function (e) {
      e.stopPropagation();
      var img = document.getElementById('adminProfAvatarImg');
      if (img) openAdminPreview('avatar', img.src);
    });
  }

  var bannerPrev = document.getElementById('adminBannerPreviewBtn');
  if (bannerPrev) {
    bannerPrev.addEventListener('click', function (e) {
      e.stopPropagation();
      var banner = document.getElementById('adminProfHeroBanner');
      if (!banner) return;
      var bg    = banner.style.backgroundImage || '';
      var match = bg.match(/url\(['"]?([^'"\)]+)['"]?\)/);
      if (match) openAdminPreview('banner', match[1]);
    });
  }

  var propertyPreviewImg = document.getElementById('lemImg');
  if (propertyPreviewImg) {
    propertyPreviewImg.addEventListener('click', function(e) {
      var src = propertyPreviewImg.getAttribute('src') || '';
      if (!src) return;
      e.stopPropagation();
      openAdminReadOnlyPreview(src, 'editPropertyModal');
    });
  }

  var subPreviewImg = document.getElementById('subPreviewImg');
  if (subPreviewImg) {
    subPreviewImg.addEventListener('click', function(e) {
      var src = subPreviewImg.getAttribute('src') || '';
      if (!src) return;
      e.stopPropagation();
      openAdminReadOnlyPreview(src, 'subPreviewModal');
    });
  }

  var projectPreviewImg = document.getElementById('projectPreviewImg');
  if (projectPreviewImg) {
    projectPreviewImg.addEventListener('click', function(e) {
      var src = projectPreviewImg.getAttribute('src') || '';
      if (!src) return;
      e.stopPropagation();
      openAdminReadOnlyPreview(src, 'projectPreviewModal');
    });
  }

  (function initDarkBackdrops() {
    var darkBackdropModalIds = [
      'editPropertyModal',
      'subPreviewModal',
      'projectPreviewModal',
      'adminImgPreviewModal'
    ];
    darkBackdropModalIds.forEach(function(modalId) {
      var modalEl = document.getElementById(modalId);
      if (!modalEl) return;
      modalEl.addEventListener('show.bs.modal', function() {
        setTimeout(_applyDarkModalBackdrops, 0);
      });
      modalEl.addEventListener('shown.bs.modal', function() {
        _applyDarkModalBackdrops();
      });
    });
  })();

  /* Replace input inside preview modal */
  var replaceInput = document.getElementById('adminImgPreviewReplaceInput');
  if (replaceInput) {
    replaceInput.addEventListener('change', function () {
      if (!_adminPreviewType) return;
      var file = this.files[0];
      if (!file) return;
      var fd       = new FormData();
      var endpoint = _adminPreviewType === 'avatar' ? '/admin/profile/upload-avatar' : '/admin/profile/upload-banner';
      fd.append(_adminPreviewType === 'avatar' ? 'avatar' : 'banner', file);
      fetch(endpoint, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken() },
        body: fd
      })
        .then(parseApiResponse)
        .then(function (res) {
          if (!res.ok) { showToast(getApiErrorMessage(res, 'Upload failed.'), 'danger'); return; }
          var freshUrl = res.data.url + '?t=' + Date.now();
          var modalImg = document.getElementById('adminImgPreviewSrc');
          if (modalImg) modalImg.src = freshUrl;
          if (_adminPreviewType === 'avatar') {
            var existingIcon = document.getElementById('adminProfAvatarIcon');
            if (existingIcon) existingIcon.remove();
            var existingImg = document.getElementById('adminProfAvatarImg');
            if (existingImg) {
              existingImg.src = freshUrl;
            } else {
              var wrap = document.getElementById('adminProfAvatarLg');
              if (wrap) {
                var img = document.createElement('img');
                img.id  = 'adminProfAvatarImg';
                img.src = freshUrl;
                img.alt = 'Profile photo';
                wrap.insertBefore(img, wrap.querySelector('.prof-avatar-upload-btn'));
              }
            }
            var prevBtn = document.getElementById('adminAvatarPreviewBtn');
            if (prevBtn) prevBtn.style.display = '';
            _syncAdminTopbarAvatar(freshUrl);
          } else {
            var banner = document.getElementById('adminProfHeroBanner');
            if (banner) {
              banner.style.backgroundImage    = 'url(\'' + freshUrl + '\')';
              banner.style.backgroundSize     = 'cover';
              banner.style.backgroundPosition = 'center';
            }
            var bPrevBtn = document.getElementById('adminBannerPreviewBtn');
            if (bPrevBtn) bPrevBtn.style.display = '';
          }
          showToast(_adminPreviewType === 'avatar' ? 'Profile photo updated!' : 'Cover photo updated!', 'success');
        })
        .catch(function () { showToast('Upload failed.', 'danger'); });
    });
  }

  /* Delete button inside preview modal */
  var deleteBtn = document.getElementById('adminImgPreviewDeleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function () {
      if (!_adminPreviewType) return;
      var url = _adminPreviewType === 'avatar' ? '/admin/profile/delete-avatar' : '/admin/profile/delete-banner';
      fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } })
        .then(parseApiResponse)
        .then(function (res) {
          if (!res.ok || !res.data || !res.data.success) { showToast(getApiErrorMessage(res, 'Delete failed.'), 'danger'); return; }
          bootstrap.Modal.getInstance(document.getElementById('adminImgPreviewModal')).hide();
          if (_adminPreviewType === 'avatar') {
            var img = document.getElementById('adminProfAvatarImg');
            if (img) img.remove();
            var wrap = document.getElementById('adminProfAvatarLg');
            if (wrap && !document.getElementById('adminProfAvatarIcon')) {
              var icon = document.createElement('i');
              icon.className = 'fas fa-user';
              icon.id = 'adminProfAvatarIcon';
              wrap.insertBefore(icon, wrap.firstChild);
            }
            var prevBtn = document.getElementById('adminAvatarPreviewBtn');
            if (prevBtn) prevBtn.style.display = 'none';
            _clearAdminTopbarAvatar();
          } else {
            var banner = document.getElementById('adminProfHeroBanner');
            if (banner) {
              banner.style.backgroundImage    = '';
              banner.style.backgroundSize     = '';
              banner.style.backgroundPosition = '';
            }
            var bPrevBtn = document.getElementById('adminBannerPreviewBtn');
            if (bPrevBtn) bPrevBtn.style.display = 'none';
          }
          showToast(_adminPreviewType === 'avatar' ? 'Profile photo removed.' : 'Cover photo removed.', 'success');
        })
        .catch(function () { showToast('Delete failed. Please try again.', 'danger'); });
    });
  }
}());

/* ── Admin Trips: assign + approve/reject ───────────────────── */
(function () {
  var tripsSearch = document.getElementById('adminTripsSearch');
  var tripsFilter = document.getElementById('adminTripsFilterStatus');
  var _tripActionState = { action: '', tripId: '' };
  var _adminTrmImages = [];
  var _adminTrmIdx = 0;

  function filterAdminTrips() {
    var table = document.getElementById('adminTripsTable');
    if (!table) return;
    var q = tripsSearch ? String(tripsSearch.value || '').toLowerCase().trim() : '';
    var s = tripsFilter ? String(tripsFilter.value || '').toLowerCase().trim() : '';
    var rows = table.querySelectorAll('tbody tr[id^="admin-trip-row-"]');
    var visible = 0;
    rows.forEach(function (row) {
      var text = row.textContent.toLowerCase();
      var status = String(row.getAttribute('data-status') || '').toLowerCase();
      var show = (!q || text.indexOf(q) !== -1) && (!s || status === s);
      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    var noResults = document.getElementById('adminTripsNoResults');
    if (noResults) noResults.classList.toggle('d-none', visible > 0);
  }

  if (tripsSearch) tripsSearch.addEventListener('input', filterAdminTrips);
  if (tripsFilter) tripsFilter.addEventListener('change', filterAdminTrips);

  function removeTripRow(tripId) {
    var row = document.getElementById('admin-trip-row-' + tripId);
    if (row) row.remove();
    var table = document.getElementById('adminTripsTable');
    if (!table) return;
    var left = table.querySelectorAll('tbody tr[id^="admin-trip-row-"]').length;
    if (left > 0) return;
    var wrap = table.closest('.table-responsive');
    var noResults = document.getElementById('adminTripsNoResults');
    if (noResults) noResults.classList.add('d-none');
    if (wrap) {
      wrap.innerHTML = ''
        + '<div class="text-center py-5 text-muted" id="adminTripQueueEmpty">'
        + '  <i class="fas fa-check-circle fa-2x mb-2 d-block" style="color:var(--clr-accent);"></i>'
        + '  <span class="fw-semibold d-block mb-1">No tripping requests yet.</span>'
        + '  <span class="small">New requests will appear here once clients submit them.</span>'
        + '</div>';
    }
  }

  function _tripBadgeHtml(status) {
    status = String(status || '').toLowerCase();
    if (status === 'approved') return '<span class="sqh-badge badge-qualified">Approved</span>';
    if (status === 'sold') return '<span class="sqh-badge badge-not-qualified">Sold</span>';
    if (status === 'rejected') return '<span class="sqh-badge badge-not-qualified">Rejected</span>';
    return '<span class="sqh-badge badge-conditional">Pending</span>';
  }

  function _setAdminTripModalStatus(status) {
    var badgeEl = document.getElementById('adminTrmStatus');
    if (!badgeEl) return;
    var s = String(status || 'pending').toLowerCase();
    var text = s.charAt(0).toUpperCase() + s.slice(1);
    var cls = 'badge-conditional';
    if (s === 'approved') cls = 'badge-qualified';
    else if (s === 'sold' || s === 'rejected') cls = 'badge-not-qualified';
    badgeEl.className = 'sqh-badge ' + cls;
    badgeEl.textContent = text;
  }

  function _adminTrmShowSlide(idx) {
    if (!_adminTrmImages.length) return;
    _adminTrmIdx = (idx + _adminTrmImages.length) % _adminTrmImages.length;

    var imgEl = document.getElementById('adminTrmImg');
    var dotsEl = document.getElementById('adminTrmDots');
    if (!imgEl) return;

    imgEl.src = '/uploads/' + _adminTrmImages[_adminTrmIdx];
    if (dotsEl) {
      dotsEl.querySelectorAll('.trm-dot').forEach(function (dot, i) {
        dot.classList.toggle('active', i === _adminTrmIdx);
      });
    }
  }

  function _adminTrmLoadImages(imagesCsv) {
    _adminTrmImages = String(imagesCsv || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    _adminTrmIdx = 0;

    var imgWrap = document.getElementById('adminTrmImgWrap');
    var imgEl = document.getElementById('adminTrmImg');
    var placeholderEl = document.getElementById('adminTrmImgPlaceholder');
    var prevBtn = document.getElementById('adminTrmPrev');
    var nextBtn = document.getElementById('adminTrmNext');
    var dotsEl = document.getElementById('adminTrmDots');
    if (!imgWrap || !imgEl || !placeholderEl || !prevBtn || !nextBtn || !dotsEl) return;

    if (!_adminTrmImages.length) {
      imgEl.classList.add('d-none');
      imgEl.src = '';
      placeholderEl.classList.remove('d-none');
      prevBtn.classList.add('d-none');
      nextBtn.classList.add('d-none');
      dotsEl.innerHTML = '';
      return;
    }

    imgEl.classList.remove('d-none');
    placeholderEl.classList.add('d-none');
    _adminTrmShowSlide(0);

    if (_adminTrmImages.length > 1) {
      prevBtn.classList.remove('d-none');
      nextBtn.classList.remove('d-none');
      dotsEl.innerHTML = _adminTrmImages.map(function (_, i) {
        return '<span class="trm-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></span>';
      }).join('');
      dotsEl.querySelectorAll('.trm-dot').forEach(function (dot) {
        dot.addEventListener('click', function () {
          _adminTrmShowSlide(parseInt(this.getAttribute('data-idx'), 10) || 0);
        });
      });
    } else {
      prevBtn.classList.add('d-none');
      nextBtn.classList.add('d-none');
      dotsEl.innerHTML = '';
    }
  }

  function _openAdminTripRequestModal(tripId) {
    var row = document.getElementById('admin-trip-row-' + tripId);
    if (!row) return;

    var status = String(row.getAttribute('data-status') || '').toLowerCase();
    if (status === 'pending') return;

    var modalEl = document.getElementById('adminTripRequestModal');
    if (!modalEl) return;

    modalEl.dataset.tripId = String(tripId || '');
    modalEl.dataset.tripStatus = status;

    var clientEl = document.getElementById('adminTrmClient');
    var propertyEl = document.getElementById('adminTrmProperty');
    var dateEl = document.getElementById('adminTrmDate');
    var timeEl = document.getElementById('adminTrmTime');
    var submittedEl = document.getElementById('adminTrmSubmitted');
    var noteEl = document.getElementById('adminTrmNote');

    if (clientEl) clientEl.textContent = row.getAttribute('data-client-name') || '—';
    if (propertyEl) propertyEl.textContent = row.getAttribute('data-property-name') || '—';
    _adminTrmLoadImages(row.getAttribute('data-property-images') || '');
    if (dateEl) {
      var isoDate = String(row.getAttribute('data-preferred-date') || '').trim();
      if (isoDate) {
        var d = new Date(isoDate + 'T00:00:00');
        dateEl.textContent = Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
      } else {
        dateEl.textContent = '—';
      }
    }
    if (timeEl) timeEl.textContent = row.getAttribute('data-preferred-time') || '—';
    if (submittedEl) submittedEl.textContent = row.getAttribute('data-submitted-date') || '—';
    if (noteEl) noteEl.textContent = row.getAttribute('data-agent-note') || 'No note provided.';

    _setAdminTripModalStatus(status);
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function _setTripRowFinalized(tripId, status, note) {
    var row = document.getElementById('admin-trip-row-' + tripId);
    if (!row) return;
    row.setAttribute('data-status', status);
    row.setAttribute('data-trip-status', String(status || '').charAt(0).toUpperCase() + String(status || '').slice(1));
    row.setAttribute('data-agent-note', String(note || 'No note provided.'));

    var cells = row.querySelectorAll('td');
    if (!cells || cells.length < 10) return;

    var tripStatusCell = cells[5];
    var visitStatusCell = cells[6];
    var assignCell = cells[7];
    var noteCell = cells[8];
    var actionCell = cells[9];

    if (tripStatusCell) tripStatusCell.innerHTML = _tripBadgeHtml(status);
    if (visitStatusCell) {
      if (status === 'visited' || status === 'sold') {
        visitStatusCell.innerHTML = '<span class="sqh-badge badge-qualified">Visited</span>';
      } else {
        visitStatusCell.innerHTML = '<span class="sqh-badge badge-conditional">Pending</span>';
      }
    }

    if (assignCell) {
      var labelEl = document.getElementById('tripAssignAgentLabel-' + tripId);
      var selectedLabel = labelEl ? String(labelEl.textContent || '').trim() : '';
      var hiddenAssign = document.getElementById('tripAssignAgent-' + tripId);
      if (status === 'rejected') {
        if (hiddenAssign) hiddenAssign.value = '';
        if (labelEl) labelEl.textContent = '';
        assignCell.innerHTML = '<span class="small fw-semibold text-dark">—</span>';
      } else {
        assignCell.innerHTML = '<span class="small fw-semibold text-dark">' + (selectedLabel || '—') + '</span>';
      }
    }

    var safeNote = String(note || '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    if (noteCell) noteCell.innerHTML = '<span class="text-muted small">' + safeNote + '</span>';

    if (actionCell) {
      var clientId = String(row.getAttribute('data-client-id') || '').trim();
      if (status === 'approved') {
        actionCell.innerHTML = ''
          + '<div class="d-flex gap-1">'
          + '  <button type="button" class="btn btn-sm btn-outline-blue admin-trip-visit-btn" data-trip-id="' + String(tripId || '') + '" title="Mark as Visited">'
          + '    <i class="fas fa-map-marked-alt"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-blue open-client-modal-btn" data-client-id="' + clientId + '" title="View Client Details">'
          + '    <i class="fas fa-user"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-blue admin-trip-view-property-btn" data-property-id="' + String(row.getAttribute('data-property-id') || '') + '" title="View Property Details">'
          + '    <i class="fas fa-home"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-lime open-trip-request-btn" data-trip-id="' + String(tripId || '') + '" title="View Trip Request">'
          + '    <i class="fas fa-clipboard-list"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-crimson admin-trip-delete-btn" data-trip-id="' + String(tripId || '') + '" title="Delete">'
          + '    <i class="fas fa-trash"></i>'
          + '  </button>'
          + '</div>';
      } else if (status === 'sold') {
        actionCell.innerHTML = ''
          + '<div class="d-flex gap-1">'
          + '  <button type="button" class="btn btn-sm btn-outline-blue open-client-modal-btn" data-client-id="' + clientId + '" title="View Client Details">'
          + '    <i class="fas fa-user"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-blue admin-trip-view-property-btn" data-property-id="' + String(row.getAttribute('data-property-id') || '') + '" title="View Property Details">'
          + '    <i class="fas fa-home"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-lime open-trip-request-btn" data-trip-id="' + String(tripId || '') + '" title="View Trip Request">'
          + '    <i class="fas fa-clipboard-list"></i>'
          + '  </button>'
          + '</div>';
      } else {
        actionCell.innerHTML = ''
          + '<div class="d-flex gap-1">'
          + '  <button type="button" class="btn btn-sm btn-outline-blue open-client-modal-btn" data-client-id="' + clientId + '" title="View Client Details">'
          + '    <i class="fas fa-user"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-blue admin-trip-view-property-btn" data-property-id="' + String(row.getAttribute('data-property-id') || '') + '" title="View Property Details">'
          + '    <i class="fas fa-home"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-lime open-trip-request-btn" data-trip-id="' + String(tripId || '') + '" title="View Trip Request">'
          + '    <i class="fas fa-clipboard-list"></i>'
          + '  </button>'
          + '  <button type="button" class="btn btn-sm btn-outline-crimson admin-trip-delete-btn" data-trip-id="' + String(tripId || '') + '" title="Delete">'
          + '    <i class="fas fa-trash"></i>'
          + '  </button>'
          + '</div>';
      }
    }
  }

  function _openAssignModal(tripId) {
    var row = document.getElementById('admin-trip-row-' + tripId);
    if (!row) return;

    var modalEl = document.getElementById('adminTripAssignModal');
    if (!modalEl) return;

    var tripIdEl = document.getElementById('tripAssignModalTripId');
    var dateEl = document.getElementById('tripAssignModalDate');
    var selectEl = document.getElementById('tripAssignModalAgentSelect');
    var hintEl = document.getElementById('tripAssignModalHint');
    if (!tripIdEl || !dateEl || !selectEl || !hintEl) return;

    tripIdEl.value = String(tripId || '');
    dateEl.value = String(row.getAttribute('data-preferred-date') || '');

    var options = [];
    try {
      options = JSON.parse(row.getAttribute('data-available-agents') || '[]') || [];
    } catch (_) {
      options = [];
    }

    selectEl.innerHTML = '<option value="">Select available agent</option>';
    options.forEach(function (ag) {
      var opt = document.createElement('option');
      opt.value = String(ag.id || '');
      opt.textContent = String(ag.name || 'Agent');
      selectEl.appendChild(opt);
    });

    var hiddenAssign = document.getElementById('tripAssignAgent-' + tripId);
    if (hiddenAssign && hiddenAssign.value) selectEl.value = hiddenAssign.value;

    hintEl.textContent = '';

    var saveBtn = document.getElementById('tripAssignModalSaveBtn');
    if (saveBtn) saveBtn.disabled = options.length === 0;

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  _bind('tripAssignModalSaveBtn', 'click', function () {
    var tripId = String((document.getElementById('tripAssignModalTripId') || {}).value || '');
    var selectEl = document.getElementById('tripAssignModalAgentSelect');
    if (!tripId || !selectEl) return;

    var selectedId = String(selectEl.value || '').trim();
    var selectedText = selectedId && selectEl.selectedOptions && selectEl.selectedOptions.length
      ? String(selectEl.selectedOptions[0].textContent || '').trim()
      : '';

    var hiddenAssign = document.getElementById('tripAssignAgent-' + tripId);
    if (hiddenAssign) hiddenAssign.value = selectedId;

    var labelEl = document.getElementById('tripAssignAgentLabel-' + tripId);
    if (labelEl) labelEl.textContent = selectedText || '';

    var approveBtn = document.querySelector('.admin-trip-approve-btn[data-trip-id="' + tripId + '"]');
    if (approveBtn) approveBtn.disabled = !selectedId;

    bootstrap.Modal.getInstance(document.getElementById('adminTripAssignModal'))?.hide();
  });

  function _openTripActionConfirm(action, tripId) {
    var modalEl = document.getElementById('adminTripActionConfirmModal');
    if (!modalEl) return;
    _tripActionState.action = action;
    _tripActionState.tripId = String(tripId || '');

    var iconEl = document.getElementById('adminTripActionIcon');
    var titleEl = document.getElementById('adminTripActionTitle');
    var descEl = document.getElementById('adminTripActionDesc');
    var btnEl = document.getElementById('adminTripActionConfirmBtn');
    var rejectReasonEl = document.getElementById('adminTripRejectReason');
    var rejectReasonNoteEl = document.getElementById('adminTripRejectReasonNote');
    if (!iconEl || !titleEl || !descEl || !btnEl) return;
    if (rejectReasonEl) rejectReasonEl.value = '';
    if (rejectReasonNoteEl) rejectReasonNoteEl.value = '';

    if (action === 'approve') {
      iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
      iconEl.style.color = 'var(--clr-accent-dk)';
      titleEl.textContent = 'Approve this tripping request?';
      descEl.textContent = 'The selected available agent will be assigned to this request.';
      btnEl.className = 'btn btn-lime px-4';
      btnEl.innerHTML = '<i class="fas fa-check me-1"></i>Approve';
    } else if (action === 'visited') {
      iconEl.innerHTML = '<i class="fas fa-map-marked-alt"></i>';
      iconEl.style.color = 'var(--clr-blue)';
      titleEl.textContent = 'Mark this trip as visited?';
      descEl.textContent = 'The request will be marked as visited and the visit status will be updated.';
      btnEl.className = 'btn btn-outline-blue px-4';
      btnEl.innerHTML = '<i class="fas fa-map-marked-alt me-1"></i>Mark Visited';
    } else if (action === 'reject') {
      iconEl.innerHTML = '<i class="fas fa-times-circle"></i>';
      iconEl.style.color = 'var(--clr-primary)';
      titleEl.textContent = 'Reject this tripping request?';
      descEl.textContent = 'The request will be marked as rejected and can still be deleted later.';
      btnEl.className = 'btn btn-crimson px-4';
      btnEl.innerHTML = '<i class="fas fa-times me-1"></i>Reject';
      document.getElementById('adminTripRejectReasonWrap')?.classList.remove('d-none');
      document.getElementById('adminTripRejectReasonNoteWrap')?.classList.remove('d-none');
    } else if (action === 'sold') {
      iconEl.innerHTML = '<i class="fas fa-handshake"></i>';
      iconEl.style.color = 'var(--clr-blue)';
      titleEl.textContent = 'Mark this trip as sold?';
      descEl.textContent = 'The property will be marked sold and both client and assigned agent will be notified.';
      btnEl.className = 'btn btn-outline-blue px-4';
      btnEl.innerHTML = '<i class="fas fa-handshake me-1"></i>Mark Sold';
    } else {
      iconEl.innerHTML = '<i class="fas fa-trash"></i>';
      iconEl.style.color = 'var(--clr-primary)';
      titleEl.textContent = 'Delete this finalized request?';
      descEl.textContent = 'Only approved or rejected requests can be deleted. This cannot be undone.';
      btnEl.className = 'btn btn-crimson px-4';
      btnEl.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
    }

    if (action !== 'reject') {
      document.getElementById('adminTripRejectReasonWrap')?.classList.add('d-none');
      document.getElementById('adminTripRejectReasonNoteWrap')?.classList.add('d-none');
      if (document.getElementById('adminTripRejectReason')) document.getElementById('adminTripRejectReason').value = '';
      if (document.getElementById('adminTripRejectReasonNote')) document.getElementById('adminTripRejectReasonNote').value = '';
    }
    if (action !== 'approve') {
      document.getElementById('adminTripApproveNoteWrap')?.classList.add('d-none');
      if (document.getElementById('adminTripApproveNote')) document.getElementById('adminTripApproveNote').value = '';
    } else {
      document.getElementById('adminTripApproveNoteWrap')?.classList.remove('d-none');
    }
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  _bind('adminTripRejectReason', 'change', function () {
    var noteWrap = document.getElementById('adminTripRejectReasonNoteWrap');
    if (!noteWrap) return;
    noteWrap.classList.remove('d-none');
  });

  _bind('adminTripActionConfirmBtn', 'click', function () {
    var tripId = _tripActionState.tripId;
    var action = _tripActionState.action;
    if (!tripId || !action) return;

    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing…';

    var payload = {
      note: ((document.getElementById('adminTripApproveNote') || {}).value || '').trim() || ((document.getElementById('tripNote-' + tripId) || {}).value || '').trim()
    };
    if (action === 'reject') {
      var rejectReason = ((document.getElementById('adminTripRejectReason') || {}).value || '').trim();
      var rejectReasonNote = ((document.getElementById('adminTripRejectReasonNote') || {}).value || '').trim();
      if (rejectReason) {
        payload.note = rejectReason + (rejectReasonNote ? ': ' + rejectReasonNote : '');
      } else if (!payload.note) {
        payload.note = '';
      }
    }
    var url = '';

    if (action === 'approve') {
      var selectedAgent = String(((document.getElementById('tripAssignAgent-' + tripId) || {}).value || '')).trim();
      if (!selectedAgent) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check me-1"></i>Approve';
        bootstrap.Modal.getInstance(document.getElementById('adminTripActionConfirmModal'))?.hide();
        _openAssignModal(tripId);
        showToast('Please choose an available agent first.', 'warning');
        return;
      }
      payload.agent_id = selectedAgent;
      url = '/agent/trip/' + encodeURIComponent(tripId) + '/approve';
    } else if (action === 'visited') {
      url = '/agent/trip/' + encodeURIComponent(tripId) + '/mark-visited';
    } else if (action === 'reject') {
      url = '/agent/trip/' + encodeURIComponent(tripId) + '/reject';
    } else if (action === 'sold') {
      url = '/agent/trip/' + encodeURIComponent(tripId) + '/mark-bought';
    } else {
      url = '/agent/trip/' + encodeURIComponent(tripId) + '/delete';
    }

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken()
      },
      body: action === 'delete' ? null : JSON.stringify(payload)
    })
      .then(parseApiResponse)
      .then(function (res) {
        btn.disabled = false;
        if (action === 'approve') btn.innerHTML = '<i class="fas fa-check me-1"></i>Approve';
        else if (action === 'visited') btn.innerHTML = '<i class="fas fa-map-marked-alt me-1"></i>Mark Visited';
        else if (action === 'reject') btn.innerHTML = '<i class="fas fa-times me-1"></i>Reject';
        else if (action === 'sold') btn.innerHTML = '<i class="fas fa-handshake me-1"></i>Mark Sold';
        else btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';

        if (!res.ok || !res.data || (res.data.success !== true && res.data.ok !== true)) {
          showToast(getApiErrorMessage(res, 'Unable to update tripping request.'), 'danger');
          return;
        }

        bootstrap.Modal.getInstance(document.getElementById('adminTripActionConfirmModal'))?.hide();

        if (action === 'approve') {
          _setTripRowFinalized(tripId, 'approved', payload.note || '');
          showToast('Tripping request approved and assigned.', 'success');
        } else if (action === 'visited') {
          _setTripRowFinalized(tripId, 'visited', (res.data && res.data.note) || payload.note || 'Trip marked as visited by admin.');
          showToast('Trip marked as visited.', 'success');
        } else if (action === 'reject') {
          _setTripRowFinalized(tripId, 'rejected', payload.note || '');
          showToast('Tripping request rejected.', 'info');
        } else if (action === 'sold') {
          _setTripRowFinalized(tripId, 'sold', (res.data && res.data.note) || payload.note || 'Property marked as sold by admin.');
          showToast('Trip marked as sold. Notifications sent.', 'success');
        } else {
          removeTripRow(tripId);
          showToast('Tripping request deleted.', 'success');
        }

        _tripActionState.action = '';
        _tripActionState.tripId = '';
        filterAdminTrips();
      })
      .catch(function () {
        btn.disabled = false;
        if (action === 'approve') btn.innerHTML = '<i class="fas fa-check me-1"></i>Approve';
        else if (action === 'visited') btn.innerHTML = '<i class="fas fa-map-marked-alt me-1"></i>Mark Visited';
        else if (action === 'reject') btn.innerHTML = '<i class="fas fa-times me-1"></i>Reject';
        else if (action === 'sold') btn.innerHTML = '<i class="fas fa-handshake me-1"></i>Mark Sold';
        else btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
        showToast('Network error. Please try again.', 'danger');
      });
  });

  document.addEventListener('click', function (e) {
    var openAssignBtn = e.target.closest('.admin-trip-open-assign-btn');
    if (openAssignBtn) {
      e.preventDefault();
      _openAssignModal(openAssignBtn.getAttribute('data-trip-id'));
      return;
    }

    var openClientBtn = e.target.closest('.open-client-modal-btn');
    if (openClientBtn) {
      e.preventDefault();
      var clientId = parseInt(openClientBtn.getAttribute('data-client-id'), 10);
      if (clientId) openUserModal(clientId);
      return;
    }

    var openTripBtn = e.target.closest('.open-trip-request-btn');
    if (openTripBtn) {
      e.preventDefault();
      _openAdminTripRequestModal(openTripBtn.getAttribute('data-trip-id'));
      return;
    }

    var openPropertyBtn = e.target.closest('.admin-trip-view-property-btn');
    if (openPropertyBtn) {
      e.preventDefault();
      var propId = parseInt(openPropertyBtn.getAttribute('data-property-id'), 10);
      if (propId) _openPropertyDetailsModal(propId);
      return;
    }

    var approveBtn = e.target.closest('.admin-trip-approve-btn');
    var visitBtn = e.target.closest('.admin-trip-visit-btn');
    var rejectBtn = e.target.closest('.admin-trip-reject-btn');
    var soldBtn = e.target.closest('.admin-trip-sold-btn');
    var deleteBtn = e.target.closest('.admin-trip-delete-btn');
    if (!approveBtn && !visitBtn && !rejectBtn && !soldBtn && !deleteBtn) return;

    var btn = approveBtn || visitBtn || rejectBtn || soldBtn || deleteBtn;
    var tripId = btn.getAttribute('data-trip-id');
    if (!tripId) return;

    if (approveBtn) {
      var selectedAgent = String(((document.getElementById('tripAssignAgent-' + tripId) || {}).value || '')).trim();
      if (!selectedAgent) {
        _openAssignModal(tripId);
        showToast('Please choose an available agent first.', 'warning');
        return;
      }
      _openTripActionConfirm('approve', tripId);
    }
    else if (visitBtn) _openTripActionConfirm('visited', tripId);
    else if (rejectBtn) _openTripActionConfirm('reject', tripId);
    else if (soldBtn) _openTripActionConfirm('sold', tripId);
    else _openTripActionConfirm('delete', tripId);
  });

  document.querySelectorAll('.admin-trip-approve-btn').forEach(function (btn) {
    var tripId = String(btn.getAttribute('data-trip-id') || '').trim();
    if (!tripId) return;
    var selectedAgent = String(((document.getElementById('tripAssignAgent-' + tripId) || {}).value || '')).trim();
    btn.disabled = !selectedAgent;
  });

  _bind('adminTrmPrev', 'click', function (e) {
    e.preventDefault();
    _adminTrmShowSlide(_adminTrmIdx - 1);
  });

  _bind('adminTrmNext', 'click', function (e) {
    e.preventDefault();
    _adminTrmShowSlide(_adminTrmIdx + 1);
  });

  filterAdminTrips();
}());

function _syncAdminCreatePropertyLocation() {
  var regionSel = document.getElementById('acp_region_select');
  var provinceSel = document.getElementById('acp_province_select');
  var citySel = document.getElementById('acp_citymun_select');
  var brgySel = document.getElementById('acp_barangay_select');
  function txt(sel) {
    if (!sel || !sel.value || !sel.selectedOptions || !sel.selectedOptions.length) return '';
    return (sel.selectedOptions[0].textContent || '').trim();
  }
  var regionName = txt(regionSel);
  var provinceName = txt(provinceSel);
  var cityName = txt(citySel);
  var brgyName = txt(brgySel);
  var street = ((document.getElementById('acp_street') || {}).value || '').trim();
  var block = ((document.getElementById('acp_block') || {}).value || '').trim();
  var lotNo = ((document.getElementById('acp_lot_no') || {}).value || '').trim();
  var lineParts = [];
  if (street) lineParts.push(street);
  if (block) lineParts.push('Block ' + block);
  if (lotNo) lineParts.push('Lot ' + lotNo);
  var line = lineParts.join(', ');
  var tail = [brgyName, cityName, provinceName, regionName].filter(Boolean).join(', ');
  var loc = [line, tail].filter(Boolean).join(', ');
  var setVal = function (id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('acp_location', loc);
  setVal('acp_region', regionName);
  setVal('acp_region_code', regionSel ? regionSel.value : '');
  setVal('acp_region_name', regionName);
  setVal('acp_province_code', provinceSel ? provinceSel.value : '');
  setVal('acp_province_name', provinceName);
  setVal('acp_citymun_code', citySel ? citySel.value : '');
  setVal('acp_citymun_name', cityName);
  setVal('acp_barangay_code', brgySel ? brgySel.value : '');
  setVal('acp_barangay_name', brgyName);
}

function initAdminCreatePropertyPsgc() {
  var regionSel = document.getElementById('acp_region_select');
  var provinceSel = document.getElementById('acp_province_select');
  var citySel = document.getElementById('acp_citymun_select');
  var brgySel = document.getElementById('acp_barangay_select');
  var subdivisionSel = document.getElementById('acp_subdivision');
  if (!regionSel || !provinceSel || !citySel || !brgySel) return;

  function _applyAcpSubdivisionMeta() {
    if (!subdivisionSel || !subdivisionSel.value || !subdivisionSel.selectedOptions || !subdivisionSel.selectedOptions.length) {
      return;
    }
    var opt = subdivisionSel.selectedOptions[0];
    var regionCode = String(opt.dataset.subRegionCode || '');
    var regionName = String(opt.dataset.subRegionName || '');
    var provinceCode = String(opt.dataset.subProvinceCode || '');
    var provinceName = String(opt.dataset.subProvinceName || '');
    var cityCode = String(opt.dataset.subCitymunCode || '');
    var cityName = String(opt.dataset.subCitymunName || '');
    var brgyCode = String(opt.dataset.subBarangayCode || '');
    var brgyName = String(opt.dataset.subBarangayName || '');

    if (regionCode || regionName) _subFillSelect(regionSel, [{ code: regionCode, name: regionName || regionCode }], '-- Select --', regionCode);
    if (provinceCode || provinceName) _subFillSelect(provinceSel, [{ code: provinceCode, name: provinceName || provinceCode }], '-- Select --', provinceCode);
    if (cityCode || cityName) _subFillSelect(citySel, [{ code: cityCode, name: cityName || cityCode }], '-- Select --', cityCode);
    if (brgyCode || brgyName) _subFillSelect(brgySel, [{ code: brgyCode, name: brgyName || brgyCode }], '-- Select --', brgyCode);

    _syncAdminCreatePropertyLocation();
  }

  regionSel.addEventListener('change', function () {
    if (!regionSel.value) {
      _subResetSelect(provinceSel, '-- Select --');
      _subResetSelect(citySel, '-- Select --');
      _subResetSelect(brgySel, '-- Select --');
      _syncAdminCreatePropertyLocation();
      return;
    }
    _subGetItems('/api/psgc/provinces?region_code=' + encodeURIComponent(regionSel.value))
      .then(function (items) {
        _subFillSelect(provinceSel, items, '-- Select --');
        _subResetSelect(citySel, '-- Select --');
        _subResetSelect(brgySel, '-- Select --');
        _syncAdminCreatePropertyLocation();
      })
      .catch(function () { showToast('Unable to load provinces right now.', 'warning'); });
  });

  provinceSel.addEventListener('change', function () {
    if (!provinceSel.value && !regionSel.value) return;
    var q = provinceSel.value
      ? ('province_code=' + encodeURIComponent(provinceSel.value))
      : ('region_code=' + encodeURIComponent(regionSel.value));
    _subGetItems('/api/psgc/cities?' + q)
      .then(function (items) {
        _subFillSelect(citySel, items, '-- Select --');
        _subResetSelect(brgySel, '-- Select --');
        _syncAdminCreatePropertyLocation();
      })
      .catch(function () { showToast('Unable to load cities right now.', 'warning'); });
  });

  citySel.addEventListener('change', function () {
    if (!citySel.value) {
      _subResetSelect(brgySel, '-- Select --');
      _syncAdminCreatePropertyLocation();
      return;
    }
    _subGetItems('/api/psgc/barangays?city_mun_code=' + encodeURIComponent(citySel.value))
      .then(function (items) {
        _subFillSelect(brgySel, items, '-- Select --');
        _syncAdminCreatePropertyLocation();
      })
      .catch(function () { showToast('Unable to load barangays right now.', 'warning'); });
  });

  brgySel.addEventListener('change', _syncAdminCreatePropertyLocation);
  _bind('acp_street', 'input', _syncAdminCreatePropertyLocation);
  _bind('acp_block', 'input', _syncAdminCreatePropertyLocation);
  _bind('acp_lot_no', 'input', _syncAdminCreatePropertyLocation);
  if (subdivisionSel) {
    subdivisionSel.addEventListener('change', _applyAcpSubdivisionMeta);
  }

  _subGetItems('/api/psgc/regions')
    .then(function (items) {
      _subFillSelect(regionSel, items, '-- Select --');
      _syncAdminCreatePropertyLocation();
    })
    .catch(function () { showToast('Unable to load PSGC regions.', 'warning'); });
}
initAdminCreatePropertyPsgc();

var _pendingAcpFiles = [];

(function initAdminCreateProperty() {
  var btn = document.getElementById('adminCreatePropBtn');
  var modalEl = document.getElementById('adminCreatePropertyModal');
  if (!btn || !modalEl) return;

  function syncAcpFileNames() {
    var fnEl = document.getElementById('acp_images_filenames');
    if (!fnEl) return;
    var names = _pendingAcpFiles.filter(Boolean).map(function (f) { return f.name; });
    fnEl.value = names.join(', ');
  }

  function resetAcpFormState() {
    _pendingAcpFiles = [];
    var wrap = document.getElementById('acp_images_wrap');
    if (wrap) wrap.innerHTML = '';
    var fInput = document.getElementById('acp_images');
    if (fInput) fInput.value = '';
    var fnEl = document.getElementById('acp_images_filenames');
    if (fnEl) fnEl.value = '';
    _syncPropertyPricingPreview('acp');
  }

  function _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _titleCase(str) {
    return String(str || '').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function _pushNewPropertyCard(prop) {
    var grid = document.getElementById('propCardsGrid');
    if (!grid || !prop || !prop.id) return;

    var emptyState = document.getElementById('propEmptyState');
    if (emptyState) emptyState.remove();

    var imagesCsv = String(prop.images || '');
    var images = imagesCsv ? imagesCsv.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    var firstImg = images.length ? images[0] : '';
    var imgCount = images.length;
    var propType = String(prop.prop_type || '');
    var location = String(prop.location || '');
    var psgcTail = [
      String(prop.barangay_name || ''),
      String(prop.citymun_name || ''),
      String(prop.province_name || ''),
      String(prop.region_name || '')
    ].filter(Boolean).join(', ');
    if (psgcTail && location.indexOf(psgcTail) === -1) {
      location = [location, psgcTail].filter(Boolean).join(', ');
    }
    var name = String(prop.name || 'Property');
    var status = 'available';
    var listingStatus = String(prop.listing_status || 'available').toLowerCase();
    if (listingStatus !== 'sold' && listingStatus !== 'reserved' && listingStatus !== 'available') listingStatus = 'available';
    var modelKey = String(prop.model_key || '').trim();
    if (!modelKey) {
      modelKey = String(prop.subdivision_id || '') + ':' + String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    }
    var colStatus = listingStatus;
    var priceNum = Number(prop.price || 0);
    var priceText = priceNum ? ('₱' + priceNum.toLocaleString('en-PH', { maximumFractionDigits: 0 })) : '₱0';

    var col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-xl-4 prop-card-col';
    col.setAttribute('data-status', colStatus);
    col.setAttribute('data-prop-name', name);
    col.setAttribute('data-prop-loc', location);
    col.setAttribute('data-prop-subdiv', String(prop.subdivision_name || ''));

    col.innerHTML = ''
      + '<div class="prop-card prop-card-clickable"'
      + ' data-prop-id="' + _escapeHtml(prop.id) + '"'
      + ' data-prop-name="' + _escapeHtml(name) + '"'
      + ' data-prop-subdivision="' + _escapeHtml(prop.subdivision_name || '') + '"'
      + ' data-prop-location="' + _escapeHtml(location) + '"'
      + ' data-prop-region="' + _escapeHtml(prop.region || '') + '"'
      + ' data-prop-region-code="' + _escapeHtml(prop.region_code || '') + '"'
      + ' data-prop-region-name="' + _escapeHtml(prop.region_name || '') + '"'
      + ' data-prop-province-code="' + _escapeHtml(prop.province_code || '') + '"'
      + ' data-prop-province-name="' + _escapeHtml(prop.province_name || '') + '"'
      + ' data-prop-citymun-code="' + _escapeHtml(prop.citymun_code || '') + '"'
      + ' data-prop-citymun-name="' + _escapeHtml(prop.citymun_name || '') + '"'
      + ' data-prop-barangay-code="' + _escapeHtml(prop.barangay_code || '') + '"'
      + ' data-prop-barangay-name="' + _escapeHtml(prop.barangay_name || '') + '"'
      + ' data-prop-unit-id="' + _escapeHtml(prop.unit_id || '') + '"'
      + ' data-prop-type="' + _escapeHtml(propType) + '"'
      + ' data-prop-unit-type="' + _escapeHtml(prop.unit_type || '') + '"'
      + ' data-prop-price="' + _escapeHtml(priceNum ? priceNum.toLocaleString('en-PH', { maximumFractionDigits: 0 }) : '0') + '"'
      + ' data-prop-promo-discount-rate="' + _escapeHtml(prop.promo_discount_rate || 0) + '"'
      + ' data-prop-reservation-fee="' + _escapeHtml(prop.reservation_fee || 0) + '"'
      + ' data-prop-downpayment-rate="' + _escapeHtml(prop.downpayment_rate || 0) + '"'
      + ' data-prop-downpayment-terms-months="' + _escapeHtml(prop.downpayment_terms_months || 0) + '"'
      + ' data-prop-loanable-percentage="' + _escapeHtml(prop.loanable_percentage || 0) + '"'
      + ' data-prop-interest-rate="' + _escapeHtml(prop.interest_rate || 8.5) + '"'
      + ' data-prop-vat-rate="' + _escapeHtml(prop.vat_rate || 0) + '"'
      + ' data-prop-lmf-rate="' + _escapeHtml(prop.lmf_rate || 0) + '"'
      + ' data-prop-bedrooms="' + _escapeHtml(prop.bedrooms || '') + '"'
      + ' data-prop-bathrooms="' + _escapeHtml(prop.bathrooms || '') + '"'
      + ' data-prop-storeys="' + _escapeHtml(prop.storeys || '') + '"'
      + ' data-prop-floor-area="' + _escapeHtml(prop.floor_area || '') + '"'
      + ' data-prop-lot-area="' + _escapeHtml(prop.lot_area || '') + '"'
      + ' data-prop-description="' + _escapeHtml(prop.description || '') + '"'
      + ' data-prop-custom-availability-note="' + _escapeHtml(prop.custom_availability_note || '') + '"'
      + ' data-prop-subdivision-id="' + _escapeHtml(prop.subdivision_id || '') + '"'
      + ' data-prop-agent="' + _escapeHtml(prop.agent_name || '') + '"'
      + ' data-prop-added="' + _escapeHtml(prop.created_at || '') + '"'
      + ' data-prop-status="' + _escapeHtml(status) + '"'
      + ' data-prop-listing-status="' + _escapeHtml(listingStatus) + '"'
      + ' data-prop-model-key="' + _escapeHtml(modelKey) + '"'
      + ' data-prop-available-left="0"'
      + ' data-prop-images="' + _escapeHtml(imagesCsv) + '">'
      + '  <div class="prop-card-img-wrap">'
      + (firstImg
          ? '    <img src="/uploads/' + _escapeHtml(firstImg) + '" alt="' + _escapeHtml(name) + '" class="prop-card-img">'
          : '    <div class="prop-card-img-placeholder"><i class="fas fa-home"></i></div>')
      + (imgCount > 1 ? '    <span class="prop-card-img-count"><i class="fas fa-images me-1"></i>' + imgCount + '</span>' : '')
        + '    <div class="prop-card-actions">'
        + '      <button type="button" class="sub-card-action-btn prop-view-btn-icon" title="View details"><i class="fas fa-eye"></i></button>'
        + (listingStatus !== 'sold'
          ? '      <button type="button" class="sub-card-action-btn sub-card-action-delete pvm-delete-btn" data-prop-id="' + _escapeHtml(prop.id) + '" title="Delete"><i class="fas fa-trash"></i></button>'
          : '')
        + '    </div>'
      + '  </div>'
      + '  <div class="prop-card-body">'
      + '    <div class="prop-card-header">'
      + '      <div class="prop-card-name">' + _escapeHtml(name) + '</div>'
      + '      ' + _statusToggleHtml(prop.id, listingStatus)
      + '    </div>'
        + (listingStatus === 'available'
          ? '    <div class="prop-availability-note editable-note' + (prop.custom_availability_note ? '' : ' empty-note') + '" role="button" tabindex="0" data-prop-id="' + _escapeHtml(prop.id) + '" data-custom-note="' + _escapeHtml(prop.custom_availability_note || '') + '" title="' + _escapeHtml(prop.custom_availability_note ? 'Click to edit availability note' : 'Click to add availability note') + '"><span class="note-display">' + _escapeHtml(prop.custom_availability_note || 'Add note') + '</span><i class="fas fa-edit edit-icon ms-1" style="opacity: 0; transition: opacity 0.2s;"></i></div>'
          : '')
      + '    <div class="prop-card-header">'
      + '      <div class="prop-card-loc"><i class="fas fa-map-marker-alt me-1"></i>' + _escapeHtml(location) + '</div>'
      + '      <div class="prop-card-icons">'
      + (prop.bedrooms ? '<span class="prop-card-icon-chip"><i class="fas fa-bed" style="color: var(--clr-accent-dk);"></i> ' + _escapeHtml(prop.bedrooms) + '</span>' : '')
      + (prop.bathrooms ? '<span class="prop-card-icon-chip"><i class="fas fa-bath" style="color: var(--clr-blue);"></i> ' + _escapeHtml(prop.bathrooms) + '</span>' : '')
      + (prop.storeys ? '<span class="prop-card-icon-chip"><i class="fas fa-layer-group" style="color: var(--clr-primary);"></i> ' + _escapeHtml(prop.storeys) + '</span>' : '')
      + '      </div>'
      + '    </div>'
      + '    <div class="prop-card-footer">'
      + '      <span class="prop-card-type">' + _escapeHtml(propType ? _titleCase(propType) : '—') + '</span>'
      + '      <span class="prop-card-price">' + priceText + '</span>'
      + '    </div>'
      + '    <div class="prop-card-meta">'
      + '      <span><i class="fas fa-city me-1"></i>' + _escapeHtml(prop.subdivision_name || '—') + '</span>'
      + '      <span><i class="fas fa-hashtag me-1"></i>' + _escapeHtml(prop.unit_id || 'No Unit ID') + '</span>'
      + '      <span>' + _escapeHtml(prop.created_at || '') + '</span>'
      + '    </div>'
      + '    <div class="prop-card-pending-details-wrap mt-2">'
      + '      <button type="button" class="btn btn-sm btn-outline-blue px-3 pvm-full-details-btn"><i class="fas fa-file-lines me-1"></i>View Pending Details</button>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    var filterEmpty = document.getElementById('propFilterEmpty');
    if (filterEmpty) {
      grid.insertBefore(col, filterEmpty);
    } else {
      grid.insertBefore(col, grid.firstChild);
    }

    _refreshAvailabilityNotes();
    var searchEl = document.getElementById('propSearch');
    if (searchEl) searchEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  _bind('acp_images_wrap', 'click', function (e) {
    var delBtn = e.target.closest('.sub-img-tile-del');
    if (!delBtn) return;
    var tile = delBtn.closest('.sub-img-tile');
    var idx = tile ? tile.dataset.newIdx : null;
    if (idx !== null && idx !== undefined) {
      _pendingAcpFiles[parseInt(idx, 10)] = null;
    }
    if (tile) tile.remove();
    syncAcpFileNames();
  });

  _bind('acp_images', 'change', function () {
    var files = this.files;
    if (!files || !files.length) return;
    var wrap = document.getElementById('acp_images_wrap');
    if (!wrap) return;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var arrIdx = _pendingAcpFiles.length;
      _pendingAcpFiles.push(f);
      var tile = document.createElement('div');
      tile.className = 'sub-img-tile';
      tile.dataset.newIdx = arrIdx;
      tile.innerHTML =
        '<img src="' + URL.createObjectURL(f) + '" class="sub-img-tile-img" alt="">'
        + '<button type="button" class="sub-img-tile-del" title="Remove"><i class="fas fa-times"></i></button>';
      wrap.appendChild(tile);
    }
    syncAcpFileNames();
  });

  modalEl.addEventListener('hidden.bs.modal', function () {
    resetAcpFormState();
  });

  btn.addEventListener('click', function () {
    var errEl = document.getElementById('adminCreatePropError');
    if (errEl) errEl.classList.add('d-none');

    function val(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    }

    var name = val('acp_name');
    _syncAdminCreatePropertyLocation();
    var location = val('acp_location');
    var street = val('acp_street');
    var block = val('acp_block');
    var lotNo = val('acp_lot_no');
    var propType = val('acp_type');
    var unitId = val('acp_unit_id');
    var price = val('acp_price');
    var unitType = val('acp_unit_type');

    if (!name || !unitId || !location || !propType || !unitType || !price) {
      if (errEl) {
        errEl.textContent = 'Name, unit ID, unit type, location details, type, and TCP are required.';
        errEl.classList.remove('d-none');
      }
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

    var fd = new FormData();
    fd.append('name', name);
    fd.append('location', location);
    fd.append('street', street);
    fd.append('block', block);
    fd.append('lot_no', lotNo);
    fd.append('region', val('acp_region'));
    fd.append('region_code', val('acp_region_code'));
    fd.append('region_name', val('acp_region_name'));
    fd.append('province_code', val('acp_province_code'));
    fd.append('province_name', val('acp_province_name'));
    fd.append('citymun_code', val('acp_citymun_code'));
    fd.append('citymun_name', val('acp_citymun_name'));
    fd.append('barangay_code', val('acp_barangay_code'));
    fd.append('barangay_name', val('acp_barangay_name'));
    fd.append('prop_type', propType);
    fd.append('unit_type', unitType);
    fd.append('price', price);
    fd.append('promo_discount_rate', val('acp_promo_discount_rate') || '0');
    fd.append('reservation_fee', val('acp_reservation_fee') || '0');
    fd.append('downpayment_rate', val('acp_downpayment_rate') || '0');
    fd.append('downpayment_terms_months', val('acp_downpayment_terms_months') || '0');
    fd.append('loanable_percentage', val('acp_loanable_percentage') || '0');
    fd.append('interest_rate', val('acp_interest_rate') || '8.5');
    fd.append('vat_rate', val('acp_vat_rate') || '0');
    fd.append('lmf_rate', val('acp_lmf_rate') || '0');
    fd.append('bedrooms', val('acp_bedrooms') || '0');
    fd.append('bathrooms', val('acp_bathrooms') || '0');
    fd.append('storeys', val('acp_storeys') || '1');
    fd.append('floor_area', val('acp_floor_area'));
    fd.append('lot_area', val('acp_lot_area'));
    fd.append('subdivision_id', val('acp_subdivision'));
    fd.append('unit_id', val('acp_unit_id'));
    fd.append('description', val('acp_description'));
    _pendingAcpFiles.filter(Boolean).forEach(function (f) { fd.append('images', f); });
    fd.append('csrf_token', csrfToken());

    fetch('/admin/property/create', {
      method: 'POST',
      body: fd,
    })
      .then(function (r) {
        if (r.status === 413) {
          return { ok: false, status: 413, data: { error: 'Upload too large.' } };
        }
        return r.text().then(function (raw) {
          var parsed = {};
          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch (_) {
              parsed = {};
            }
          }
          return { ok: r.ok, status: r.status, data: parsed };
        });
      })
      .then(function (res) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus me-1"></i> Add Property';

        if (!res.ok || !res.data || !res.data.success) {
          if (res.status === 413) {
            var sizeMsg = 'Image upload is too large. Please use smaller photo files and try again.';
            if (errEl) {
              errEl.textContent = sizeMsg;
              errEl.classList.remove('d-none');
            }
            showToast(sizeMsg, 'danger');
            return;
          }
          if (errEl) {
            errEl.textContent = (res.data && res.data.error) || 'Failed to create property.';
            errEl.classList.remove('d-none');
          }
          return;
        }

        resetAcpFormState();
        bootstrap.Modal.getInstance(document.getElementById('adminCreatePropertyModal'))?.hide();
        showToast('Property listing created successfully.', 'success');
        _pushNewPropertyCard((res.data && res.data.property) || {
          id: (res.data && res.data.id) || '',
          name: name,
          location: location,
          prop_type: propType,
          unit_type: unitType,
          price: parseFloat(price || '0') || 0,
          promo_discount_rate: parseFloat(val('acp_promo_discount_rate') || '0') || 0,
          reservation_fee: parseFloat(val('acp_reservation_fee') || '0') || 0,
          downpayment_rate: parseFloat(val('acp_downpayment_rate') || '0') || 0,
          downpayment_terms_months: parseInt(val('acp_downpayment_terms_months') || '0', 10) || 0,
          loanable_percentage: parseFloat(val('acp_loanable_percentage') || '0') || 0,
          interest_rate: parseFloat(val('acp_interest_rate') || '8.5') || 8.5,
          vat_rate: parseFloat(val('acp_vat_rate') || '0') || 0,
          lmf_rate: parseFloat(val('acp_lmf_rate') || '0') || 0,
          bedrooms: val('acp_bedrooms') || '',
          bathrooms: val('acp_bathrooms') || '',
          storeys: val('acp_storeys') || '',
          floor_area: val('acp_floor_area') || '',
          lot_area: val('acp_lot_area') || '',
          description: val('acp_description') || '',
          subdivision_name: '',
          agent_name: '',
          approval_status: 'approved',
          listing_status: 'available',
          created_at: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          images: ''
        });
      })
      .catch(function () {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus me-1"></i> Add Property';
        if (errEl) {
          errEl.textContent = 'Network error. Please try again.';
          errEl.classList.remove('d-none');
        }
      });
  });
}());

/* ── Save Profile ──────────────────────────────────────────── */
(function () {
  var saveBtn = document.getElementById('adminSaveProfileBtn');
  var errEl   = document.getElementById('adminProfileError');
  if (!saveBtn) return;

  /* Validate then open confirm modal */
  saveBtn.addEventListener('click', function () {
    var firstName = (document.getElementById('admin_prof_first_name') || {}).value || '';
    var lastName  = (document.getElementById('admin_prof_last_name')  || {}).value || '';
    var email     = (document.getElementById('admin_prof_email')       || {}).value || '';
    var username  = (document.getElementById('admin_prof_username')    || {}).value || '';
    var newPw     = (document.getElementById('admin_prof_new_password')    || {}).value || '';
    var confirmPw = (document.getElementById('admin_prof_confirm_password') || {}).value || '';

    if (!firstName.trim() || !lastName.trim()) {
      if (errEl) { errEl.textContent = 'First name and last name are required.'; errEl.classList.remove('d-none'); }
      return;
    }
    if (!email.trim()) {
      if (errEl) { errEl.textContent = 'Email address is required.'; errEl.classList.remove('d-none'); }
      return;
    }
    if (!username.trim()) {
      if (errEl) { errEl.textContent = 'Username is required.'; errEl.classList.remove('d-none'); }
      return;
    }
    if (username.trim().length < 3) {
      if (errEl) { errEl.textContent = 'Username must be at least 3 characters.'; errEl.classList.remove('d-none'); }
      return;
    }
    if (!/^[\w.]+$/.test(username.trim())) {
      if (errEl) { errEl.textContent = 'Username may contain only letters, numbers, dots, and underscores.'; errEl.classList.remove('d-none'); }
      return;
    }
    if (newPw && newPw !== confirmPw) {
      if (errEl) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('d-none'); }
      return;
    }
    if (errEl) errEl.classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('adminSaveProfileModal')).show();
  });

  /* Confirm button → actually save */
  document.getElementById('adminConfirmSaveProfileBtn') && document.getElementById('adminConfirmSaveProfileBtn').addEventListener('click', function () {
    var confirmBtn = this;
    bootstrap.Modal.getInstance(document.getElementById('adminSaveProfileModal')).hide();

    var firstName = (document.getElementById('admin_prof_first_name') || {}).value || '';
    var lastName  = (document.getElementById('admin_prof_last_name')  || {}).value || '';
    var email     = (document.getElementById('admin_prof_email')       || {}).value || '';
    var username  = (document.getElementById('admin_prof_username')    || {}).value || '';
    var contact   = (document.getElementById('admin_prof_contact')    || {}).value || '';
    var newPw     = (document.getElementById('admin_prof_new_password')    || {}).value || '';

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';
    confirmBtn.disabled = true;

    fetch('/admin/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({
        first_name:     firstName.trim(),
        last_name:      lastName.trim(),
        email:          email.trim(),
        username:       username.trim(),
        contact_number: contact.trim(),
        new_password:   newPw || null,
      })
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (res) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Save Changes';
      confirmBtn.disabled = false;
      if (!res.ok || res.data.error) {
        if (errEl) { errEl.textContent = res.data.error || 'Save failed.'; errEl.classList.remove('d-none'); }
        return;
      }
      var fullName = res.data.full_name || '';
      document.querySelectorAll('.dash-topbar-name').forEach(function (el) { el.textContent = fullName; });
      var heroNameEl = document.getElementById('adminProfHeroName');
      if (heroNameEl) heroNameEl.textContent = fullName;
      if (newPw) {
        var npEl = document.getElementById('admin_prof_new_password');
        var cpEl = document.getElementById('admin_prof_confirm_password');
        if (npEl) npEl.value = '';
        if (cpEl) cpEl.value = '';
        ['adminProfPwLen','adminProfPwUpper','adminProfPwNum','adminProfPwSpecial'].forEach(function (id) {
          var el = document.getElementById(id); if (!el) return;
          el.classList.remove('pw-ok');
        });
      }
      window._adminProfDirty = false;
      if (typeof window._adminProfRefreshSnapshot === 'function') window._adminProfRefreshSnapshot();
      showToast('Profile saved successfully!', 'success');
    })
    .catch(function () {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save me-1"></i> Save Changes';
      confirmBtn.disabled = false;
      if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.classList.remove('d-none'); }
    });
  });

  /* Password checklist live feedback */
  var pwInput = document.getElementById('admin_prof_new_password');
  if (pwInput) {
    pwInput.addEventListener('input', function () {
      var v = this.value;
      var len     = document.getElementById('adminProfPwLen');
      var upper   = document.getElementById('adminProfPwUpper');
      var num     = document.getElementById('adminProfPwNum');
      var special = document.getElementById('adminProfPwSpecial');
      function _set(el, ok) {
        if (!el) return;
        el.classList.toggle('pw-ok', ok);
      }
      _set(len,     v.length >= 6);
      _set(upper,   /[A-Z]/.test(v));
      _set(num,     /[0-9]/.test(v));
      _set(special, /[^A-Za-z0-9]/.test(v));
    });
  }
}());

/* ── Admin Profile — Unsaved Changes Nav Guard ────────────────── */
(function () {
  var _pendingNav = null;

  var ADMIN_PROF_FIELDS = ['admin_prof_first_name', 'admin_prof_last_name', 'admin_prof_email', 'admin_prof_username', 'admin_prof_contact'];
  var ADMIN_PROF_PW     = ['admin_prof_new_password', 'admin_prof_confirm_password'];

  // Snapshot on load
  var _adminProfSnapshot = {};
  ADMIN_PROF_FIELDS.forEach(function (id) {
    var el = document.getElementById(id);
    _adminProfSnapshot[id] = el ? el.value : '';
  });

  // Expose refresh so save handler can update snapshot
  window._adminProfRefreshSnapshot = function () {
    ADMIN_PROF_FIELDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) _adminProfSnapshot[id] = el.value;
    });
  };

  function _restoreAdminProfForm() {
    ADMIN_PROF_FIELDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = _adminProfSnapshot[id] || '';
    });
    ADMIN_PROF_PW.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['adminProfPwLen','adminProfPwUpper','adminProfPwNum','adminProfPwSpecial'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.classList.remove('pw-ok');
    });
    var errEl = document.getElementById('adminProfileError');
    if (errEl) errEl.classList.add('d-none');
  }

  // Mark dirty on any input inside page-profile
  var profPage = document.getElementById('page-profile');
  if (profPage) {
    profPage.querySelectorAll('input:not([type=file]), textarea, select').forEach(function (el) {
      el.addEventListener('input',  function () { window._adminProfDirty = true; });
      el.addEventListener('change', function () { window._adminProfDirty = true; });
    });
  }
  // Also mark dirty when a photo is uploaded
  ['adminAvatarFileInput', 'adminBannerFileInput'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', function () { window._adminProfDirty = true; });
  });

  // Nav guard — called by sidebar click handler
  window._navGuard = function (targetPage) {
    var activePage = document.querySelector('.dash-page:not(.d-none)');
    if (!activePage) return;
    var id = activePage.id;
    var dirty = false;
    if (id === 'page-profile')  dirty = !!window._adminProfDirty;
    if (id === 'page-reports')  dirty = !!window._criteriaDirty;
    if (id === 'page-settings') dirty = !!window._settingsDirty;
    if (!dirty) return;
    _pendingNav = targetPage;
    var modalEl = document.getElementById('adminUnsavedChangesModal');
    if (!modalEl) return;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
    return false; // block navigation
  };

  // "Leave anyway" button
  var leaveBtn = document.getElementById('adminUnsavedLeaveBtn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', function () {
      _restoreAdminProfForm();
      window._adminProfDirty  = false;
      window._criteriaDirty  = false;
      window._settingsDirty  = false;
      var modalEl = document.getElementById('adminUnsavedChangesModal');
      var modal   = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      if (_pendingNav && typeof showPage === 'function') {
        showPage(_pendingNav);
        _pendingNav = null;
      }
    });
  }
}());

/* ── Qualification Criteria — dirty tracking ──────────────────── */
(function () {
  window._criteriaDirty = false;
  var criteriaPane = document.getElementById('rptTabCriteria');
  if (!criteriaPane) return;
  criteriaPane.querySelectorAll('input:not([disabled])').forEach(function (el) {
    el.addEventListener('input',  function () { window._criteriaDirty = true; });
    el.addEventListener('change', function () { window._criteriaDirty = true; });
  });
}());

/* ── General & Security Settings — dirty tracking ─────────────── */
(function () {
  window._settingsDirty = false;
  var settingsPane = document.getElementById('pane-settings');
  if (!settingsPane) return;
  settingsPane.querySelectorAll('input, select, textarea').forEach(function (el) {
    el.addEventListener('input',  function () { window._settingsDirty = true; });
    el.addEventListener('change', function () { window._settingsDirty = true; });
  });
}());

/* ── Admin Profile — Confirm-password live match + cross-dispatch ── */
(function () {
  var newPwInput   = document.getElementById('admin_prof_new_password');
  var confirmInput = document.getElementById('admin_prof_confirm_password');
  var confirmErr   = document.getElementById('admin_prof_confirm_password_error');
  if (!confirmInput || !confirmErr) return;
  // When new-pw changes, re-validate confirm if it already has a value
  if (newPwInput) {
    newPwInput.addEventListener('input', function () {
      if (confirmInput.value) confirmInput.dispatchEvent(new Event('input'));
    });
  }
  confirmInput.addEventListener('input', function () {
    var cf = this.value;
    var pw = newPwInput ? newPwInput.value : '';
    if (!cf) {
      confirmErr.textContent = '';
      confirmErr.classList.remove('sqh-err-visible');
      this.classList.remove('lv-valid', 'lv-invalid');
    } else if (cf !== pw) {
      confirmErr.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match.';
      confirmErr.classList.add('sqh-err-visible');
      this.classList.add('lv-invalid');
      this.classList.remove('lv-valid');
    } else {
      confirmErr.textContent = '';
      confirmErr.classList.remove('sqh-err-visible');
      this.classList.add('lv-valid');
      this.classList.remove('lv-invalid');
    }
  });
}());
