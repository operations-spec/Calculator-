var machineData = [], blanketData = [], blanketCategoriesData = {}, barData = [], discountData = [], thicknessData = [];
var fullDiscountOptions = [];
var discountPrivileges = (function resolveDiscountPrivileges() {
  if (typeof window !== 'undefined' && window.__discountPrivileges) {
    return window.__discountPrivileges;
  }

  if (typeof document !== 'undefined') {
    var rootEl = document.getElementById('blanketsPageRoot');
    if (rootEl && rootEl.dataset && rootEl.dataset.discountPrivileges) {
      try {
        return JSON.parse(rootEl.dataset.discountPrivileges);
      } catch (error) {
        console.warn('[SAVA] Failed to parse discount privileges dataset', error);
      }
    }
  }

  return {};
})();
var basePrice = typeof basePrice !== 'undefined' ? basePrice : 0;
var priceWithBar = typeof priceWithBar !== 'undefined' ? priceWithBar : 0;
var finalDiscountedPrice = typeof finalDiscountedPrice !== 'undefined' ? finalDiscountedPrice : 0;
var currentDiscount = typeof currentDiscount !== 'undefined' ? currentDiscount : 0;
var currentBarRate = typeof currentBarRate !== 'undefined' ? currentBarRate : 0;

function generateSavaDiscountOptions(maxCap = 5) {
  const options = [];
  const capped = Number(maxCap);
  const stepCount = Number.isFinite(capped) && capped > 0 ? Math.round(capped / 0.5) : 10;
  for (let step = 0; step <= stepCount; step += 1) {
    const value = Number((step * 0.5).toFixed(2));
    if (value <= capped + 1e-9) {
      options.push(value);
    }
  }
  return options;
}

function generateDefaultDiscountOptions() {
  const options = [];
  for (let val = 0; val <= 10; val += 0.5) {
    options.push(Number(val.toFixed(2)));
  }
  return options;
}

function isRestrictedDiscountBlanket(name = '') {
  const normalized = String(name).toLowerCase();
  return /conti\s*sava/.test(normalized) || /web\s*x\s*press\s*g3/.test(normalized);
}

function getRestrictedDiscountCap() {
  const cap = discountPrivileges && Number(discountPrivileges.restricted_cap);
  if (!Number.isNaN(cap) && cap > 0) {
    return cap;
  }
  return discountPrivileges && discountPrivileges.extended_discount_allowed ? 10 : 5;
}

function populateDiscountSelectOptions(selectEl, options = [], currentValue = '') {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">-- Select Discount --</option>';
  const normalizedValue = currentValue !== '' ? Number(currentValue) : null;
  const normalizedOptions = options
    .map(val => Number(val))
    .filter(val => !Number.isNaN(val));

  normalizedOptions.forEach(val => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = val.toFixed(2);
    selectEl.appendChild(option);
  });

  if (normalizedValue !== null && normalizedOptions.includes(normalizedValue)) {
    selectEl.value = normalizedValue;
  }
}

function getBlanketDiscountSelect() {
  return document.querySelector('#pricingSection #discountSelect');
}

function applySavaDiscountRestriction(blanketSelectEl, discountSelectEl) {
  if (!blanketSelectEl || !discountSelectEl) return;
  const selectedId = blanketSelectEl.value;
  const blanket = blanketData && blanketData.length ? blanketData.find(b => String(b.id) === String(selectedId)) : null;
  const selectedOptionText = blanketSelectEl.options?.[blanketSelectEl.selectedIndex]?.text || '';
  const blanketName = blanket?.name || selectedOptionText;
  const isRestricted = isRestrictedDiscountBlanket(blanketName || '');
  const restrictionType = isRestricted ? (/(conti\s*sava)/i.test(blanketName || '') ? 'conti_sava' : 'web_x_press_g3') : 'none';
  console.log('[SAVA] apply restriction', { selectedId, blanketName, isRestricted, restrictionType, currentValue: discountSelectEl.value });
  const currentValue = discountSelectEl.value;
  const restrictedCap = getRestrictedDiscountCap();
  const allowedOptions = isRestricted
    ? generateSavaDiscountOptions(restrictedCap)
    : (fullDiscountOptions.length ? fullDiscountOptions : generateDefaultDiscountOptions());
  console.log('[SAVA] allowed options', allowedOptions);

  // Manual rebuild to avoid residual options
  discountSelectEl.innerHTML = '<option value="">-- Select Discount --</option>';
  allowedOptions.forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val.toFixed(2);
    discountSelectEl.appendChild(opt);
  });
  console.log('[SAVA] options rebuilt', Array.from(discountSelectEl.options).map(o=>o.value));

  if (currentValue) {
    const numericCurrent = parseFloat(currentValue);
    if (!Number.isNaN(numericCurrent) && allowedOptions.includes(numericCurrent)) {
      discountSelectEl.value = numericCurrent;
    } else {
      discountSelectEl.value = '';
    }
  }

  // Observe external mutations that might add back high discounts
  if (isRestricted) {
    discountSelectEl.__restrictedCap = restrictedCap;
    // Clean any high options immediately before attaching observer
    Array.from(discountSelectEl.options).forEach(opt => {
      const num = parseFloat(opt.value || '');
      if (!Number.isNaN(num) && num > restrictedCap) {
        opt.remove();
      }
    });

    if (!discountSelectEl.__savaObserver) {
    const observer = new MutationObserver(() => {
      console.log('[SAVA] mutation observed, pruning');
      const cap = typeof discountSelectEl.__restrictedCap === 'number' ? discountSelectEl.__restrictedCap : 5;
      Array.from(discountSelectEl.options).forEach(opt=>{
        const num = parseFloat(opt.value||'');
        if(!Number.isNaN(num) && num>cap){ opt.remove(); }
      });
      console.log('[SAVA] post-prune options', Array.from(discountSelectEl.options).map(o=>o.value));
    });
    observer.observe(discountSelectEl, {childList:true});
    discountSelectEl.__savaObserver = observer; // store flag
    }
  } else if (!isRestricted && discountSelectEl.__savaObserver) {
    discountSelectEl.__savaObserver.disconnect();
    discountSelectEl.__savaObserver = null;
    discountSelectEl.__restrictedCap = null;
  }

  if (isRestricted && parseFloat(discountSelectEl.value || '0') > restrictedCap) {
    discountSelectEl.value = '';
    discountSelectEl.dispatchEvent(new Event('change'));
  }
}

function getBlanketSections() {
  return {
    categorySection: document.getElementById("categorySection"),
    blanketSection: document.getElementById("blanketSection"),
    measurementSection: document.getElementById("measurementSection"),
    pricingSection: document.getElementById("pricingSection"),
    blanketTypeSection: document.getElementById("blanketTypeSection")
  };
}

function sanitizeOptionText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function optionButton(kind, value, title, active, note = '') {
  return `
    <button type="button" class="chem-option ${active ? 'chem-option--active' : ''}" data-${kind}="${sanitizeOptionText(value)}" aria-pressed="${active ? 'true' : 'false'}">
      <span class="chem-option__title">${sanitizeOptionText(title)}</span>
      ${note ? `<span class="chem-option__meta">${sanitizeOptionText(note)}</span>` : ''}
    </button>
  `;
}

function syncPickerState(selectEl, pickerEl) {
  if (!pickerEl || !selectEl) return;
  const showDropdown = !!selectEl.value && !selectEl.disabled;
  pickerEl.classList.toggle('chem-picker--selected', showDropdown);
}

function resetPicker(selectEl, pickerEl) {
  if (selectEl) {
    selectEl.value = '';
  }
  syncPickerState(selectEl, pickerEl);
}

function bindPickerSelect(selectEl, pickerEl) {
  if (!selectEl || !pickerEl || selectEl.__pickerBound) return;
  selectEl.addEventListener('change', () => syncPickerState(selectEl, pickerEl));
  selectEl.__pickerBound = true;
}

function renderOptionBoxes(selectEl, containerEl, kind, pickerEl, { placeholder = 'No options available.', skipEmpty = true } = {}) {
  if (!containerEl) return;
  if (!selectEl) {
    containerEl.innerHTML = `<p class="chem-placeholder mb-0">${sanitizeOptionText(placeholder)}</p>`;
    syncPickerState(selectEl, pickerEl);
    return;
  }

  const options = Array.from(selectEl.options).filter(opt => !skipEmpty || opt.value);
  if (!options.length) {
    containerEl.innerHTML = `<p class="chem-placeholder mb-0">${sanitizeOptionText(placeholder)}</p>`;
    syncPickerState(selectEl, pickerEl);
    return;
  }

  containerEl.innerHTML = options
    .map(opt => optionButton(kind, opt.value, opt.textContent, selectEl.value === opt.value))
    .join('');

  containerEl.querySelectorAll(`[data-${kind}]`).forEach(button => {
    button.addEventListener('click', () => {
      const value = button.getAttribute(`data-${kind}`);
      if (selectEl.value === value) return;
      selectEl.value = value;
      syncPickerState(selectEl, pickerEl);
      selectEl.dispatchEvent(new Event('change'));
    });
  });

  syncPickerState(selectEl, pickerEl);
}

function renderCategoryOptions() {
  const categorySelect = document.getElementById('categorySelect');
  renderOptionBoxes(
    categorySelect,
    document.getElementById('categoryOptions'),
    'category',
    document.getElementById('categorySection'),
    { placeholder: 'Loading categories...' }
  );
}

function renderBlanketOptions() {
  const blanketSelect = document.getElementById('blanketSelect');
  renderOptionBoxes(
    blanketSelect,
    document.getElementById('blanketOptions'),
    'blanket',
    document.getElementById('blanketTypeSection'),
    { placeholder: 'Select a category first.' }
  );
}

function initBlanketPickers() {
  bindPickerSelect(
    document.getElementById('categorySelect'),
    document.getElementById('categorySection')
  );
  bindPickerSelect(
    document.getElementById('blanketSelect'),
    document.getElementById('blanketTypeSection')
  );
}

function resetMeasurements() {
  const lengthInput = document.getElementById('lengthInput');
  const widthInput = document.getElementById('widthInput');
  const thicknessSelect = document.getElementById('thicknessSelect');
  if (lengthInput) lengthInput.value = '';
  if (widthInput) widthInput.value = '';
  if (thicknessSelect) thicknessSelect.value = '';
}

function resetPricing() {
  const barSelect = document.getElementById('barSelect');
  const quantityInput = document.getElementById('quantityInput');
  const finalPriceElement = document.getElementById('finalPrice');
  const basePriceEl = document.getElementById('basePrice');
  const netUnitPriceEl = document.getElementById('netUnitPrice');
  const netUnitPriceMirrorEl = document.getElementById('netUnitPriceMirror');
  const areaElement = document.getElementById('calculatedArea');
  const discountValue = document.getElementById('discountedValue');
  if (barSelect) barSelect.value = '';
  if (quantityInput) quantityInput.value = 1;
  if (areaElement) areaElement.innerText = '';
  if (basePriceEl) basePriceEl.innerText = '';
  if (netUnitPriceEl) netUnitPriceEl.innerText = '';
  if (netUnitPriceMirrorEl) netUnitPriceMirrorEl.innerText = '';
  if (discountValue) discountValue.style.display = 'none';
  if (finalPriceElement) {
    finalPriceElement.innerHTML = '<p class="text-muted mb-0">Enter dimensions and select options to see pricing</p>';
  }
}

function updateMeasurementVisibility() {
  const { measurementSection, pricingSection } = getBlanketSections();
  const categorySelect = document.getElementById("categorySelect");
  const blanketSelect = document.getElementById("blanketSelect");
  const hasCategory = categorySelect && !!categorySelect.value;
  const hasBlanket = blanketSelect && !!blanketSelect.value;
  if (measurementSection) {
    measurementSection.style.display = hasCategory && hasBlanket ? 'block' : 'none';
  }
  if (!hasCategory) {
    if (blanketSelect) blanketSelect.value = '';
    if (measurementSection) measurementSection.style.display = 'none';
    if (pricingSection) pricingSection.style.display = 'none';
    resetMeasurements();
    resetPricing();
  } else if (!hasBlanket) {
    if (pricingSection) pricingSection.style.display = 'none';
    resetMeasurements();
    resetPricing();
  }
}

function updatePricingVisibility() {
  const { pricingSection } = getBlanketSections();
  const thickness = document.getElementById('thicknessSelect')?.value;
  const shouldShowPricing = !!thickness;
  if (pricingSection) {
    pricingSection.style.display = shouldShowPricing ? 'block' : 'none';
  }
  if (!shouldShowPricing) {
    resetPricing();
  }
}

// Function to update an existing cart item
async function updateCartItem(button, itemId) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
    
    try {
        // Get the current form data
        const formData = getFormData();
        
        // Create the payload with the expected structure
        const payload = {
            item_id: itemId, // This must match the item ID in the cart
            id: itemId, // Some endpoints might expect this as well
            quantity: formData.quantity || 1,
            length: formData.length || 0,
            width: formData.width || 0,
            thickness: formData.thickness || '',
            machine: formData.machine || '',
            bar_type: formData.bar_type || 'None',
            bar_price: formData.bar_price || 0,
            discount_percent: formData.discount_percent || 0,
            gst_percent: formData.gst_percent || 12,
            unit_price: formData.unit_price || 0,
            base_price: formData.base_price || 0,
            name: formData.name || 'Custom Blanket',
            blanket_name: formData.blanket_name || formData.name || 'Custom Blanket',
            type: 'blanket', // Explicitly set type
            unit: formData.unit || 'mm',
            calculations: formData.calculations || {}
        };
        
        // Include all calculations if they exist
        if (formData.calculations) {
            payload.calculations = formData.calculations;
        }
        
        console.log('Sending update request with payload:', payload);
        
        // Send update request to the server
        const response = await fetch('/update_cart_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'same-origin' // Include cookies for session
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server responded with:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Update response:', data);
        
        if (data.success) {
            // Update the cart count
            if (typeof updateCartCount === 'function') {
                updateCartCount();
            }
            
            // Show success message and redirect back to cart
            showToast('Success', 'Item updated in cart!', 'success');
            setTimeout(() => {
                window.location.href = '/cart';
            }, 1000);
        } else {
            throw new Error(data.error || 'Failed to update item');
        }
    } catch (error) {
        console.error('Error updating cart item:', error);
        showToast('Error', 'Failed to update item. Please try again.', 'error');
        button.disabled = false;
        button.textContent = 'Update Item';
        throw error; // Re-throw the error to be caught by the caller
    }
}

// Function to get form data for cart operations
function getFormData() {
    const blanketSelect = document.getElementById('blanketSelect');
    const machineSelect = document.getElementById('machineSelect');
    const thicknessSelect = document.getElementById('thicknessSelect');
    const lengthInput = document.getElementById('lengthInput');
    const widthInput = document.getElementById('widthInput');
    const unitSelect = document.getElementById('unitSelect');
    const quantityInput = document.getElementById('quantityInput');
    const barSelect = document.getElementById('barSelect');
    const gstSelect = document.getElementById('gstSelect');
    const discountSelect = getBlanketDiscountSelect();
    
    // Get selected blanket
    const selectedBlanketId = blanketSelect.value;
    const selectedBlanket = blanketData.find(b => b.id.toString() === selectedBlanketId.toString());
    
    if (!selectedBlanket) {
        throw new Error('Please select a valid blanket');
    }
    
    // Get barring information
    const selectedBar = barData.find(b => b.bar === barSelect.options[barSelect.selectedIndex]?.text);
    const barType = selectedBar ? selectedBar.bar : 'None';
    const barPrice = selectedBar ? parseFloat(selectedBar.barRate || selectedBar.price || 0) : 0;
    
    // Get dimensions and convert to meters for calculation
    const length = parseFloat(lengthInput.value) || 0;
    const width = parseFloat(widthInput.value) || 0;
    const unit = unitSelect.value || 'mm';
    const lengthM = convertToMeters(length, unit);
    const widthM = convertToMeters(width, unit);
    const areaSqM = lengthM * widthM;
    
    // Calculate base price
    const ratePerSqMt = parseFloat(selectedBlanket.ratePerSqMt || selectedBlanket.base_rate || 0);
    const basePrice = areaSqM * ratePerSqMt;
    
    // Apply discount if any
    const discountPercent = parseFloat(discountSelect.value) || 0;
    const discountAmount = discountPercent > 0 ? (basePrice * discountPercent / 100) : 0;
    const discountedBasePrice = basePrice - discountAmount;
    
    // Add bar price after discount
    const priceWithBar = discountedBasePrice + (barPrice * areaSqM);
    
    // Calculate GST
    const gstPercent = parseFloat(gstSelect.value) || 0;
    const gstAmount = (priceWithBar * gstPercent) / 100;
    const finalUnitPrice = priceWithBar + gstAmount;
    const quantity = parseInt(quantityInput.value) || 1;
    const finalTotalPrice = finalUnitPrice * quantity;
    
    const machineName = (machineSelect && machineSelect.value)
        ? (machineSelect.options[machineSelect.selectedIndex]?.text || '--')
        : '--';

    return {
        type: 'blanket',
        id: 'blanket_' + Date.now(),
        name: selectedBlanket.name || 'Custom Blanket',
        blanket_name: selectedBlanket.name || 'Custom Blanket',
        machine: machineName,
        thickness: thicknessSelect ? thicknessSelect.value : '',
        length: length,
        width: width,
        unit: unit,
        bar_type: barType,
        bar_price: barPrice,
        quantity: quantity,
        gst_percent: gstPercent,
        base_price: parseFloat(basePrice.toFixed(2)),
        discount_percent: discountPercent,
        calculations: {
            areaSqM: parseFloat(areaSqM.toFixed(4)),
            ratePerSqMt: parseFloat(selectedBlanket.base_rate) || 0,
            basePrice: parseFloat(basePrice.toFixed(2)),
            pricePerUnit: parseFloat(priceWithBar.toFixed(2)),
            subtotal: parseFloat((priceWithBar * quantity).toFixed(2)),
            discount_percent: discountPercent,
            discount_amount: parseFloat(discountAmount.toFixed(2)),
            discounted_subtotal: parseFloat((priceWithBar * quantity).toFixed(2)),
            gst_percent: gstPercent,
            gst_amount: parseFloat((gstAmount * quantity).toFixed(2)),
            final_price: parseFloat(finalTotalPrice.toFixed(2))
        },
        unit_price: parseFloat(finalUnitPrice.toFixed(2)),
        total_price: parseFloat(finalTotalPrice.toFixed(2)),
        image: 'images/products/blanket-placeholder.jpg',
        added_at: new Date().toISOString()
    };
}

// Function to check if we're editing an existing cart item
function checkForEditingItem() {
    // First check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const editMode = urlParams.get('edit') === 'true';
    const itemId = urlParams.get('item_id');
    
    if (editMode && itemId) {
        // Get item details from URL parameters
        const item = {};
        urlParams.forEach((value, key) => {
            // Skip internal parameters
            if (key === 'edit' || key === 'item_id' || key === 'type' || key === '_') return;
            
            // Try to parse JSON values
            try {
                item[key] = JSON.parse(decodeURIComponent(value));
            } catch (e) {
                item[key] = value;
            }
        });
        
        // Add ID and type - ensure these are set correctly
        item.id = itemId.toString(); // Ensure ID is a string
        item.type = urlParams.get('type') || 'blanket';
        
        // Make sure we have the required calculations object
        if (!item.calculations) {
            item.calculations = {
                areaSqM: 0,
                ratePerSqMt: 0,
                basePrice: 0,
                pricePerUnit: 0,
                subtotal: 0,
                discount_percent: 0,
                discount_amount: 0,
                discounted_subtotal: 0,
                gst_percent: 0,
                gst_amount: 0,
                final_price: 0
            };
        }
        
        console.log('Editing item from URL:', item);
        return item;
    }
    
    // Fall back to session storage if no URL parameters
    const editingItem = sessionStorage.getItem('editingCartItem');
    if (!editingItem) return null;
    
    try {
        const parsed = JSON.parse(editingItem);
        // Remove the item from session storage so it doesn't persist after refresh
        sessionStorage.removeItem('editingCartItem');
        return parsed;
    } catch (e) {
        console.error('Error parsing editing item:', e);
        return null;
    }
}

// Function to pre-fill the form with item data
function prefillFormWithItem(item) {
    if (!item) return;
    
    console.log('Prefilling form with item:', item);
    
    try {
        // Update the button text
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.textContent = 'Update Item';
        }
        
        // Set machine if available
        if (item.machine && item.machine !== '--') {
            const machineSelect = document.getElementById('machineSelect');
            if (machineSelect) {
                // Find the option that matches the machine name
                for (let i = 0; i < machineSelect.options.length; i++) {
                    if (machineSelect.options[i].text === item.machine) {
                        machineSelect.selectedIndex = i;
                        // Trigger change event to load blankets for this machine
                        machineSelect.dispatchEvent(new Event('change'));
                        break;
                    }
                }
            }
        }
        
        // Set blanket type after a short delay to allow the blanket options to load
        setTimeout(() => {
            if (item.blanket_name) {
                const blanketSelect = document.getElementById('blanketSelect');
                if (blanketSelect) {
                    // Find the option that matches the blanket name
                    for (let i = 0; i < blanketSelect.options.length; i++) {
                        if (blanketSelect.options[i].text === item.blanket_name) {
                            blanketSelect.selectedIndex = i;
                            // Trigger change event to update prices
                            blanketSelect.dispatchEvent(new Event('change'));
                            break;
                        }
                    }
                }
            }
            
            // Set thickness if available
            if (item.thickness) {
                const thicknessSelect = document.getElementById('thicknessSelect');
                if (thicknessSelect) {
                    for (let i = 0; i < thicknessSelect.options.length; i++) {
                        if (thicknessSelect.options[i].value === item.thickness) {
                            thicknessSelect.selectedIndex = i;
                            thicknessSelect.dispatchEvent(new Event('change'));
                            break;
                        }
                    }
                }
            }
            
            // Set dimensions
            const lengthInput = document.getElementById('lengthInput');
            const widthInput = document.getElementById('widthInput');
            const unitSelect = document.getElementById('unitSelect');
            
            if (lengthInput && !isNaN(item.length)) lengthInput.value = item.length;
            if (widthInput && !isNaN(item.width)) widthInput.value = item.width;
            if (unitSelect && item.unit) unitSelect.value = item.unit;
            
            // Set quantity
            const quantityInput = document.getElementById('quantityInput');
            if (quantityInput && !isNaN(item.quantity)) quantityInput.value = item.quantity;
            
            // Set bar type after a short delay to allow the bar options to load
            setTimeout(() => {
                if (item.bar_type && item.bar_type !== 'None') {
                    const barSelect = document.getElementById('barSelect');
                    if (barSelect) {
                        for (let i = 0; i < barSelect.options.length; i++) {
                            if (barSelect.options[i].text === item.bar_type) {
                                barSelect.selectedIndex = i;
                                barSelect.dispatchEvent(new Event('change'));
                                break;
                            }
                        }
                    }
                }
                
                // Set GST
                const gstSelect = document.getElementById('gstSelect');
                if (gstSelect && !isNaN(item.gst_percent)) {
                    gstSelect.value = item.gst_percent;
                    gstSelect.dispatchEvent(new Event('change'));
                }
                
                // Set discount if available
                if (item.discount_percent) {
                    const discountSelect = getBlanketDiscountSelect();
                    if (discountSelect) {
                        // Try to find an exact match first
                        let found = false;
                        for (let i = 0; i < discountSelect.options.length; i++) {
                            if (parseFloat(discountSelect.options[i].value) === item.discount_percent) {
                                discountSelect.selectedIndex = i;
                                discountSelect.dispatchEvent(new Event('change'));
                                found = true;
                                break;
                            }
                        }
                        
                        // If no exact match, set the value directly (this will work if the select allows custom values)
                        if (!found && discountSelect.value !== '') {
                            discountSelect.value = item.discount_percent;
                            discountSelect.dispatchEvent(new Event('change'));
                        }
                    }
                }
                
                // Recalculate the price to update the display
                if (typeof calculatePrice === 'function') {
                    calculatePrice();
                }
                
            }, 500); // Additional delay for bar options to load
            
        }, 500); // Initial delay for blanket options to load
        
    } catch (error) {
        console.error('Error prefilling form:', error);
    }
}

// Function to handle company info from URL parameters
function handleCompanyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const companyName = urlParams.get('company_name');
    const companyEmail = urlParams.get('company_email');
    const companyId = urlParams.get('company_id');
    
    if (companyName && companyEmail) {
        const companyInfo = {
            name: decodeURIComponent(companyName),
            email: decodeURIComponent(companyEmail),
            id: companyId || ''
        };
        
        // Save to localStorage for persistence
        localStorage.setItem('selectedCompany', JSON.stringify(companyInfo));
        
        // Update the UI if the elements exist
        const companyNameEl = document.getElementById('companyNameDisplay');
        const companyEmailEl = document.getElementById('companyEmailDisplay');
        
        if (companyNameEl) companyNameEl.textContent = companyInfo.name;
        if (companyEmailEl) companyEmailEl.textContent = companyInfo.email;
    }
}

window.onload = () => {
    // Handle company info from URL if present
    handleCompanyFromUrl();
    
    fetch("/api/machines")
    .then(res => res.json())
    .then(data => {
      machineData = Array.isArray(data) ? data : data.machines;
      const select = document.getElementById("machineSelect");
      select.innerHTML = '<option value="">-- Select Machine --</option>';
      machineData.forEach(machine => {
        const option = document.createElement("option");
        option.value = machine.id;
        option.text = machine.name;
        select.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error loading machine data:', error);
      alert('Error loading machine data. Please refresh the page to try again.');
    });
    
  const gmMode = document.documentElement && document.documentElement.dataset && document.documentElement.dataset.pricingMode === 'gm';
  const dataRoot = gmMode ? '/static/data/gm' : '/static/data';

  // Load blanket categories
  fetch(`${dataRoot}/blanket_categories.json`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      const categorySelect = document.getElementById("categorySelect");
      categorySelect.innerHTML = `
        <option value="" selected disabled>-- Select Category --</option>
        <option value="All">All Categories</option>
      `;
      blanketCategoriesData = data.categories || {};
      
      // Add each category to the dropdown
      Object.keys(blanketCategoriesData).forEach(category => {
        if (category !== "All") {  // Skip the "All" category as it's already added
          const option = document.createElement("option");
          option.value = category;
          option.text = category;
          categorySelect.appendChild(option);
        }
      });
      
      // When category changes, filter the blankets
      categorySelect.addEventListener("change", () => {
        const selectedCategory = categorySelect.value || 'All';
        const blanketSelect = document.getElementById('blanketSelect');
        resetPicker(blanketSelect, document.getElementById('blanketTypeSection'));
        filterBlanketsByCategory(selectedCategory, blanketCategoriesData);
        const { blanketSection } = getBlanketSections();
        if (blanketSection) blanketSection.style.display = 'block';
        updateMeasurementVisibility();
        renderCategoryOptions();
      });

      initBlanketPickers();
      renderCategoryOptions();

      const initialCategory = categorySelect.value || '';
      if (initialCategory) {
        filterBlanketsByCategory(initialCategory, blanketCategoriesData);
      }
    })
    .catch(error => {
      console.error('Error loading blanket categories:', error);
      alert('Error loading blanket categories. Please refresh the page to try again.');
    });

  // Load blankets data
  fetch(`${dataRoot}/blanket_data.json`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      blanketData = data.products || [];
      // Initial load - show all blankets
      populateBlanketSelect(blanketData);
      updateMeasurementVisibility();
    })
    .catch(error => {
      console.error('Error loading blanket data:', error);
      alert('Error loading blanket data. Please refresh the page to try again.');
    });

  // Load thickness data
  function loadThicknessData() {
    fetch("/thickness_data")
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Handle both array and object response formats
        if (Array.isArray(data)) {
          thicknessData = data;
        } else if (data.thickness && Array.isArray(data.thickness)) {
          thicknessData = data.thickness;
        } else if (data.thicknesses && Array.isArray(data.thicknesses)) {
          thicknessData = data.thicknesses;
        } else {
          throw new Error('Invalid thickness data format');
        }

        const thicknessSelect = document.getElementById("thicknessSelect");
        if (!thicknessSelect) {
          console.error('Thickness select element not found');
          return;
        }

        thicknessSelect.innerHTML = '<option value="">-- Select Thickness --</option>';
        
        thicknessData.forEach(t => {
          const opt = document.createElement("option");
          // Handle both object and primitive values
          if (typeof t === 'object' && t !== null) {
            opt.value = t.value || t.id || JSON.stringify(t);
            opt.text = t.label || t.name || t.value || JSON.stringify(t);
          } else {
            opt.value = t;
            opt.text = t;
          }
          thicknessSelect.appendChild(opt);
        });
        
        // Add change event listener for thickness select
        thicknessSelect.addEventListener("change", () => {
          console.log('Thickness changed, recalculating price...');
          calculatePrice();
        });
      })
      .catch(error => {
        console.error('Error loading thickness data:', error);
        // Fallback to default thickness options if the request fails
        const defaultThicknesses = [
          { value: '0.5', label: '0.5mm' },
          { value: '1.0', label: '1.0mm' },
          { value: '1.5', label: '1.5mm' },
          { value: '2.0', label: '2.0mm' },
          { value: '3.0', label: '3.0mm' }
        ];
        
        const thicknessSelect = document.getElementById("thicknessSelect");
        if (thicknessSelect) {
          thicknessSelect.innerHTML = '<option value="">-- Select Thickness --</option>';
          defaultThicknesses.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.value;
            opt.text = t.label;
            thicknessSelect.appendChild(opt);
          });
        }
      });
  }

  // Initialize thickness data loading
  loadThicknessData();

  // Load bar data
  fetch(`${dataRoot}/bar_data.json`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      barData = data.bars || [];
      const barSelect = document.getElementById("barSelect");
      barSelect.innerHTML = '<option value="">--Select--</option>';
      barData.forEach(bar => {
        const opt = document.createElement("option");
        opt.value = bar.barRate;
        opt.text = bar.bar;
        barSelect.appendChild(opt);
      });

      barSelect.onchange = () => {
        currentBarRate = parseFloat(barSelect.value || 0);
        const barRateElement = document.getElementById("barRate");
        if (barRateElement) {
          barRateElement.innerText = `Barring Price/pc: ₹${currentBarRate.toFixed(2)}`;
        }
        calculatePrice();
      };
    });

  // Load discounts from discount.json
  function loadDiscounts() {
    fetch(`${dataRoot}/discount.json`)
      .then(res => res.json())
      .then(data => {
        const select = document.getElementById("discountSelect");
        select.innerHTML = '<option value="">-- Select Discount --</option>';
        
        // Sort discounts in descending order
        const sortedDiscounts = [...data.discounts].sort((a, b) => parseFloat(b) - parseFloat(a));
        
        sortedDiscounts.forEach(discount => {
          const option = document.createElement("option");
          const discountValue = parseFloat(discount);
          option.value = discountValue;
          option.text = `${discountValue.toFixed(2)}%`;
          select.appendChild(option);
        });
        
        // Add event listener for discount changes
        select.addEventListener('change', () => {
          currentDiscount = parseFloat(select.value) || 0;
          calculatePrice();
        });
      })
      .catch(error => {
        console.error('Error loading discounts:', error);
        // Fallback to default discounts if loading fails
        const defaultDiscounts = ["5.00", "10.00", "15.00", "20.00"];
        const select = document.getElementById("discountSelect");
        select.innerHTML = '<option value="">-- Select Discount --</option>';
        defaultDiscounts.forEach(discount => {
          const option = document.createElement("option");
          const discountValue = parseFloat(discount);
          option.value = discountValue;
          option.text = `${discountValue.toFixed(2)}%`;
          select.appendChild(option);
        });
      });
  }

  // Call loadDiscounts when the page loads
  loadDiscounts();

  fetch("/static/data/thickness.json")
    .then(res => res.json())
    .then(data => {
      thicknessData = data.thicknesses || [];
      const select = document.getElementById("thicknessSelect");
      if (select) {
        select.innerHTML = '<option value="">-- Select Thickness --</option>';
        thicknessData.forEach(th => {
          const opt = document.createElement("option");
          opt.value = th.value;
          opt.textContent = th.label;
          select.appendChild(opt);
        });
        // Add change event to recalculate price when thickness changes
        select.addEventListener('change', calculatePrice);
      }
    })
    .catch(error => {
      console.error('Error loading thickness data:', error);
    });

  // Function to filter blankets by category
  function filterBlanketsByCategory(category, categories) {
    if (!blanketData || !blanketData.length) return;
    
    let filteredBlankets = [];
    
    if (category === "All" || !category) {
      filteredBlankets = [...blanketData];
    } else {
      const sourceCategories = categories || {};
      const categoryBlanketIds = sourceCategories[category] || [];
      filteredBlankets = blanketData.filter(blanket =>
        categoryBlanketIds.includes(blanket.id)
      );
    }
    
    populateBlanketSelect(filteredBlankets);
    if (blanketTypeSection) {
      blanketTypeSection.style.display = filteredBlankets.length ? 'block' : 'none';
    }
    if (blanketSection) {
      blanketSection.style.display = filteredBlankets.length ? 'block' : 'none';
    }
  }
  
  // Function to populate blanket select dropdown
  function populateBlanketSelect(blankets) {
    const blanketSelect = document.getElementById("blanketSelect");
    if (!blanketSelect) {
      console.warn('populateBlanketSelect: blanketSelect not found');
      return;
    }

    blanketSelect.innerHTML = '<option value="">-- Select Blanket --</option>';

    blankets.forEach(blanket => {
      const opt = document.createElement("option");
      opt.value = blanket.id;
      opt.text = blanket.name;
      blanketSelect.appendChild(opt);
    });

    if (blanketSelect.__blanketChangeHandler) {
      blanketSelect.removeEventListener('change', blanketSelect.__blanketChangeHandler);
    }

    blanketSelect.__blanketChangeHandler = () => {
      displayRates();
      calculatePrice();
      updateMeasurementVisibility();
      updatePricingVisibility();
      renderBlanketOptions();
    };

    blanketSelect.addEventListener('change', blanketSelect.__blanketChangeHandler);

    renderBlanketOptions();
    updateMeasurementVisibility();
  }

  // Debug: Log when script loads
  console.log('Blankets script loaded');

  // Add event listeners for automatic updates
  const inputs = [
    { id: "lengthInput", type: "input" },
    { id: "widthInput", type: "input" },
    { id: "unitSelect", type: "change" },
    { id: "thicknessSelect", type: "change" },
    { id: "quantityInput", type: "input" },
    { id: "barSelect", type: "change" },
    { id: "gstSelect", type: "change" },
    { id: "discountSelect", type: "change" }
  ];
  
  inputs.forEach(({id, type}) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(type, (e) => {
        console.log(`${id} ${type} event triggered`);
        calculatePrice();
      });
    } else {
      console.warn(`Element with id '${id}' not found`);
    }
  });

  // Call calculatePrice when the page loads to initialize values
  calculatePrice();
  
  // Initialize discount section
  function updateDiscountSection() {
    const discountSection = document.getElementById('discountSection');
    const discountSelect = getBlanketDiscountSelect();
    
    if (!discountSection || !discountSelect) {
      console.error('Discount section or select element not found');
      return;
    }
  }
  
  // Hook add-to-cart button
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", async function(e) {
      e.preventDefault();
      const button = this;
      const editingItem = checkForEditingItem();
      
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' + 
                        (editingItem ? 'Updating...' : 'Adding...');
      
      try {
        if (editingItem) {
          console.log('Updating item with ID:', editingItem.id);
          // If editing an existing item, update it using the item's ID
          await updateCartItem(button, editingItem.id);
        } else {
          // Otherwise, add a new item
          await addBlanketToCart();
          button.textContent = 'Added to Cart';
          setTimeout(() => {
            button.disabled = false;
            button.textContent = 'Add to Cart';
          }, 2000);
        }
      } catch (error) {
        console.error('Error:', error);
        button.disabled = false;
        button.textContent = editingItem ? 'Update Item' : 'Add to Cart';
      }
    });
  }

  // Initialize discount section
  updateDiscountSection();
  
  // Initial calculation
  calculatePrice();
};

function convertToMeters(value, unit) {
  if (!value) {
    console.log('convertToMeters: No value provided, returning 0');
    return 0;
  }
  
  console.log(`convertToMeters: Converting ${value} ${unit} to meters`);
  
  let result;
  switch(unit) {
    case "mm": 
      result = value / 1000;
      break;
    case "m": 
      result = value;
      break;
    case "in": 
      result = value * 0.0254;
      break;
    default: 
      console.warn(`convertToMeters: Unknown unit '${unit}', returning value as is`);
      result = value;
  }
  
  console.log(`convertToMeters: ${value} ${unit} = ${result} meters`);
  return result;
}

function displayRates() {
  const selected = blanketData.find(p => p.id == document.getElementById("blanketSelect").value);
  const ratePerSqMeterEl = document.getElementById("rateSqMeter");
  const ratePerSqYardEl = document.getElementById("rateSqYard");
  if (selected) {
    const ratePerSqMeter = parseFloat(selected.ratePerSqMt || selected.base_rate || 0);
    if (ratePerSqMeterEl) {
      ratePerSqMeterEl.innerText = `₹${ratePerSqMeter}`;
    }
    // 1 sq.m = 1.19599 sq.yd, derive yard rate on the fly if not provided
    const ratePerSqYard = parseFloat(selected.ratePerSqYard || (ratePerSqMeter ? (ratePerSqMeter / 1.19599).toFixed(2) : 0));
    if (ratePerSqYardEl) {
      ratePerSqYardEl.innerText = `₹${ratePerSqYard}`;
    }
    
  } else {
    if (ratePerSqMeterEl) ratePerSqMeterEl.innerText = '-';
    if (ratePerSqYardEl) ratePerSqYardEl.innerText = '-';
  }
}

function calculatePrice() {
  console.log('calculatePrice called');
  
  // Get input values with fallbacks
  const length = parseFloat(document.getElementById("lengthInput")?.value) || 0;
  const width = parseFloat(document.getElementById("widthInput")?.value) || 0;
  const unit = document.getElementById("unitSelect")?.value || 'mm';
  const thickness = document.getElementById("thicknessSelect")?.value || '';
  const quantity = parseInt(document.getElementById("quantityInput")?.value) || 1;
  const blanketSelect = document.getElementById("blanketSelect");
  const discountSelect = getBlanketDiscountSelect();

  if (discountSelect) {
    applySavaDiscountRestriction(blanketSelect, discountSelect);
  }
  
  
  console.log('Input values:', { length, width, unit, thickness, quantity });
  
  if (!blanketSelect?.value) {
    console.log('No blanket selected');
    return;
  }
  
  // Convert string ID to number for comparison
  const selectedBlanket = blanketData.find(b => b.id.toString() === blanketSelect.value.toString());
  
  if (!selectedBlanket) {
    console.log('Selected blanket not found in data');
    return;
  }
  
  console.log('Selected blanket:', selectedBlanket);
  
  try {
    // Convert dimensions to meters
    const lengthM = convertToMeters(length, unit);
    const widthM = convertToMeters(width, unit);
    const areaSqM = lengthM * widthM;
    const areaSqYard = areaSqM * 1.19599; // 1 sq.m = 1.19599 sq.yd
    
    // Update area display
    const areaElement = document.getElementById("calculatedArea");
    if (areaElement) {
      areaElement.innerText = `Area per unit: ${areaSqM.toFixed(4)} m² (${areaSqYard.toFixed(4)} yd²)`;
    }
    
    // Calculate base price (area × rate per sq.m)
    const ratePerSqMt = parseFloat(selectedBlanket.ratePerSqMt || selectedBlanket.base_rate || 0);
    basePrice = areaSqM * ratePerSqMt;
    
    // Calculate net price per piece (base price + barring per piece)
    const netPricePerPiece = basePrice + currentBarRate;
    
    // Get quantity
    const quantity = parseInt(document.getElementById('quantityInput').value) || 1;
    
    // Calculate base total (net price × quantity)
    const baseTotal = netPricePerPiece * quantity;
    
    // Update UI - Show base price and net price/pc
    document.getElementById('basePrice').textContent = `Base Price: ₹${basePrice.toFixed(2)}`;
    document.getElementById('netUnitPrice').textContent = `Net Price/PC: ₹${netPricePerPiece.toFixed(2)}`;
    
    // Get discount percentage from select
    currentDiscount = discountSelect ? (parseFloat(discountSelect.value) || 0) : 0;
    
    // Calculate discount amount and discounted total (round each step like server)
    const subtotal2 = Number(baseTotal.toFixed(2));
    const discountAmount2 = currentDiscount > 0 ? Number((subtotal2 * currentDiscount / 100).toFixed(2)) : 0;
    const taxable2 = Number((subtotal2 - discountAmount2).toFixed(2));
    const discountValue = document.getElementById('discountedValue');
    
    if (currentDiscount > 0) {
      // Update discount display
      if (discountValue) {
        discountValue.textContent = `Discount (${currentDiscount}%): -₹${discountAmount2.toFixed(2)}`;
        discountValue.style.display = 'block';
      }
    } else {
      // Hide discount display if no discount
      if (discountValue) {
        discountValue.style.display = 'none';
      }
    }
    
    // Apply GST on the taxable amount
    const gstRate = parseFloat(document.getElementById('gstSelect').value) || 0;
    const gstAmount2 = Number((taxable2 * gstRate / 100).toFixed(2));
    const totalPrice2 = Number((taxable2 + gstAmount2).toFixed(2));
    
    // Update price summary
    const finalPriceElement = document.getElementById('finalPrice');
    if (finalPriceElement) {
      const selectedBar = document.getElementById('barSelect').options[document.getElementById('barSelect').selectedIndex]?.text || 'None';
      const pricePerUnit = basePrice + currentBarRate;
      const netPrice = pricePerUnit * quantity;
      
      let summaryHTML = `
        <div class="d-flex justify-content-between mb-2">
          <span>Unit Price:</span>
          <span>₹${basePrice.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between mb-2">
          <span>Barring (${selectedBar}):</span>
          <span>₹${currentBarRate.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between mb-2">
          <span>Price per Unit:</span>
          <span>₹${pricePerUnit.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between mb-2">
          <span>Quantity:</span>
          <span>${quantity}</span>
        </div>
        <div class="d-flex justify-content-between mb-2 fw-bold">
          <span>Net Price:</span>
          <span>₹${subtotal2.toFixed(2)}</span>
        </div>`;
      
      if (currentDiscount > 0) {
        summaryHTML += `
        <div class="d-flex justify-content-between text-danger mb-2">
          <span>Discount (${currentDiscount}%):</span>
          <span>-₹${discountAmount2.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between mb-2 fw-bold">
          <span>Discounted Price:</span>
          <span>₹${taxable2.toFixed(2)}</span>
        </div>`;
      }
      
      summaryHTML += `
        <div class="d-flex justify-content-between mb-2">
          <span>GST (${gstRate}%):</span>
          <span>₹${gstAmount2.toFixed(2)}</span>
        </div>
        <hr>
        <div class="d-flex justify-content-between fw-bold fs-5">
          <span>Sum Total:</span>
          <span>₹${totalPrice2.toFixed(2)}</span>
        </div>`;
      
      finalPriceElement.innerHTML = summaryHTML;
    }
    
  } catch (error) {
    console.error('Error in calculatePrice:', error);
  }
}

function applyDiscount() {
  const discountSelect = document.getElementById("discountSelect");
  const discountVal = discountSelect.value;
  const discountedValueElement = document.getElementById("discountedValue");
  
  if (discountVal) {
    const discount = parseFloat(discountVal.replace('%', '')) || 0;
    currentDiscount = discount;
    const discountAmount = (priceWithBar * discount) / 100;
    finalDiscountedPrice = priceWithBar - discountAmount;
    
    // Show discounted value per unit
    if (discountedValueElement) {
      discountedValueElement.style.display = 'block';
      discountedValueElement.textContent = `Discounted value/unit: ₹${discountAmount.toFixed(2)}`;
    }
  } else {
    currentDiscount = 0;
    finalDiscountedPrice = priceWithBar;
    // Hide discounted value display when no discount is selected
    if (discountedValueElement) {
      discountedValueElement.style.display = 'none';
    }
  }
}

function applyGST() {
  const quantity = parseInt(document.getElementById("quantityInput").value) || 0;
  if (quantity === 0) return;

  const gstRate = parseFloat(document.getElementById("gstSelect").value) || 0;
  const totalBeforeDiscount = priceWithBar * quantity;
  const discountAmount = (totalBeforeDiscount * currentDiscount) / 100;
  const totalAfterDiscount = totalBeforeDiscount - discountAmount;
  const gstAmount = (totalAfterDiscount * gstRate) / 100;
  const finalPrice = totalAfterDiscount + gstAmount;

  const finalPriceElement = document.getElementById("finalPrice");
  if (finalPriceElement) {
    finalPriceElement.innerHTML = `
      <div class="price-breakdown">
        <div class="d-flex justify-content-between">
          <span>Subtotal (${quantity} units):</span>
          <span>₹${totalBeforeDiscount.toFixed(2)}</span>
        </div>
        ${currentDiscount > 0 ? `
        <div class="d-flex justify-content-between text-danger">
          <span>Discount (${currentDiscount}%):</span>
          <span>-₹${discountAmount.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between">
          <span>After Discount:</span>
          <span>₹${totalAfterDiscount.toFixed(2)}</span>
        </div>` : ''}
        <div class="d-flex justify-content-between">
          <span>GST (${gstRate}%):</span>
          <span>+₹${gstAmount.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between fw-bold mt-2 pt-2 border-top">
          <span>Final Amount:</span>
          <span>₹${finalPrice.toFixed(2)}</span>
        </div>
      </div>
    `;
  }
}

// Attach auto-calc listeners for dimension and other inputs
  const lengthInput = document.getElementById('lengthInput');
  const widthInput = document.getElementById('widthInput');
  const quantityInput = document.getElementById('quantityInput');
  const unitSelect = document.getElementById('unitSelect');
  const gstSelect = document.getElementById('gstSelect');
  const thicknessSelect = document.getElementById('thicknessSelect');

  [lengthInput, widthInput].forEach(el => {
    if (el) {
      el.addEventListener('input', () => {
        calculatePrice();
        updatePricingVisibility();
      });
    }
  });
  if (quantityInput) quantityInput.addEventListener('input', calculatePrice);
  if (unitSelect) unitSelect.addEventListener('change', () => {
    calculatePrice();
    updatePricingVisibility();
  });
  if (thicknessSelect) thicknessSelect.addEventListener('change', () => {
    calculatePrice();
    updatePricingVisibility();
  });
  if (gstSelect) gstSelect.addEventListener('change', () => {
    applyGST();
    calculatePrice();
  });

// Initialize discount select when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Add event listener for discount select
  const discountSelect = getBlanketDiscountSelect();
  const blanketSelect = document.getElementById('blanketSelect');

  if (discountSelect) {
    discountSelect.addEventListener('change', function() {
      currentDiscount = parseFloat(this.value) || 0;
      calculatePrice();
    });

    const gmMode = document.documentElement && document.documentElement.dataset && document.documentElement.dataset.pricingMode === 'gm';
    const dataRoot = gmMode ? '/static/data/gm' : '/static/data';
    fetch(`${dataRoot}/discount.json`)
      .then(res => res.json())
      .then(data => {
        const parsedOptions = data && Array.isArray(data.discounts) ? data.discounts : [];
        fullDiscountOptions = parsedOptions
          .map(value => Number(parseFloat(value).toFixed(2)))
          .filter(value => !Number.isNaN(value));

        if (!fullDiscountOptions.length) {
          fullDiscountOptions = generateSavaDiscountOptions();
        }

        if (fullDiscountOptions.every(opt => opt <= 5)) {
          fullDiscountOptions = generateDefaultDiscountOptions();
        }
        populateDiscountSelectOptions(discountSelect, fullDiscountOptions);

        if (blanketSelect) {
          applySavaDiscountRestriction(blanketSelect, getBlanketDiscountSelect());
        }
      })
      .catch(error => {
        console.error('Error loading discounts:', error);
        fullDiscountOptions = generateSavaDiscountOptions();
        populateDiscountSelectOptions(discountSelect, fullDiscountOptions);
      });
  }

  if (blanketSelect && discountSelect) {
    // Ensure correct list whenever blanket changes
    blanketSelect.addEventListener('change', () => {
      applySavaDiscountRestriction(blanketSelect, getBlanketDiscountSelect());
    });
  }
});

async function addBlanketToCart(event) {
  return new Promise(async (resolve, reject) => {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  // Get input elements
  const blanketSelect = document.getElementById('blanketSelect');
  const machineSelect = document.getElementById('machineSelect');
  const thicknessSelect = document.getElementById('thicknessSelect');
  const lengthInput = document.getElementById('lengthInput');
  const widthInput = document.getElementById('widthInput');
  const quantityInput = document.getElementById('quantityInput');
  const barSelect = document.getElementById('barSelect');
  const gstSelect = document.getElementById('gstSelect');
  
  // Check if we're in edit mode
  const urlParams = new URLSearchParams(window.location.search);
  const isEditMode = urlParams.get('edit') === 'true';
  const itemId = urlParams.get('item_id');
  
  // Get input values
  const quantity = parseInt(quantityInput.value) || 1;
  const length = parseFloat(lengthInput.value) || 0;
  const width = parseFloat(widthInput.value) || 0;
  const unit = document.getElementById('unitSelect').value || 'mm';
  const gstPercent = parseFloat(gstSelect.value) || 0;
  
  // Get selected blanket - ensure string comparison for ID matching
  const selectedBlanketId = blanketSelect.value;
  const selectedBlanket = blanketData.find(b => b.id.toString() === selectedBlanketId.toString());
  
  if (!selectedBlanket) {
    showToast('Error', 'Please select a valid blanket', 'error');
    return;
  }
  
  // Get barring information
  const selectedBar = barData.find(b => b.bar === barSelect.options[barSelect.selectedIndex]?.text);
  const barType = selectedBar ? selectedBar.bar : 'None';
  const barPrice = selectedBar ? parseFloat(selectedBar.barRate || selectedBar.price || 0) : 0;
  
  console.log('Bar info:', { selectedBar, barType, barPrice });
  
  // Convert dimensions to meters for calculation
  const lengthM = convertToMeters(length, unit);
  const widthM = convertToMeters(width, unit);
  const areaSqM = lengthM * widthM;
  
  // Calculate base price (area * rate per sq.meter)
  // Prefer ratePerSqMt, fallback to base_rate for backward compatibility
  const ratePerSqMt = parseFloat(selectedBlanket.ratePerSqMt || selectedBlanket.base_rate || 0);
  basePrice = areaSqM * ratePerSqMt;
  
  // Calculate using the same formula as cart/server:
  // subtotal = (base_price + bar_price) * qty
  // discount = subtotal * discount%
  // taxable = subtotal - discount
  // gst = taxable * gst%
  // final_total = taxable + gst
  const unitPricePerPiece = basePrice + barPrice;
  const subtotal = unitPricePerPiece * quantity;
  const discountAmount = currentDiscount > 0 ? (subtotal * currentDiscount / 100) : 0;
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = (taxableAmount * gstPercent) / 100;
  const finalTotalPrice = taxableAmount + gstAmount;
  const finalUnitPrice = quantity > 0 ? (finalTotalPrice / quantity) : 0;

  // Create product object with all calculated values
  const machineName = (machineSelect && machineSelect.value)
    ? (machineSelect.options[machineSelect.selectedIndex]?.text || '--')
    : '--';

  const product = {
    id: isEditMode ? itemId : 'blanket_' + Date.now(),
    type: 'blanket',
    name: selectedBlanket.name || 'Custom Blanket',
    blanket_name: selectedBlanket.name || 'Custom Blanket',
    machine: machineName,
    thickness: thicknessSelect ? thicknessSelect.value : '',
    length: length,
    width: width,
    unit: unit,
    bar_type: barType,
    bar_price: barPrice,
    quantity: quantity,
    gst_percent: gstPercent,
    
    // Price calculations
    base_price: parseFloat(basePrice.toFixed(2)),
    bar_price: barPrice,
    discount_percent: currentDiscount,
    gst_percent: gstPercent,
    
    // Pre-calculated values for display
    calculations: {
      areaSqM: parseFloat(areaSqM.toFixed(4)),
      ratePerSqMt: parseFloat(selectedBlanket.base_rate) || 0,
      basePrice: parseFloat(basePrice.toFixed(2)),
      pricePerUnit: parseFloat(unitPricePerPiece.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_percent: currentDiscount,
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      discounted_subtotal: parseFloat(taxableAmount.toFixed(2)),
      gst_percent: gstPercent,
      gst_amount: parseFloat(gstAmount.toFixed(2)),
      final_price: parseFloat(finalTotalPrice.toFixed(2))
    },
    
    // For backward compatibility
    unit_price: parseFloat(finalUnitPrice.toFixed(2)),
    total_price: parseFloat(finalTotalPrice.toFixed(2)),
    
    // Other
    image: 'images/products/blanket-placeholder.jpg',
    added_at: isEditMode ? new Date().toISOString() : new Date().toISOString()
  };
  
  console.log('Adding to cart with pre-calculated values:', JSON.stringify({
    ...product,
    // Don't log the entire calculations object to keep console clean
    calculations: { ...product.calculations, barPrice: product.calculations.barPrice }
  }, null, 2));

  // Initialize cart as array if it doesn't exist
  let cart = JSON.parse(localStorage.getItem('cart'));
  if (!cart || !Array.isArray(cart)) {
    cart = [];
  }
  
  // Handle edit mode
  if (isEditMode && itemId) {
    try {
      // Use the updateCartItem function for edit mode
      await updateCartItem(event.target, itemId);
      resolve(); // Resolve the promise when update is complete
      return;
    } catch (error) {
      console.error('Error updating cart item:', error);
      showToast('Error', 'Failed to update item. Please try again.', 'error');
      reject(error);
      return;
    }
  }
  
  // Handle new item addition
  cart.push(product);
  localStorage.setItem('cart', JSON.stringify(cart));

  // Prepare payload for server
  try {
    const payload = {
      type: 'blanket',
      name: product.name,
      machine: machineName,
      thickness: product.thickness,
      length: product.length,
      width: product.width,
      unit: product.unit,
      bar_type: product.bar_type,
      bar_price: product.bar_price,
      quantity: product.quantity,
      base_price: product.base_price,
      discount_percent: product.discount_percent,
      gst_percent: product.gst_percent,
      unit_price: product.unit_price,
      total_price: product.total_price,
      calculations: product.calculations
    };

    fetch('/add_to_cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          const message = isEditMode ? 'Blanket updated in cart!' : 'Blanket added to cart!';
          showToast('Success', message, 'success');
          if (typeof updateCartCount === 'function') {
            updateCartCount();
          }
          // If in edit mode, redirect back to cart
          if (isEditMode) {
            setTimeout(() => {
              window.location.href = '/cart';
            }, 1000);
          }
          resolve(data); // Resolve the promise when item is successfully added/updated
        } else if (data.is_duplicate) {
          // Show confirmation dialog for duplicate product
          if (confirm('A product with the same dimensions is already in your cart. Would you like to add it anyway?')) {
            // If user confirms, force add the product by removing the duplicate check
            fetch('/add_to_cart', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({...payload, force_add: true})
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                showToast('Success', 'Blanket added to cart!', 'success');
                if (typeof updateCartCount === 'function') {
                  updateCartCount();
                }
                resolve(data); // Resolve the promise when duplicate is confirmed and added
              } else {
                showToast('Error', data.error || 'Failed to add to cart', 'error');
                reject(data.error || 'Failed to add to cart'); // Reject the promise if there's an error
              }
            })
            .catch(err => {
              console.error('Error adding to cart:', err);
              showToast('Error', 'Failed to add to cart. Please try again.', 'error');
              reject(err);
            });
          } else {
            // User chose not to add duplicate
            reject('Duplicate item not added');
          }
        } else {
          showToast('Error', data.error || 'Failed to add to cart', 'error');
          reject(data.error || 'Failed to add to cart');
        }
      })
      .catch(err => {
        console.error('Error adding to cart:', err);
        showToast('Error', 'Failed to add to cart. Please try again.', 'error');
      });
  } catch (e) {
    console.error('Unexpected error:', e);
    showToast('Error', 'Failed to add to cart. Please try again.', 'error');
    reject(e); // Reject the promise if there's an error
  }
});
}