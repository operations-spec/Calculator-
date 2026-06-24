(function() {
  const UNIT_PRICE = 3000;
  const GST_PERCENT = 18;
  const TPIS = [6, 8, 12, 16, 30, 40, 50];
  const BRANDS = [
    { id: 'thompson', label: 'Thompson' },
    { id: 'hs_boyd', label: 'H.S Boyd' },
    { id: 'thompson_boyd', label: 'Thompson-Boyd' }
  ];
  const TYPES = {
    card_center: 'CARD - CENTER',
    card_side: 'CARD - SIDE',
    paper_center: 'PAPER - CENTER',
    paper_side: 'PAPER - SIDE',
    paper_center_micro: 'PAPER - CENTER - MICRO PERF',
    paper_side_micro: 'PAPER - SIDE - MICRO PERF',
    paper_center_score: 'PAPER - CENTER SCORE (CREASING)',
    card_center_score: 'CARD - CENTER SCORE (CREASING)',
    card_centre_slit: 'CARD - CENTRE SLIT (HALF-CUT)'
  };
  const CODES = [
    { tpi: 6, type: 'card_center', t: '311', h: '609' },
    { tpi: 6, type: 'card_side', t: '511', h: '809' },
    { tpi: 8, type: 'paper_center', t: '409', h: '610' },
    { tpi: 8, type: 'card_center', t: '309', h: '611' },
    { tpi: 8, type: 'card_side', t: '509', h: '811' },
    { tpi: 12, type: 'paper_center', t: '407', h: '612' },
    { tpi: 12, type: 'card_center', t: '307', h: '613' },
    { tpi: 12, type: 'paper_side', t: '607', h: '812' },
    { tpi: 12, type: 'card_side', t: '507', h: '813' },
    { tpi: 16, type: 'paper_center', t: '405', h: '614' },
    { tpi: 16, type: 'card_center', t: '305', h: '615' },
    { tpi: 16, type: 'paper_side', t: '605', h: '814' },
    { tpi: 16, type: 'card_side', t: '505', h: '815' },
    { tpi: 30, type: 'paper_center_micro', t: '416', h: '303' },
    { tpi: 30, type: 'paper_side_micro', t: '616', h: '301' },
    { tpi: 40, type: 'paper_center_micro', t: '417', h: null },
    { tpi: 40, type: 'paper_side_micro', t: '617', h: '401' },
    { tpi: 50, type: 'paper_center_micro', t: '418', h: null },
    { tpi: 50, type: 'paper_side_micro', t: '618', h: '501' },
    { tpi: null, type: 'paper_center_score', t: '401', h: null },
    { tpi: null, type: 'card_center_score', t: '301', h: '627-2' },
    { tpi: null, type: 'card_centre_slit', t: '303', h: '631' }
  ];

  const machineSelect = document.getElementById('lithoMachineSelect');
  const tpiOptions = document.getElementById('lithoTpiOptions');
  const brandOptions = document.getElementById('lithoBrandOptions');
  const typeOptions = document.getElementById('lithoTypeOptions');
  const quantityInput = document.getElementById('lithoQuantityInput');
  const quantityHelper = document.getElementById('lithoQuantityHelper');
  const confirmQuantityBtn = document.getElementById('lithoConfirmQuantityBtn');
  const summaryBody = document.getElementById('lithoSummaryBody');
  const summaryActions = document.getElementById('lithoSummaryActions');

  if (!tpiOptions || !brandOptions || !typeOptions || !quantityInput || !summaryBody) {
    return;
  }

  const state = {
    machineName: '',
    tpi: null,
    brand: null,
    type: null,
    quantity: null,
    quantityConfirmed: false
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadMachines();
    renderTpiOptions();
    renderBrandOptions();
    renderTypeOptions();
    setupEvents();
    updateSummary();
  });

  function setupEvents() {
    if (machineSelect) {
      machineSelect.addEventListener('change', event => {
        const option = event.target.options[event.target.selectedIndex];
        state.machineName = option && option.value ? option.textContent : '';
        updateSummary();
      });
    }

    quantityInput.addEventListener('input', () => {
      const value = Number(quantityInput.value);
      const valid = Number.isFinite(value) && value > 0;
      state.quantity = valid ? Math.round(value) : null;
      state.quantityConfirmed = false;
      confirmQuantityBtn.disabled = !valid;
      updateSummary();
    });

    confirmQuantityBtn.addEventListener('click', () => {
      const value = Number(quantityInput.value);
      if (!Number.isFinite(value) || value <= 0) {
        showToast('Error', 'Enter a valid number of packets before confirming.', 'error');
        return;
      }
      state.quantity = Math.round(value);
      state.quantityConfirmed = true;
      updateSummary();
    });
  }

  function loadMachines() {
    if (!machineSelect) return;
    fetch('/api/machines')
      .then(response => response.json())
      .then(data => {
        const machines = Array.isArray(data) ? data : data.machines || [];
        machineSelect.innerHTML = '<option value="">-- Select Machine (optional) --</option>';
        machines.forEach(machine => {
          const option = document.createElement('option');
          option.value = machine.id;
          option.textContent = machine.name;
          machineSelect.appendChild(option);
        });
      })
      .catch(() => {
        machineSelect.innerHTML = '<option value="">-- Error loading machines --</option>';
      });
  }

  function renderTpiOptions() {
    tpiOptions.innerHTML = TPIS.map(tpi => optionButton('tpi', tpi, `${tpi} TPI`, state.tpi === tpi)).join('');
    tpiOptions.querySelectorAll('[data-tpi]').forEach(button => {
      button.addEventListener('click', () => {
        state.tpi = Number(button.dataset.tpi);
        state.type = null;
        resetQuantity();
        renderTpiOptions();
        renderTypeOptions();
        updateSummary();
      });
    });
  }

  function renderBrandOptions() {
    brandOptions.innerHTML = BRANDS.map(brand => optionButton('brand', brand.id, brand.label, state.brand === brand.id)).join('');
    brandOptions.querySelectorAll('[data-brand]').forEach(button => {
      button.addEventListener('click', () => {
        state.brand = button.dataset.brand;
        resetQuantity();
        renderBrandOptions();
        renderTypeOptions();
        updateSummary();
      });
    });
  }

  function renderTypeOptions() {
    if (!state.tpi) {
      typeOptions.innerHTML = '<p class="chem-placeholder mb-0">Select TPI first.</p>';
      return;
    }

    const entries = getAvailableEntries();
    if (!entries.length) {
      typeOptions.innerHTML = '<p class="chem-placeholder mb-0">No product codes available for this selection.</p>';
      return;
    }

    typeOptions.innerHTML = entries
      .map(entry => {
        const active = state.type === entry.type;
        const codes = formatCodes(entry);
        return optionButton('type', entry.type, TYPES[entry.type], active, codes);
      })
      .join('');

    typeOptions.querySelectorAll('[data-type]').forEach(button => {
      button.addEventListener('click', () => {
        state.type = button.dataset.type;
        resetQuantity();
        enableQuantity();
        renderTypeOptions();
        updateSummary();
      });
    });
  }

  function getAvailableEntries() {
    return CODES.filter(entry => {
      const tpiMatches = entry.tpi === state.tpi || entry.tpi === null;
      return tpiMatches && hasCodeForBrand(entry);
    });
  }

  function getSelectedEntry() {
    return getAvailableEntries().find(entry => entry.type === state.type) || null;
  }

  function hasCodeForBrand(entry) {
    if (!state.brand) return true;
    if (state.brand === 'thompson') return Boolean(entry.t);
    if (state.brand === 'hs_boyd') return Boolean(entry.h);
    return Boolean(entry.t || entry.h);
  }

  function formatCodes(entry) {
    if (!entry) return '';
    if (state.brand === 'thompson') return entry.t ? `T - ${entry.t}` : 'N/A';
    if (state.brand === 'hs_boyd') return entry.h ? `H - ${entry.h}` : 'N/A';
    const parts = [];
    if (entry.t) parts.push(`T - ${entry.t}`);
    if (entry.h) parts.push(`H - ${entry.h}`);
    return parts.join(' / ') || 'N/A';
  }

  function optionButton(kind, value, title, active, note = '') {
    return `
      <button type="button" class="chem-option ${active ? 'chem-option--active' : ''}" data-${kind}="${sanitize(value)}" aria-pressed="${active ? 'true' : 'false'}">
        <span class="chem-option__title">${sanitize(title)}</span>
        ${note ? `<span class="chem-option__meta">${sanitize(note)}</span>` : ''}
      </button>
    `;
  }

  function enableQuantity() {
    quantityInput.disabled = false;
    quantityInput.placeholder = 'Enter number of packets';
    quantityInput.focus();
    quantityHelper.textContent = `Rs. ${UNIT_PRICE.toFixed(2)} per packet.`;
  }

  function resetQuantity() {
    state.quantity = null;
    state.quantityConfirmed = false;
    quantityInput.value = '';
    quantityInput.disabled = true;
    quantityInput.placeholder = 'Select type first';
    quantityHelper.textContent = 'Choose a type to enable packet entry.';
    confirmQuantityBtn.disabled = true;
  }

  function updateSummary() {
    const items = [];
    const entry = getSelectedEntry();

    if (state.machineName) items.push(summaryItem('Machine', state.machineName));
    if (state.tpi) items.push(summaryItem('TPI', `${state.tpi} TPI`));
    if (state.brand) items.push(summaryItem('Brand', getBrandLabel(state.brand)));
    if (entry) {
      items.push(summaryItem('Type', TYPES[entry.type]));
      items.push(summaryItem('Product code', formatCodes(entry)));
    }

    const complete = Boolean(entry && state.brand && state.quantityConfirmed && state.quantity > 0);
    if (complete) {
      const subtotal = UNIT_PRICE * state.quantity;
      const gstAmount = subtotal * (GST_PERCENT / 100);
      const total = subtotal + gstAmount;
      items.push(summaryItem('Packets', String(state.quantity), `Rs. ${UNIT_PRICE.toFixed(2)} x ${state.quantity}`));
      items.push(summaryItem('Subtotal', `Rs. ${subtotal.toFixed(2)}`));
      items.push(summaryItem('GST', `Rs. ${gstAmount.toFixed(2)} (${GST_PERCENT}%)`));
      items.push(summaryItem('Total', `Rs. ${total.toFixed(2)}`));
    }

    summaryBody.innerHTML = items.length ? items.join('') : '<p class="chem-summary__empty mb-0">Start by selecting a TPI.</p>';
    summaryActions.innerHTML = complete
      ? '<button type="button" class="chem-summary__cta-btn add-to-cart-btn" id="lithoAddToCartBtn"><i class="fas fa-cart-plus"></i><span>Add to cart</span></button>'
      : '<p class="chem-summary__note chem-summary__note--muted mb-0">Confirm packets to enable the cart button.</p>';

    const cartButton = document.getElementById('lithoAddToCartBtn');
    if (cartButton) {
      cartButton.addEventListener('click', () => addLithoToCart(cartButton));
    }
  }

  async function addLithoToCart(button) {
    const entry = getSelectedEntry();
    if (!entry || !state.brand || !state.quantityConfirmed || !state.quantity) {
      showToast('Error', 'Complete all selections before adding to cart.', 'error');
      return;
    }

    const subtotal = UNIT_PRICE * state.quantity;
    const gstAmount = subtotal * (GST_PERCENT / 100);
    const total = subtotal + gstAmount;
    const codeLabel = formatCodes(entry);
    const payload = {
      type: 'litho_perforation',
      name: `Litho Perforation - ${TYPES[entry.type]} - ${codeLabel}`,
      machine: state.machineName || '--',
      tpi: state.tpi,
      brand: getBrandLabel(state.brand),
      brand_id: state.brand,
      rule_type: TYPES[entry.type],
      rule_type_id: entry.type,
      product_code: codeLabel,
      unit_price: UNIT_PRICE,
      quantity: state.quantity,
      packets: state.quantity,
      discount_percent: 0,
      gst_percent: GST_PERCENT,
      subtotal,
      gst_amount: gstAmount,
      total_price: total,
      image: 'images/litho-perforation-placeholder.jpg',
      added_at: new Date().toISOString(),
      calculations: {
        unit_price: UNIT_PRICE,
        quantity: state.quantity,
        subtotal,
        discount_percent: 0,
        discount_amount: 0,
        discounted_subtotal: subtotal,
        gst_percent: GST_PERCENT,
        gst_amount: gstAmount,
        final_total: total
      }
    };

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';

    try {
      const response = await fetch('/add_to_cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to add to cart');
      }
      showToast('Success', 'Litho perforation added to cart!', 'success');
      if (typeof updateCartCount === 'function') updateCartCount();
      setTimeout(resetForm, 1200);
    } catch (error) {
      showToast('Error', error.message || 'Failed to add litho perforation. Please try again.', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  function resetForm() {
    state.tpi = null;
    state.brand = null;
    state.type = null;
    resetQuantity();
    renderTpiOptions();
    renderBrandOptions();
    renderTypeOptions();
    updateSummary();
  }

  function getBrandLabel(id) {
    const brand = BRANDS.find(item => item.id === id);
    return brand ? brand.label : '';
  }

  function summaryItem(label, value, note) {
    return `
      <div class="chem-summary__item">
        <span class="chem-summary__label">${sanitize(label)}</span>
        <span class="chem-summary__value">${sanitize(value)}</span>
        ${note ? `<span class="chem-summary__note">${sanitize(note)}</span>` : ''}
      </div>
    `;
  }

  function sanitize(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(title, message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(title, message, type);
      return;
    }
    alert(`${title}: ${message}`);
  }
})();
