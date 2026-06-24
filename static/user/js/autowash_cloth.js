(function() {
  const dataUrl = '/static/data/autowash_cloth/products.json';
  const machineSelect = document.getElementById('autowashMachineSelect');
  const typeOptions = document.getElementById('autowashTypeOptions');
  const productOptions = document.getElementById('autowashProductOptions');
  const quantityInput = document.getElementById('autowashQuantityInput');
  const quantityHelper = document.getElementById('autowashQuantityHelper');
  const confirmQuantityBtn = document.getElementById('autowashConfirmQuantityBtn');
  const summaryBody = document.getElementById('autowashSummaryBody');
  const summaryActions = document.getElementById('autowashSummaryActions');

  if (!typeOptions || !productOptions || !quantityInput || !summaryBody || !summaryActions) {
    return;
  }

  const state = {
    machineName: '',
    gstPercent: 18,
    types: [],
    selectedTypeId: null,
    selectedProductId: null,
    quantity: null,
    quantityConfirmed: false
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await loadCatalog();
    loadMachines();
    setupEvents();
    renderTypes();
    renderProducts();
    updateSummary();
  });

  async function loadCatalog() {
    try {
      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch autowash data (${response.status})`);
      const payload = await response.json();
      state.gstPercent = Number(payload.gst_percent) || 18;
      state.types = Array.isArray(payload.types) ? payload.types : [];
    } catch (error) {
      console.error('autowash_cloth.js: unable to load products', error);
      showToast('Warning', 'Autowash rates could not be loaded. Please refresh.', 'warning');
    }
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
        showToast('Error', 'Enter a valid quantity before confirming.', 'error');
        return;
      }
      state.quantity = Math.round(value);
      state.quantityConfirmed = true;
      updateSummary();
    });
  }

  function renderTypes() {
    if (!state.types.length) {
      typeOptions.innerHTML = '<p class="chem-placeholder mb-0">No autowash types available.</p>';
      return;
    }

    typeOptions.innerHTML = state.types
      .map(type => optionButton('type', type.id, type.label, state.selectedTypeId === type.id))
      .join('');

    typeOptions.querySelectorAll('[data-type]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedTypeId = button.dataset.type;
        state.selectedProductId = null;
        resetQuantity();
        renderTypes();
        renderProducts();
        updateSummary();
      });
    });
  }

  function renderProducts() {
    const selectedType = getSelectedType();
    if (!selectedType) {
      productOptions.innerHTML = '<p class="chem-placeholder mb-0">Select dry or wet first.</p>';
      return;
    }

    const products = Array.isArray(selectedType.products) ? selectedType.products : [];
    productOptions.innerHTML = products
      .map(product => {
        const packaging = product.packaging === 'box'
          ? `Box, ${product.pcs_per_box || 20} pcs`
          : `${product.length_m || 500} m roll`;
        return optionButton(
          'product',
          product.id,
          product.label,
          state.selectedProductId === product.id,
          `${packaging} - Rs. ${getUnitPrice(product).toFixed(2)} + GST`
        );
      })
      .join('');

    productOptions.querySelectorAll('[data-product]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedProductId = button.dataset.product;
        resetQuantity();
        enableQuantity();
        renderProducts();
        updateSummary();
      });
    });
  }

  function enableQuantity() {
    const product = getSelectedProduct();
    if (!product) return;
    quantityInput.disabled = false;
    quantityInput.placeholder = `Enter number of ${product.unit_label || 'units'}`;
    quantityInput.focus();
    quantityHelper.textContent = `Rs. ${getUnitPrice(product).toFixed(2)} per ${product.unit_label || 'unit'} + GST.`;
  }

  function resetQuantity() {
    state.quantity = null;
    state.quantityConfirmed = false;
    quantityInput.value = '';
    quantityInput.disabled = true;
    quantityInput.placeholder = 'Select product first';
    quantityHelper.textContent = 'Choose a product to enable quantity entry.';
    confirmQuantityBtn.disabled = true;
  }

  function updateSummary() {
    const items = [];
    const selectedType = getSelectedType();
    const product = getSelectedProduct();

    if (state.machineName) items.push(summaryItem('Machine', state.machineName));
    if (selectedType) items.push(summaryItem('Type', selectedType.label));
    if (product) {
      items.push(summaryItem('Product', product.label));
      items.push(summaryItem('Packaging', getPackagingLabel(product)));
    }

    const complete = Boolean(product && state.quantityConfirmed && state.quantity > 0);
    if (complete) {
      const unitPrice = getUnitPrice(product);
      const subtotal = unitPrice * state.quantity;
      const gstAmount = subtotal * (state.gstPercent / 100);
      const total = subtotal + gstAmount;
      const unitLabel = product.unit_label || 'unit';
      items.push(summaryItem('Quantity', `${state.quantity} ${pluralize(unitLabel, state.quantity)}`, `Rs. ${unitPrice.toFixed(2)} x ${state.quantity}`));
      items.push(summaryItem('Subtotal', `Rs. ${subtotal.toFixed(2)}`));
      items.push(summaryItem('GST', `Rs. ${gstAmount.toFixed(2)} (${state.gstPercent}%)`));
      items.push(summaryItem('Total', `Rs. ${total.toFixed(2)}`));
    }

    summaryBody.innerHTML = items.length ? items.join('') : '<p class="chem-summary__empty mb-0">Start by selecting dry or wet.</p>';
    summaryActions.innerHTML = complete
      ? '<button type="button" class="chem-summary__cta-btn add-to-cart-btn" id="autowashAddToCartBtn"><i class="fas fa-cart-plus"></i><span>Add to cart</span></button>'
      : '<p class="chem-summary__note chem-summary__note--muted mb-0">Confirm quantity to enable the cart button.</p>';

    const cartButton = document.getElementById('autowashAddToCartBtn');
    if (cartButton) cartButton.addEventListener('click', () => addAutowashToCart(cartButton));
  }

  async function addAutowashToCart(button) {
    const selectedType = getSelectedType();
    const product = getSelectedProduct();
    if (!selectedType || !product || !state.quantityConfirmed || !state.quantity) {
      showToast('Error', 'Complete all selections before adding to cart.', 'error');
      return;
    }

    const unitPrice = getUnitPrice(product);
    const subtotal = unitPrice * state.quantity;
    const gstAmount = subtotal * (state.gstPercent / 100);
    const total = subtotal + gstAmount;
    const unitLabel = product.unit_label || 'unit';
    const payload = {
      type: 'autowash_cloth',
      name: `Autowash Cloth - ${selectedType.label} - ${product.label}`,
      machine: state.machineName || '--',
      category: selectedType.label,
      product_id: product.id,
      format_label: getPackagingLabel(product),
      autowash_type: selectedType.id,
      width_mm: product.width_mm || '',
      length_m: product.length_m || '',
      packaging: product.packaging || '',
      pcs_per_box: product.pcs_per_box || '',
      unit: unitLabel,
      unit_price: unitPrice,
      quantity: state.quantity,
      discount_percent: 0,
      gst_percent: state.gstPercent,
      subtotal,
      gst_amount: gstAmount,
      total_price: total,
      image: 'images/autowash-cloth-placeholder.jpg',
      added_at: new Date().toISOString(),
      calculations: {
        unit_price: unitPrice,
        quantity: state.quantity,
        subtotal,
        discount_percent: 0,
        discount_amount: 0,
        discounted_subtotal: subtotal,
        gst_percent: state.gstPercent,
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
      if (!data.success) throw new Error(data.message || data.error || 'Failed to add to cart');
      showToast('Success', 'Autowash cloth added to cart!', 'success');
      if (typeof updateCartCount === 'function') updateCartCount();
      setTimeout(resetForm, 1200);
    } catch (error) {
      showToast('Error', error.message || 'Failed to add autowash cloth. Please try again.', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  function resetForm() {
    state.selectedTypeId = null;
    state.selectedProductId = null;
    resetQuantity();
    renderTypes();
    renderProducts();
    updateSummary();
  }

  function getSelectedType() {
    return state.types.find(type => type.id === state.selectedTypeId) || null;
  }

  function getSelectedProduct() {
    const selectedType = getSelectedType();
    const products = selectedType && Array.isArray(selectedType.products) ? selectedType.products : [];
    return products.find(product => product.id === state.selectedProductId) || null;
  }

  function getUnitPrice(product) {
    const price = Number(product && product.unit_price);
    return Number.isFinite(price) && price > 0 ? price : 15000;
  }

  function getPackagingLabel(product) {
    if (!product) return '';
    if (product.packaging === 'box') return `Box (${product.pcs_per_box || 20} pcs)`;
    return `${product.length_m || 500} m roll`;
  }

  function optionButton(kind, value, title, active, note = '') {
    return `
      <button type="button" class="chem-option ${active ? 'chem-option--active' : ''}" data-${kind}="${sanitize(value)}" aria-pressed="${active ? 'true' : 'false'}">
        <span class="chem-option__title">${sanitize(title)}</span>
        ${note ? `<span class="chem-option__meta">${sanitize(note)}</span>` : ''}
      </button>
    `;
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

  function pluralize(unit, quantity) {
    return quantity === 1 ? unit : `${unit}s`;
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
