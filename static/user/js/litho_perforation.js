(function() {
  const dataUrl = '/static/data/litho_perforation/products.json';
  const DEFAULT_UNIT_PRICE = 3000;
  const GST_PERCENT = 18;
  const TPI_OPTIONS = [
    { value: 6, label: '6 TPI' },
    { value: 8, label: '8 TPI' },
    { value: 12, label: '12 TPI' },
    { value: 16, label: '16 TPI' },
    { value: 30, label: '30 TPI' },
    { value: 40, label: '40 TPI' },
    { value: 50, label: '50 TPI' },
    { value: 'no_tpi', label: 'No TPI' }
  ];
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
    defaultPricePerPacket: DEFAULT_UNIT_PRICE,
    products: [],
    quantity: null,
    quantityConfirmed: false
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    loadMachines();
    renderTpiOptions();
    renderBrandOptions();
    renderTypeOptions();
    setupEvents();
    updateSummary();
  });

  async function loadProducts() {
    try {
      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch litho data (${response.status})`);
      }
      const payload = await response.json();
      state.defaultPricePerPacket = Number(payload.default_price_per_packet) || DEFAULT_UNIT_PRICE;
      state.products = Array.isArray(payload.products)
        ? payload.products.map(normalizeProduct).filter(Boolean)
        : [];
    } catch (error) {
      console.error('litho_perforation.js: unable to load products', error);
      state.defaultPricePerPacket = DEFAULT_UNIT_PRICE;
      state.products = [];
      showToast('Warning', 'Litho rates could not be loaded. Using default pricing for now.', 'warning');
    }
  }

  function normalizeProduct(product) {
    if (!product || !product.type) return null;
    return {
      tpi: product.tpi === null || product.tpi === undefined ? null : Number(product.tpi),
      type: product.type,
      t: product.thompson_code || null,
      h: product.hs_boyd_code || null,
      price_per_packet: Number(product.price_per_packet) || state.defaultPricePerPacket
    };
  }

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
    tpiOptions.innerHTML = TPI_OPTIONS
      .map(option => optionButton('tpi', option.value, option.label, state.tpi === option.value))
      .join('');
    tpiOptions.querySelectorAll('[data-tpi]').forEach(button => {
      button.addEventListener('click', () => {
        state.tpi = parseTpiValue(button.dataset.tpi);
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
    if (state.tpi === null) {
      typeOptions.innerHTML = '<p class="chem-placeholder mb-0">Select TPI first.</p>';
      return;
    }

    const entries = getAvailableEntries();
    if (!entries.length) {
      const emptyMessage = state.brand === 'thompson_boyd'
        ? 'No items available.'
        : 'No product codes available for this selection.';
      typeOptions.innerHTML = `<p class="chem-placeholder mb-0">${emptyMessage}</p>`;
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
    return state.products.filter(entry => {
      const tpiMatches = state.tpi === 'no_tpi'
        ? entry.tpi === null
        : entry.tpi === state.tpi;
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
    return false;
  }

  function formatCodes(entry) {
    if (!entry) return '';
    if (state.brand === 'thompson') return entry.t ? `T - ${entry.t}` : 'N/A';
    if (state.brand === 'hs_boyd') return entry.h ? `H - ${entry.h}` : 'N/A';
    return 'N/A';
  }

  function parseTpiValue(value) {
    if (value === 'no_tpi') return 'no_tpi';
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function formatTpiLabel(value) {
    if (value === 'no_tpi') return 'No TPI';
    return value ? `${value} TPI` : '';
  }

  function getUnitPrice(entry) {
    const price = Number(entry && entry.price_per_packet);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
    return state.defaultPricePerPacket || DEFAULT_UNIT_PRICE;
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
    const entry = getSelectedEntry();
    quantityHelper.textContent = `Rs. ${getUnitPrice(entry).toFixed(2)} per packet.`;
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
    if (state.tpi !== null) items.push(summaryItem('TPI', formatTpiLabel(state.tpi)));
    if (state.brand) items.push(summaryItem('Brand', getBrandLabel(state.brand)));
    if (entry) {
      items.push(summaryItem('Type', TYPES[entry.type]));
      items.push(summaryItem('Product code', formatCodes(entry)));
    }

    const complete = Boolean(entry && state.brand && state.quantityConfirmed && state.quantity > 0);
    if (complete) {
      const unitPrice = getUnitPrice(entry);
      const subtotal = unitPrice * state.quantity;
      const gstAmount = subtotal * (GST_PERCENT / 100);
      const total = subtotal + gstAmount;
      items.push(summaryItem('Packets', String(state.quantity), `Rs. ${unitPrice.toFixed(2)} x ${state.quantity}`));
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

    const unitPrice = getUnitPrice(entry);
    const subtotal = unitPrice * state.quantity;
    const gstAmount = subtotal * (GST_PERCENT / 100);
    const total = subtotal + gstAmount;
    const codeLabel = formatCodes(entry);
    const payload = {
      type: 'litho_perforation',
      name: `Litho Perforation - ${TYPES[entry.type]} - ${codeLabel}`,
      machine: state.machineName || '--',
      tpi: formatTpiLabel(state.tpi),
      brand: getBrandLabel(state.brand),
      brand_id: state.brand,
      rule_type: TYPES[entry.type],
      rule_type_id: entry.type,
      product_code: codeLabel,
      unit_price: unitPrice,
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
        unit_price: unitPrice,
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
