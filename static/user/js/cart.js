// Get cart container reference at the top
const cartContainer = document.getElementById('cart-container');

let isUpdatingCartTotals = false;
let isRemovingCartItem = false;

// Helper function to round numbers to 2 decimal places
function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

// Function to calculate item prices based on type
function calculateItemPrices(item) {
    // This function is no longer needed as calculations are done server-side
    // We'll keep it for backward compatibility
    if (!item.calculations) {
        if (item.type === 'mpack') {
            const price = parseFloat(item.unit_price) || 0;
            const quantity = parseInt(item.quantity) || 1;
            const discountPercent = parseFloat(item.discount_percent) || 0;
            const gstPercent = parseFloat(item.gst_percent) || 18;
            
            const discountAmount = (price * quantity * discountPercent / 100);
            const priceAfterDiscount = (price * quantity) - discountAmount;
            const gstAmount = (priceAfterDiscount * gstPercent / 100);
            const finalTotal = priceAfterDiscount + gstAmount;
            
            item.calculations = {
                unitPrice: parseFloat(price.toFixed(2)),
                quantity: quantity,
                discountPercent: discountPercent,
                discountAmount: parseFloat(discountAmount.toFixed(2)),
                priceAfterDiscount: parseFloat(priceAfterDiscount.toFixed(2)),
                gstPercent: gstPercent,
                gstAmount: round(gstAmount, 2),
                finalTotal: round(finalTotal, 2)
            };
        } else if (item.type === 'chemical') {
            const price = parseFloat(item.unit_price) || 0;
            const quantity = parseInt(item.quantity) || 1;
            const discountPercent = parseFloat(item.discount_percent) || 0;
            const gstPercent = parseFloat(item.gst_percent) || 18;

            const discountAmount = (price * quantity * discountPercent / 100);
            const priceAfterDiscount = (price * quantity) - discountAmount;
            const gstAmount = (priceAfterDiscount * gstPercent / 100);
            const finalTotal = priceAfterDiscount + gstAmount;

            item.calculations = {
                unit_price: parseFloat(price.toFixed(2)),
                quantity: quantity,
                discount_percent: discountPercent,
                discount_amount: parseFloat(discountAmount.toFixed(2)),
                price_after_discount: parseFloat(priceAfterDiscount.toFixed(2)),
                gst_percent: gstPercent,
                gst_amount: round(gstAmount, 2),
                final_total: round(finalTotal, 2)
            };
        }
    }
    return item.calculations;
}

// Function to add item to cart
function addToCart(item, event) {
    item = calculateItemPrices(item);
    const addToCartBtn = event.target;
    const originalText = addToCartBtn.innerHTML;
    
    addToCartBtn.disabled = true;
    addToCartBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';

    fetch('/add_to_cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(item)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateCartCount();
            showToast('Success', 'Item added to cart', 'success');
        } else {
            showToast('Error', data.message || 'Failed to add item to cart', 'error');
        }
    })
    .catch(error => {
        console.error('Error adding to cart:', error);
        showToast('Error', 'An error occurred while adding to cart', 'error');
    })
    .finally(() => {
        addToCartBtn.disabled = false;
        addToCartBtn.innerHTML = originalText;
    });
}

// Function to get CSRF token from cookies
function getCSRFToken() {
    const name = 'csrf_token=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return '';
}

// Function to get cart from localStorage
function getCart() {
    try {
        const cartData = localStorage.getItem('cart');
        if (!cartData) return { products: [] };
        
        const parsed = JSON.parse(cartData);
        return Array.isArray(parsed) ? { products: parsed } : parsed;
    } catch (error) {
        console.error('Error getting cart from localStorage:', error);
        return { products: [] };
    }
}

// Function to update cart empty state
function updateCartEmptyState() {
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartFooter = document.querySelector('.cart-footer');
    
    if (!cartItems) return;
    
    const hasItems = document.querySelectorAll('.cart-item').length > 0;
    
    if (hasItems) {
        cartItems.style.display = 'flex';
        if (emptyCart) emptyCart.style.display = 'none';
        if (cartFooter) cartFooter.style.display = 'flex';
    } else {
        cartItems.style.display = 'flex';
        if (emptyCart) emptyCart.style.display = 'block';
        if (cartFooter) cartFooter.style.display = 'none';
    }
}

// Function to update cart count in the UI
function updateCartCount() {
    fetch('/get_cart_count')
        .then(response => response.json())
        .then(data => {
            const cartCount = document.getElementById('cart-count');
            if (cartCount) {
                cartCount.textContent = data.count;
                cartCount.style.display = data.count > 0 ? 'inline' : 'none';
            }
        })
        .catch(error => console.error('Error updating cart count:', error));
}

// Function to show toast notifications
function showToast(title, message, type = 'info') {
    // Remove any existing toasts first
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });

    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '1100';
        document.body.appendChild(toastContainer);
    }

    // Create toast with unique ID based on content to prevent duplicates
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast show align-items-center text-white bg-${type} border-0`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.style.marginBottom = '10px';
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong><br>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        const existingToast = document.getElementById(toastId);
        if (existingToast) {
            existingToast.classList.remove('show');
            setTimeout(() => {
                if (existingToast && existingToast.parentNode) {
                    existingToast.parentNode.removeChild(existingToast);
                }
            }, 300);
        }
    }, 5000);
}

// Update company display in the cart
function updateCompanyDisplay(name, email) {
    const companyNameEl = document.getElementById('companyName');
    const companyInfoEl = document.getElementById('companyInfo');

    if (!companyNameEl && !companyInfoEl) {
        return;
    }

    const normalizedName = name && name !== 'undefined' && name !== 'Your Company'
        ? name
        : 'Your Company';

    if (companyNameEl) {
        companyNameEl.textContent = normalizedName;
    }

    if (companyInfoEl) {
        if (email && email !== 'undefined' && email !== 'email@example.com') {
            companyInfoEl.innerHTML = `<a href="mailto:${email}" id="companyEmail" class="text-muted mb-0" style="text-decoration: none;">${email}</a>`;
        } else {
            companyInfoEl.innerHTML = '<p class="text-muted mb-0" id="companyEmail">No email provided</p>';
        }
    }
    updateCartTotals();
}

// Initialize company info from URL parameters and storage
function initCompanyInfo() {
    try {
        // First check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const companyName = urlParams.get('company_name');
        const companyEmail = urlParams.get('company_email');
        const companyId = urlParams.get('company_id');

        if (companyName && companyEmail) {
            // We have company info in URL
            const companyInfo = {
                name: decodeURIComponent(companyName),
                email: decodeURIComponent(companyEmail),
                id: companyId || ''
            };

            // Save to both localStorage and sessionStorage for consistency
            const companyString = JSON.stringify(companyInfo);
            localStorage.setItem('selectedCompany', companyString);
            sessionStorage.setItem('selectedCompany', companyString);

            updateCompanyDisplay(companyInfo.name, companyInfo.email);
            updateNavCompanyDisplay(companyInfo.name);
            return;
        }

        // If no URL params, check localStorage
        const storedCompany = localStorage.getItem('selectedCompany');
        if (storedCompany) {
            const company = JSON.parse(storedCompany);
            updateCompanyDisplay(company.name, company.email);
            updateNavCompanyDisplay(company.name);

            // Ensure it's also in sessionStorage
            sessionStorage.setItem('selectedCompany', storedCompany);
            return;
        }

        // Finally, check sessionStorage
        const sessionCompany = sessionStorage.getItem('selectedCompany');
        if (sessionCompany) {
            const company = JSON.parse(sessionCompany);
            updateCompanyDisplay(company.name, company.email);
            updateNavCompanyDisplay(company.name);

            // Save to localStorage for persistence
            localStorage.setItem('selectedCompany', sessionCompany);
        }
    } catch (e) {
        console.error('Error initializing company info:', e);
    }
}

// Update company display in the navigation
function updateNavCompanyDisplay(companyName) {
    const companyDisplay = document.getElementById('companyNameDisplay');
    if (companyDisplay && companyName) {
        companyDisplay.textContent = companyName;
    }
}

// Function to normalize cart data structure
function normalizeCartData(cartData) {
    console.log('Normalizing cart data...');
    
    if (!cartData) {
        console.log('No cart data, returning empty cart');
        return { products: [] };
    }
    
    try {
        // If cartData is already an object with products array, return as is
        if (cartData.products && Array.isArray(cartData.products)) {
            console.log('Cart data already has products array');
            return cartData;
        }
        
        // If cartData is an array, convert to object with products array
        if (Array.isArray(cartData)) {
            console.log('Converting array cart to object with products array');
            return { products: cartData };
        }
        
        // If cartData is an object but doesn't have products array, create one
        if (typeof cartData === 'object' && cartData !== null) {
            console.log('Converting object cart to standard format');
            return { 
                products: Object.values(cartData).filter(item => item !== null && typeof item === 'object')
            };
        }
        
        // If we get here, the format is unexpected
        console.warn('Unexpected cart format, initializing empty cart');
        return { products: [] };
        
    } catch (error) {
        console.error('Error normalizing cart data:', error);
        return { products: [] };
    }
}

// Initialize all cart handlers
function initializeCart() {
    console.log('Initializing cart...');
    
    // Load and normalize cart data
    try {
        const cartData = localStorage.getItem('cart');
        const parsedCart = cartData ? JSON.parse(cartData) : { products: [] };
        const normalizedCart = normalizeCartData(parsedCart);
        
        // Save normalized cart back to localStorage
        if (JSON.stringify(parsedCart) !== JSON.stringify(normalizedCart)) {
            console.log('Saving normalized cart data');
            localStorage.setItem('cart', JSON.stringify(normalizedCart));
        }
    } catch (error) {
        console.error('Error initializing cart data:', error);
        localStorage.setItem('cart', JSON.stringify({ products: [] }));
    }
    
    // Store original quantities when page loads
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.setAttribute('data-original-quantity', input.value);
    });
    
    // Set up quantity change handlers
    console.log('Setting up quantity handlers...');
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', handleQuantityInputChange);
        input.addEventListener('keydown', handleQuantityKeyDown);
    });
    
    // Set up discount update handlers
    document.querySelectorAll('.update-discount-btn').forEach(button => {
        button.addEventListener('click', handleDiscountUpdate);
    });
    
    // Set up discount input handlers
    document.querySelectorAll('.discount-input').forEach(input => {
        input.addEventListener('keydown', handleDiscountKeyDown);
    });
    
    console.log('Setting up remove handlers...');
    setupRemoveHandlers();
    
    // Set up change item buttons
    console.log('Setting up change item handlers...');
    document.querySelectorAll('.change-item-btn').forEach(button => {
        button.addEventListener('click', handleChangeItem);
    });
    
    // Initialize calculations
    console.log('Initializing cart calculations...');
    initializeCartCalculations();
    
    // Update UI
    console.log('Updating cart UI...');
    updateCartCount();
    updateCartTotals();
    
    // Check if we need to show the empty cart message
    const cartItems = document.querySelectorAll('.cart-item');
    const emptyCartDiv = document.getElementById('emptyCart');
    const cartItemsDiv = document.getElementById('cartItems');
    
    console.log(`Found ${cartItems.length} cart items`);
    
    if (cartItems.length === 0) {
        console.log('No cart items, showing empty cart message');
        if (emptyCartDiv) emptyCartDiv.style.display = 'block';
        if (cartItemsDiv) cartItemsDiv.style.display = 'flex';
    } else {
        console.log('Cart has items, showing cart contents');
        if (emptyCartDiv) emptyCartDiv.style.display = 'none';
        if (cartItemsDiv) cartItemsDiv.style.display = 'block';
    }
}

// Make createProductTypeModal available globally
window.createProductTypeModal = function() {
    const modalHTML = `
        <div class="modal fade" id="productTypeModal" tabindex="-1" aria-labelledby="productTypeModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="productTypeModalLabel">Select Product Type</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="row g-3">
                            <div class="col-6">
                                <button type="button" class="btn btn-outline-primary w-100 py-4" id="selectBlankets">
                                    <i class="fas fa-blanket fa-2x mb-2 d-block"></i>
                                    Blankets
                                </button>
                            </div>
                            <div class="col-6">
                                <button type="button" class="btn btn-outline-success w-100 py-4" id="selectMpacks">
                                    <i class="fas fa-box fa-2x mb-2 d-block"></i>
                                    MPacks
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    
    // Add modal to the body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Initialize the modal
    const modal = new bootstrap.Modal(document.getElementById('productTypeModal'));
    
    // Get company ID once
    const companyId = sessionStorage.getItem('companyId') || 
                     new URLSearchParams(window.location.search).get('company_id');
    
    // Add event listeners to the buttons
    document.getElementById('selectBlankets').addEventListener('click', function() {
        if (companyId) {
            window.location.href = `/blankets?company_id=${companyId}`;
        } else {
            window.location.href = '/blankets';
        }
    });
    
    document.getElementById('selectMpacks').addEventListener('click', function() {
        if (companyId) {
            window.location.href = `/mpacks?company_id=${companyId}`;
        } else {
            window.location.href = '/mpacks';
        }
    });
    
    return modal;
}

// Function to handle continue shopping
function handleContinueShopping(event) {
    try {
        // Prevent default action (navigation)
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        // Check if modal already exists
        let modalElement = document.getElementById('productTypeModal');
        let modal;
        
        if (!modalElement) {
            // Create the modal if it doesn't exist
            modal = createProductTypeModal();
        } else {
            // Initialize modal if it exists but isn't initialized
            modal = bootstrap.Modal.getInstance(modalElement);
            if (!modal) {
                modal = new bootstrap.Modal(modalElement);
            }
        }
        
        // Show the modal
        if (modal) {
            modal.show();
            
            // Update button handlers with latest company info
            const companyId = sessionStorage.getItem('companyId') || 
                            new URLSearchParams(window.location.search).get('company_id');
            
            const selectBlanketsBtn = document.getElementById('selectBlankets');
            const selectMpacksBtn = document.getElementById('selectMpacks');
            
            if (selectBlanketsBtn) {
                selectBlanketsBtn.onclick = function() {
                    window.location.href = companyId ? 
                        `/blankets?company_id=${companyId}` : 
                        '/blankets';
                };
            }
            
            if (selectMpacksBtn) {
                selectMpacksBtn.onclick = function() {
                    window.location.href = companyId ? 
                        `/mpacks?company_id=${companyId}` : 
                        '/mpacks';
                };
            }
        } else {
            console.error('Failed to initialize product type modal');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error in continue shopping:', error);
        window.location.href = '/';
    }
}

// Helper to remove or merge duplicate MPack items in the cart
function checkForDuplicateMpacks() {
    if (isRemovingCartItem) {
        return;
    }
    try {
        const mpackItems = document.querySelectorAll('.cart-item[data-type="mpack"]');
        const seen = new Map();

        mpackItems.forEach(item => {
            // Create a more specific key that includes both ID and name to prevent incorrect merging
            const itemId = item.dataset.id || '';
            const itemName = item.dataset.name || item.querySelector('.item-name')?.textContent?.trim() || '';
            const key = `${itemId}-${itemName}`; // Combine ID and name for uniqueness
            
            if (!key) return; // Skip if no identifiable key

            if (seen.has(key)) {
                // Duplicate found â€“ only merge if it's truly the same product with same attributes
                const existing = seen.get(key);
                const existingAttrs = existing.dataset;
                const newAttrs = item.dataset;
                
                // Check if all data attributes match before considering them duplicates
                let isExactMatch = true;
                for (const attr in existingAttrs) {
                    if (existingAttrs[attr] !== newAttrs[attr]) {
                        isExactMatch = false;
                        break;
                    }
                }
                
                if (isExactMatch) {
                    const qtyInputExisting = existing.querySelector('.quantity-input');
                    const qtyInputDuplicate = item.querySelector('.quantity-input');

                    if (qtyInputExisting && qtyInputDuplicate) {
                        const totalQty = (parseInt(qtyInputExisting.value) || 1) + (parseInt(qtyInputDuplicate.value) || 1);
                        qtyInputExisting.value = totalQty;
                        existing.setAttribute('data-quantity', totalQty);
                    }

                    // Remove the duplicate row from DOM
                    item.remove();
                }
            } else {
                seen.set(key, item);
            }
        });

        // After checking for duplicates, recalculate totals
        updateCartTotals();
    } catch (err) {
        console.error('Error checking for duplicate MPacks:', err);
    }
}

// Helper to detect duplicate Blanket items in the cart (non-destructive)
function checkForDuplicateBlankets() {
    if (isRemovingCartItem) {
        return;
    }
    try {
        const blanketItems = document.querySelectorAll('.cart-item[data-type="blanket"]');
        console.log('checkForDuplicateBlankets: Found Blanket items:', blanketItems.length);
        console.log('checkForDuplicateBlankets: Blanket items:', Array.from(blanketItems).map(item => ({
            id: item.getAttribute('data-id'),
            name: item.getAttribute('data-name'),
            type: item.getAttribute('data-type')
        })));
        if (!blanketItems.length) return;

        const seen = new Map();

        blanketItems.forEach(item => {
            const keyParts = [
                item.getAttribute('data-name') || '',
                item.getAttribute('data-machine') || '',
                item.getAttribute('data-size') || '',
                item.getAttribute('data-thickness') || '',
                item.getAttribute('data-length') || '',
                item.getAttribute('data-width') || ''
            ];

            const key = keyParts.join('|');
            if (seen.has(key)) {
                console.warn('Duplicate blanket detected', { key, item });
            } else {
                seen.set(key, item);
            }
        });
    } catch (error) {
        console.error('Error checking duplicate blankets:', error);
    }
}

// Expose for legacy inline handlers expecting global functions
if (typeof window !== 'undefined') {
    window.checkForDuplicateBlankets = checkForDuplicateBlankets;
}

// Helper to remove or merge duplicate Chemical items in the cart
function checkForDuplicateChemicals() {
    if (isRemovingCartItem) {
        return;
    }
    try {
        const chemicalItems = document.querySelectorAll('.cart-item[data-type="chemical"], .cart-item[data-type="maintenance"]');
        const seen = new Map();

        chemicalItems.forEach(item => {
            // Create a unique key based on all relevant attributes
            const itemId = item.dataset.id || '';
            const lineItemIndex = item.dataset.index || '';
            const itemName = item.dataset.name || item.querySelector('.item-name')?.textContent?.trim() || '';
            const category = item.dataset.category || '';
            const formatLabel = item.dataset.formatLabel || '';
            const packSize = item.dataset.packSizeLitre || '';
            const machine = item.dataset.machine || '';
            const pricePerLitre = item.dataset.pricePerLitre || item.dataset.unitPrice || '';
            const quantityLitre = item.dataset.quantityLitre || item.dataset.quantity || '';

            // Include index and quantity in composite key so unique rows stay separate
            const key = `${lineItemIndex}-${itemId}-${itemName}-${category}-${formatLabel}-${packSize}-${machine}-${pricePerLitre}-${quantityLitre}`.toLowerCase();

            if (!key) return; // Skip if no identifiable key

            if (seen.has(key)) {
                // Duplicate found – only remove if it's a true clone (likely leftover from re-render)
                console.log('Removing duplicate chemical item with key:', key, item);
                item.remove();
            } else {
                seen.set(key, item);
            }
        });

        // After checking for duplicates, recalculate totals
        updateCartTotals();
    } catch (err) {
        console.error('Error checking for duplicate Chemicals:', err);
    }
}

// Function to toggle quotation section
function toggleQuotationSection() {
    const cartItems = document.querySelectorAll('.cart-item');
    const quotationSection = document.getElementById('quotationSection');
    if (quotationSection) {
        quotationSection.style.display = cartItems.length > 0 ? 'block' : 'none';
    }
}

async function sendQuotationFromCart(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    const sendBtn = document.getElementById('sendQuotationBtn');
    if (!sendBtn || sendBtn.classList.contains('disabled') || sendBtn.getAttribute('aria-disabled') === 'true') {
        return;
    }

    // Cart page should only navigate to quotation preview.
    window.location.href = '/quotation_preview';
}

// Function to handle clearing the cart
function handleClearCart(event) {
    // Update empty state after clearing cart
    updateCartEmptyState();
    if (event) event.preventDefault();
    
    if (!confirm('Are you sure you want to clear your cart? This action cannot be undone.')) {
        return false;
    }
    
    const csrfToken = getCSRFToken();
    const clearButton = event.target.closest('button');
    const originalHtml = clearButton ? clearButton.innerHTML : '';
    
    // Show loading state
    if (clearButton) {
        clearButton.disabled = true;
        clearButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Clearing...';
    }
    
    fetch('/clear_cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw err; });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Remove all cart items from the DOM
            const cartItemsContainer = document.getElementById('cartItems');
            if (cartItemsContainer) {
                // Remove all child elements except the first one (which contains the empty cart message)
                while (cartItemsContainer.firstChild) {
                    cartItemsContainer.removeChild(cartItemsContainer.firstChild);
                }
                
                // Show empty cart message
                const emptyCart = document.getElementById('emptyCart');
                if (emptyCart) {
                    emptyCart.style.display = 'block';
                }
                
                // Hide the cart items container
                cartItemsContainer.style.display = 'flex';
            }
            
            // Update cart count
            updateCartCount();
            
            // Reset cart totals
            const cartTotals = document.querySelectorAll('.cart-summary, .cart-total, .checkout-section');
            cartTotals.forEach(el => el.style.display = 'none');
            
            // Show success message
            showToast('Success', 'Your cart has been cleared', 'success');
            
            // Trigger an event that other components might be listening for
            document.dispatchEvent(new Event('cartCleared'));
        } else {
            throw new Error(data.error || 'Failed to clear cart');
        }
    })
    .catch(error => {
        console.error('Error clearing cart:', error);
        showToast('Error', error.message || 'An error occurred while clearing the cart', 'error');
    })
    .finally(() => {
        // Restore button state
        if (clearButton) {
            clearButton.disabled = false;
            clearButton.innerHTML = originalHtml;
        }
    });
    
    return false;
}

// Function to sync cart from server to localStorage
function syncCartFromServer() {
    try {
        // Get the cart data from the server-rendered template (matches template id "serverCartData")
        const serverCartData = document.getElementById('serverCartData') || document.getElementById('cartData');
        if (serverCartData && serverCartData.textContent) {
            const rawCart = JSON.parse(serverCartData.textContent);
            const normalized = Array.isArray(rawCart)
                ? { products: rawCart }
                : (rawCart && Array.isArray(rawCart.products) ? rawCart : null);

            if (normalized) {
                localStorage.setItem('cart', JSON.stringify(normalized));
                console.log('Synced cart from server to localStorage');
                return true;
            }
        }
    } catch (error) {
        console.error('Error syncing cart from server:', error);
    }
    return false;
}

// Initialize cart when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, initializing cart...');
    
    // Initialize company info first
    initCompanyInfo();
    
    try {
        // Get server-rendered cart data if available
        const serverCartData = document.getElementById('serverCartData');
        if (serverCartData) {
            try {
                const serverCart = JSON.parse(serverCartData.textContent);
                if (Array.isArray(serverCart) && serverCart.length > 0) {
                    console.log('Found server-rendered cart with', serverCart.length, 'items');
                    // Update localStorage with server cart data
                    const currentCart = getCart();
                    currentCart.products = serverCart;
                    localStorage.setItem('cart', JSON.stringify(currentCart));
                }
            } catch (e) {
                console.error('Error parsing server cart data:', e);
            }
        }
        
        // Sync cart from server to localStorage
        syncCartFromServer();
        
        // Initial empty state check
        updateCartEmptyState();
        
        // Initialize cart
        initializeCart();
        
        // Set up continue shopping buttons
        const continueShoppingBtn = document.getElementById('continueShoppingBtn');
        const continueShoppingBtnBottom = document.getElementById('continueShoppingBtnBottom');
        
        if (continueShoppingBtn) {
            continueShoppingBtn.addEventListener('click', handleContinueShopping);
        }
        
        if (continueShoppingBtnBottom) {
            continueShoppingBtnBottom.addEventListener('click', handleContinueShopping);
        }
        
        // Re-initialize company info after cart is loaded to ensure it's displayed
        setTimeout(initCompanyInfo, 500);
        
        // Initialize cart calculations
        initializeCartCalculations();
        
        // Update cart totals
        console.log('Updating cart totals...');
        updateCartTotals();
        
        // Check for duplicate items
        console.log('Checking for duplicate MPacks...');
        checkForDuplicateMpacks();
        
        console.log('Checking for duplicate Blankets...');
        checkForDuplicateBlankets();

        console.log('Checking for duplicate Chemicals...');
        checkForDuplicateChemicals();
        
        // Toggle quotation section based on cart items
        toggleQuotationSection();
        
        // Ensure Send Quotation works even when the button is an <a href="...">.
        const sendQuotationBtn = document.getElementById('sendQuotationBtn');
        if (sendQuotationBtn) {
            sendQuotationBtn.addEventListener('click', sendQuotationFromCart);
        }
        
        // Listen for cart updates from other tabs
        window.addEventListener('storage', function(event) {
            if (event.key === 'cart') {
                try {
                    window.location.reload();
                } catch (e) {
                    console.error('Error handling cart update:', e);
                }
            }
        });
        
        // Add a small delay to ensure all elements are properly initialized
        setTimeout(() => {
            console.log('Cart initialization complete');
            // Force a recalculation of totals after a short delay
            updateCartTotals();
        }, 100);
        
        // Set up clear cart button
        const clearCartBtn = document.getElementById('clearCartBtn');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', handleClearCart);
        }
    } catch (error) {
        console.error('Error initializing cart:', error);
    }
    
    // Set up event delegation for quantity buttons and discount updates
    document.addEventListener('click', function(event) {
        // Handle decrease quantity button click
        if (event.target.closest('.quantity-decrease') || event.target.classList.contains('quantity-decrease')) {
            event.preventDefault();
            event.stopPropagation();

            const button = event.target.closest('.quantity-decrease');
            const inputGroup = button.closest('.input-group');
            const input = inputGroup ? inputGroup.querySelector('.quantity-input') : null;
            
            if (input) {
                const container = input.closest('.cart-item');
                const type = container?.getAttribute('data-type');
                let value = parseFloat(input.value) || 1;
                if (type === 'chemical' || type === 'maintenance') {
                    value = Math.max(0.1, value - 1);
                    input.value = value.toFixed(2).replace(/\.00$/, '');
                    scheduleQuantityUpdate(input);
                } else if (value > 1) {
                    input.value = Math.max(1, Math.round(value - 1));
                    scheduleQuantityUpdate(input);
                }
            }
        }

        // Handle increase quantity button click
        else if (event.target.closest('.quantity-increase') || event.target.classList.contains('quantity-increase')) {
            event.preventDefault();
            event.stopPropagation();

            const button = event.target.closest('.quantity-increase');
            const input = button.closest('.input-group')?.querySelector('.quantity-input');
            
            if (input) {
                const container = input.closest('.cart-item');
                const type = container?.getAttribute('data-type');
                let value = parseFloat(input.value) || 1;
                if (type === 'chemical' || type === 'maintenance') {
                    value = Math.max(0.1, value + 1);
                    input.value = value.toFixed(2).replace(/\.00$/, '');
                } else {
                    input.value = Math.max(1, Math.round(value + 1));
                }
                scheduleQuantityUpdate(input);
            }
        }
        
        // Handle update discount button click
        else if (event.target.closest('.update-discount-btn')) {
            handleDiscountUpdate(event);
        }
        
        // Handle change item button click
        else if (event.target.closest('.change-item-btn')) {
            handleChangeItem(event);
        }
    });
    
    // Handle quantity input on Enter key and blur
    document.addEventListener('keydown', function(event) {
        // Handle discount input Enter key
        if (event.target.classList.contains('discount-input') && event.key === 'Enter') {
            handleDiscountKeyDown(event);
        }
        // Handle quantity input Enter key
        else if (event.target.classList.contains('quantity-input') && event.key === 'Enter') {
            event.preventDefault();
            updateQuantity(event.target);
        }
    });
    
    // Handle quantity input blur (when user clicks away)
    document.addEventListener('focusout', function(event) {
        if (event.target.classList.contains('quantity-input')) {
            updateQuantity(event.target);
        }
    });
    
    // Track pending quantity updates
    const pendingUpdates = new Map();
    
    // Function to update quantity with loading state
    function updateQuantity(input) {
        const cartItem = input.closest('.cart-item');
        const index = input.getAttribute('data-index');
        const inputGroup = input.closest('.input-group');
        const buttons = cartItem?.querySelectorAll('.quantity-decrease, .quantity-increase');
        
        if (!cartItem || !index) return;
        
        // Add loading state
        input.disabled = true;
        buttons.forEach(btn => btn.disabled = true);
        if (inputGroup) inputGroup.classList.add('loading');
        
        // Get and validate the quantity
        const type = cartItem.getAttribute('data-type');
        let newQuantity = parseFloat(input.value);
        const isDecimalQuantity = type === 'chemical' || type === 'maintenance' || type === 'creasing_matrix';

        if (isNaN(newQuantity) || newQuantity <= 0) {
            newQuantity = isDecimalQuantity ? 0.1 : 1;
            input.value = isDecimalQuantity
                ? newQuantity.toFixed(2).replace(/\.00$/, '')
                : Math.round(newQuantity);
        } else if (!isDecimalQuantity) {
            newQuantity = Math.max(1, Math.round(newQuantity));
            input.value = newQuantity;
        } else {
            newQuantity = Math.max(0.1, newQuantity);
            input.value = newQuantity.toFixed(2).replace(/\.00$/, '');
        }

        // Update the cart item quantity
        updateCartItemQuantity(index, newQuantity);
    }
    
    // Function to schedule a quantity update with debouncing
    function scheduleQuantityUpdate(input) {
        const index = input.getAttribute('data-index');
        const cartItem = input.closest('.cart-item');
        
        if (!index || !cartItem) return;
        
        // Clear any pending update for this input
        if (pendingUpdates.has(index)) {
            clearTimeout(pendingUpdates.get(index));
        }
        
        // Schedule a new update after a delay
        pendingUpdates.set(index, setTimeout(() => {
            updateQuantity(input);
            pendingUpdates.delete(index);
        }, 500)); // 500ms delay
    }
    

    
    // Handle discount input changes for immediate calculation updates
    document.addEventListener('input', function(event) {
        if (event.target.classList.contains('discount-input')) {
            const cartItem = event.target.closest('.cart-item');
            if (cartItem) {
                const itemType = cartItem.getAttribute('data-type');
                // Apply cap immediately and update discount percent in data attribute for calculations
                const rawDiscountValue = parseFloat(event.target.value);
                const discountValue = clampDiscountWithCap(Number.isFinite(rawDiscountValue) ? rawDiscountValue : 0);
                if (String(discountValue) !== String(event.target.value || '')) {
                    event.target.value = discountValue;
                }
                cartItem.setAttribute('data-discount-percent', discountValue);
                
                if (itemType === 'mpack') {
                    calculateMPackPrices(cartItem);
                } else if (itemType === 'blanket') {
                    calculateBlanketPrices(cartItem);
                } else if (itemType === 'chemical' || itemType === 'maintenance') {
                    calculateChemicalPrices(cartItem);
                } else if (itemType === 'creasing_matrix') {
                    // Keep summary in sync for creasing matrix discounts as well
                    updateCartTotals();
                }
            }
        }
    });
    
    // Set up remove handlers
    setupRemoveHandlers();
    
    // Initialize cart calculations
    initializeCartCalculations();
    
    // Check for duplicate MPacks
    checkForDuplicateMpacks();
    
    // Set up checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/checkout';
        });
    }
    
    // Set up footer continue shopping button
    const continueShoppingFooter = document.getElementById('continueShoppingBtnBottom');
    if (continueShoppingFooter) {
        continueShoppingFooter.addEventListener('click', function(e) {
            e.preventDefault();
            handleContinueShopping();
        });
    }
    
    // Set up footer clear cart button
    const clearCartFooter = document.getElementById('clearCartBtnFooter');
    if (clearCartFooter) {
        clearCartFooter.addEventListener('click', handleClearCart);
    }
    
    // Set up change company button
    const changeCompanyBtn = document.getElementById('changeCompanyBtn');
    if (changeCompanyBtn) {
        changeCompanyBtn.addEventListener('click', function() {
            window.location.href = '/select-company';
        });
    }
    
    // Set up mutation observer for cart changes
    if (cartContainer) {
        // Show the cart initially
        cartContainer.style.visibility = 'visible';
        
        const observer = new MutationObserver(function() {
            checkForDuplicateMpacks();
            checkForDuplicateBlankets();
            checkForDuplicateChemicals();
            updateCartTotals(); // Ensure totals are updated on any cart changes
        });
        
        observer.observe(cartContainer, { 
            childList: true, 
            subtree: true,
            attributes: true,
            characterData: true
        });
        
        // Show cart after a short delay if mutation observer doesn't trigger
        setTimeout(() => {
            if (cartContainer.style.visibility !== 'visible') {
                cartContainer.style.visibility = 'visible';
            }
        }, 500);
    }
    
    // Initialize the cart
    initializeCart();
    
    // Check for duplicate items on initial load
    checkForDuplicateMpacks();
    checkForDuplicateBlankets();
    checkForDuplicateChemicals();
    
    console.log('Cart initialization complete');
});

// Initialize cart calculations
function initializeCartCalculations() {
    const cartItems = document.querySelectorAll('.cart-item');
    cartItems.forEach(item => {
        // Only calculate prices, no quantity handlers
        if (item.dataset.type === 'mpack') {
            calculateMPackPrices(item);
        } else if (item.dataset.type === 'blanket') {
            calculateBlanketPrices(item);
        } else if (item.dataset.type === 'chemical' || item.dataset.type === 'maintenance') {
            calculateChemicalPrices(item);
        }
    });
}

// Function to calculate MPack prices
function calculateMPackPrices(item) {
    const unitPrice = parseFloat(item.getAttribute('data-unit-price') || 0);
    const quantity = parseInt(item.querySelector('.quantity-input')?.value || 1);
    const discountPercent = parseFloat(item.getAttribute('data-discount-percent') || 0);
    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || 12);
    
    // Calculate prices
    const subtotal = unitPrice * quantity;
    const discountAmount = subtotal * (discountPercent / 100);
    const discountedSubtotal = subtotal - discountAmount;
    const gstAmount = (discountedSubtotal * gstPercent) / 100;
    const total = discountedSubtotal + gstAmount;
    
    // Update the displayed subtotal in the item row
    const subtotalElement = item.querySelector('.subtotal-value, .item-subtotal');
    if (subtotalElement) {
        subtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
    }
    
    // Update Pre-GST total value element only (span), not the entire row
    const preGstElement = item.querySelector('.pre-gst-total .pre-gst-amount, .total-before-gst');
    if (preGstElement) {
        preGstElement.textContent = `₹${discountedSubtotal.toFixed(2)}`;
    }
    
    return {
        subtotal: round(subtotal, 2),
        discountAmount: round(discountAmount, 2),
        discountedSubtotal: round(discountedSubtotal, 2),
        gstAmount: round(gstAmount, 2),
        total: round(total, 2)
    };
}

// Function to calculate blanket prices
function calculateBlanketPrices(item) {
    const basePrice = parseFloat(item.getAttribute('data-base-price') || 0);
    const barPrice = parseFloat(item.getAttribute('data-bar-price') || 0);
    const quantity = parseInt(item.querySelector('.quantity-input')?.value || item.getAttribute('data-quantity') || item.dataset.quantity || 1);
    const discountPercent = parseFloat(item.querySelector('.discount-input')?.value || item.getAttribute('data-discount-percent') || item.dataset.discountPercent || 0);
    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || item.dataset.gstPercent || 18);

    const netPricePerPiece = basePrice + barPrice;
    const subtotal = netPricePerPiece * quantity;
    const discountAmount = subtotal * (discountPercent / 100);
    const discountedSubtotal = subtotal - discountAmount;
    const gstAmount = (discountedSubtotal * gstPercent) / 100;
    const total = discountedSubtotal + gstAmount;

    updateItemDisplay(item, {
        type: 'blanket',
        base_price: basePrice,
        bar_price: barPrice,
        quantity,
        discount_percent: discountPercent,
        gst_percent: gstPercent,
        subtotal,
        discount_amount: discountAmount,
        gst_amount: gstAmount,
        final_total: total
    });

    return {
        subtotal: round(subtotal, 2),
        discountAmount: round(discountAmount, 2),
        discountedSubtotal: round(discountedSubtotal, 2),
        gstAmount: round(gstAmount, 2),
        total: round(total, 2)
    };
}

// Function to calculate chemical prices
function calculateChemicalPrices(item) {
    const litres = parseFloat(item.getAttribute('data-quantity-litre') || item.dataset.quantityLitre || item.dataset.quantity || 0);
    const pricePerLitre = parseFloat(item.getAttribute('data-price-per-litre') || item.dataset.pricePerLitre || item.dataset.unitPrice || 0);
    const discountPercent = parseFloat(item.querySelector('.discount-input')?.value || item.getAttribute('data-discount-percent') || item.dataset.discountPercent || 0);
    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || item.dataset.gstPercent || 18);

    const effectiveQuantity = litres > 0 ? litres : 0;
    const subtotal = pricePerLitre * effectiveQuantity;
    const discountAmount = subtotal * (discountPercent / 100);
    const discountedSubtotal = subtotal - discountAmount;
    const gstAmount = (discountedSubtotal * gstPercent) / 100;
    const total = discountedSubtotal + gstAmount;

    const type = item.getAttribute('data-type') || 'chemical';
    updateItemDisplay(item, {
        type,
        unit_price: pricePerLitre,
        quantity: effectiveQuantity,
        quantity_litre: effectiveQuantity,
        discount_percent: discountPercent,
        gst_percent: gstPercent,
        subtotal,
        discount_amount: discountAmount,
        gst_amount: gstAmount,
        final_total: total
    });

    const subtotalElement = item.querySelector('.subtotal-value, .item-subtotal');
    if (subtotalElement) {
        subtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
    }

    const preGstElement = item.querySelector('.pre-gst-total .pre-gst-amount, .total-before-gst');
    if (preGstElement) {
        preGstElement.textContent = `₹${discountedSubtotal.toFixed(2)}`;
    }

    return {
        subtotal: round(subtotal, 2),
        discountAmount: round(discountAmount, 2),
        discountedSubtotal: round(discountedSubtotal, 2),
        gstAmount: round(gstAmount, 2),
        total: round(total, 2)
    };
}

// Helper function to convert to meters (matching the one in blankets.js)
function convertToMeters(value, unit) {
    if (unit === 'mm') return value / 1000;
    if (unit === 'cm') return value / 100;
    if (unit === 'm') return value;
    if (unit === 'inch') return value * 0.0254;
    if (unit === 'feet') return value * 0.3048;
    if (unit === 'yard') return value * 0.9144;
    return value; // Default to meters if unit not recognized
}

function updateCartTotals() {
    if (isUpdatingCartTotals) return;

    const cartContainer = document.getElementById('cart-container') || document.querySelector('.cart-container');
    let cartSummary = document.getElementById('cartSummary');

    if (!cartContainer && !cartSummary) {
        return;
    }

    isUpdatingCartTotals = true;

    try {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalGst = 0;
        let total = 0;
        let totalItems = 0;

        const cartItems = document.querySelectorAll('.cart-item');
        const emptyCart = document.getElementById('emptyCart');
        const cartItemsContainer = document.getElementById('cartItems');
        cartSummary = cartSummary || document.getElementById('cartSummary');
        const cartFooter = cartContainer ? cartContainer.querySelector('.cart-footer') : document.querySelector('.cart-footer');
        const sendQuotationBtn = document.getElementById('sendQuotationBtn');
        const clearCartBtn = document.getElementById('clearCartBtn');
        const clearCartBtnFooter = document.getElementById('clearCartBtnFooter');

        // Ensure the cart summary container exists
        if (!cartSummary) {
            cartSummary = document.createElement('div');
            cartSummary.id = 'cartSummary';
            cartSummary.className = 'cart-summary mt-4';

            if (cartContainer) {
                if (cartFooter) {
                    cartContainer.insertBefore(cartSummary, cartFooter);
                } else {
                    cartContainer.appendChild(cartSummary);
                }
            }
        }

        if (cartFooter) {
            cartFooter.style.display = 'flex';
        }

        // Handle empty cart state
        if (cartItems.length === 0) {
            if (emptyCart) emptyCart.style.display = 'block';
            if (cartItemsContainer) cartItemsContainer.style.display = 'none';

            cartSummary.style.display = 'block';
            cartSummary.style.visibility = 'visible';
            cartSummary.style.opacity = '1';
            cartSummary.innerHTML = `
                <div class="card">
                    <div class="card-body text-center py-4">
                        <h5 class="card-title mb-3">Order Summary</h5>
                        <p class="text-muted mb-1">Your cart is empty.</p>
                        <p class="text-muted mb-0">Add items to see totals and checkout options.</p>
                    </div>
                </div>`;

            if (sendQuotationBtn) {
                sendQuotationBtn.classList.add('disabled');
                sendQuotationBtn.setAttribute('aria-disabled', 'true');
                sendQuotationBtn.style.pointerEvents = 'none';
                sendQuotationBtn.tabIndex = -1;
            }

            if (clearCartBtn) {
                clearCartBtn.disabled = true;
                clearCartBtn.classList.add('disabled');
            }

            if (clearCartBtnFooter) {
                clearCartBtnFooter.disabled = true;
                clearCartBtnFooter.classList.add('disabled');
            }

            return;
        }

        if (emptyCart) emptyCart.style.display = 'none';
        if (cartItemsContainer) {
            cartItemsContainer.style.display = 'block';
            cartItemsContainer.style.visibility = 'visible';
            cartItemsContainer.style.opacity = '1';
        }

        if (sendQuotationBtn) {
            sendQuotationBtn.classList.remove('disabled');
            sendQuotationBtn.removeAttribute('aria-disabled');
            sendQuotationBtn.style.pointerEvents = '';
            sendQuotationBtn.tabIndex = 0;
        }

        if (clearCartBtn) {
            clearCartBtn.disabled = false;
            clearCartBtn.classList.remove('disabled');
        }

        if (clearCartBtnFooter) {
            clearCartBtnFooter.disabled = false;
            clearCartBtnFooter.classList.remove('disabled');
        }

        // Calculate totals for all items
        cartItems.forEach(item => {
            try {
                const type = item.getAttribute('data-type');

                const rawServerCalculations = item.getAttribute('data-calculations');
                let serverCalc = null;
                if (rawServerCalculations) {
                    try {
                        serverCalc = JSON.parse(rawServerCalculations);
                    } catch (e) {
                        serverCalc = null;
                    }
                }

                // Prefer server-side calculations to avoid rounding drift.
                if (serverCalc && (serverCalc.final_total !== undefined || serverCalc.finalTotal !== undefined)) {
                    const itemSubtotal = parseFloat(serverCalc.subtotal ?? serverCalc.display_subtotal ?? 0) || 0;
                    const discountAmount = parseFloat(serverCalc.discount_amount ?? serverCalc.discountAmount ?? 0) || 0;
                    const gstAmount = parseFloat(serverCalc.gst_amount ?? serverCalc.gstAmount ?? 0) || 0;
                    const itemTotal = parseFloat(serverCalc.final_total ?? serverCalc.finalTotal ?? serverCalc.final_price ?? 0) || 0;

                    const quantity = (() => {
                        const rawQty = serverCalc.quantity ?? serverCalc.qty ?? item.getAttribute('data-quantity') ?? item.dataset.quantity;
                        const parsed = parseFloat(rawQty);
                        if (!Number.isFinite(parsed) || parsed <= 0) return 1;
                        return type === 'mpack' ? Math.max(1, Math.round(parsed)) : parsed;
                    })();

                    const unitPrice = (() => {
                        const fromServer = serverCalc.unit_price ?? serverCalc.unitPrice;
                        const parsedServer = parseFloat(fromServer);
                        if (Number.isFinite(parsedServer) && parsedServer > 0) return parsedServer;
                        if (quantity > 0 && itemSubtotal > 0) return itemSubtotal / quantity;
                        const fromAttr = item.getAttribute('data-unit-price') ?? item.dataset.unitPrice;
                        const parsedAttr = parseFloat(fromAttr);
                        return Number.isFinite(parsedAttr) ? parsedAttr : 0;
                    })();

                    const discountPercent = (() => {
                        const raw = serverCalc.discount_percent ?? serverCalc.discountPercent ?? item.getAttribute('data-discount-percent') ?? item.dataset.discountPercent;
                        const parsed = parseFloat(raw);
                        return Number.isFinite(parsed) ? parsed : 0;
                    })();

                    const gstPercent = (() => {
                        const raw = serverCalc.gst_percent ?? serverCalc.gstPercent ?? item.getAttribute('data-gst-percent') ?? item.dataset.gstPercent;
                        const parsed = parseFloat(raw);
                        return Number.isFinite(parsed) ? parsed : (type === 'mpack' ? 12 : 18);
                    })();

                    subtotal += itemSubtotal;
                    totalDiscount += discountAmount;
                    totalGst += gstAmount;
                    total += itemTotal;

                    if (type === 'mpack') {
                        totalItems += 1;
                    } else {
                        const q = parseFloat(item.getAttribute('data-quantity') || item.dataset.quantity || '1');
                        totalItems += Number.isFinite(q) ? q : 1;
                    }

                    updateItemDisplay(item, {
                        type,
                        unit_price: unitPrice,
                        quantity,
                        subtotal: itemSubtotal,
                        final_total: itemTotal,
                        discount_amount: discountAmount,
                        gst_amount: gstAmount,
                        discount_percent: discountPercent,
                        gst_percent: gstPercent
                    });
                    return;
                }

                // Fallback: original client-side calculations
                if (type === 'mpack') {
                    const quantity = parseInt(item.getAttribute('data-quantity') || '1');
                    const validQuantity = isNaN(quantity) || quantity < 1 ? 1 : quantity;

                    // Get prices for mpack
                    const unitPrice = parseFloat(item.getAttribute('data-unit-price') || '0');
                    const discountPercent = parseFloat(item.getAttribute('data-discount-percent') || '0');
                    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || '12');
                    
                    // Calculate prices
                    const itemSubtotal = unitPrice * validQuantity;
                    const discountAmount = itemSubtotal * (discountPercent / 100);
                    const discountedSubtotal = itemSubtotal - discountAmount;
                    const gstAmount = (discountedSubtotal * gstPercent) / 100;
                    const itemTotal = discountedSubtotal + gstAmount;
                    
                    // Update running totals
                    subtotal += itemSubtotal; // include MPack subtotal
                    totalDiscount += discountAmount;
                    totalGst += gstAmount;
                    total += itemTotal;
                    totalItems += 1;
                    
                    // Update data attributes
                    item.setAttribute('data-quantity', validQuantity.toString());
                    
                    // Update item display
                    updateItemDisplay(item, {
                        type: 'mpack',
                        final_total: itemTotal,
                        discount_amount: discountAmount,
                        gst_amount: gstAmount,
                        quantity: validQuantity,
                        unit_price: unitPrice,
                        discount_percent: discountPercent,
                        gst_percent: gstPercent
                    });
                    
                } else if (type === 'blanket') {
                    const quantity = parseInt(item.getAttribute('data-quantity') || '1');
                    const validQuantity = isNaN(quantity) || quantity < 1 ? 1 : quantity;

                    // Get prices for blanket
                    const basePrice = parseFloat(item.getAttribute('data-base-price') || '0');
                    const barPrice = parseFloat(item.getAttribute('data-bar-price') || '0');
                    const discountPercent = parseFloat(item.getAttribute('data-discount-percent') || '0');
                    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || '18');
                    
                    // Calculate prices
                    const displaySubtotal = (basePrice + barPrice) * validQuantity;
                    const discountAmount = displaySubtotal * (discountPercent / 100);
                    const discountedSubtotal = displaySubtotal - discountAmount;
                    const gstAmount = (discountedSubtotal * gstPercent) / 100;
                    const itemTotal = discountedSubtotal + gstAmount;
                    
                    // Update running totals
                    subtotal += displaySubtotal; // include blanket subtotal
                    totalDiscount += discountAmount;
                    totalGst += gstAmount;
                    total += itemTotal;
                    totalItems += validQuantity;
                    
                    // Update data attributes
                    item.setAttribute('data-quantity', validQuantity.toString());
                    
                    // Update item display
                    updateItemDisplay(item, {
                        type: 'blanket',
                        final_total: itemTotal,
                        discount_amount: discountAmount,
                        gst_amount: gstAmount,
                        quantity: validQuantity,
                        base_price: basePrice,
                        bar_price: barPrice,
                        discount_percent: discountPercent,
                        gst_percent: gstPercent
                    });
                } else if (type === 'chemical' || type === 'maintenance') {
                    const litres = parseFloat(item.getAttribute('data-quantity-litre') || item.dataset.quantityLitre || '0');
                    const pricePerLitre = parseFloat(item.getAttribute('data-price-per-litre') || item.dataset.pricePerLitre || item.getAttribute('data-unit-price') || '0');
                    const discountPercent = parseFloat(item.getAttribute('data-discount-percent') || '0');
                    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || '18');

                    const validQuantity = Number.isFinite(litres) && litres > 0 ? litres : 0;

                    // Calculate prices
                    const itemSubtotal = pricePerLitre * validQuantity;
                    const discountAmount = itemSubtotal * (discountPercent / 100);
                    const discountedSubtotal = itemSubtotal - discountAmount;
                    const gstAmount = (discountedSubtotal * gstPercent) / 100;
                    const itemTotal = discountedSubtotal + gstAmount;

                    // Update running totals
                    subtotal += itemSubtotal; // include chemical subtotal
                    totalDiscount += discountAmount;
                    totalGst += gstAmount;
                    total += itemTotal;
                    totalItems += validQuantity;

                    // Update data attributes
                    item.setAttribute('data-quantity', validQuantity.toString());
                    item.setAttribute('data-quantity-litre', validQuantity.toString());
                    item.setAttribute('data-unit-price', pricePerLitre.toString());

                    // Update item display
                    updateItemDisplay(item, {
                        type,
                        final_total: itemTotal,
                        discount_amount: discountAmount,
                        gst_amount: gstAmount,
                        quantity: validQuantity,
                        quantity_litre: validQuantity,
                        unit_price: pricePerLitre,
                        discount_percent: discountPercent,
                        gst_percent: gstPercent
                    });
                } else if (type === 'creasing_matrix' || type === 'litho_perforation') {
                    const quantityInput = item.querySelector('.quantity-input');
                    const rawQuantity = quantityInput?.value
                        ?? item.getAttribute('data-quantity')
                        ?? item.dataset.quantity
                        ?? item.getAttribute('data-quantity-rolls')
                        ?? item.getAttribute('data-packets')
                        ?? '1';
                    const quantity = Math.max(1, Math.round(parseFloat(rawQuantity) || 1));
                    const unitPrice = parseFloat(item.getAttribute('data-unit-price') || item.dataset.unitPrice || '0');
                    const discountPercent = parseFloat(item.getAttribute('data-discount-percent') || '0');
                    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || '18');

                    const itemSubtotal = unitPrice * quantity;
                    const discountAmount = itemSubtotal * (discountPercent / 100);
                    const discountedSubtotal = itemSubtotal - discountAmount;
                    const gstAmount = (discountedSubtotal * gstPercent) / 100;
                    const itemTotal = discountedSubtotal + gstAmount;

                    subtotal += itemSubtotal;
                    totalDiscount += discountAmount;
                    totalGst += gstAmount;
                    total += itemTotal;
                    totalItems += quantity;

                    item.setAttribute('data-quantity', quantity.toString());
                    item.setAttribute('data-unit-price', unitPrice.toString());

                    updateItemDisplay(item, {
                        type,
                        unit_price: unitPrice,
                        quantity,
                        quantity_rolls: quantity,
                        packets: quantity,
                        discount_percent: discountPercent,
                        gst_percent: gstPercent,
                        subtotal: itemSubtotal,
                        discount_amount: discountAmount,
                        discounted_subtotal: discountedSubtotal,
                        gst_amount: gstAmount,
                        final_total: itemTotal
                    });
                } else if (type === 'rule') {
                    const quantity = parseInt(item.getAttribute('data-quantity') || '1');
                    const validQuantity = Number.isNaN(quantity) || quantity < 1 ? 1 : quantity;
                    const unitPrice = parseFloat(item.getAttribute('data-unit-price') || '0');
                    const discountPercent = parseFloat(item.getAttribute('data-discount-percent') || '0');
                    const gstPercent = parseFloat(item.getAttribute('data-gst-percent') || '18');
                    const lengthPerUnit = parseFloat(item.getAttribute('data-length-per-unit-m') || item.dataset.lengthPerUnitM || '100');
                    const ratePerMeter = parseFloat(item.getAttribute('data-rate-per-meter') || item.dataset.ratePerMeter || '0');

                    const itemSubtotal = unitPrice * validQuantity;
                    const discountAmount = itemSubtotal * (discountPercent / 100);
                    const discountedSubtotal = itemSubtotal - discountAmount;
                    const gstAmount = (discountedSubtotal * gstPercent) / 100;
                    const itemTotal = discountedSubtotal + gstAmount;
                    const totalLength = lengthPerUnit * validQuantity;

                    subtotal += itemSubtotal;
                    totalDiscount += discountAmount;
                    totalGst += gstAmount;
                    total += itemTotal;
                    totalItems += validQuantity;

                    item.setAttribute('data-quantity', validQuantity.toString());
                    item.setAttribute('data-length-per-unit-m', lengthPerUnit.toString());
                    item.setAttribute('data-total-length-m', totalLength.toString());

                    updateItemDisplay(item, {
                        type: 'rule',
                        unit_price: unitPrice,
                        quantity: validQuantity,
                        discount_percent: discountPercent,
                        gst_percent: gstPercent,
                        length_per_unit_m: lengthPerUnit,
                        rate_per_meter: ratePerMeter,
                        total_length_m: totalLength,
                        subtotal: itemSubtotal,
                        discount_amount: discountAmount,
                        discounted_subtotal: discountedSubtotal,
                        gst_amount: gstAmount,
                        final_total: itemTotal
                    });
                }
            } catch (error) {
                console.error('Error calculating item totals:', error);
            }
        });
        
        // Update the cart summary
        if (cartSummary) {
            cartSummary.style.display = 'block';
            cartSummary.style.visibility = 'visible';
            cartSummary.style.opacity = '1';

            // Round all values to 2 decimal places
            subtotal = Math.round(subtotal * 100) / 100;
            totalDiscount = Math.round(totalDiscount * 100) / 100;
            totalGst = Math.round(totalGst * 100) / 100;
            total = Math.round(total * 100) / 100;

            cartSummary.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title mb-3">Order Summary</h5>
                        <div class="mb-2">
                            <div class="d-flex justify-content-between mb-1">
                                <span>Subtotal (${totalItems} ${totalItems === 1 ? 'item' : 'items'}):</span>
                                <span>₹${subtotal.toFixed(2)}</span>
                            </div>
                            ${totalDiscount > 0 ? `
                            <div class="d-flex justify-content-between mb-1 text-success">
                                <span>Discount:</span>
                                <span>-₹${totalDiscount.toFixed(2)}</span>
                            </div>` : ''}
                            <div class="d-flex justify-content-between mb-1 fw-medium">
                                <span>Total (Pre-GST):</span>
                                <span>₹${(subtotal - totalDiscount).toFixed(2)}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>GST:</span>
                                <span>₹${totalGst.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                            <span class="fw-bold">Total:</span>
                            <span class="fw-bold fs-5">₹${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>`;
        }
    } catch (error) {
        console.error('Error updating cart totals:', error);
    } finally {
        isUpdatingCartTotals = false;
    }
}

// Function to handle discount updates
function handleDiscountUpdate(event) {
    const button = event.target.closest('.update-discount-btn');
    if (!button) return;
    
    const index = button.getAttribute('data-index');
    if (index === null) {
        console.error('Could not find cart item index');
        return;
    }
    
    const cartItem = document.querySelector(`.cart-item[data-index="${index}"]`);
    if (!cartItem) {
        console.error('Cart item not found in DOM');
        return;
    }
    
    const discountInput = cartItem.querySelector('.discount-input');
    let discountPercent = parseFloat(discountInput.value);
    
    // Ensure the discount is between 0 and 100
    if (isNaN(discountPercent) || discountPercent < 0) {
        discountPercent = 0;
    } else if (discountPercent > 100) {
        discountPercent = 100;
    }
    
    // Update the input value in case it was out of bounds
    discountInput.value = discountPercent;
    
    // Update the cart item discount
    const itemId = cartItem.getAttribute('data-item-id');
    updateCartItemDiscount(index, discountPercent, itemId);
}

// Function to handle discount input keydown (Enter key)
function handleDiscountKeyDown(event) {
    if (event.key === 'Enter') {
        handleDiscountUpdate(event);
    }
}

function getCartDiscountCap() {
    const pricingMode = document.documentElement?.dataset?.pricingMode;
    return pricingMode === 'gm' ? 50 : 10;
}

function clampDiscountWithCap(discountPercent) {
    const cap = getCartDiscountCap();
    let normalized = Number(discountPercent);
    if (Number.isNaN(normalized) || normalized < 0) {
        normalized = 0;
    }
    if (normalized > cap) {
        showToast('Error', `Discount cannot exceed ${cap}%. Please choose between 0-${cap}%.`, 'error');
        normalized = cap;
    }
    return normalized;
}

// Function to update cart item discount
function updateCartItemDiscount(index, discountPercent, itemId) {
    updateCartEmptyState();
    discountPercent = clampDiscountWithCap(discountPercent);
    const csrfToken = getCSRFToken();
    
    // Try to find the cart item in the DOM
    let cartItem = document.querySelector(`.cart-item[data-index="${index}"]`);
    
    // If not found, try to find any cart item with the index or item_id
    if (!cartItem) {
        const allCartItems = document.querySelectorAll('.cart-item');
        for (const item of allCartItems) {
            if (item.getAttribute('data-index') === index || item.getAttribute('data-item-id') === itemId) {
                cartItem = item;
                // Update the index in case we found by item_id
                if (itemId && !cartItem.getAttribute('data-index')) {
                    cartItem.setAttribute('data-index', index);
                }
                break;
            }
        }
    }
    
    // Get the update button before any async operations
    const updateButton = cartItem ? cartItem.querySelector('.update-discount-btn') : null;
    let originalHtml = '';

    if (cartItem) {
        const discountInput = cartItem.querySelector('.discount-input');
        if (discountInput) {
            discountInput.value = discountPercent;
        }
    }
    
    // Store the original button state
    if (updateButton) {
        originalHtml = updateButton.innerHTML;
        updateButton.disabled = true;
        updateButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Updating...';
    }
    
    fetch('/update_cart_discount', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            index: parseInt(index),
            item_id: itemId,
            discount_percent: parseFloat(discountPercent)
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Update the UI with the new data from the server
            if (data.updated_item) {
                updateItemDisplay(cartItem, data.updated_item);
                updateCartTotals();
                showToast('Success', 'Discount updated', 'success');
            } else {
                updateCartTotals();
                showToast('Success', 'Discount updated', 'success');
            }
        } else {
            throw new Error(data.message || 'Failed to update discount');
        }
    })
    .catch(error => {
        console.error('Error updating discount:', error);
        showToast('Error', error.message || 'An error occurred while updating discount', 'error');
        // Don't re-throw here as it would prevent the finally block from running
        return Promise.reject(error);
    })
    .finally(() => {
        // Simplified button state restoration
        if (updateButton) {
            updateButton.disabled = false;
            updateButton.innerHTML = originalHtml || 'Update';
        }
    });
}

// Function to handle quantity changes
function handleQuantityChange(event) {
    const input = event.target;
    const index = input.getAttribute('data-index');
    const cartItem = input.closest('.cart-item');
    
    if (index === null) {
        console.error('Could not find cart item index');
        return;
    }
    
    // Ensure the quantity is at least 1
    let newQuantity = parseFloat(input.value);
    if (isNaN(newQuantity) || newQuantity <= 0) {
        newQuantity = cartItem.getAttribute('data-type') === 'chemical' || cartItem.getAttribute('data-type') === 'maintenance' ? 0.1 : 1;
        input.value = cartItem.getAttribute('data-type') === 'chemical' || cartItem.getAttribute('data-type') === 'maintenance'
            ? newQuantity.toFixed(2).replace(/\.00$/, '')
            : Math.round(newQuantity);
    }

    if (cartItem.getAttribute('data-type') !== 'chemical' && cartItem.getAttribute('data-type') !== 'maintenance') {
        newQuantity = Math.max(1, Math.round(newQuantity));
        input.value = newQuantity;
    } else {
        newQuantity = Math.max(0.1, newQuantity);
        input.value = newQuantity.toFixed(2).replace(/\.00$/, '');
    }

    // Add loading state
    input.disabled = true;
    const buttons = cartItem.querySelectorAll('.quantity-decrease, .quantity-increase');
    buttons.forEach(btn => btn.disabled = true);

    // Add loading class to parent for visual feedback
    const quantityControls = input.closest('.input-group');
    if (quantityControls) {
        quantityControls.classList.add('loading');
    }

    // Update the cart item quantity
    updateCartItemQuantity(index, newQuantity);
}

// Function to update cart item quantity
function updateCartItemQuantity(index, newQuantity, type) {
    // Update empty state after quantity changes
    updateCartEmptyState();
    const csrfToken = getCSRFToken();

    // Try to find the cart item in the DOM
    let cartItem = document.querySelector(`.cart-item[data-index="${index}"]`);
    let itemId = null;

    // If not found, try to find by type and index
    if (!cartItem && type) {
        cartItem = document.querySelector(`.cart-item[data-type="${type}"][data-index="${index}"]`);
    }

    // If still not found, try to find any cart item with the index
    if (!cartItem) {
        const allCartItems = document.querySelectorAll('.cart-item');
        for (const candidate of allCartItems) {
            const candidateIndex = candidate.getAttribute('data-index');
            if (candidateIndex === String(index)) {
                cartItem = candidate;
                break;
            }
        }
    }

    if (cartItem) {
        itemId = cartItem.getAttribute('data-item-id');
    } else {
        console.warn('Cart item not found in DOM, but will still update server-side');
    }

    const quantityInput = cartItem ? cartItem.querySelector('.quantity-input') : null;
    const originalValue = quantityInput ? quantityInput.value : '';

    if (quantityInput) {
        quantityInput.disabled = true;
    }
    
    fetch('/update_cart_quantity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            index: parseInt(index),
            item_id: itemId,
            quantity: parseFloat(newQuantity),
            type: cartItem ? cartItem.getAttribute('data-type') : null
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Update the UI with the new data from the server
            if (data.updated_item) {
                // Utilize helper to refresh all price-related fields including discount & GST
                const itemData = { ...data.updated_item };

                // Ensure type present for updateItemDisplay (fallback to DOM dataset)
                if (!itemData.type) {
                    itemData.type = cartItem ? cartItem.getAttribute('data-type') : '';
                }

                if (quantityInput) {
                    const isChemical = itemData.type === 'chemical' || itemData.type === 'maintenance';
                    const qtyValue = itemData.quantity_litre ?? itemData.quantity;
                    quantityInput.value = isChemical
                        ? formatNumber(qtyValue ?? 0, 2)
                        : (Math.max(1, Math.round(qtyValue ?? 1)));
                }

                // Delegate DOM refresh to central utility
                updateItemDisplay(cartItem, itemData);
                
                // Recalculate totals
                updateCartTotals();
                updateCartCount();
                showToast('Success', 'Quantity updated', 'success');
            } else {
                // Fallback if updated_item is not provided
                updateCartTotals();
                updateCartCount();
                showToast('Success', 'Quantity updated', 'success');
            }
        } else {
            throw new Error(data.message || 'Failed to update quantity');
        }
    })
    .catch(error => {
        console.error('Error updating quantity:', error);
        // Revert to original value on error and re-enable input
        if (quantityInput) {
            quantityInput.value = originalValue;
        }
        showToast('Error', error.message || 'An error occurred while updating quantity', 'error');
    })
    .finally(() => {
        // Re-enable all quantity controls
        const quantityControls = document.querySelectorAll('.quantity-input, .quantity-decrease, .quantity-increase');
        quantityControls.forEach(control => {
            control.disabled = false;
        });
        
        // Remove loading state
        const loadingGroups = document.querySelectorAll('.input-group.loading');
        loadingGroups.forEach(group => {
            group.classList.remove('loading');
        });
    });
}

// Handle manual input changes
function handleQuantityInputChange(event) {
    const input = event.target;
    if (!input.classList.contains('quantity-input')) return;
    
    const container = input.closest('.cart-item');
    if (!container) {
        console.warn('Could not find cart item container for quantity input');
        return;
    }
    
    const index = container.getAttribute('data-index');
    const type = container.getAttribute('data-type');
    
    if (!index) {
        console.warn('Cart item is missing data-index attribute');
        return;
    }
    
    let newQuantity = parseFloat(input.value);
    const isDecimalQuantity = type === 'chemical' || type === 'maintenance' || type === 'creasing_matrix';

    if (isNaN(newQuantity) || newQuantity <= 0) {
        newQuantity = isDecimalQuantity ? 0.1 : 1;
    }

    if (!isDecimalQuantity) {
        newQuantity = Math.max(1, Math.round(newQuantity));
        input.value = newQuantity;
    } else {
        newQuantity = Math.max(0.1, newQuantity);
        input.value = newQuantity.toFixed(2).replace(/\.00$/, '');
    }

    updateCartItemQuantity(index, newQuantity, type);
}

// Handle keyboard input for quantity fields
function handleQuantityKeyDown(event) {
    if (event.target.classList.contains('quantity-input') && event.key === 'Enter') {
        event.preventDefault();
        event.target.blur(); // Triggers the change event
    }
}

// Function to handle change item button clicks
function resolveConfiguratorPath(productType) {
    const normalized = String(productType || '').trim().toLowerCase();
    const routeMap = {
        chemical: '/chemicals',
        rule: '/rules',
        creasing_matrix: '/creasing-matrix',
        blanket: '/blankets',
        mpack: '/mpacks',
        spray_powder: '/spray-powder',
        litho_perforation: '/litho-perforation-rules'
    };

    if (routeMap[normalized]) {
        return routeMap[normalized];
    }

    if (!normalized) {
        return null;
    }

    return normalized.endsWith('s') ? `/${normalized}` : `/${normalized}s`;
}

function handleChangeItem(e) {
    if (!e.target.closest('.change-item-btn')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const button = e.target.closest('.change-item-btn');
    if (!button) {
        console.error('âŒ Invalid change button');
        return;
    }
    
    const cartItemElement = button.closest('.cart-item');
    if (!cartItemElement) {
        console.error('âŒ Could not find cart item element');
        return;
    }
    
    // Get item details from the cart item element
    const itemId = cartItemElement.getAttribute('data-item-id');
    const itemType = cartItemElement.getAttribute('data-type');
    const itemName = cartItemElement.getAttribute('data-name');
    const itemMachine = cartItemElement.getAttribute('data-machine');
    const itemThickness = cartItemElement.getAttribute('data-thickness');
    const itemSize = cartItemElement.getAttribute('data-size');
    
    console.log('ðŸ”„ Handling change item request');
    console.log('Item ID to edit:', itemId);
    console.log('Item details from DOM:', { 
        itemType, 
        itemName, 
        itemMachine, 
        itemThickness,
        itemSize 
    });
    
    // Get the cart data
    const cart = getCart();
    console.log(`ðŸ›’ Cart loaded with ${cart.products ? cart.products.length : 0} items`);
    
    if (!cart.products || !Array.isArray(cart.products)) {
        console.error('âŒ Invalid cart data structure:', cart);
        showToast('Error', 'Invalid cart data', 'error');
        return;
    }
    
    // Try to find the item by ID first
    let item = cart.products.find(cartItem => {
        const cartItemId = cartItem.id || cartItem._id;
        return cartItemId && String(cartItemId) === String(itemId);
    });
    
    if (!item) {
        console.log('âš ï¸ Item not found by ID, trying fallback matching...');
        // Fallback to matching by name, type, and machine
        item = cart.products.find(cartItem => {
            const nameMatch = cartItem.name === itemName;
            const typeMatch = cartItem.type === itemType;
            const machineMatch = !itemMachine || cartItem.machine === itemMachine;
            return nameMatch && typeMatch && machineMatch;
        });
    }
    
    if (!item) {
        console.error('âŒ Could not find item in cart');
        console.log('Searched with:', { itemId, itemName, itemType, itemMachine });
        console.log('Available items in cart:', cart.products.map((i, idx) => ({
            index: idx,
            id: i?.id || i?._id,
            type: i?.type,
            name: i?.name,
            machine: i?.machine,
            rawItem: i
        })));
        showToast('Error', 'Could not find item in cart', 'error');
        return;
    }
    
    console.log('âœ… Found item for editing:', item);
    
    try {
        // Prepare the redirect URL based on item type
        const baseUrl = resolveConfiguratorPath(item.type);
        if (!baseUrl) {
            console.error('❌ Unable to resolve configurator path for item type:', item.type);
            showToast('Error', 'Cannot edit this product because its configurator is unknown.', 'error');
            return;
        }
        const urlParams = new URLSearchParams();
        
        // Add edit mode and item ID
        urlParams.append('edit', 'true');
        urlParams.append('item_id', item.id || item._id);
        urlParams.append('type', item.type);
        
        // Add all item properties as query parameters, excluding internal fields
        const excludeFields = ['id', '_id', 'calculations', 'createdAt', 'updatedAt', '__v'];
        
        // Add item properties as query parameters
        for (const [key, value] of Object.entries(item)) {
            if (value !== null && value !== undefined && !excludeFields.includes(key)) {
                try {
                    const paramValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                    urlParams.append(key, paramValue);
                } catch (err) {
                    console.warn(`Could not stringify property ${key}:`, err);
                }
            }
        }
        
        // Add company information if available - check both localStorage and sessionStorage
        let company = null;
        
        // First try localStorage
        const storedCompany = localStorage.getItem('selectedCompany');
        if (storedCompany) {
            try {
                company = JSON.parse(storedCompany);
                console.log('Found company in localStorage:', company);
            } catch (e) {
                console.warn('Could not parse company info from localStorage:', e);
            }
        }
        
        // If not found in localStorage, try sessionStorage
        if (!company) {
            const sessionCompany = sessionStorage.getItem('selectedCompany');
            if (sessionCompany) {
                try {
                    company = JSON.parse(sessionCompany);
                    console.log('Found company in sessionStorage:', company);
                    // Save to localStorage for persistence
                    localStorage.setItem('selectedCompany', sessionCompany);
                } catch (e) {
                    console.warn('Could not parse company info from sessionStorage:', e);
                }
            }
        }
        
        // If we have company info, add it to the URL
        if (company) {
            urlParams.append('company_id', company.id || '');
            urlParams.append('company_name', encodeURIComponent(company.name || ''));
            urlParams.append('company_email', encodeURIComponent(company.email || ''));
            console.log('Added company info to URL params');
        } else {
            console.warn('No company information found in storage');
        }
        
        // Add a timestamp to prevent caching
        urlParams.append('_', Date.now());
        
        // Build the final URL
        const finalUrl = `${baseUrl}?${urlParams.toString()}`;
        
        console.log('ðŸ”— Redirecting to edit page:', finalUrl);
        window.location.href = finalUrl;
        
    } catch (error) {
        console.error('âŒ Error preparing item for editing:', error);
        showToast('Error', 'Failed to prepare item for editing', 'error');
    }
}

// Function to set up remove handlers using event delegation
function setupRemoveHandlers() {
    // Remove any existing event listeners to prevent duplicates
    document.removeEventListener('click', handleRemoveClick);
    
    // Add event delegation for remove buttons
    document.addEventListener('click', handleRemoveClick);
}

// Handle remove button clicks using event delegation
function handleRemoveClick(e) {
    // Find the closest remove button that was clicked
    const removeBtn = e.target.closest('.remove-item-btn');
    if (!removeBtn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Add loading state to the button
    const originalHtml = removeBtn.innerHTML;
    removeBtn.disabled = true;
    removeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Removing...';
    
    // Get the item element and its ID
    const itemElement = removeBtn.closest('.cart-item');
    if (!itemElement) {
        console.error('Could not find cart item element');
        showToast('Error', 'Could not identify item to remove', 'error');
        removeBtn.innerHTML = originalHtml;
        removeBtn.disabled = false;
        return;
    }
    
    // Get the item ID from the data attribute
    const itemId = itemElement.getAttribute('data-item-id');
    if (!itemId) {
        console.error('Item has no data-item-id attribute');
        showToast('Error', 'Could not identify item to remove', 'error');
        removeBtn.innerHTML = originalHtml;
        removeBtn.disabled = false;
        return;
    }
    
    // Show confirmation dialog
    const itemName = itemElement.getAttribute('data-name') || 'this item';
    if (confirm(`Are you sure you want to remove ${itemName} from your cart?`)) {
        console.log('Removing item with ID:', itemId);
        removeFromCart(e, itemId, () => {
            // Re-enable button after removal is complete
            removeBtn.innerHTML = originalHtml;
            removeBtn.disabled = false;
        });
    } else {
        // Reset button if user cancels
        removeBtn.innerHTML = originalHtml;
        removeBtn.disabled = false;
    }
}

async function refreshCartDisplayFromServer() {
    try {
        const currentUrl = `${window.location.pathname}${window.location.search || ''}`;
        const response = await fetch(currentUrl, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch updated cart');
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const updateSection = (selector, updateCallback) => {
            const fresh = doc.querySelector(selector);
            const current = document.querySelector(selector);

            if (fresh && current) {
                if (fresh.tagName === 'SCRIPT') {
                    current.textContent = fresh.textContent;
                } else {
                    current.innerHTML = fresh.innerHTML;
                    if (fresh instanceof HTMLElement && current instanceof HTMLElement) {
                        current.className = fresh.className;
                        current.style.display = fresh.style.display;
                        current.style.visibility = fresh.style.visibility;
                        current.style.opacity = fresh.style.opacity;
                    }
                }

                if (typeof updateCallback === 'function') {
                    updateCallback(current, fresh);
                }
            }
        };

        updateSection('#cartItems', current => {
            // Ensure indices remain sequential for newly rendered items
            current.querySelectorAll('.cart-item').forEach((item, index) => {
                item.setAttribute('data-index', index.toString());
            });
        });
        updateSection('#emptyCart');
        updateSection('#cartSummary');
        updateSection('.cart-footer');
        updateSection('#serverCartData');

        // Re-run cart initialization to restore event handlers and calculations
        initializeCart();
    } catch (error) {
        console.error('Error refreshing cart display from server:', error);
        throw error;
    }
}

// Function to remove item from cart using item ID
function removeFromCart(event, itemId, callback) {
    // Prevent default form submission if called from a form
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    
    // Get the item element for better UX
    const itemElement = event ? event.target.closest('.cart-item') : document.querySelector(`.cart-item[data-item-id="${itemId}"]`);
    const button = event ? event.target.closest('button') : null;
    const originalHtml = button ? button.innerHTML : '';
    
    // Show loading state
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Removing...';
    }
    
    const csrfToken = getCSRFToken();
    
    // First, find the item in the cart to get its exact ID format
    let cart = { products: [] };
    try {
        const cartData = localStorage.getItem('cart');
        if (cartData) {
            const parsed = JSON.parse(cartData);
            cart = Array.isArray(parsed) ? { products: parsed } : parsed;
            
            if (!Array.isArray(cart.products)) {
                cart.products = [];
            }
            
            // Find the item by ID, handling both string and ObjectId formats
            const item = cart.products.find(item => {
                if (!item) return false;
                const cartItemId = item.id || item._id;
                // Convert both to string for comparison to handle ObjectId
                return String(cartItemId) === String(itemId);
            });
            
            if (item) {
                // Use the exact ID from the cart item for the request
                itemId = item.id || item._id;
            }
        }
    } catch (error) {
        console.error('Error finding item in cart:', error);
    }
    
    const releaseRemovalGuard = (immediate = false) => {
        if (immediate) {
            isRemovingCartItem = false;
        } else {
            setTimeout(() => {
                isRemovingCartItem = false;
            }, 150);
        }
    };

    // Make API call to remove item from cart
    isRemovingCartItem = true;

    fetch('/remove_from_cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ item_id: itemId })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const finalizeRemoval = () => {
                updateCartCount(data.cart_count || 0);

                const refreshPromise = refreshCartDisplayFromServer()
                    .catch(err => {
                        console.error('Falling back to local cart update:', err);
                        updateCartTotals();
                        updateCartEmptyState();
                    })
                    .finally(() => {
                        if (typeof callback === 'function') {
                            callback();
                        } else if (button) {
                            if (document.body.contains(button)) {
                                button.innerHTML = originalHtml;
                                button.disabled = false;
                            }
                        }

                        releaseRemovalGuard();
                    });

                showToast('Success', 'Item removed from cart', 'success');
                return refreshPromise;
            };

            // Fade out the item, but DO NOT remove it yet.
            // Removing before the server refresh can cause a brief empty-cart flash.
            if (itemElement) {
                itemElement.style.opacity = '0.5';
                itemElement.style.transition = 'opacity 0.3s ease';
            }
            finalizeRemoval();
        } else {
            releaseRemovalGuard(true);
            throw new Error(data.error || 'Failed to remove item from cart');
        }
    })
    .catch(error => {
        console.error('Error removing item from cart:', error);
        showToast('Error', error.message || 'An error occurred while removing item from cart', 'error');
        
        // Reset button state on error
        if (button) {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
        
        // Call the callback if provided
        if (typeof callback === 'function') {
            callback();
        }

        releaseRemovalGuard(true);
    })
    .finally(() => {
        // Do nothing
    });
}

    // Utility helpers for refreshing cart item metadata and display
function setDataAttribute(element, attribute, value) {
    // ...
    if (!element) return;

    if (value === undefined || value === null || value === '') {
        element.removeAttribute(attribute);
    } else {
        element.setAttribute(attribute, value);
    }
}

function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toNumber(value) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isNaN(num) ? null : num;
}

function formatNumber(value, decimals = 2, trimZeros = true) {
    const num = toNumber(value);
    if (num === null) return '';

    let formatted = num.toFixed(decimals);
    if (trimZeros) {
        formatted = formatted.replace(/\.0+$/, '');
        formatted = formatted.replace(/(\.\d*?[1-9])0+$/, '$1');
    }

    return formatted;
}

function strToBool(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return false;
}

function formatUnderpackingType(type) {
    if (!type) return '';
    const normalized = type.toLowerCase();

    switch (normalized) {
        case 'mtech_mpack':
            return 'Mtech Mpack';
        case 'mark3zet':
            return 'Mark3zet';
        default:
            return normalized
                .split(/[_\s-]+/)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
    }
}

function renderBlanketDetails(item, data) {
    const detailsEl = item.querySelector('.product-details');
    if (!detailsEl) return;

    const machine = data.machine ?? item.getAttribute('data-machine');
    const thickness = data.thickness ?? item.getAttribute('data-thickness');
    const lengthMm = toNumber(data.length ?? item.getAttribute('data-length'));
    const widthMm = toNumber(data.width ?? item.getAttribute('data-width'));
    const barType = data.bar_type ?? item.getAttribute('data-bar-type');

    const lines = [];

    if (machine) {
        lines.push(`<p class="mb-1"><strong>Machine:</strong> ${escapeHtml(machine)}</p>`);
    }

    if (thickness) {
        const thicknessValue = toNumber(thickness);
        const displayThickness = thicknessValue !== null ? `${formatNumber(thicknessValue, 2)}mm` : escapeHtml(thickness);
        lines.push(`<p class="mb-1"><strong>Thickness:</strong> ${displayThickness}</p>`);
    }

    if (lengthMm !== null && widthMm !== null) {
        const lengthMeters = lengthMm / 1000;
        const widthMeters = widthMm / 1000;
        const areaSqM = (lengthMm * widthMm) / 1_000_000;

        lines.push(`<p class="mb-1"><strong>Dimensions:</strong> Length = ${formatNumber(lengthMm, 0)}mm, Width = ${formatNumber(widthMm, 0)}mm (${formatNumber(lengthMeters, 2)}m x ${formatNumber(widthMeters, 2)}m)</p>`);
        lines.push(`<p class="mb-1"><strong>Area:</strong> ${formatNumber(areaSqM, 2)} m² (${formatNumber(lengthMm * widthMm, 0, false)} mm²)</p>`);
    }

    if (barType) {
        lines.push(`<p class="mb-1"><strong>Barring:</strong> ${escapeHtml(barType)}</p>`);
    }

    detailsEl.innerHTML = lines.join('') || '<p class="text-muted mb-0">No additional details available.</p>';
}

function renderMPackDetails(item, data) {
    const detailsEl = item.querySelector('.product-details');
    if (!detailsEl) return;

    const machine = data.machine ?? item.getAttribute('data-machine');
    const thicknessRaw = data.thickness ?? item.getAttribute('data-thickness');
    const underpackingTypeRaw = data.underpacking_type ?? item.getAttribute('data-underpacking-type');
    const barType = data.bar_type ?? item.getAttribute('data-bar-type');
    const size = data.size ?? item.getAttribute('data-size');

    const customLength = toNumber(data.custom_length_mm ?? item.getAttribute('data-custom-length-mm'));
    const customWidth = toNumber(data.custom_width_mm ?? item.getAttribute('data-custom-width-mm'));
    const standardLength = toNumber(data.standard_length_mm ?? data.length ?? item.getAttribute('data-standard-length-mm') ?? item.getAttribute('data-length'));
    const standardWidth = toNumber(data.standard_width_mm ?? data.width ?? item.getAttribute('data-standard-width-mm') ?? item.getAttribute('data-width'));
    const displayLengthFallback = toNumber(data.display_length_mm ?? item.getAttribute('data-display-length-mm'));
    const displayWidthFallback = toNumber(data.display_width_mm ?? item.getAttribute('data-display-width-mm'));
    const cutToCustom = strToBool(data.cut_to_custom_size ?? item.getAttribute('data-cut-to-custom-size'));

    const resolvedStandardLength = standardLength ?? displayLengthFallback;
    const resolvedStandardWidth = standardWidth ?? displayWidthFallback;

    const displayLength = cutToCustom && customLength ? customLength : resolvedStandardLength;
    const displayWidth = cutToCustom && customWidth ? customWidth : resolvedStandardWidth;

    const lines = [];

    if (machine) {
        lines.push(`<p class="mb-1"><strong>Machine:</strong> ${escapeHtml(machine)}</p>`);
    }

    if (underpackingTypeRaw) {
        lines.push(`<p class="mb-1"><strong>Type:</strong> ${escapeHtml(formatUnderpackingType(underpackingTypeRaw))}</p>`);
    }

    if (thicknessRaw) {
        const thicknessNumber = toNumber(thicknessRaw);
        let suffix = '';
        let displayValue = escapeHtml(thicknessRaw);

        if (thicknessNumber !== null) {
            if (thicknessNumber >= 1) {
                suffix = 'mm';
                displayValue = formatNumber(thicknessNumber, 2);
            } else {
                suffix = 'micron';
                displayValue = formatNumber(thicknessNumber, 0);
            }
        }

        lines.push(`<p class="mb-1"><strong>Thickness:</strong> ${displayValue}${suffix}</p>`);
    }

    if (displayWidth !== null && displayLength !== null) {
        const areaSqM = (displayLength * displayWidth) / 1_000_000;
        lines.push(`<p class="mb-1"><strong>Dimensions:</strong> Width = ${formatNumber(displayWidth, 0)}mm, Length = ${formatNumber(displayLength, 0)}mm</p>`);
        lines.push(`<p class="mb-1"><strong>Area:</strong> ${formatNumber(areaSqM, 3)} m²</p>`);

        if (cutToCustom) {
            if (resolvedStandardWidth && resolvedStandardLength) {
                lines.push(`<p class="text-muted small mb-1">Cut from standard ${formatNumber(resolvedStandardWidth, 0)} x ${formatNumber(resolvedStandardLength, 0)} mm.</p>`);
            } else if (size) {
                lines.push(`<p class="text-muted small mb-1">Cut from standard ${escapeHtml(size)}.</p>`);
            }
        } else if (size) {
            lines.push(`<p class="text-muted small mb-1">Supplied in standard ${escapeHtml(size)}.</p>`);
        }
    } else if (size) {
        lines.push(`<p class="mb-1"><strong>Size:</strong> ${escapeHtml(size)}</p>`);
        lines.push(`<p class="text-muted small mb-1">Supplied in standard ${escapeHtml(size)}.</p>`);
    }

    if (barType) {
        lines.push(`<p class="mb-1"><strong>Barring:</strong> ${escapeHtml(barType)}</p>`);
    }

    detailsEl.innerHTML = lines.join('') || '<p class="text-muted mb-0">No additional details available.</p>';
}

function renderChemicalMaintenanceDetails(item, data) {
    const detailsEl = item.querySelector('.product-details');
    if (!detailsEl) {
        console.warn('renderChemicalMaintenanceDetails: No .product-details element found');
        return;
    }

    console.log('renderChemicalMaintenanceDetails called for:', item.getAttribute('data-name'));
    console.log('renderChemicalMaintenanceDetails data:', data);

    const getValue = (key, attrName = `data-${key.replace(/_/g, '-')}`) => {
        if (data && Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }

        const attrValue = item.getAttribute(attrName);
        return attrValue !== null ? attrValue : undefined;
    };

    const lines = [];

    // Machine
    const machine = getValue('machine');
    if (machine) {
        lines.push(`<p class="mb-1"><strong>Machine:</strong> ${escapeHtml(machine)}</p>`);
    }

    // Category
    const category = getValue('category');
    if (category) {
        lines.push(`<p class="mb-1"><strong>Category:</strong> ${escapeHtml(category)}</p>`);
    }

    // Format Label
    const formatLabel = getValue('format_label');
    console.log('renderChemicalMaintenanceDetails: formatLabel =', formatLabel);
    if (formatLabel) {
        lines.push(`<p class="mb-1"><strong>Format:</strong> ${escapeHtml(formatLabel)}</p>`);
    }

    // Quantity Litre
    const quantityLitre = getValue('quantity_litre');
    console.log('renderChemicalMaintenanceDetails: quantityLitre =', quantityLitre);
    if (quantityLitre) {
        lines.push(`<p class="mb-1"><strong>Quantity:</strong> ${escapeHtml(quantityLitre)}L</p>`);
    }

    // Packs Needed
    const packsNeeded = getValue('packs_needed');
    console.log('renderChemicalMaintenanceDetails: packsNeeded =', packsNeeded);
    if (packsNeeded) {
        lines.push(`<p class="mb-1"><strong>Packs:</strong> ${escapeHtml(packsNeeded)}</p>`);
    }

    // Total Litre (if different from quantity_litre)
    const totalLitre = getValue('total_litre');
    const surplusLitre = getValue('surplus_litre');
    if (totalLitre && quantityLitre && parseFloat(totalLitre) > parseFloat(quantityLitre)) {
        const surplusText = surplusLitre ? ` (${escapeHtml(surplusLitre)}L surplus)` : '';
        lines.push(`<p class="mb-1 text-muted small"><strong>Total Volume:</strong> ${escapeHtml(totalLitre)}L${surplusText}</p>`);
    }

    const content = lines.join('') || '<p class="text-muted mb-0">No additional details available.</p>';
    console.log('renderChemicalMaintenanceDetails: final content =', content);
    detailsEl.innerHTML = content;
}

function updateProductDetails(item, data) {
    const type = data.type || item.getAttribute('data-type');
    if (type === 'blanket') {
        renderBlanketDetails(item, data);
    } else if (type === 'mpack') {
        renderMPackDetails(item, data);
    } else if (type === 'chemical' || type === 'maintenance') {
        renderChemicalMaintenanceDetails(item, data);
    }
}

function updateItemDisplay(item, data) {
    if (!item || !data) return;

    const type = data.type || item.getAttribute('data-type');
    if (!data.type && type) {
        data.type = type;
    }

    // Initialize variables to avoid reference errors
    let discountAmount = 0;
    let discountPercent = 0;
    let quantity = 1;
    let gstAmount = 0;
    let total = 0;

    // Update the data attributes with the latest values
    if (type === 'blanket') {
        item.dataset.basePrice = data.base_price || 0;
        item.dataset.barPrice = data.bar_price || 0;
        item.dataset.quantity = data.quantity || 1;
        item.dataset.discountPercent = data.discount_percent || 0;
        item.dataset.gstPercent = data.gst_percent || 18;
    } else if (type === 'mpack') {
        item.dataset.unitPrice = data.unit_price || 0;
        item.dataset.quantity = data.quantity || 1;
        item.dataset.discountPercent = data.discount_percent || 0;
        item.dataset.gstPercent = data.gst_percent || 18;
    } else if (type === 'chemical' || type === 'maintenance') {
        const litres = data.quantity_litre ?? data.quantity;
        const pricePerLitre = data.price_per_litre ?? data.unit_price;
        item.dataset.unitPrice = pricePerLitre || 0;
        item.dataset.pricePerLitre = pricePerLitre || 0;
        item.dataset.quantity = litres || 0;
        item.dataset.quantityLitre = litres || 0;
        item.dataset.discountPercent = data.discount_percent || 0;
        item.dataset.gstPercent = data.gst_percent || 18;
    } else if (type === 'creasing_matrix') {
        const quantity = data.quantity ?? data.quantity_rolls ?? 1;
        item.dataset.unitPrice = data.unit_price || 0;
        item.dataset.quantity = quantity;
        item.dataset.quantityRolls = data.quantity_rolls ?? quantity;
        item.dataset.discountPercent = data.discount_percent || 0;
        item.dataset.gstPercent = data.gst_percent || 18;
    } else if (type === 'litho_perforation') {
        const quantity = data.quantity ?? data.packets ?? 1;
        item.dataset.unitPrice = data.unit_price || 0;
        item.dataset.quantity = quantity;
        item.dataset.packets = data.packets ?? quantity;
        item.dataset.discountPercent = data.discount_percent || 0;
        item.dataset.gstPercent = data.gst_percent || 18;
    }

    // Sync additional metadata used in the descriptive section
    const metadataFields = [
        'machine',
        'thickness',
        'length',
        'width',
        'bar_type',
        'size',
        'underpacking_type',
        'custom_length_mm',
        'custom_width_mm',
        'standard_length_mm',
        'standard_width_mm',
        'display_length_mm',
        'display_width_mm',
        'display_size_label',
        'cut_to_custom_size',
        'rate_per_sqmt',
        'category',
        'format_label',
        'pack_size_litre',
        'quantity_litre',
        'packs_needed',
        'total_litre',
        'surplus_litre',
        'tpi',
        'brand',
        'brand_id',
        'rule_type',
        'rule_type_id',
        'product_code',
        'packets'
    ];

    metadataFields.forEach(field => {
        const attrName = `data-${field.replace(/_/g, '-')}`;

        if (Object.prototype.hasOwnProperty.call(data, field)) {
            const value = data[field];
            if (value !== undefined && value !== null && value !== '') {
                item.setAttribute(attrName, value);
            }
        } else {
            const existingValue = item.getAttribute(attrName);
            if (existingValue !== null && existingValue !== '') {
                data[field] = existingValue;
            }
        }
    });

    // Sync name attribute for downstream lookups and headings
    if (data.name) {
        setDataAttribute(item, 'data-name', data.name);
        const titleEl = item.querySelector('.product-title');
        if (titleEl) {
            titleEl.textContent = data.name;
        }
    }

    // Update the quantity input
    const quantityInput = item.querySelector('.quantity-input');
    if (quantityInput) {
        const isChemical = type === 'chemical' || type === 'maintenance';
        const qtyValue = isChemical ? (data.quantity_litre ?? data.quantity ?? 0) : (data.quantity ?? 1);
        quantityInput.value = isChemical
            ? parseFloat(qtyValue).toFixed(2).replace(/\.00$/, '')
            : qtyValue;
    }

    // Update discount input if present
    const discountInput = item.querySelector('.discount-input');
    if (discountInput && Object.prototype.hasOwnProperty.call(data, 'discount_percent')) {
        const discountValue = Number(data.discount_percent || 0);
        discountInput.value = discountValue % 1 === 0 ? discountValue : discountValue.toFixed(1);
    }

    updateProductDetails(item, data);

    // Update the price displays
    if (type === 'blanket') {
        // Get dimensions and rates from data or fall back to item attributes
        const length = parseFloat(data.length || item.getAttribute('data-length') || 0) / 1000; // Convert mm to m
        const width = parseFloat(data.width || item.getAttribute('data-width') || 0) / 1000; // Convert mm to m
        const areaSqM = length * width;
        const ratePerSqMt = parseFloat(data.rate_per_sqmt || item.getAttribute('data-rate-per-sqmt') || 0);
        
        // Calculate all required values
        const basePrice = parseFloat(data.base_price || (areaSqM * ratePerSqMt));
        const barPrice = parseFloat(data.bar_price || item.getAttribute('data-bar-price') || 0);
        const unitPrice = basePrice; // Unit price is just the base price without bar price
        const netPricePerPiece = basePrice + barPrice; // Total price per piece including bar price
        const quantity = parseInt(data.quantity || 1);
        const subtotal = netPricePerPiece * quantity;
        discountPercent = parseFloat(data.discount_percent || item.getAttribute('data-discount-percent') || 0);
        discountAmount = (subtotal * discountPercent) / 100;
        const totalBeforeGst = subtotal - discountAmount;
        const gstPercent = parseFloat(data.gst_percent || item.getAttribute('data-gst-percent') || 18);
        const gstAmount = (totalBeforeGst * gstPercent) / 100;
        const total = totalBeforeGst + gstAmount;
        
        // Update unit price display (show only the base price)
        const unitPriceElement = item.querySelector('.unit-price');
        const unitPriceInput = item.querySelector('.unit-price-value');
        if (unitPriceElement && unitPriceInput) {
            unitPriceElement.textContent = `₹${basePrice.toFixed(2)}`;
            unitPriceInput.value = basePrice.toFixed(2);
        }
        
        // Update bar price display
        const barPriceElement = item.querySelector('.bar-price');
        const barPriceInput = item.querySelector('.bar-price-value');
        if (barPriceElement && barPriceInput) {
            barPriceElement.textContent = `+₹${barPrice.toFixed(2)}`;
            barPriceInput.value = barPrice.toFixed(2);
        }
        
        // Update net price per piece (base + bar price)
        const netPriceElement = item.querySelector('.net-price');
        if (netPriceElement) {
            netPriceElement.textContent = `₹${netPricePerPiece.toFixed(2)} (Base: ₹${basePrice.toFixed(2)} + Bar: ₹${barPrice.toFixed(2)})`;
        }
        
        // Update quantity display
        const quantityDisplayElement = item.querySelector('.quantity-display');
        if (quantityDisplayElement) {
            quantityDisplayElement.textContent = quantity;
        }
        
        // Update subtotal (net price × quantity)
        const subtotalDisplayElements = item.querySelectorAll('.subtotal, .subtotal-value');
        subtotalDisplayElements.forEach(element => {
            element.textContent = `₹${subtotal.toFixed(2)}`;
        });
        
        // Also update any hidden inputs that might store the subtotal
        const subtotalInputElements = item.querySelectorAll('input[type="hidden"][name$="_subtotal"]');
        subtotalInputElements.forEach(input => {
            input.value = subtotal.toFixed(2);
        });
        
        // Update discount amount and after discount value
        const discountDisplayElement = item.querySelector('.discount-amount');
        if (discountDisplayElement) {
            discountDisplayElement.textContent = `-₹${discountAmount.toFixed(2)}`;
        }
        
        // Update after discount value
        const afterDiscountElement = item.querySelector('.after-discount-amount');
        if (afterDiscountElement) {
            afterDiscountElement.textContent = `₹${(subtotal - discountAmount).toFixed(2)}`;
        }
        
        // Update total before GST
        const totalBeforeGstElement = item.querySelector('.total-before-gst, .pre-gst-total .pre-gst-amount');
        if (totalBeforeGstElement) {
            totalBeforeGstElement.textContent = `₹${totalBeforeGst.toFixed(2)}`;
            // Also update any other elements that might be showing the pre-GST total
            const preGstElements = item.querySelectorAll('.pre-gst-total .pre-gst-amount, .total-before-gst');
            preGstElements.forEach(el => {
                el.textContent = `₹${totalBeforeGst.toFixed(2)}`;
            });
        }
        
        // Update GST
        const gstElement = item.querySelector('.gst-amount');
        if (gstElement) {
            gstElement.textContent = `₹${gstAmount.toFixed(2)}`;
        }
        
        // Update total
        const totalElement = item.querySelector('.total-amount') || item.querySelector('.item-total') || item.querySelector('.total-value');
        if (totalElement) {
            totalElement.textContent = `₹${total.toFixed(2)}`;
        }
        
        // Update hidden inputs
        const hiddenGstInput = item.querySelector('input[name$="_gst_amount"]');
        if (hiddenGstInput) {
            hiddenGstInput.value = gstAmount.toFixed(2);
        }
        
        const hiddenTotalInput = item.querySelector('input[name$="_total"]');
        if (hiddenTotalInput) {
            hiddenTotalInput.value = total.toFixed(2);
        }
    } else if (type === 'mpack') {
        // Initialize variables at function scope
        let unitPrice, quantity, subtotal, discountPercent, discountAmount, totalBeforeGst, gstPercent;
        
        try {
            // Handle mpack items
            unitPrice = parseFloat(data.unit_price || item.getAttribute('data-unit-price') || 0);
            quantity = parseInt(data.quantity || 1);
            subtotal = unitPrice * quantity;
            discountPercent = parseFloat(data.discount_percent || item.getAttribute('data-discount-percent') || 0);
            discountAmount = (subtotal * discountPercent) / 100;
            totalBeforeGst = subtotal - discountAmount;
            gstPercent = parseFloat(data.gst_percent || item.getAttribute('data-gst-percent') || 12);
            gstAmount = (totalBeforeGst * gstPercent) / 100;
            total = totalBeforeGst + gstAmount;
            
            // Update all item data attributes from the data object
            const dataAttributes = {
                'data-unit-price': unitPrice,
                'data-quantity': quantity,
                'data-discount-percent': discountPercent,
                'data-gst-percent': gstPercent,
                'data-thickness': data.thickness || item.getAttribute('data-thickness'),
                'data-size': data.size || item.getAttribute('data-size'),
                'data-display-size-label': data.display_size_label || item.getAttribute('data-display-size-label'),
                'data-machine': data.machine || item.getAttribute('data-machine'),
                'data-type': data.type || item.getAttribute('data-type'),
                'data-name': data.name || item.getAttribute('data-name'),
                'data-display-length-mm': data.display_length_mm || item.getAttribute('data-display-length-mm'),
                'data-display-width-mm': data.display_width_mm || item.getAttribute('data-display-width-mm')
            };
            
            // Set all data attributes on the item
            Object.entries(dataAttributes).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    item.setAttribute(key, value);
                }
            });
            
            // Debug logging
            console.log('MPack update:', { 
                unitPrice, 
                quantity, 
                subtotal, 
                discountPercent, 
                discountAmount, 
                totalBeforeGst, 
                gstPercent, 
                gstAmount, 
                total,
                dataAttributes
            });
            
            // Update all display elements with the latest data
            const updateElement = (selector, value, suffix = '') => {
                const elements = item.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el) el.textContent = value + (suffix ? ` ${suffix}` : '');
                });
            };

            // Update all price displays
            const updatePriceElement = (selector, value, prefix = '₹') => {
                const elements = item.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el) el.textContent = `${prefix}${value.toFixed(2)}`;
                });
            };

            // Update thickness display
            const thickness = data.thickness || item.getAttribute('data-thickness');
            if (thickness) {
                updateElement('.thickness-value, .item-thickness', thickness, 'micron');
            }
            
            // Update size display
            const sizeLabel = data.display_size_label || data.size || item.getAttribute('data-display-size-label') || item.getAttribute('data-size');
            if (sizeLabel) {
                // Update the data attributes
                item.setAttribute('data-size', sizeLabel);
                item.setAttribute('data-display-size-label', sizeLabel);
                
                // Update all size displays in the item
                const sizeDisplays = item.querySelectorAll('.size-value, .mpack-size, .item-size, .size-display .size-value');
                sizeDisplays.forEach(display => {
                    if (display.classList.contains('size-display')) {
                        // If it's the container, update the span inside it
                        const span = display.querySelector('span.size-value');
                        if (span) span.textContent = sizeLabel;
                    } else {
                        // Direct update for other elements
                        display.textContent = sizeLabel;
                    }
                });
                console.log('Updated size display to:', sizeLabel);
            }
            
            // Update machine display
            const machine = data.machine || item.getAttribute('data-machine');
            if (machine) {
                updateElement('.machine-value, .item-machine', machine);
            }
            
            // Update type display
            const type = data.type || item.getAttribute('data-type');
            if (type) {
                updateElement('.type-value, .item-type', type);
            }
            
            // Update quantity display
            updateElement('.quantity-display, .item-quantity', quantity);
            
            // Update price displays
            updatePriceElement('.unit-price, .item-unit-price', unitPrice);
            
            // Explicitly update subtotal elements to ensure they're updated
            const subtotalElements = item.querySelectorAll('.subtotal, .item-subtotal, .subtotal-value');
            subtotalElements.forEach(el => {
                el.textContent = `₹${subtotal.toFixed(2)}`;
            });
            
            // Also update any hidden inputs that might store the subtotal
            const subtotalInputElements = item.querySelectorAll('input[type="hidden"][name$="_subtotal"]');
            subtotalInputElements.forEach(input => {
                input.value = subtotal.toFixed(2);
            });
            
            updatePriceElement('.discount-amount, .item-discount', discountAmount);
            updatePriceElement('.total-before-gst, .pre-gst-total .pre-gst-amount, .item-total-before-gst', totalBeforeGst);
            updatePriceElement('.gst-amount, .item-gst', gstAmount);
            updatePriceElement('.total-amount, .item-total, .total-value', total);
            
            // Update hidden inputs
            const hiddenGstInput = item.querySelector('input[name$="_gst_amount"]');
            if (hiddenGstInput) {
                hiddenGstInput.value = gstAmount.toFixed(2);
            }
            
            const hiddenTotalInput = item.querySelector('input[name$="_total"]');
            if (hiddenTotalInput) {
                hiddenTotalInput.value = total.toFixed(2);
            }
            
            // Debug log the final state
            console.log('Updated MPack item display:', {
                unitPrice,
                quantity,
                subtotal,
                discountAmount,
                totalBeforeGst,
                gstAmount,
                total,
                size: sizeLabel,
                thickness,
                machine,
                type
            });
            
            // Update discount row if it exists
            const discountRow = item.querySelector('.discount-row');
            if (discountRow) {
                if (discountPercent > 0) {
                    discountRow.style.display = 'flex';
                    const discountAmountElement = discountRow.querySelector('.discount-amount') || 
                                               discountRow.querySelector('.discount-value') ||
                                               discountRow.querySelector('span:last-child');
                    if (discountAmountElement) {
                        discountAmountElement.textContent = `-₹${discountAmount.toFixed(2)}`;
                    }
                    
                    // Update after discount value for MPack items
                    const afterDiscountElement = item.querySelector('.after-discount-amount');
                    if (afterDiscountElement) {
                        afterDiscountElement.textContent = `₹${(subtotal - discountAmount).toFixed(2)}`;
                    }
                    
                    const discountPercentElement = discountRow.querySelector('.discount-percent');
                    if (discountPercentElement) {
                        discountPercentElement.textContent = `${discountPercent}%`;
                    }
                } else {
                    discountRow.style.display = 'none';
                    
                    // Reset after discount value when no discount
                    const afterDiscountElement = item.querySelector('.after-discount-amount');
                    if (afterDiscountElement) {
                        afterDiscountElement.textContent = `₹${subtotal.toFixed(2)}`;
                    }
                }
            }
            
            // Update cart totals after item updates
            updateCartTotals();
        } catch (error) {
            console.error('Error updating MPack item display:', error);
            showToast('Error', 'Failed to update MPack item. Please refresh the page.', 'error');
            return; // Exit the function if there's an error
        }
        
        // Update GST row if it exists
        const gstRow = item.querySelector('.gst-row');
        if (gstRow) {
            const gstAmountElement = gstRow.querySelector('.gst-amount') || 
                                   gstRow.querySelector('span:last-child');
            if (gstAmountElement) {
                gstAmountElement.textContent = `₹${gstAmount.toFixed(2)}`;
            }
            const gstPercentElement = gstRow.querySelector('.gst-percent');
            if (gstPercentElement) {
                gstPercentElement.textContent = `${gstPercent}%`;
            }
        }
        
        // Update pre-GST total
        const preGstTotalElement = item.querySelector('.pre-gst-total .pre-gst-amount');
        if (preGstTotalElement) {
            preGstTotalElement.textContent = `₹${totalBeforeGst.toFixed(2)}`;
        }
    } else if (type === 'rule') {
        const toPositiveNumber = (value, fallback = 0) => {
            const num = toNumber(value);
            return num === null || !Number.isFinite(num) ? fallback : num;
        };

        let lengthPerUnit = toPositiveNumber(data.length_per_unit_m ?? item.getAttribute('data-length-per-unit-m'), 100);
        let ratePerMeter = toPositiveNumber(data.rate_per_meter ?? item.getAttribute('data-rate-per-meter'), 21);
        let unitPrice = toPositiveNumber(data.unit_price ?? item.getAttribute('data-unit-price'), lengthPerUnit * ratePerMeter);
        let quantity = toPositiveNumber(data.quantity ?? item.getAttribute('data-quantity'), 1);
        quantity = Math.max(1, Math.round(quantity));
        let discountPercent = toPositiveNumber(data.discount_percent ?? item.getAttribute('data-discount-percent'), 0);
        if (discountPercent < 0) discountPercent = 0;
        if (discountPercent > 100) discountPercent = 100;
        let gstPercent = toPositiveNumber(data.gst_percent ?? item.getAttribute('data-gst-percent'), 18);
        if (gstPercent < 0) gstPercent = 0;

        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
            unitPrice = lengthPerUnit * ratePerMeter;
        }

        const subtotal = unitPrice * quantity;
        const discountAmount = subtotal * (discountPercent / 100);
        const discountedSubtotal = subtotal - discountAmount;
        const gstAmount = (discountedSubtotal * gstPercent) / 100;
        const total = discountedSubtotal + gstAmount;
        const totalLength = lengthPerUnit * quantity;

        // Persist updated metadata on the DOM element
        item.dataset.unitPrice = unitPrice.toFixed(2);
        item.dataset.quantity = quantity.toString();
        item.dataset.discountPercent = discountPercent.toString();
        item.dataset.gstPercent = gstPercent.toString();
        item.dataset.lengthPerUnitM = lengthPerUnit.toString();
        item.dataset.ratePerMeter = ratePerMeter.toString();
        item.dataset.totalLengthM = totalLength.toFixed(2);

        const quantityInput = item.querySelector('.quantity-input');
        if (quantityInput) {
            quantityInput.value = quantity;
        }

        const setText = (selector, value) => {
            const el = item.querySelector(selector);
            if (el) {
                el.textContent = value;
            }
        };

        const formatCurrencyValue = amount => `₹${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;

        item.querySelectorAll('.quantity-display, .item-quantity').forEach(el => {
            el.textContent = quantity;
        });

        setText('.rule-pack-length', formatNumber(lengthPerUnit, 0));
        setText('.rule-rate-per-meter', formatNumber(ratePerMeter, 2));
        setText('.rule-total-length', formatNumber(totalLength, 0));

        item.querySelectorAll('.unit-price, .item-unit-price').forEach(el => {
            el.textContent = formatCurrencyValue(unitPrice);
        });

        item.querySelectorAll('.subtotal, .item-subtotal, .subtotal-value').forEach(el => {
            el.textContent = formatCurrencyValue(subtotal);
        });

        const discountElements = item.querySelectorAll('.discount-amount, .item-discount');
        discountElements.forEach(el => {
            el.textContent = `-₹${discountAmount.toFixed(2)}`;
        });

        const preGstElements = item.querySelectorAll('.total-before-gst, .pre-gst-total .pre-gst-amount, .item-total-before-gst');
        preGstElements.forEach(el => {
            el.textContent = formatCurrencyValue(discountedSubtotal);
        });

        item.querySelectorAll('.gst-amount, .item-gst').forEach(el => {
            el.textContent = formatCurrencyValue(gstAmount);
        });

        item.querySelectorAll('.total-amount, .item-total, .total-value').forEach(el => {
            el.textContent = formatCurrencyValue(total);
        });

        const gstPercentElement = item.querySelector('.gst-percent');
        if (gstPercentElement) {
            gstPercentElement.textContent = `${gstPercent}`;
        }

        const discountRow = item.querySelector('.discount-row');
        if (discountRow) {
            discountRow.style.display = discountPercent > 0 ? 'flex' : 'flex';
            const discountPercentDisplay = discountRow.querySelector('.discount-percent');
            if (discountPercentDisplay) {
                discountPercentDisplay.textContent = `${discountPercent}%`;
            }
        }

        const totalLengthNote = item.querySelector('.rule-total-length');
        if (totalLengthNote) {
            totalLengthNote.textContent = formatNumber(totalLength, 0);
        }

        const packLengthEl = item.querySelector('.rule-pack-length');
        if (packLengthEl) {
            packLengthEl.textContent = formatNumber(lengthPerUnit, 0);
        }

        const ratePerMeterEl = item.querySelector('.rule-rate-per-meter');
        if (ratePerMeterEl) {
            ratePerMeterEl.textContent = formatNumber(ratePerMeter, 2);
        }

        const hiddenGstInput = item.querySelector('input[name$="_gst_amount"]');
        if (hiddenGstInput) {
            hiddenGstInput.value = gstAmount.toFixed(2);
        }

        const hiddenTotalInput = item.querySelector('input[name$="_total"]');
        if (hiddenTotalInput) {
            hiddenTotalInput.value = total.toFixed(2);
        }

        const totalBeforeGstElement = item.querySelector('.pre-gst-total .pre-gst-amount');
        if (totalBeforeGstElement) {
            totalBeforeGstElement.textContent = formatCurrencyValue(discountedSubtotal);
        }
    } else if (type === 'chemical' || type === 'maintenance') {
        // Handle chemical items with litre-based pricing
        const rawPricePerLitre = data.price_per_litre ?? data.unit_price ??
            item.getAttribute('data-price-per-litre') ?? item.getAttribute('data-unit-price');
        const rawQuantityLitre = data.quantity_litre ?? data.quantity ??
            item.getAttribute('data-quantity-litre') ?? item.getAttribute('data-quantity');
        const rawDiscountPercent = data.discount_percent ?? item.getAttribute('data-discount-percent');
        const rawGstPercent = data.gst_percent ?? item.getAttribute('data-gst-percent');

        let pricePerLitre = toNumber(rawPricePerLitre) ?? 0;
        let quantityLitres = toNumber(rawQuantityLitre) ?? 0;
        let discountPercent = toNumber(rawDiscountPercent) ?? 0;
        let gstPercent = toNumber(rawGstPercent) ?? 18;

        if (!Number.isFinite(pricePerLitre) || pricePerLitre < 0) pricePerLitre = 0;
        if (!Number.isFinite(quantityLitres) || quantityLitres < 0) quantityLitres = 0;
        if (!Number.isFinite(discountPercent) || discountPercent < 0) discountPercent = 0;
        if (!Number.isFinite(gstPercent) || gstPercent < 0) gstPercent = 0;

        const subtotal = pricePerLitre * quantityLitres;
        const discountAmount = subtotal * (discountPercent / 100);
        const discountedSubtotal = subtotal - discountAmount;
        const gstAmount = discountedSubtotal * (gstPercent / 100);
        const total = discountedSubtotal + gstAmount;

        // Persist key attributes back on the DOM node
        item.dataset.unitPrice = pricePerLitre.toString();
        item.dataset.pricePerLitre = pricePerLitre.toString();
        item.dataset.quantity = quantityLitres.toString();
        item.dataset.quantityLitre = quantityLitres.toString();
        item.dataset.discountPercent = discountPercent.toString();
        item.dataset.gstPercent = gstPercent.toString();

        // Update quantity input for litre precision
        const quantityInput = item.querySelector('.quantity-input');
        if (quantityInput) {
            quantityInput.value = quantityLitres > 0
                ? quantityLitres.toFixed(2).replace(/\.00$/, '')
                : '0';
        }

        // Update discount input if present
        const discountInput = item.querySelector('.discount-input');
        if (discountInput && Object.prototype.hasOwnProperty.call(data, 'discount_percent')) {
            discountInput.value = discountPercent % 1 === 0
                ? discountPercent
                : discountPercent.toFixed(1);
        }

        // Refresh quantity displays
        const quantityDisplays = item.querySelectorAll('.quantity-display, .item-quantity');
        const quantityLabel = quantityLitres > 0 ? `${formatNumber(quantityLitres, 2)} L` : '0 L';
        quantityDisplays.forEach(el => {
            el.textContent = quantityLabel;
        });

        // Helper to update monetary values consistently
        const applyPrice = (selector, value, prefix = '₹') => {
            const amount = Number.isFinite(value) ? value : 0;
            item.querySelectorAll(selector).forEach(el => {
                el.textContent = `${prefix}${amount.toFixed(2)}`;
            });
        };

        applyPrice('.unit-price, .item-unit-price', pricePerLitre);
        applyPrice('.subtotal, .item-subtotal, .subtotal-value', subtotal);
        applyPrice('.discount-amount, .item-discount', discountAmount, '-₹');
        applyPrice('.total-before-gst, .pre-gst-total .pre-gst-amount, .item-total-before-gst', discountedSubtotal);
        applyPrice('.gst-amount, .item-gst', gstAmount);
        applyPrice('.total-amount, .item-total, .total-value', total);

        // Update hidden inputs to stay in sync
        const hiddenGstInput = item.querySelector('input[name$="_gst_amount"]');
        if (hiddenGstInput) {
            hiddenGstInput.value = gstAmount.toFixed(2);
        }

        const hiddenTotalInput = item.querySelector('input[name$="_total"]');
        if (hiddenTotalInput) {
            hiddenTotalInput.value = total.toFixed(2);
        }
    } else if (type === 'creasing_matrix' || type === 'litho_perforation') {
        const rawUnitPrice = data.unit_price ?? item.getAttribute('data-unit-price');
        const rawQuantity = data.quantity ?? data.quantity_rolls ?? data.packets ?? item.getAttribute('data-quantity') ?? item.getAttribute('data-quantity-rolls') ?? item.getAttribute('data-packets');
        const rawDiscountPercent = data.discount_percent ?? item.getAttribute('data-discount-percent');
        const rawGstPercent = data.gst_percent ?? item.getAttribute('data-gst-percent');

        const unitPrice = Number(rawUnitPrice) || 0;
        const quantity = Math.max(1, Math.round(Number(rawQuantity) || 1));
        const discountPercent = Number(rawDiscountPercent) || 0;
        const gstPercent = Number(rawGstPercent) || 18;

        const subtotal = unitPrice * quantity;
        const discountAmount = subtotal * (discountPercent / 100);
        const discountedSubtotal = subtotal - discountAmount;
        const gstAmount = discountedSubtotal * (gstPercent / 100);
        const total = discountedSubtotal + gstAmount;

        item.dataset.unitPrice = unitPrice.toString();
        item.dataset.quantity = quantity.toString();
        if (type === 'creasing_matrix') {
            item.dataset.quantityRolls = quantity.toString();
        } else {
            item.dataset.packets = quantity.toString();
        }
        item.dataset.discountPercent = discountPercent.toString();
        item.dataset.gstPercent = gstPercent.toString();

        const quantityInput = item.querySelector('.quantity-input');
        if (quantityInput) {
            quantityInput.value = quantity;
        }

        if (discountInput && Object.prototype.hasOwnProperty.call(data, 'discount_percent')) {
            discountInput.value = discountPercent % 1 === 0 ? discountPercent : discountPercent.toFixed(1);
        }

        const applyPrice = (selector, value, prefix = '₹') => {
            const amount = Number.isFinite(value) ? value : 0;
            item.querySelectorAll(selector).forEach(el => {
                el.textContent = `${prefix}${amount.toFixed(2)}`;
            });
        };

        applyPrice('.unit-price, .item-unit-price', unitPrice);
        applyPrice('.subtotal, .item-subtotal, .subtotal-value', subtotal);
        applyPrice('.discount-amount, .item-discount', discountAmount, '-₹');
        applyPrice('.total-before-gst, .pre-gst-total .pre-gst-amount, .item-total-before-gst', discountedSubtotal);
        applyPrice('.gst-amount, .item-gst', gstAmount);
        applyPrice('.total-amount, .item-total, .total-value', total);

        const gstPercentElement = item.querySelector('.gst-percent');
        if (gstPercentElement) {
            gstPercentElement.textContent = `${gstPercent}`;
        }
    }
}
// End of file
