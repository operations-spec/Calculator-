(function() {
  const gmMode = document.documentElement && document.documentElement.dataset && document.documentElement.dataset.pricingMode === 'gm';
  const dataUrl = '/static/data/creasing_matrix/options.json';

  function getDiscountCap() {
    return gmMode ? 50 : 10;
  }

  function isTruthyFlag(value) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return false;
    return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
  }

  const machineSelect = document.getElementById('creasingMatrixMachineSelect');
  const thicknessSelect = document.getElementById('creasingMatrixThicknessSelect');
  const thicknessHelper = document.getElementById('creasingMatrixThicknessHelper');
  const sizeSelect = document.getElementById('creasingMatrixSizeSelect');
  const sizeHelper = document.getElementById('creasingMatrixSizeHelper');
  const quantityInput = document.getElementById('creasingMatrixQuantityInput');
  const quantityHelper = document.getElementById('creasingMatrixQuantityHelper');
  const confirmQuantityBtn = document.getElementById('creasingMatrixConfirmQuantityBtn');
  const summaryBody = document.getElementById('creasingMatrixSummaryBody');
  const summaryActions = document.getElementById('creasingMatrixSummaryActions');

  if (!thicknessSelect || !sizeSelect || !quantityInput || !summaryBody) {
    return;
  }

  const editContext = detectEditContext();

  const state = {
    machineName: '',
    machines: [],
    thicknesses: [],
    selectedThickness: null,
    selectedSize: null,
    quantityRolls: null,
    quantityConfirmed: false,
    discountPercent: 0
  };

  document.addEventListener('DOMContentLoaded', () => {
    initCollapsibleSteps();
    initializeConfigurator()
      .then(async () => {
        if (editContext.isEditMode && editContext.itemData) {
          try {
            await applyEditingItem(editContext.itemData);
          } catch (error) {
            console.error('creasing_matrix.js: failed to apply editing context', error);
            showToast('Warning', 'Loaded creasing matrix but previous selections were not fully restored.', 'warning');
          }
        }
      })
      .catch(error => {
        console.error('creasing_matrix.js: initialization failed', error);
        showToast('Error', 'Could not load the creasing matrix configurator. Please refresh.', 'error');
      });
  });

  function detectEditContext() {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item_id');
    const hasEditFlag = isTruthyFlag(params.get('edit'));
    const isEditMode = Boolean(itemId) || hasEditFlag;

    if (!isEditMode || !itemId) {
      const stored = sessionStorage.getItem('editingCartItem');
      if (!stored) {
        return { isEditMode: false };
      }
      try {
        const parsed = JSON.parse(stored);
        sessionStorage.removeItem('editingCartItem');
        return { isEditMode: true, itemId: parsed.id || parsed._id, itemData: parsed };
      } catch (err) {
        console.error('creasing_matrix.js: failed to parse editingCartItem', err);
        sessionStorage.removeItem('editingCartItem');
        return { isEditMode: false };
      }
    }

    const itemData = {};
    params.forEach((value, key) => {
      if (['edit', 'item_id', 'type', '_'].includes(key)) return;
      try {
        itemData[key] = JSON.parse(decodeURIComponent(value));
      } catch (parseErr) {
        itemData[key] = decodeURIComponent(value);
      }
    });

    return {
      isEditMode: true,
      itemId,
      itemData: {
        ...itemData,
        id: itemId,
        type: params.get('type') || 'creasing_matrix'
      }
    };
  }

  function resolveEditState() {
    const params = new URLSearchParams(window.location.search);
    const itemId = editContext.itemId || params.get('item_id') || editContext.itemData?.id || editContext.itemData?._id;
    const editFlag = isTruthyFlag(params.get('edit'));
    return {
      isEditMode: Boolean(editContext.isEditMode || editFlag || itemId),
      itemId
    };
  }

  function waitFor(predicate, timeout = 4000, interval = 50) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        try {
          if (predicate()) {
            resolve();
            return;
          }
        } catch (error) {
          reject(error);
          return;
        }

        if (Date.now() - start >= timeout) {
          reject(new Error('creasing_matrix.js: timed out waiting for configurator state'));
          return;
        }
        setTimeout(check, interval);
      };
      check();
    });
  }

  function selectMachineByLabel(label) {
    if (!machineSelect || !label) return;
    const normalized = label.trim().toLowerCase();
    const option = Array.from(machineSelect.options).find(opt => opt.textContent.trim().toLowerCase() === normalized);
    if (option) {
      machineSelect.value = option.value;
      machineSelect.dispatchEvent(new Event('change'));
    } else {
      state.machineName = label;
      updateSummary();
    }
  }

  async function selectThicknessByIdentifier(identifier) {
    if (!identifier) return;
    await waitFor(() => state.thicknesses.length > 0);
    const normalized = String(identifier).trim().toLowerCase();
    const target = state.thicknesses.find(entry => {
      return (
        String(entry.id) === String(identifier) ||
        (entry.label && entry.label.trim().toLowerCase() === normalized) ||
        (entry.value && String(entry.value).trim().toLowerCase() === normalized)
      );
    });
    if (target) {
      selectThickness(target.id);
      await waitFor(() => state.selectedThickness?.id === target.id);
    }
  }

  async function selectSizeByIdentifier(identifier) {
    if (!identifier) return;
    await waitFor(() => Boolean(state.selectedThickness));
    const normalized = String(identifier).trim().toLowerCase();
    const sizes = Array.isArray(state.selectedThickness?.sizes) ? state.selectedThickness.sizes : [];
    const target = sizes.find(size => {
      return (
        String(size.id) === String(identifier) ||
        (size.label && size.label.trim().toLowerCase() === normalized)
      );
    });
    if (target) {
      selectSize(target.id);
      await waitFor(() => state.selectedSize?.id === target.id);
    }
  }

  async function applyEditingItem(item) {
    if (!item) return;

    if (item.machine) {
      selectMachineByLabel(item.machine);
    }

    const thicknessIdentifier = item.thickness_id || item.thickness_label || item.thickness;
    await selectThicknessByIdentifier(thicknessIdentifier);

    const sizeIdentifier = item.size_id || item.size_label || item.size;
    await selectSizeByIdentifier(sizeIdentifier);

    const quantityValue = Number(item.quantity_rolls ?? item.quantity);
    if (Number.isFinite(quantityValue) && quantityValue > 0) {
      quantityInput.value = quantityValue;
      quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
      state.quantityRolls = quantityValue;
      state.quantityConfirmed = true;
      if (confirmQuantityBtn && !confirmQuantityBtn.disabled) {
        confirmQuantityBtn.click();
      }
    }

    if (item.discount_percent !== undefined) {
      state.discountPercent = Number(item.discount_percent) || 0;
    }

    updateSummary();
  }

  async function initializeConfigurator() {
    setThicknessLoading('Loading thickness options…');
    setSizeLoading('Select a thickness first');
    resetQuantityInput();

    await Promise.all([loadMachines(), loadThicknesses()]);

    setupEventListeners();
    updateSummary();
  }

  function loadMachines() {
    return fetch('/api/machines')
      .then(res => res.json())
      .then(data => {
        state.machines = Array.isArray(data) ? data : data.machines || [];
        if (machineSelect) {
          machineSelect.innerHTML = '<option value="">-- Select Machine (optional) --</option>';
          state.machines.forEach(machine => {
            const opt = document.createElement('option');
            opt.value = machine.id;
            opt.textContent = machine.name;
            machineSelect.appendChild(opt);
          });
        }
      })
      .catch(error => {
        console.error('creasing_matrix.js: error loading machines', error);
        if (machineSelect) {
          machineSelect.innerHTML = '<option value="">-- Error loading machines --</option>';
        }
      });
  }

  async function loadThicknesses() {
    try {
      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch creasing matrix data (${response.status})`);
      }
      const payload = await response.json();
      state.thicknesses = Array.isArray(payload?.thicknesses) ? payload.thicknesses : [];
      renderThicknessOptions();
    } catch (error) {
      console.error('creasing_matrix.js: unable to load matrix options', error);
      thicknessSelect.innerHTML = '<option value="">Unable to load thickness list</option>';
      thicknessSelect.disabled = true;
      setThicknessHelper('Unable to load thicknesses. Please refresh.');
    }
  }

  function setupEventListeners() {
    if (machineSelect) {
      machineSelect.addEventListener('change', event => {
        const selectedOption = event.target.options[event.target.selectedIndex];
        state.machineName = selectedOption && selectedOption.value ? selectedOption.textContent : '';
        updateSummary();
      });
    }

    thicknessSelect.addEventListener('change', event => {
      const { value } = event.target;
      if (!value) {
        state.selectedThickness = null;
        state.selectedSize = null;
        renderSizeOptions();
        resetQuantityInput();
        updateSummary();
        return;
      }
      selectThickness(value);
    });

    sizeSelect.addEventListener('change', event => {
      const { value } = event.target;
      if (!value) {
        state.selectedSize = null;
        resetQuantityInput();
        updateSummary();
        return;
      }
      selectSize(value);
    });

    quantityInput.addEventListener('input', () => {
      if (!state.selectedSize) {
        quantityInput.value = '';
        state.quantityRolls = null;
        state.quantityConfirmed = false;
        if (confirmQuantityBtn) confirmQuantityBtn.disabled = true;
        updateSummary();
        return;
      }

      const value = parseFloat(quantityInput.value);
      const hasValidQuantity = Number.isFinite(value) && value > 0;
      state.quantityRolls = hasValidQuantity ? value : null;
      state.quantityConfirmed = false;
      if (confirmQuantityBtn) {
        confirmQuantityBtn.disabled = !hasValidQuantity;
      }
      updateSummary();
    });

    if (confirmQuantityBtn) {
      confirmQuantityBtn.addEventListener('click', () => {
        if (!state.selectedSize) {
          showToast('Error', 'Please select a size before confirming packets.', 'error');
          return;
        }

        const value = parseFloat(quantityInput.value);
        if (!Number.isFinite(value) || value <= 0) {
          showToast('Error', 'Enter a valid number of packets before confirming.', 'error');
          return;
        }

        state.quantityRolls = value;
        state.quantityConfirmed = true;
        confirmQuantityBtn.blur();
        updateSummary();
      });
    }
  }

  function renderThicknessOptions() {
    if (!state.thicknesses.length) {
      thicknessSelect.innerHTML = '<option value="">No thickness data yet</option>';
      thicknessSelect.disabled = true;
      setThicknessHelper('Thickness data is not available.');
      return;
    }

    thicknessSelect.disabled = false;
    thicknessSelect.innerHTML = '<option value="">-- Select thickness --</option>';
    state.thicknesses.forEach(entry => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.label || `${entry.value} mm`;
      thicknessSelect.appendChild(option);
    });

    setThicknessHelper('Pick a thickness to filter compatible sizes.');
  }

  function selectThickness(thicknessId) {
    const thickness = state.thicknesses.find(item => String(item.id) === String(thicknessId));
    if (!thickness) return;

    state.selectedThickness = thickness;
    state.selectedSize = null;
    state.quantityRolls = null;
    state.quantityConfirmed = false;
    thicknessSelect.value = thickness.id;
    renderSizeOptions();
    resetQuantityInput();
    updateSummary();
    collapseStep(document.getElementById('creasingMatrixStepThickness'), thickness.label || `${thickness.value} mm`);
  }

  function renderSizeOptions() {
    if (!state.selectedThickness) {
      sizeSelect.disabled = true;
      setSizeLoading('Select a thickness first');
      return;
    }

    const sizes = Array.isArray(state.selectedThickness.sizes) ? state.selectedThickness.sizes : [];
    if (!sizes.length) {
      sizeSelect.disabled = true;
      sizeSelect.innerHTML = '<option value="">No sizes configured for this thickness</option>';
      setSizeHelper('No active sizes documented for the chosen thickness.');
      return;
    }

    sizeSelect.disabled = false;
    sizeSelect.innerHTML = '<option value="">-- Select size --</option>';
    sizes.forEach(size => {
      const option = document.createElement('option');
      option.value = size.id;
      const width = Number(size.width_mm);
      option.textContent = formatSizeLabel(size.label);
      option.dataset.meta = buildSizeMeta(size);
      if (width) {
        option.dataset.width = width;
      }
      sizeSelect.appendChild(option);
    });

    if (state.selectedSize) {
      const exists = sizes.some(size => String(size.id) === String(state.selectedSize.id));
      sizeSelect.value = exists ? state.selectedSize.id : '';
      if (!exists) state.selectedSize = null;
    } else {
      sizeSelect.value = '';
    }

    if (!state.selectedSize) {
      setSizeHelper('Choose a size to proceed to packets.');
    } else {
      setSizeHelper(buildSizeMeta(state.selectedSize));
    }
  }

  function selectSize(sizeId) {
    if (!state.selectedThickness) return;
    const sizes = Array.isArray(state.selectedThickness.sizes) ? state.selectedThickness.sizes : [];
    const size = sizes.find(item => String(item.id) === String(sizeId));
    if (!size) return;

    state.selectedSize = size;
    state.quantityRolls = null;
    state.quantityConfirmed = false;
    sizeSelect.value = size.id;
    if (quantityInput) {
      quantityInput.value = '';
      quantityInput.disabled = false;
      quantityInput.placeholder = 'Enter number of packets (e.g. 10)';
      quantityInput.focus();
    }
    if (quantityHelper) {
      quantityHelper.textContent = size.length_m
        ? `Each packet is ${size.length_m} m · ₹${getUnitPrice(size).toFixed(2)} per packet.`
        : `Enter packets required · ₹${getUnitPrice(size).toFixed(2)} per packet.`;
    }
    if (confirmQuantityBtn) {
      confirmQuantityBtn.disabled = true;
    }

    renderSizeOptions();
    resetQuantityInput(false);
    updateSummary();
    collapseStep(document.getElementById('creasingMatrixStepSize'), formatSizeLabel(size.label));
  }

  function resetQuantityInput(hard = true) {
    if (quantityInput) {
      if (hard) {
        quantityInput.value = '';
        quantityInput.disabled = true;
        quantityInput.placeholder = 'Select a size first';
      }
      if (!state.selectedSize) {
        quantityInput.value = '';
      }
    }
    if (quantityHelper) {
      quantityHelper.textContent = 'Choose a size to enable packet entry.';
    }
    if (confirmQuantityBtn) {
      confirmQuantityBtn.disabled = true;
    }
  }

  function updateSummary() {
    if (summaryActions) summaryActions.innerHTML = '';
    const items = [];

    if (state.machineName) {
      items.push(summaryItem('Machine', state.machineName));
    }

    if (state.selectedThickness) {
      items.push(summaryItem(
        'Thickness',
        state.selectedThickness.label || `${state.selectedThickness.value} mm`,
        state.selectedThickness.description || ''
      ));
    }

    if (state.selectedSize) {
      items.push(summaryItem('Size', formatSizeLabel(state.selectedSize.label), buildSizeMeta(state.selectedSize)));
    }

    const quantityValue = Number(state.quantityRolls);
    const hasValidQuantity = Number.isFinite(quantityValue) && quantityValue > 0;
    const quantityIsReady = state.quantityConfirmed && hasValidQuantity;

    if (state.selectedSize && quantityIsReady) {
      const rollLength = Number(state.selectedSize.length_m) || 0;
      const totalLength = rollLength > 0 ? quantityValue * rollLength : 0;
      if (totalLength > 0) {
        items.push(summaryItem('Total length', `${formatNumber(totalLength)} m`, `${formatNumber(rollLength)} m × ${formatNumber(quantityValue)} packets`));
      }
    }

    const hasCompleteSelection = Boolean(state.selectedThickness && state.selectedSize && quantityIsReady);

    let discountLabel = '';
    if (hasCompleteSelection) {
      const discountValue = getDiscountPercent();
      const discountPercent = Math.max(0, Math.min(100, Number.isFinite(discountValue) ? discountValue : 0));
      state.discountPercent = discountPercent;
      discountLabel = discountPercent > 0 ? ` (${discountPercent}% discount)` : '';
      const unitPrice = getUnitPrice();
      const subtotal = unitPrice * quantityValue;
      const discountAmount = (subtotal * discountPercent) / 100;
      const discountedSubtotal = subtotal - discountAmount;
      const gstPercent = 18;
      const gstAmount = (discountedSubtotal * gstPercent) / 100;
      const finalTotal = discountedSubtotal + gstAmount;

      items.push(summaryItem('Base price', `₹${subtotal.toFixed(2)}`, `₹${unitPrice.toFixed(2)} × ${formatNumber(quantityValue)} packets`));
      items.push(renderDiscountControl(discountPercent, discountAmount, discountedSubtotal));
      items.push(summaryItem('GST', `₹${gstAmount.toFixed(2)} (${gstPercent}%)`));
      items.push(summaryItem('Total', `₹${finalTotal.toFixed(2)}`));
    }

    if (!items.length) {
      summaryBody.innerHTML = '<p class="chem-summary__empty mb-0">Start by selecting a thickness.</p>';
      if (summaryActions) {
        summaryActions.innerHTML = '<p class="chem-summary__note chem-summary__note--muted mb-0">Your cart button appears after you confirm packets.</p>';
      }
    } else {
      summaryBody.innerHTML = items.join('');
      rebindDiscountSelect();

      if (summaryActions) {
        if (hasCompleteSelection) {
          const { isEditMode } = resolveEditState();
          summaryActions.innerHTML = `
            <button type="button" class="chem-summary__cta-btn add-to-cart-btn" id="creasingMatrixAddToCartBtn">
              <i class="fas fa-${isEditMode ? 'save' : 'cart-plus'}"></i>
              <span>${isEditMode ? 'Update item' : 'Add to cart'}</span>
            </button>
          `;

          const summaryCartBtn = document.getElementById('creasingMatrixAddToCartBtn');
          if (summaryCartBtn) {
            summaryCartBtn.addEventListener('click', async event => {
              event.preventDefault();
              try {
                await addMatrixToCart(summaryCartBtn);
              } catch (error) {
                console.error('creasing_matrix.js: failed to process cart action', error);
                showToast('Error', 'Failed to process your request. Please try again.', 'error');
              }
            });
          }
        } else {
          summaryActions.innerHTML = '<p class="chem-summary__note chem-summary__note--muted mb-0">Confirm packets to enable the cart button.</p>';
        }
      }

      if (state.selectedThickness) {
        collapseStep(document.getElementById('creasingMatrixStepThickness'), state.selectedThickness.label || `${state.selectedThickness.value} mm`);
      }
      if (state.selectedSize) {
        collapseStep(document.getElementById('creasingMatrixStepSize'), formatSizeLabel(state.selectedSize.label));
      }
      if (quantityIsReady) {
        collapseStep(document.getElementById('creasingMatrixStepQuantity'), `${formatNumber(state.quantityRolls)} packets${discountLabel}`);
      }
    }
  }

  function getDiscountPercent() {
    const discountSelectEl = document.getElementById('creasingMatrixDiscountPercent');
    if (discountSelectEl && discountSelectEl.value !== '') {
      const value = parseFloat(discountSelectEl.value);
      if (Number.isFinite(value)) {
        state.discountPercent = value;
        return value;
      }
    }
    return Math.max(0, Math.min(100, Number.isFinite(state.discountPercent) ? state.discountPercent : 0));
  }

  function renderDiscountControl(discountPercent, discountAmount, discountedSubtotal) {
    const cap = getDiscountCap();
    const discountOptions = Array.from({ length: Math.round(cap / 0.5) + 1 }, (_, idx) => idx * 0.5)
      .map(percent => `<option value="${percent}" ${percent === discountPercent ? 'selected' : ''}>${percent}%</option>`)
      .join('');

    const discountSummaryText = discountPercent > 0
      ? `Saving: ₹${discountAmount.toFixed(2)}<br>Subtotal after discount: ₹${discountedSubtotal.toFixed(2)}`
      : 'No discount applied yet.';

    return `
      <div class="chem-summary__item chem-summary__item--discount">
        <div class="chem-summary__discount-control">
          <span class="chem-summary__label">Discount</span>
          <select id="creasingMatrixDiscountPercent" class="form-select form-select-sm chem-summary__discount-select">${discountOptions}</select>
        </div>
        <div class="chem-summary__note chem-summary__note--muted">${discountSummaryText}</div>
      </div>
    `;
  }

  function rebindDiscountSelect() {
    const discountSelectEl = document.getElementById('creasingMatrixDiscountPercent');
    if (discountSelectEl) {
      if (Number.isFinite(state.discountPercent)) {
        discountSelectEl.value = String(state.discountPercent);
      }
      discountSelectEl.addEventListener('change', () => {
        state.discountPercent = Number(discountSelectEl.value) || 0;
        updateSummary();
      });
    }
  }

  function getUnitPrice(size = state.selectedSize) {
    const price = size && Number(size.price_per_roll);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
    return 2000;
  }

  async function addMatrixToCart(cartBtn) {
    if (!state.selectedThickness || !state.selectedSize || !state.quantityConfirmed || !state.quantityRolls || state.quantityRolls <= 0) {
      showToast('Error', 'Complete all selections before adding to cart.', 'error');
      return;
    }

    const discountPercent = getDiscountPercent();
    const quantityValue = state.quantityRolls;
    const unitPrice = getUnitPrice();
    const subtotal = unitPrice * quantityValue;
    const discountAmount = (subtotal * discountPercent) / 100;
    const discountedSubtotal = subtotal - discountAmount;
    const gstPercent = 18;
    const gstAmount = (discountedSubtotal * gstPercent) / 100;
    const finalTotal = discountedSubtotal + gstAmount;
    const rollLength = Number(state.selectedSize.length_m) || 0;

    const { isEditMode, itemId } = resolveEditState();
    const resolvedId = isEditMode && itemId ? itemId : 'creasing_matrix_' + Date.now();

    const payload = {
      id: resolvedId,
      type: 'creasing_matrix',
      name: `${state.selectedThickness.label || state.selectedThickness.id} - ${state.selectedSize.label}`,
      machine: state.machineName || '--',
      thickness_id: state.selectedThickness.id,
      thickness_label: state.selectedThickness.label,
      size_id: state.selectedSize.id,
      size_label: state.selectedSize.label,
      size_details: {
        channel_mm: state.selectedSize.channel_mm,
        shoulder_mm: state.selectedSize.shoulder_mm,
        width_mm: state.selectedSize.width_mm,
        length_m: state.selectedSize.length_m
      },
      unit_price: unitPrice,
      price_per_roll: unitPrice,
      quantity: quantityValue,
      quantity_rolls: quantityValue,
      total_length_m: rollLength > 0 ? quantityValue * rollLength : null,
      discount_percent: discountPercent,
      gst_percent: gstPercent,
      subtotal,
      discount_amount: discountAmount,
      discounted_subtotal: discountedSubtotal,
      gst_amount: gstAmount,
      final_total: finalTotal,
      image: 'images/creasing-matrix-placeholder.jpg',
      added_at: new Date().toISOString()
    };

    const targetBtn = cartBtn || document.getElementById('creasingMatrixAddToCartBtn');
    if (targetBtn) {
      const originalText = targetBtn.innerHTML;
      targetBtn.disabled = true;
      targetBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${isEditMode ? 'Updating…' : 'Adding…'}`;

      try {
        let response;
        if (isEditMode && itemId) {
          payload.item_id = resolvedId;
          response = await fetch('/update_cart_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          response = await fetch('/add_to_cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await response.json();
        if (data.success) {
          showToast('Success', isEditMode ? 'Creasing matrix updated!' : 'Creasing matrix added to cart!', 'success');
          if (typeof updateCartCount === 'function') {
            updateCartCount();
          }

          if (isEditMode && itemId) {
            setTimeout(() => {
              window.location.href = '/cart';
            }, 800);
          } else {
            setTimeout(() => resetForm(), 1500);
          }
        } else {
          throw new Error(data.message || 'Failed to save creasing matrix');
        }
      } catch (error) {
        console.error('creasing_matrix.js: error saving cart item', error);
        showToast('Error', error.message || 'Failed to process creasing matrix. Please try again.', 'error');
      } finally {
        targetBtn.disabled = false;
        targetBtn.innerHTML = originalText;
      }
    }
  }

  function resetForm() {
    state.selectedThickness = null;
    state.selectedSize = null;
    state.quantityRolls = null;
    state.quantityConfirmed = false;
    state.machineName = '';
    state.discountPercent = 0;

    if (machineSelect) machineSelect.value = '';
    thicknessSelect.value = '';
    setThicknessHelper('Pick a thickness to filter compatible sizes.');
    renderSizeOptions();
    resetQuantityInput();
    summaryBody.innerHTML = '<p class="chem-summary__empty mb-0">Start by selecting a thickness.</p>';
    if (summaryActions) summaryActions.innerHTML = '';
    updateSummary();
    expandStep(document.getElementById('creasingMatrixStepThickness'));
    expandStep(document.getElementById('creasingMatrixStepSize'));
    expandStep(document.getElementById('creasingMatrixStepQuantity'));
  }

  function setThicknessLoading(message) {
    thicknessSelect.innerHTML = `<option value="">${sanitize(message)}</option>`;
    thicknessSelect.disabled = true;
  }

  function setSizeLoading(message) {
    sizeSelect.innerHTML = `<option value="">${sanitize(message)}</option>`;
    sizeSelect.disabled = true;
    setSizeHelper(message);
  }

  function setThicknessHelper(message) {
    if (thicknessHelper) thicknessHelper.textContent = message;
  }

  function setSizeHelper(message) {
    if (sizeHelper) sizeHelper.textContent = message;
  }

  function buildSizeMeta(size) {
    if (!size) return '';
    const parts = [];
    if (size.shoulder_mm) parts.push(`Shoulder ${size.shoulder_mm} mm`);
    if (size.width_mm) parts.push(`Width ${size.width_mm} mm`);
    if (size.length_m) parts.push(`${size.length_m} m packet`);
    return parts.join(' · ');
  }

  function formatSizeLabel(label) {
    if (!label) return '';
    const text = String(label).trim();
    const match = text.match(/^([\d.]+)\s*x\s*([\d.]+)\s*mm$/i);
    if (!match) {
      return text;
    }
    return `${match[1]} mm x ${match[2]} mm`;
  }

  function summaryItem(label, value, note) {
    return `
      <div class="chem-summary__item">
        <span class="chem-summary__label">${sanitize(label)}</span>
        <span class="chem-summary__value">${sanitize(value)}</span>
        ${note ? `<span class="chem-summary__note">${note}</span>` : ''}
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

  function formatNumber(value) {
    return Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function collapseStep(stepEl, summaryText) {
    if (!stepEl) return;
    stepEl.classList.add('chem-step--collapsed');
    let summary = stepEl.querySelector('.chem-step__summary');
    if (!summary) {
      const header = stepEl.querySelector('.chem-step__header');
      if (header) {
        summary = document.createElement('span');
        summary.className = 'chem-step__summary ms-auto';
        header.appendChild(summary);
      }
    }
    if (summary) summary.textContent = summaryText || '';
    const updateBtn = stepEl.querySelector('.chem-step__update');
    if (updateBtn) updateBtn.classList.remove('d-none');
  }

  function expandStep(stepEl) {
    if (!stepEl) return;
    stepEl.classList.remove('chem-step--collapsed');
    const updateBtn = stepEl.querySelector('.chem-step__update');
    if (updateBtn) updateBtn.classList.add('d-none');
  }

  function initCollapsibleSteps() {
    document.querySelectorAll('.chem-step').forEach(stepEl => {
      const header = stepEl.querySelector('.chem-step__header');
      if (!header) return;

      let summarySpan = header.querySelector('.chem-step__summary');
      if (!summarySpan) {
        summarySpan = document.createElement('span');
        summarySpan.className = 'chem-step__summary ms-2';
        header.appendChild(summarySpan);
      }

      let updateBtn = header.querySelector('.chem-step__update');
      if (!updateBtn) {
        updateBtn = document.createElement('button');
        updateBtn.type = 'button';
        updateBtn.className = 'btn btn-sm btn-outline-secondary chem-step__update ms-2 d-none';
        updateBtn.textContent = 'Update';
        header.appendChild(updateBtn);
      }

      const reopenStep = () => {
        expandStep(stepEl);
        if (stepEl.id === 'creasingMatrixStepQuantity') {
          state.quantityConfirmed = false;
          if (confirmQuantityBtn) {
            const currentValue = parseFloat(quantityInput.value);
            const hasValidQuantity = Number.isFinite(currentValue) && currentValue > 0;
            confirmQuantityBtn.disabled = !hasValidQuantity;
          }
          updateSummary();
        }
      };

      updateBtn.addEventListener('click', e => {
        e.stopPropagation();
        reopenStep();
      });

      header.addEventListener('click', e => {
        if (e.target.closest('.chem-step__update')) return;
        reopenStep();
      });
    });
  }

  function showToast(title, message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(title, message, type);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
    toast.role = 'alert';
    toast.innerHTML = `
      <strong>${sanitize(title)}</strong> ${sanitize(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    document.body.insertBefore(toast, document.body.firstChild);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }
})();
