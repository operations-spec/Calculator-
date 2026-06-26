let sizeMetaMap = {};
let currentNetPrice = 0;
let currentDiscount = 0; // Track current discount percentage
let currentThickness = ''; // Track current thickness
let editingItem = null; // Track the item being edited
let customSize = { across: null, along: null, area: 0 };
let standardSize = { across: 0, along: 0, area: 0, label: '', rollLength: 0, usesHalfRoll: false, halfLength: 0 };
let currentRatePerSqm = 0;
let thicknessOptionsBySize = new Map();
let lengthsByWidthMap = new Map();
let widthsByLengthMap = new Map();
let allSizeCombos = [];
let uniqueWidths = [];
let uniqueLengths = [];
let uniqueThicknesses = [];

const BASE_RATE_PER_100_MICRON = 75; // ₹ per sq.m at 100 micron
// Standard MPack around sizes (full rolls)
const STANDARD_AROUND_SIZES = [795, 1150, 1240, 1320, 1540];
const STANDARD_AROUND_HALF_SIZES = STANDARD_AROUND_SIZES
  .map(size => size / 2)
  .filter(size => size > 0);
const FULL_ROLL_SIZES = [...STANDARD_AROUND_SIZES];
const DEFAULT_FULL_ROLL_SIZES = [...FULL_ROLL_SIZES];
const POLIPACK_STANDARD_ROLLS = [600, 1300];
const HALF_ROLL_SIZES = [...STANDARD_AROUND_HALF_SIZES];
const CANDIDATE_AROUND_SIZES = Array.from(
  new Set([...HALF_ROLL_SIZES, ...FULL_ROLL_SIZES])
).sort((a, b) => a - b);

// ----------------------- Polipack AA overrides -----------------------
const POLIPACK_AA_THICKNESSES = [100, 120, 140, 160, 180, 200, 230, 250, 280, 300, 350, 400, 420, 450, 500, 550, 600];
const POLIPACK_AA_BASE_RATE = 925; // ₹ per sq.m at 100 micron
const POLIPACK_WA_THICKNESSES = [100, 125, 150, 175, 200, 230, 250, 280, 300, 350, 400, 420, 450, 500, 550, 600];
const POLIPACK_WA_BASE_RATE = 425; // ₹ per sq.m at 100 micron

function isPolipackAASelected() {
  const underSel = document.getElementById('underpackingType');
  const fmtSel = document.getElementById('productFormatSelect');
  return underSel && fmtSel && underSel.value === 'polipack' && fmtSel.value === 'polipack_aa';
}
function isPolipackWASelected() {
  const underSel = document.getElementById('underpackingType');
  const fmtSel = document.getElementById('productFormatSelect');
  return underSel && fmtSel && underSel.value === 'polipack' && fmtSel.value === 'polipack_wa';
}

function getActivePolipackConfig() {
  if (isPolipackAASelected()) return { list: POLIPACK_AA_THICKNESSES, base: POLIPACK_AA_BASE_RATE };
  if (isPolipackWASelected()) return { list: POLIPACK_WA_THICKNESSES, base: POLIPACK_WA_BASE_RATE };
  return null;
}

function getActiveBaseRatePer100Micron() {
  const polCfg = getActivePolipackConfig();
  return polCfg ? polCfg.base : BASE_RATE_PER_100_MICRON;
}

function getPolipackFormatLabel() {
  const formatSelect = document.getElementById('productFormatSelect');
  const formatValue = formatSelect ? formatSelect.value : '';

  if (formatValue === 'polipack_aa') {
    return 'Self Adhesive';
  }
  if (formatValue === 'polipack_wa') {
    return 'Non Adhesive';
  }
  return '';
}

// --------------------------------------------------------------------

function resolveRollForLength(inputAround) {
  const polCfg = getActivePolipackConfig();
  if (polCfg) {
    if (!POLIPACK_STANDARD_ROLLS.length) {
      return { rollLength: 0, effectiveLength: 0, usesHalfRoll: false };
    }

    let fallbackRoll = POLIPACK_STANDARD_ROLLS[POLIPACK_STANDARD_ROLLS.length - 1];

    for (const rollLength of POLIPACK_STANDARD_ROLLS) {
      const halfLength = rollLength / 2;

      if (inputAround <= halfLength) {
        const closerToHalf = Math.abs(inputAround - halfLength) <= Math.abs(inputAround - rollLength);
        if (closerToHalf) {
          return {
            rollLength,
            effectiveLength: halfLength,
            usesHalfRoll: true
          };
        }
      }

      if (inputAround <= rollLength) {
        return {
          rollLength,
          effectiveLength: rollLength,
          usesHalfRoll: false
        };
      }

      fallbackRoll = rollLength;
    }

    return {
      rollLength: fallbackRoll,
      effectiveLength: fallbackRoll,
      usesHalfRoll: false
    };
  }

  const sizeCatalog = CANDIDATE_AROUND_SIZES;
  if (!sizeCatalog.length) {
    return {
      rollLength: 0,
      effectiveLength: 0,
      usesHalfRoll: false
    };
  }

  // Pick the first candidate (half or full) >= requested length
  let selectedCandidate = sizeCatalog[sizeCatalog.length - 1];
  for (const cand of sizeCatalog) {
    if (inputAround <= cand) {
      selectedCandidate = cand;
      break;
    }
  }

  const usesHalfRoll = HALF_ROLL_SIZES.includes(selectedCandidate);
  const rollLength = usesHalfRoll ? selectedCandidate * 2 : selectedCandidate;

  return {
    rollLength,
    effectiveLength: selectedCandidate,
    usesHalfRoll
  };
}

// Determine the roll or half-roll size that should be considered for pricing based on the
// user-entered around length. It always returns the smallest candidate size that is
// greater than or equal to the requested length.
function getStandardAroundSize(inputAround) {
  if (!isPositiveNumber(inputAround)) {
    return 0;
  }

  const { effectiveLength } = resolveRollForLength(inputAround);
  return effectiveLength;
}

function populateCutSizeDropdown(rollArray = FULL_ROLL_SIZES) {
  const cutSelect = document.getElementById('cutFromSizeSelect');
  if (!cutSelect) {
    return;
  }

  const previousValue = cutSelect.value;
  cutSelect.innerHTML = '<option value="">----</option>';

  rollArray.forEach(size => {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = `${size} mm`;
    cutSelect.appendChild(option);
  });

  if (previousValue && rollArray.includes(Number(previousValue))) {
    cutSelect.value = previousValue;
  }
}

let customLengthInputEl;
let customWidthInputEl;
let thicknessSelectEl;
let underpackingTypeOptionsEl;
let productFormatOptionsEl;
let underpackingTypePickerEl;
let productFormatPickerEl;
let customSizeSummaryEl;
let customSizeFeedbackEl;
let cutQuestionSectionEl;
let cutDetailsSectionEl;
let cutYesRadio;
let cutNoRadio;
let standardAreaDisplayEl;
let customAreaDisplayEl;
let cutStandardRowEl;
let cutCustomRowEl;
let cutDetailsNoteEl;
let manualWidthInputEl;
let manualLengthInputEl;
let manualSizeContainerEl;
let toggleManualSizeBtn;
let manualThicknessSelectEl;
let cutRollSummaryEl;
let manualInlineSummaryRowEl;
let manualInlineSizeSummaryEl;
let manualInlineDiscountSummaryEl;
let presetQuantityGroupEl;
let presetDiscountGroupEl;
let presetStandardColumnEl;
let presetThicknessGroupEl;
let manualThicknessGroupEl;

let manualOnlyNoticeEl;
let presetConfigRowEl;

let manualEntryEnabled = false;

function isPositiveNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value) && value > 0;
}

function mmToSqm(acrossMm, alongMm) {
  if (!isPositiveNumber(acrossMm) || !isPositiveNumber(alongMm)) {
    return 0;
  }
  return (acrossMm / 1000) * (alongMm / 1000);
}

function parseSizeLabel(label) {
  if (!label) return null;
  const match = label.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return {
    across: parseFloat(match[1]),
    along: parseFloat(match[2])
  };
}

const CUT_NOTE_STANDARD = 'Underpacking will be supplied in the selected size.';
const CUT_NOTE_CUSTOM = 'Underpacking will be cut to your entered size.';
const CUT_NOTE_WAITING = 'Select whether we should cut to your entered size.';

function formatDimensionValue(value) {
  if (!isPositiveNumber(value)) {
    return null;
  }
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatDimensionLabel(acrossMm, alongMm) {
  const formattedAcross = formatDimensionValue(acrossMm);
  const formattedAlong = formatDimensionValue(alongMm);
  if (!formattedAcross || !formattedAlong) {
    return '';
  }
  return `${formattedAcross} x ${formattedAlong} mm`;
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

function renderOptionBoxes(selectEl, containerEl, kind, pickerEl, { placeholder = 'No options available.', skipEmpty = true, disabledMessage = '' } = {}) {
  if (!containerEl) return;

  if (!selectEl || selectEl.disabled) {
    const message = disabledMessage || placeholder;
    containerEl.innerHTML = `<p class="chem-placeholder mb-0">${sanitizeOptionText(message)}</p>`;
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

function renderUnderpackingTypeOptions() {
  renderOptionBoxes(
    document.getElementById('underpackingType'),
    underpackingTypeOptionsEl,
    'underpacking',
    underpackingTypePickerEl,
    { placeholder: 'Choose an underpacking type to begin.' }
  );
}

function renderProductFormatOptions() {
  renderOptionBoxes(
    document.getElementById('productFormatSelect'),
    productFormatOptionsEl,
    'format',
    productFormatPickerEl,
    { placeholder: 'Select Polipack to choose a format.' }
  );
}

function resetSizePickers() {
  if (customWidthInputEl) customWidthInputEl.value = '';
  if (customLengthInputEl) customLengthInputEl.value = '';
  if (thicknessSelectEl) thicknessSelectEl.value = '';
  if (manualThicknessSelectEl) manualThicknessSelectEl.value = '';
}

function initMpackPickers() {
  bindPickerSelect(document.getElementById('underpackingType'), underpackingTypePickerEl);
  bindPickerSelect(document.getElementById('productFormatSelect'), productFormatPickerEl);
}

function populateSelectOptions(selectEl, values = [], placeholder = '-- Select --') {
  if (!selectEl) return;

  const currentValue = selectEl.value;
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;

  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });

  if (currentValue && values.map(String).includes(String(currentValue))) {
    selectEl.value = currentValue;
  }
}

function populateCustomDropdowns({ widths = [], lengths = [] } = {}) {
  if (!manualEntryEnabled) {
    populateSelectOptions(customWidthInputEl, widths.map(String), '-- Select Across --');
    populateSelectOptions(customLengthInputEl, lengths.map(String), '-- Select Around --');
  }
}

function handleSizeSelection() {
  const sizeSelectEl = document.getElementById('sizeSelect');
  if (!sizeSelectEl) return;

  const selectedValue = (sizeSelectEl.value || '').trim();
  const selectedOption = sizeSelectEl.options && sizeSelectEl.selectedIndex >= 0
    ? sizeSelectEl.options[sizeSelectEl.selectedIndex]
    : null;

  if (!selectedValue) {
    standardSize = { across: 0, along: 0, area: 0, label: '', rollLength: 0, usesHalfRoll: false, halfLength: 0 };
    updatePricingFromSelections();
    return;
  }

  const meta = sizeMetaMap[selectedValue] || parseSizeLabel(selectedOption ? selectedOption.text : '') || null;
  const along = meta && typeof meta.length === 'number' ? meta.length : (meta && typeof meta.along === 'number' ? meta.along : 0);
  const across = meta && typeof meta.width === 'number' ? meta.width : (meta && typeof meta.across === 'number' ? meta.across : 0);
  const area = mmToSqm(across, along);
  const label = formatDimensionLabel(across, along);

  // Sync customSize too so other flows (manual summary/payload) always have consistent values.
  customSize.across = across || null;
  customSize.along = along || null;
  customSize.area = area || 0;

  standardSize = {
    across,
    along,
    area,
    label,
    rollLength: along,
    usesHalfRoll: false,
    halfLength: along ? along / 2 : 0
  };

  updatePricingFromSelections();
}

function updateLengthOptionsForWidth(widthValue) {
  if (manualEntryEnabled) return;
  if (!customLengthInputEl) return;
  const sanitizedWidth = String(widthValue || '').trim();
  if (!sanitizedWidth) {
    populateSelectOptions(customLengthInputEl, uniqueLengths.map(String), '-- Select Around --');
    return;
  }

  const lengths = lengthsByWidthMap.get(sanitizedWidth) || [];
  populateSelectOptions(customLengthInputEl, lengths.map(String), '-- Select Around --');
}

function updateWidthOptionsForLength(lengthValue) {
  if (manualEntryEnabled) return;
  if (!customWidthInputEl) return;
  const sanitizedLength = String(lengthValue || '').trim();
  if (!sanitizedLength) {
    populateSelectOptions(customWidthInputEl, uniqueWidths.map(String), '-- Select Across --');
    return;
  }

  const widths = widthsByLengthMap.get(sanitizedLength) || [];
  populateSelectOptions(customWidthInputEl, widths.map(String), '-- Select Across --');
}

function hasValidCustomSize() {
  return isPositiveNumber(customSize.across) && isPositiveNumber(customSize.along);
}

function hideCuttingSections() {
  if (cutQuestionSectionEl) {
    cutQuestionSectionEl.style.display = 'none';
  }
  if (cutDetailsSectionEl) {
    cutDetailsSectionEl.style.display = 'none';
  }
  if (cutYesRadio) {
    cutYesRadio.checked = false;
  }
  if (cutNoRadio) {
    cutNoRadio.checked = false;
  }
  if (standardAreaDisplayEl) {
    standardAreaDisplayEl.textContent = '0.000';
  }
  if (customAreaDisplayEl) {
    customAreaDisplayEl.textContent = '0.000';
  }
  if (cutStandardRowEl) {
    cutStandardRowEl.style.display = 'none';
  }
  if (cutCustomRowEl) {
    cutCustomRowEl.style.display = 'none';
  }
  if (cutDetailsNoteEl) {
    cutDetailsNoteEl.textContent = CUT_NOTE_WAITING;
  }
}

function updateManualInlineSummary({ show = false } = {}) {
  if (!manualInlineSummaryRowEl || !manualInlineSizeSummaryEl || !manualInlineDiscountSummaryEl) {
    return;
  }

  if (!manualEntryEnabled) {
    manualInlineSummaryRowEl.classList.add('d-none');
    manualInlineSizeSummaryEl.textContent = 'Enter measurements to see sq.m.';
    manualInlineDiscountSummaryEl.textContent = '';
    manualInlineDiscountSummaryEl.classList.add('d-none');
    if (manualDetailsRowEl) {
      manualDetailsRowEl.classList.add('d-none');
    }
    relocateManualControlGroups('preset');
    return;
  }

  if (manualDetailsRowEl) {
    manualDetailsRowEl.classList.remove('d-none');
  }

  if (!show) {
    manualInlineSummaryRowEl.classList.remove('d-none');
    manualInlineSizeSummaryEl.textContent = 'Enter measurements to see sq.m.';
    manualInlineDiscountSummaryEl.textContent = '';
    manualInlineDiscountSummaryEl.classList.add('d-none');
    return;
  }

  const hasSize = hasValidCustomSize();
  if (hasSize) {
    const acrossLabel = formatDimensionValue(customSize.across) || customSize.across?.toFixed?.(0) || '';
    const alongLabel = formatDimensionValue(customSize.along) || customSize.along?.toFixed?.(0) || '';
    const areaLabel = isPositiveNumber(customSize.area) ? customSize.area.toFixed(3) : '0.000';
    manualInlineSizeSummaryEl.textContent = `Manual size: ${acrossLabel} × ${alongLabel} mm · ${areaLabel} sq.m`;
  } else {
    manualInlineSizeSummaryEl.textContent = 'Enter measurements to see sq.m.';
  }

  manualInlineDiscountSummaryEl.textContent = '';
  manualInlineDiscountSummaryEl.classList.add('d-none');
  manualInlineSummaryRowEl.classList.remove('d-none');
}

function relocateManualControlGroups(target) {
  if (!presetPrimaryColumnEl) return;
  if (!presetQuantityGroupEl || !presetDiscountGroupEl) return;

  presetPrimaryColumnEl.appendChild(presetQuantityGroupEl);
  presetPrimaryColumnEl.appendChild(presetDiscountGroupEl);
}

function updateManualDiscountSummary() {
  if (!manualInlineDiscountSummaryEl) return;

  manualInlineDiscountSummaryEl.classList.add('d-none');
  manualInlineDiscountSummaryEl.textContent = '';
}

function showCutQuestion(resetRadios = true) {
  if (cutQuestionSectionEl) {
    cutQuestionSectionEl.style.display = 'block';
  }
  if (resetRadios) {
    if (cutYesRadio) cutYesRadio.checked = false;
    if (cutNoRadio) cutNoRadio.checked = false;
    if (cutDetailsSectionEl) cutDetailsSectionEl.style.display = 'none';
    if (cutDetailsNoteEl) cutDetailsNoteEl.textContent = CUT_NOTE_WAITING;
    if (cutCustomRowEl) cutCustomRowEl.style.display = 'none';
  } else if (cutYesRadio && cutYesRadio.checked) {
    updateCutDetails();
  }
}

function updateCutDetails() {
  if (!cutDetailsSectionEl) {
    return;
  }

  const hasCustom = hasValidCustomSize();

  if (!hasCustom) {
    hideCuttingSections();
    return;
  }

  const customArea = customSize.area || mmToSqm(customSize.across, customSize.along);
  customSize.area = customArea;

  if (standardAreaDisplayEl) {
    standardAreaDisplayEl.textContent = customArea.toFixed(3);
  }

  if (cutStandardRowEl) {
    cutStandardRowEl.style.display = 'flex';
  }

  const shouldShowCustomRow = Boolean(cutYesRadio && cutYesRadio.checked);

  if (customAreaDisplayEl) {
    customAreaDisplayEl.textContent = customArea.toFixed(3);
  }

  if (cutCustomRowEl) {
    cutCustomRowEl.style.display = shouldShowCustomRow ? 'flex' : 'none';
  }

  if (cutDetailsNoteEl) {
    cutDetailsNoteEl.textContent = shouldShowCustomRow ? CUT_NOTE_CUSTOM : CUT_NOTE_STANDARD;
  }

  cutDetailsSectionEl.style.display = 'block';
}

function getActiveSizeValues() {
  if (manualEntryEnabled && manualWidthInputEl && manualLengthInputEl) {
    return {
      across: parseFloat(manualWidthInputEl.value || ''),
      along: parseFloat(manualLengthInputEl.value || ''),
      source: 'manual'
    };
  }

  const rawLength = customLengthInputEl ? customLengthInputEl.value : '';
  const rawWidth = customWidthInputEl ? customWidthInputEl.value : '';
  return {
    across: parseFloat(rawWidth || ''),
    along: parseFloat(rawLength || ''),
    source: 'preset'
  };
}

function updateCustomSizeState({ showFeedback = false } = {}) {
  const { across, along, source } = getActiveSizeValues();
  const aroundVal = along;
  const acrossVal = across;
  const valid = isPositiveNumber(acrossVal) && isPositiveNumber(aroundVal);

  if (valid) {
    customSize.across = acrossVal;
    customSize.along = aroundVal;
    customSize.area = mmToSqm(customSize.across, customSize.along);

    const isManualSource = source === 'manual';
    const cutSelect = document.getElementById('cutFromSizeSelect');

    if (isManualSource) {
      const rollMeta = resolveRollForLength(customSize.across);
      const pricingAcross = rollMeta.effectiveLength;

      standardSize = {
        across: rollMeta.rollLength,
        along: customSize.along,
        effectiveAcross: pricingAcross,
        area: mmToSqm(pricingAcross, customSize.along),
        label: formatDimensionLabel(rollMeta.rollLength, customSize.along),
        rollLength: rollMeta.rollLength,
        usesHalfRoll: rollMeta.usesHalfRoll,
        halfLength: rollMeta.rollLength / 2
      };

      // Reflect the chosen roll size in the disabled dropdown for user clarity
      if (cutSelect) {
        cutSelect.value = String(rollMeta.rollLength);
      }

      if (cutRollSummaryEl) {
        cutRollSummaryEl.classList.add('d-none');
        cutRollSummaryEl.textContent = '';
      }

      if (manualStandardColumnEl) {
        manualStandardColumnEl.classList.remove('d-none');
      }
      if (manualCutFromSizeSelectEl) {
        manualCutFromSizeSelectEl.value = String(rollMeta.rollLength);
      }
      if (manualCutFromHalfNoteEl) {
        manualCutFromHalfNoteEl.classList[rollMeta.usesHalfRoll ? 'remove' : 'add']('d-none');
        if (rollMeta.usesHalfRoll) {
          manualCutFromHalfNoteEl.textContent = '½ roll';
        } else {
          manualCutFromHalfNoteEl.textContent = '';
        }
      }

      if (cutStandardRowEl) {
        cutStandardRowEl.style.display = 'flex';
        if (standardAreaDisplayEl) {
          standardAreaDisplayEl.textContent = mmToSqm(pricingAcross, customSize.along).toFixed(3);
        }
      }

      if (cutCustomRowEl) {
        cutCustomRowEl.style.display = 'flex';
        if (customAreaDisplayEl) {
          customAreaDisplayEl.textContent = mmToSqm(customSize.across, customSize.along).toFixed(3);
        }
      }
    } else {
      standardSize = {
        across: customSize.across,
        along: customSize.along,
        area: customSize.area,
        label: formatDimensionLabel(customSize.across, customSize.along),
        rollLength: customSize.along,
        usesHalfRoll: false,
        halfLength: customSize.along / 2
      };

      if (cutSelect) {
        cutSelect.value = '';
      }

      if (cutRollSummaryEl) {
        cutRollSummaryEl.classList.add('d-none');
        cutRollSummaryEl.textContent = '';
      }

      if (manualStandardColumnEl) {
        manualStandardColumnEl.classList.add('d-none');
      }
      if (manualCutFromSizeSelectEl) {
        manualCutFromSizeSelectEl.value = '';
      }
      if (manualCutFromHalfNoteEl) {
        manualCutFromHalfNoteEl.classList.add('d-none');
      }
    }

    if (customSizeSummaryEl) {
      const activeThicknessValue = getSelectedThicknessValue();
      const thicknessLabel = activeThicknessValue ? `${activeThicknessValue} micron · ` : '';
      const descriptionPrefix = source === 'manual' ? 'Manual size: ' : '';
      customSizeSummaryEl.textContent = `${descriptionPrefix}${thicknessLabel}${acrossVal.toFixed(0)} mm × ${aroundVal.toFixed(0)} mm (${customSize.area.toFixed(3)} sq.m)`;
    }
    updateManualInlineSummary({ show: manualEntryEnabled && isManualSource });

    if (customSizeFeedbackEl) {
      customSizeFeedbackEl.classList.add('d-none');
    }
    return true;
  }

  customSize.across = null;
  customSize.along = null;
  customSize.area = 0;
  standardSize = { across: 0, along: 0, area: 0, label: '', rollLength: 0, usesHalfRoll: false, halfLength: 0 };

  updateManualInlineSummary({ show: false });

  if (customSizeSummaryEl) {
    const activeThicknessValue = getSelectedThicknessValue();
    customSizeSummaryEl.textContent = activeThicknessValue ? 'Select across and around to see sq.m.' : 'Select thickness and sizes to see sq.m.';
  }
  if (cutRollSummaryEl) {
    cutRollSummaryEl.classList.add('d-none');
    cutRollSummaryEl.textContent = '';
  }
  if (manualStandardColumnEl) {
    manualStandardColumnEl.classList[manualEntryEnabled ? 'remove' : 'add']('d-none');
  }
  if (manualCutFromSizeSelectEl) {
    manualCutFromSizeSelectEl.value = '';
  }
  if (manualCutFromHalfNoteEl) {
    manualCutFromHalfNoteEl.classList.add('d-none');
  }
  if (customSizeFeedbackEl) {
    customSizeFeedbackEl.classList[showFeedback ? 'remove' : 'add']('d-none');
  }
  hideCuttingSections();
  return false;
}

function handleCustomSizeInputChange({ preserveManualThickness, existingValidity } = {}) {
  const previousManualThickness = preserveManualThickness !== undefined
    ? preserveManualThickness
    : (manualThicknessSelectEl ? manualThicknessSelectEl.value : '');

  const isValid = typeof existingValidity === 'boolean'
    ? existingValidity
    : updateCustomSizeState();

  if (isValid) {
    if (manualEntryEnabled) {
      enableManualThicknessSelection({ preserveValue: previousManualThickness });
    } else {
      enableThicknessForSize();
    }

    const activeThicknessValue = getSelectedThicknessValue();
    if (activeThicknessValue) {
      updatePricingFromSelections();
    }
  } else {
    disableThicknessSelection({
      preserveManual: manualEntryEnabled,
      skipReset: manualEntryEnabled
    });
  }

  if (isValid && cutYesRadio && cutYesRadio.checked) {
    updateCutDetails();
  }

  return isValid;
}

function resetCustomSizeInputs() {
  if (customLengthInputEl) customLengthInputEl.value = '';
  if (customWidthInputEl) customWidthInputEl.value = '';
  if (manualWidthInputEl) manualWidthInputEl.value = '';
  if (manualLengthInputEl) manualLengthInputEl.value = '';
  resetSizePickers();
  updateCustomSizeState();
  disableThicknessSelection();
}

function toggleManualSizeEntry(forceState = null) {
  if (!manualSizeContainerEl || !toggleManualSizeBtn) return;

  manualEntryEnabled = forceState !== null ? forceState : !manualEntryEnabled;

  if (manualEntryEnabled) {
    manualSizeContainerEl.classList.remove('d-none');
    toggleManualSizeBtn.textContent = 'Use preset sizes';
    if (presetConfigRowEl) {
      presetConfigRowEl.classList.add('d-none');
    }
    if (customWidthInputEl) {
      customWidthInputEl.value = '';
      customWidthInputEl.disabled = true;
    }
    if (customLengthInputEl) {
      customLengthInputEl.value = '';
      customLengthInputEl.disabled = true;
    }
    disableThicknessSelection();
    if (presetThicknessGroupEl) {
      presetThicknessGroupEl.classList.add('d-none');
    }
    if (manualThicknessGroupEl) {
      manualThicknessGroupEl.classList.remove('d-none');
    }
    if (manualDetailsRowEl) {
      manualDetailsRowEl.classList.remove('d-none');
    }
    if (manualStandardColumnEl) {
      manualStandardColumnEl.classList.remove('d-none');
    }
    if (manualCutFromSizeSelectEl) {
      manualCutFromSizeSelectEl.value = '';
    }
    if (manualCutFromHalfNoteEl) {
      manualCutFromHalfNoteEl.classList.add('d-none');
    }
    relocateManualControlGroups('manual');
  } else {
    manualSizeContainerEl.classList.add('d-none');
    toggleManualSizeBtn.textContent = "Can't find your sizes?";
    if (presetConfigRowEl) {
      presetConfigRowEl.classList.remove('d-none');
    }
    if (customWidthInputEl) {
      customWidthInputEl.disabled = false;
    }
    if (customLengthInputEl) {
      customLengthInputEl.disabled = false;
    }
    resetCustomSizeInputs();
    if (presetThicknessGroupEl) {
      presetThicknessGroupEl.classList.remove('d-none');
    }
    if (manualThicknessGroupEl) {
      manualThicknessGroupEl.classList.add('d-none');
    }
    populateCustomDropdowns({ widths: uniqueWidths, lengths: uniqueLengths });
    if (manualDetailsRowEl) {
      manualDetailsRowEl.classList.add('d-none');
    }
    if (manualStandardColumnEl) {
      manualStandardColumnEl.classList.add('d-none');
    }
    relocateManualControlGroups('preset');
  }

  updateCustomSizeState();
}

function enableManualThicknessSelection({ preserveValue } = {}) {
  if (!manualThicknessSelectEl) return;

  // Polipack manual entry mode (AA/WA)
  const polCfg = getActivePolipackConfig();
  if (polCfg) {
    const previousValue = preserveValue !== undefined ? preserveValue : manualThicknessSelectEl.value;
    manualThicknessSelectEl.innerHTML = '<option value="">-- Select Thickness --</option>';
    polCfg.list.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      manualThicknessSelectEl.appendChild(opt);
    });
    manualThicknessSelectEl.disabled = false;
    if (previousValue) manualThicknessSelectEl.value = previousValue;
    return;
  }
  if (!manualThicknessSelectEl) return;
  if (!uniqueThicknesses.length) return;

  const previousValue = preserveValue !== undefined
    ? preserveValue
    : manualThicknessSelectEl.value;

  const existingValues = Array.from(manualThicknessSelectEl.options, option => option.value);
  const needsRebuild = existingValues.length - 1 !== uniqueThicknesses.length
    || uniqueThicknesses.some((value, index) => existingValues[index + 1] !== String(value));

  if (needsRebuild) {
    manualThicknessSelectEl.innerHTML = '<option value="">-- Select Thickness --</option>';
    uniqueThicknesses.forEach(thickness => {
      const option = document.createElement('option');
      option.value = thickness;
      option.textContent = thickness;
      manualThicknessSelectEl.appendChild(option);
    });
  }

  manualThicknessSelectEl.disabled = false;

  if (previousValue) {
    const matchingOption = Array.from(manualThicknessSelectEl.options)
      .find(option => option.value === previousValue);
    if (matchingOption) {
      manualThicknessSelectEl.value = previousValue;
    }
  }
}

function getActiveThicknessSelect() {
  return manualEntryEnabled ? manualThicknessSelectEl : thicknessSelectEl;
}

function getSelectedThicknessValue() {
  const select = getActiveThicknessSelect();
  return select ? select.value : '';
}

// Debug function to log element status
function logElementStatus(id) {
  const el = document.getElementById(id);
  console.log(`Element ${id}:`, el ? 'Found' : 'Not found');
  return el;
}

// Function to check if we're editing an existing cart item
function checkForEditingItem() {
  // First check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const editMode = urlParams.get('edit') === 'true';
  const itemId = urlParams.get('item_id');
  
  if (editMode && itemId) {
    // Get item details from URL parameters
    editingItem = {};
    urlParams.forEach((value, key) => {
      // Skip internal parameters
      if (key === 'edit' || key === 'item_id' || key === 'type' || key === '_') return;
      
      // Try to parse JSON values
      try {
        editingItem[key] = JSON.parse(value);
      } catch (e) {
        editingItem[key] = value;
      }
    });
    
    // Add ID and type
    editingItem.id = itemId;
    editingItem.type = urlParams.get('type') || 'mpack';
    
    console.log('Editing mpack item from URL:', editingItem);
    return editingItem;
  }
  
  // Fall back to session storage if no URL parameters
  const storedItem = sessionStorage.getItem('editingCartItem');
  if (!storedItem) return null;
  
  try {
    editingItem = JSON.parse(storedItem);
    // Remove the item from session storage so it doesn't persist after refresh
    sessionStorage.removeItem('editingCartItem');
    return editingItem;
  } catch (e) {
    console.error('Error parsing editing item:', e);
    return null;
  }
}

// Function to pre-fill the form with item data
function prefillFormWithItem(item) {
  if (!item) return;
  
  console.log('Prefilling MPack form with item:', item);
  
  try {
    // Update the button text
    const addToCartBtn = document.getElementById('addToCartBtn');
    if (addToCartBtn) {
      addToCartBtn.textContent = 'Update Item';
      addToCartBtn.onclick = async function(e) { 
        e.preventDefault();
        try {
          await updateCartItem(this, item.id);
        } catch (error) {
          console.error('Error updating cart item:', error);
          showToast('Error', 'Failed to update item. Please try again.', 'error');
        }
      };
    }
    
    // Set underpacking type
    if (item.underpacking_type) {
      const underpackingTypeSelect = document.getElementById('underpackingType');
      if (underpackingTypeSelect) {
        underpackingTypeSelect.value = item.underpacking_type;
        underpackingTypeSelect.dispatchEvent(new Event('change'));
      }
    }
    
    // Set machine
    if (item.machine) {
      const machineSelect = document.getElementById('machineSelect');
      if (machineSelect) {
        // Find the option that matches the machine name
        for (let i = 0; i < machineSelect.options.length; i++) {
          if (machineSelect.options[i].text === item.machine) {
            machineSelect.selectedIndex = i;
            machineSelect.dispatchEvent(new Event('change'));
            break;
          }
        }
      }
    }

    // Set Polipack format (AA/WA) when editing
    if (item.underpacking_type === 'polipack') {
      const formatSelect = document.getElementById('productFormatSelect');
      if (formatSelect) {
        const formatLabel = (item.format_label || item.format || '').toString().toLowerCase();
        let resolvedFormat = '';
        if (formatLabel.includes('self') || formatLabel.includes('aa')) {
          resolvedFormat = 'polipack_aa';
        } else if (formatLabel.includes('non') || formatLabel.includes('wa')) {
          resolvedFormat = 'polipack_wa';
        }

        if (resolvedFormat) {
          setTimeout(() => {
            formatSelect.value = resolvedFormat;
            formatSelect.dispatchEvent(new Event('change'));
          }, 200);
        }
      }
    }
    
    // Set thickness after a short delay to allow the thickness options to load
    setTimeout(() => {
      if (item.thickness) {
        const thicknessValue = item.thickness.replace(' micron', '');
        const thicknessSelect = getActiveThicknessSelect();
        if (thicknessSelect) {
          thicknessSelect.value = thicknessValue;
          thicknessSelect.dispatchEvent(new Event('change'));
          
          // Set size after thickness is loaded
          setTimeout(() => {
            if (item.size) {
              const sizeSelect = document.getElementById('sizeSelect');
              const sizeInput = document.getElementById('sizeInput');
              if (sizeSelect && sizeInput) {
                // Find the option that matches the size
                for (let i = 0; i < sizeSelect.options.length; i++) {
                  if (sizeSelect.options[i].text === item.size) {
                    sizeSelect.selectedIndex = i;
                    sizeInput.value = item.size;
                    sizeSelect.dispatchEvent(new Event('change'));
                    break;
                  }
                }
              }
              
              // Set quantity
              const sheetInput = document.getElementById('sheetInput');
              if (sheetInput && !isNaN(item.quantity)) {
                sheetInput.value = item.quantity;
              }
              
              // Set discount after a short delay to allow the discount options to load
              setTimeout(() => {
                if (item.discount_percent) {
                  const discountSelect = document.getElementById('discountSelect');
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
                    
                    // If no exact match, set the value directly
                    if (!found && discountSelect.value !== '') {
                      discountSelect.value = item.discount_percent;
                      discountSelect.dispatchEvent(new Event('change'));
                    }
                  }
                }
              }, 500);
            }
          }, 500);
        }
      }
    }, 500);
    
  } catch (error) {
    console.error('Error prefilling form:', error);
  }
}

// Function to update an existing cart item
async function updateCartItem(button, itemId) {
  const addToCartBtn = button || document.getElementById('addToCartBtn');
  if (!addToCartBtn) return;
  
  // Show loading state
  const originalText = addToCartBtn.innerHTML;
  addToCartBtn.disabled = true;
  addToCartBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
  
  try {
    // Get the current form data
    const formData = getFormData();
    
    // Add the item ID to the form data for server-side processing
    formData.item_id = itemId;
    
    // Send the update request to the server
    const response = await fetch('/update_cart_item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
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
    addToCartBtn.disabled = false;
    addToCartBtn.innerHTML = originalText;
  }
}

// Helper function to get form data
function getFormData() {
  const machineSelect = document.getElementById('machineSelect');
  const thicknessSelect = getActiveThicknessSelect();
  const sheetInput = document.getElementById('sheetInput');
  const underpackingTypeSelect = document.getElementById('underpackingType');
  const discountSelect = document.getElementById('discountSelect');
  
  const quantity = parseInt(sheetInput.value) || 1;
  const discount = discountSelect ? parseFloat(discountSelect.value) || 0 : 0;
  
  // Get underpacking type display name
  let underpackingType = '';
  let underpackingTypeDisplay = 'Underpacking Material';
  if (underpackingTypeSelect && underpackingTypeSelect.value) {
    underpackingType = underpackingTypeSelect.value;
    underpackingTypeDisplay = underpackingTypeSelect.options[underpackingTypeSelect.selectedIndex].text;
  }

  const formatLabel = underpackingType === 'polipack' ? getPolipackFormatLabel() : '';
  const resolvedName = underpackingType === 'polipack' && formatLabel
    ? `Polipack - ${formatLabel}`
    : underpackingTypeDisplay;

  const thicknessValue = Number(currentThickness || (thicknessSelect && thicknessSelect.value) || 0);
  // Use effective roll-based area for manual entries to honor half-roll pricing
  const sqmArea = manualEntryEnabled ? (standardSize.area || customSize.area || 0) : (standardSize.area || customSize.area || 0);
  const ratePerSqm = getActiveBaseRatePer100Micron() * (thicknessValue / 100);
  const sheetCount = Math.max(1, quantity);
  const unitPrice = ratePerSqm * sqmArea;
  const subtotal = unitPrice * sheetCount;
  const discountAmount = (subtotal * discount) / 100;
  const discountedSubtotal = subtotal - discountAmount;
  const gstRate = parseFloat(document.getElementById('gstSelect').value) || 0;
  const gstAmount = (discountedSubtotal * gstRate) / 100;
  const finalPrice = discountedSubtotal + gstAmount;
  
  // Get size details
  const customAcross = isPositiveNumber(customSize.across) ? customSize.across : null;
  const customAlong = isPositiveNumber(customSize.along) ? customSize.along : null;
  const customArea = isPositiveNumber(customSize.area) ? customSize.area : (customAcross && customAlong ? mmToSqm(customAcross, customAlong) : null);
  const cutToCustom = manualEntryEnabled ? true : Boolean(cutYesRadio && cutYesRadio.checked);

  const resolvedRollLength = standardSize.rollLength || standardSize.across || 0;
  const displayAlong = customAlong || 0;
  const displayAcross = manualEntryEnabled
    ? (resolvedRollLength || (customAcross || 0))
    : (customAcross || 0);
  const displaySizeLabel = (displayAcross && displayAlong)
    ? formatDimensionLabel(displayAcross, displayAlong)
    : '';
  const standardAlong = isPositiveNumber(standardSize.along) ? standardSize.along : null;
  const standardAcross = isPositiveNumber(standardSize.across) ? standardSize.across : null;
  const standardArea = isPositiveNumber(standardSize.area)
    ? standardSize.area
    : (standardAcross && standardAlong ? mmToSqm(standardAcross, standardAlong) : null);
  const standardSizeLabel = standardSize.label || '';
  const customSizeLabel = displaySizeLabel;

  return {
    id: 'mpack_' + Date.now(),
    type: 'mpack',
    name: resolvedName,
    machine: machineSelect && machineSelect.value ? machineSelect.options[machineSelect.selectedIndex].text : '--',
    thickness: thicknessSelect.value + ' micron',
    size: displaySizeLabel,
    along_mm: displayAlong,
    across_mm: displayAcross,
    underpacking_type: underpackingType,
    format_label: formatLabel || undefined,
    quantity: quantity,
    unit_price: parseFloat(unitPrice.toFixed(2)),
    discount_percent: discount,
    gst_percent: gstRate,
    custom_along_mm: customAlong,
    custom_across_mm: customAcross,
    custom_area_sqm: customArea,
    custom_length_mm: customAlong,
    custom_width_mm: customAcross,
    standard_along_mm: standardAlong,
    standard_across_mm: standardAcross,
    standard_area_sqm: standardArea,
    standard_length_mm: standardAlong,
    standard_width_mm: standardAcross,
    display_length_mm: displayAlong,
    display_width_mm: displayAcross,
    display_size_label: displaySizeLabel,
    cut_to_custom_size: cutToCustom,
    standard_size_label: standardSizeLabel,
    custom_size_label: customSizeLabel,
    image: 'images/mpack-placeholder.jpg',
    added_at: new Date().toISOString(),
    calculations: {
      rate_per_sqm: parseFloat(ratePerSqm.toFixed(2)),
      sqm_per_sheet: parseFloat((sqmArea || 0).toFixed(3)),
      unit_price: parseFloat(unitPrice.toFixed(2)),
      quantity: sheetCount,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_percent: discount,
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      discounted_subtotal: parseFloat(discountedSubtotal.toFixed(2)),
      gst_percent: gstRate,
      gst_amount: parseFloat(gstAmount.toFixed(2)),
      final_total: parseFloat(finalPrice.toFixed(2))
    }
  };
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

document.addEventListener("DOMContentLoaded", async () => {
  console.log("MPACK JS loaded - DOM fully loaded");

  // Handle company info from URL if present
  handleCompanyFromUrl();

  // Cache DOM references for new workflow pieces
  sizeInputEl = document.getElementById('sizeInput');
  sizeSelectEl = document.getElementById('sizeSelect');
  customLengthInputEl = document.getElementById('customLengthInput');
  customWidthInputEl = document.getElementById('customWidthInput');
  thicknessSelectEl = document.getElementById('thicknessSelect');
  underpackingTypeOptionsEl = document.getElementById('underpackingTypeOptions');
  productFormatOptionsEl = document.getElementById('productFormatOptions');
  underpackingTypePickerEl = document.getElementById('underpackingTypePicker');
  productFormatPickerEl = document.getElementById('productFormatColumn');
  customSizeSummaryEl = document.getElementById('customSizeSummary');
  customSizeFeedbackEl = document.getElementById('customSizeFeedback');
  cutQuestionSectionEl = document.getElementById('cutQuestionSection');
  cutDetailsSectionEl = document.getElementById('cutDetailsSection');
  cutYesRadio = document.getElementById('cutYes');
  cutNoRadio = document.getElementById('cutNo');
  standardAreaDisplayEl = document.getElementById('standardAreaDisplay');
  customAreaDisplayEl = document.getElementById('customAreaDisplay');
  cutStandardRowEl = document.getElementById('cutStandardRow');
  cutCustomRowEl = document.getElementById('cutCustomRow');
  cutDetailsNoteEl = document.getElementById('cutDetailsNote');
  manualSizeContainerEl = document.getElementById('manualSizeContainer');
  manualWidthInputEl = document.getElementById('manualWidthInput');
  manualLengthInputEl = document.getElementById('manualLengthInput');
  toggleManualSizeBtn = document.getElementById('toggleManualSizeBtn');
  manualStandardColumnEl = document.getElementById('manualStandardColumn');
  manualCutFromSizeSelectEl = document.getElementById('manualCutFromSizeSelect');
  manualCutFromHalfNoteEl = document.getElementById('manualCutFromHalfNote');
  manualDetailsRowEl = document.getElementById('manualDetailsRow');
  manualPrimaryColumnEl = document.getElementById('manualPrimaryColumn');
  presetPrimaryColumnEl = document.getElementById('presetPrimaryColumn');
  presetQuantityGroupEl = document.getElementById('presetQuantityGroup');
  presetDiscountGroupEl = document.getElementById('presetDiscountGroup');
  presetStandardColumnEl = document.getElementById('presetStandardColumn');
  presetThicknessGroupEl = document.getElementById('presetThicknessGroup');
  manualThicknessGroupEl = document.getElementById('manualThicknessGroup');
  manualThicknessSelectEl = document.getElementById('manualThicknessSelect');
  cutRollSummaryEl = document.getElementById('cutRollSummary');
  manualInlineSummaryRowEl = document.getElementById('manualInlineSummaryRow');
  manualInlineSizeSummaryEl = document.getElementById('manualInlineSizeSummary');
  manualInlineDiscountSummaryEl = document.getElementById('manualInlineDiscountSummary');
  manualOnlyNoticeEl = document.getElementById('manualOnlyNotice');
  presetConfigRowEl = document.getElementById('presetConfigRow');

  populateCutSizeDropdown();

  initMpackPickers();
  renderUnderpackingTypeOptions();
  renderProductFormatOptions();

  // Disable standard size search until custom size captured
  if (sizeInputEl) {
    sizeInputEl.disabled = true;
  }
  if (sizeSelectEl) {
    sizeSelectEl.disabled = true;
  }

  // Attach listeners for custom size inputs
  if (customLengthInputEl) {
    customLengthInputEl.addEventListener('change', event => {
      if (thicknessSelectEl) thicknessSelectEl.value = '';
      updateWidthOptionsForLength(event.target.value);
      handleCustomSizeInputChange();
    });
  }
  if (customWidthInputEl) {
    customWidthInputEl.addEventListener('change', event => {
      if (customLengthInputEl) customLengthInputEl.value = '';
      if (thicknessSelectEl) thicknessSelectEl.value = '';
      updateLengthOptionsForWidth(event.target.value);
      handleCustomSizeInputChange();
    });
  }

  if (manualWidthInputEl) {
    manualWidthInputEl.addEventListener('input', () => {
      const isValid = handleCustomSizeInputChange({ preserveManualThickness: manualThicknessSelectEl ? manualThicknessSelectEl.value : '' });
      updateManualInlineSummary({ show: manualEntryEnabled && isValid });
    });
  }

  if (manualLengthInputEl) {
    manualLengthInputEl.addEventListener('input', () => {
      const isValid = handleCustomSizeInputChange();
      updateManualInlineSummary({ show: manualEntryEnabled && isValid });
    });
  }

  if (manualThicknessSelectEl) {
    manualThicknessSelectEl.addEventListener('change', () => {
      currentDiscount = 0;
      const discountSelect = document.getElementById('discountSelect');
      if (discountSelect) {
        discountSelect.value = '';
      }
      updateCustomSizeState();
      updatePricingFromSelections();
      updateManualInlineSummary({ show: manualEntryEnabled && hasValidCustomSize() });
    });
  }

  if (toggleManualSizeBtn) {
    toggleManualSizeBtn.addEventListener('click', () => {
      toggleManualSizeEntry();
    });
  }

  if (cutYesRadio) {
    cutYesRadio.addEventListener('change', () => {
      updateCutDetails();
    });
  }
  if (cutNoRadio) {
    cutNoRadio.addEventListener('change', () => {
      updateCutDetails();
    });
  }

  try {
    // Load machines first
    console.log("Loading machines...");
    loadMachines();

    // Load MPack size data for dropdowns
    console.log('Loading MPack size metadata...');
    await loadSizes();

    // Load discounts
    console.log("Loading discounts...");
    await loadDiscounts();

    // Check if we're editing an existing cart item
    console.log("Checking for editing item...");
    const foundEditingItem = checkForEditingItem();

    if (foundEditingItem) {
      editingItem = foundEditingItem;
      console.log("Editing existing item:", editingItem);

      // Small delay to ensure all elements are rendered
      setTimeout(() => {
        try {
          prefillFormWithItem(editingItem);

          // Update the add to cart button to show "Update Item"
          const addToCartBtn = document.getElementById('addToCartBtn');
          if (addToCartBtn) {
            addToCartBtn.textContent = 'Update Item';
            addToCartBtn.onclick = async function (e) {
              e.preventDefault();
              try {
                await updateCartItem(this, editingItem.id);
              } catch (error) {
                console.error('Error updating cart item:', error);
                showToast('Error', 'Failed to update item. Please try again.', 'error');
              }
            };
          }

          // Show the mpack section if it's hidden
          const mpackSection = document.getElementById('mpackSection');
          if (mpackSection) {
            mpackSection.style.display = 'block';
          }
        } catch (error) {
          console.error('Error prefilling form with item:', error);
        }
      }, 100);
    } else {
      editingItem = null;
      console.log('No editing item found');
    }
  } catch (error) {
    console.error('Error initializing MPack page:', error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = 'Error loading page. Please refresh and try again.';
    document.querySelector('main').prepend(errorDiv);
  }

  // Debug log element statuses
  console.log('Checking required elements...');
  logElementStatus('machineSelect');
  logElementStatus('mpackSection');
  logElementStatus('thicknessSelect');
  logElementStatus('sizeSelect');
  logElementStatus('sheetInput');
  logElementStatus('discountSelect');

  // Set up the add to cart button
  const addToCartBtn = document.getElementById('addToCartBtn');
  if (addToCartBtn) {
    addToCartBtn.onclick = async function (e) {
      e.preventDefault();
      try {
        if (editingItem) {
          await updateCartItem(this, editingItem.id);
        } else {
          await addMpackToCart();
        }
      } catch (error) {
        console.error('Error processing cart action:', error);
        showToast('Error', 'Failed to process your request. Please try again.', 'error');
      }
    };
  }

  // Safely add event listener to machine select
  const machineSelect = document.getElementById('machineSelect');
  const underpackingTypeSelect = document.getElementById('underpackingType');
  const mpackSection = document.getElementById('mpackSection');

  if (!machineSelect) {
    console.error('machineSelect element not found!');
  }

  if (!mpackSection) {
    console.error('mpackSection element not found!');
  }

  if (underpackingTypeSelect && mpackSection) {
    const productFormatColumn = document.getElementById('productFormatColumn');
    const productFormatSelect = document.getElementById('productFormatSelect');

    function updateStandardSizeDisplays(sizes) {
      const presetList = document.getElementById('presetStandardList');
      const manualList = document.getElementById('manualStandardList');
      const cutSelect = document.getElementById('cutFromSizeSelect');
      const manualCutSelect = document.getElementById('manualCutFromSizeSelect');

      const rebuildList = (listEl, values) => {
        if (!listEl) return;
        listEl.innerHTML = values.map(v => `<li>${v}</li>`).join('');
      };

      const rebuildSelect = (selectEl, values) => {
        if (!selectEl) return;
        const options = values.map(v => `<option value="${v}">${v} mm</option>`).join('');
        selectEl.innerHTML = `<option value="" selected>----</option>${options}`;
      };

      rebuildList(presetList, sizes);
      rebuildList(manualList, sizes);
      rebuildSelect(cutSelect, sizes);
      rebuildSelect(manualCutSelect, sizes);
    }

    const getPolipackFormatSelected = () => {
      const value = productFormatSelect ? productFormatSelect.value : '';
      return value === 'polipack_aa' || value === 'polipack_wa';
    };

    const applyManualOnlyLayout = shouldEnable => {
      if (presetConfigRowEl) {
        presetConfigRowEl.classList[shouldEnable ? 'add' : 'remove']('d-none');
      }
      if (toggleManualSizeBtn) {
        toggleManualSizeBtn.classList[shouldEnable ? 'add' : 'remove']('d-none');
      }
      if (manualSizeContainerEl) {
        manualSizeContainerEl.classList[shouldEnable ? 'remove' : 'add']('d-none');
      }
      if (manualOnlyNoticeEl) {
        manualOnlyNoticeEl.classList[shouldEnable ? 'remove' : 'add']('d-none');
      }
      toggleManualSizeEntry(shouldEnable);
    };

    const handleUnderpackingChange = () => {
      const selectedType = underpackingTypeSelect.value;
      const isPolipack = selectedType === 'polipack';
      const hasPolipackFormat = isPolipack && getPolipackFormatSelected();
      const currentSizes = isPolipack ? POLIPACK_STANDARD_ROLLS : DEFAULT_FULL_ROLL_SIZES;

      populateCutSizeDropdown(currentSizes);
      updateStandardSizeDisplays(currentSizes);

      if (productFormatColumn) {
        productFormatColumn.classList[isPolipack ? 'remove' : 'add']('d-none');
      }
      if (!isPolipack && productFormatSelect) {
        resetPicker(productFormatSelect, productFormatPickerEl);
      }

      const shouldShowConfigurator = Boolean(selectedType) && (!isPolipack || hasPolipackFormat);
      if (mpackSection) {
        mpackSection.style.display = shouldShowConfigurator ? 'block' : 'none';
      }

      const manualMode = isPolipack && hasPolipackFormat;
      applyManualOnlyLayout(manualMode);

      if (!manualMode) {
        toggleManualSizeEntry(false);
      }

      if (!shouldShowConfigurator) {
        disableThicknessSelection();
      }
    };

    underpackingTypeSelect.addEventListener('change', () => {
      resetSizePickers();
      handleUnderpackingChange();
      renderUnderpackingTypeOptions();
      renderProductFormatOptions();
    });
    handleUnderpackingChange();
    renderUnderpackingTypeOptions();
    renderProductFormatOptions();

    if (productFormatSelect) {
      productFormatSelect.addEventListener('change', () => {
        resetSizePickers();
        disableThicknessSelection();
        const pCfg = getActivePolipackConfig();
        if (pCfg) {
          populateSelectOptions(thicknessSelectEl, pCfg.list.map(String), '-- Select Thickness --');
          thicknessSelectEl.disabled = false;
        }
        handleUnderpackingChange();
        renderProductFormatOptions();
      });
    }
  }

  // Update thickness change handler to recalculate prices
  const thicknessSelect = document.getElementById('thicknessSelect');
  if (thicknessSelect) {
    thicknessSelect.addEventListener('change', () => {
      currentDiscount = 0;
      const discountSelect = document.getElementById('discountSelect');
      if (discountSelect) {
        discountSelect.value = '';
      }
      updateCustomSizeState();
      updatePricingFromSelections();
    });
  }

  // Update size selection handler
  if (sizeSelectEl) {
    sizeSelectEl.addEventListener('change', () => {
      handleSizeSelection();
      calculateFinalPrice();
    });
  }

  // Quantity input handler
  const sheetInput = document.getElementById('sheetInput');
  if (sheetInput) {
    sheetInput.addEventListener('input', () => {
      calculateFinalPrice();
    });
  }

  // Discount select handler
  const discountSelect = document.getElementById('discountSelect');
  if (discountSelect) {
    discountSelect.addEventListener('change', () => {
      applyDiscount();
      calculateFinalPrice();
      updateManualInlineSummary({ show: manualEntryEnabled && hasValidCustomSize() });
    });
  }
});

function loadMachines() {
  fetch("/api/machines")
    .then(res => res.json())
    .then(data => {
      const machineSelect = document.getElementById("machineSelect");
      const machinesArr = Array.isArray(data) ? data : data.machines;
      machinesArr.forEach(machine => {
        const opt = document.createElement("option");
        opt.value = machine.id;
        opt.textContent = machine.name;
        machineSelect.appendChild(opt);
      });
    });
}

function disableThicknessSelection({ preserveManual = false, skipReset = false } = {}) {
  if (thicknessSelectEl) {
    thicknessSelectEl.innerHTML = '<option value="">-- Select Thickness --</option>';
    thicknessSelectEl.disabled = true;
  }

  if (!preserveManual) {
    currentThickness = '';
  }

  if (manualThicknessSelectEl) {
    if (manualEntryEnabled && preserveManual) {
      manualThicknessSelectEl.disabled = true;
    } else {
      manualThicknessSelectEl.innerHTML = '<option value="">-- Select Thickness --</option>';
      manualThicknessSelectEl.disabled = true;
    }
  }

  if (!skipReset) {
    resetCalculations();
  }
}

function enableThicknessForSize() {
  if (!thicknessSelectEl) return;

  // Polipack (AA or WA): fixed list independent of size
  const cfg = getActivePolipackConfig();
  if (cfg) {
    populateSelectOptions(thicknessSelectEl, cfg.list.map(String), '-- Select Thickness --');
    thicknessSelectEl.disabled = false;
    return;
  }
  if (!thicknessSelectEl) return;
  const acrossVal = parseFloat(customWidthInputEl?.value || '');
  const alongVal = parseFloat(customLengthInputEl?.value || '');
  if (!isPositiveNumber(acrossVal) || !isPositiveNumber(alongVal)) {
    disableThicknessSelection({ preserveManual: manualEntryEnabled });
    return;
  }

  const key = `${acrossVal}x${alongVal}`;
  const matchingThicknesses = thicknessOptionsBySize.get(key) || [];

  console.debug('Thickness lookup', { key, matchingThicknesses });

  thicknessSelectEl.innerHTML = '<option value="">-- Select Thickness --</option>';
  matchingThicknesses.forEach(thickness => {
    const option = document.createElement('option');
    option.value = thickness;
    option.textContent = thickness;
    thicknessSelectEl.appendChild(option);
  });

  if (matchingThicknesses.length === 0) {
    thicknessSelectEl.disabled = true;
    thicknessSelectEl.title = 'No thickness options available for the selected size';
  } else {
    thicknessSelectEl.disabled = false;
    thicknessSelectEl.removeAttribute('disabled');
    thicknessSelectEl.title = '';
  }

  if (matchingThicknesses.length === 1) {
    thicknessSelectEl.value = matchingThicknesses[0];
    thicknessSelectEl.dispatchEvent(new Event('change'));
  }
}

function loadSizes() {
  const gmMode = document.documentElement && document.documentElement.dataset && document.documentElement.dataset.pricingMode === 'gm';
  const dataPath = gmMode ? '/static/data/gm/mpack.json' : '/static/data/mpack.json';
  fetch(`${dataPath}?v=${Date.now()}`)
    .then(res => {
      if (!res.ok) throw new Error('Failed to load MPack data');
      return res.json();
    })
    .then(data => {
      const widthLengthSets = new Map();
      const lengthWidthSets = new Map();
      const uniqueWidthSet = new Set();
      const uniqueLengthSet = new Set();
      const uniqueThicknessSet = new Set();

      thicknessOptionsBySize = new Map();
      widthsByLengthMap = new Map();
      lengthsByWidthMap = new Map();
      allSizeCombos = [];
      sizeMetaMap = {};

      data.mpack.forEach(entry => {
        uniqueThicknessSet.add(entry.id);
        entry.sizes.forEach(size => {
          const width = Number(size.width);
          const length = Number(size.length);
          const key = `${width}x${length}`;

          uniqueWidthSet.add(width);
          uniqueLengthSet.add(length);

          const existingThicknesses = thicknessOptionsBySize.get(key) || [];
          existingThicknesses.push(entry.id);
          thicknessOptionsBySize.set(key, existingThicknesses);

          const widthKey = String(width);
          const lengthSet = widthLengthSets.get(widthKey) || new Set();
          lengthSet.add(length);
          widthLengthSets.set(widthKey, lengthSet);

          const lengthKey = String(length);
          const widthSet = lengthWidthSets.get(lengthKey) || new Set();
          widthSet.add(width);
          lengthWidthSets.set(lengthKey, widthSet);

          allSizeCombos.push({ width, length, thicknesses: existingThicknesses });
          sizeMetaMap[key] = { width, length, price: null, thicknesses: existingThicknesses };
        });
      });

      lengthsByWidthMap = new Map();
      widthLengthSets.forEach((lengthSet, widthKey) => {
        lengthsByWidthMap.set(widthKey, [...lengthSet].sort((a, b) => a - b));
      });

      widthsByLengthMap = new Map();
      lengthWidthSets.forEach((widthSet, lengthKey) => {
        widthsByLengthMap.set(lengthKey, [...widthSet].sort((a, b) => a - b));
      });

      uniqueWidths = [...uniqueWidthSet].sort((a, b) => a - b);
      uniqueLengths = [...uniqueLengthSet].sort((a, b) => a - b);
      uniqueThicknesses = [...uniqueThicknessSet].sort((a, b) => a - b);

      populateSelectOptions(customWidthInputEl, uniqueWidths.map(String), '-- Select Across --');
      populateSelectOptions(customLengthInputEl, uniqueLengths.map(String), '-- Select Around --');
      populateSelectOptions(thicknessSelectEl, uniqueThicknesses.map(String), '-- Select Thickness --');

      disableThicknessSelection();
    })
    .catch(err => {
      console.error('Failed to load MPack sizes:', err);
      populateCustomDropdowns({ widths: [], lengths: [] });
      disableThicknessSelection();
    });
}

async function loadDiscounts() {
  console.log('Loading discounts...');
  const select = document.getElementById('discountSelect');
  
  if (!select) {
    console.error('Discount select element not found');
    return;
  }
  
  try {
    // Clear existing options except the first one
    while (select.options.length > 1) {
      select.remove(1);
    }

    const gmMode = document.documentElement && document.documentElement.dataset && document.documentElement.dataset.pricingMode === 'gm';
    const discountPath = gmMode ? '/static/data/gm/discount.json' : '/static/data/discount.json';
    console.log(`Fetching discounts from ${discountPath}`);
    const response = await fetch(discountPath);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received discount data:', data);
    
    const discounts = data.discounts || [];
    console.log(`Processing ${discounts.length} discount(s)`);
    
    if (discounts.length === 0) {
      console.warn('No discounts found in the JSON file');
    }
    
    // Add new discount options
    discounts.forEach(percent => {
      const percentNum = parseFloat(percent);
      if (!isNaN(percentNum)) {
        const option = document.createElement('option');
        option.value = percentNum;
        option.textContent = `${percentNum}%`;
        select.appendChild(option);
        console.log(`Added discount option: ${percentNum}%`);
      } else {
        console.warn(`Invalid discount percentage: ${percent}`);
      }
    });
    
    // Remove any existing change event listeners to prevent duplicates
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    
    // Add event listener for discount selection
    newSelect.addEventListener('change', function() {
      currentDiscount = parseFloat(this.value) || 0;
      console.log(`Selected discount: ${currentDiscount}%`);
      calculateFinalPrice();
    });
    
    console.log('Discounts loaded successfully');
    
  } catch (error) {
    console.error('Error loading discounts:', error);
    
    // Fallback to default discounts if loading fails
    console.warn('Falling back to default discounts');
    const defaultDiscounts = [5, 10, 15, 20];
    defaultDiscounts.forEach(percent => {
      const option = document.createElement('option');
      option.value = percent;
      option.textContent = `${percent}%`;
      select.appendChild(option);
      console.log(`Added default discount option: ${percent}%`);
    });
  }
}

function resetCalculations() {
  currentNetPrice = 0;
  currentDiscount = 0;

  const sheetInput = document.getElementById('sheetInput');
  if (sheetInput) sheetInput.value = '1';

  const pricingBreakdown = document.getElementById('pricingBreakdown');
  if (pricingBreakdown) {
    pricingBreakdown.innerHTML = '<p class="text-muted mb-0">Select thickness and sizes to see pricing.</p>';
  }

  const priceSection = document.getElementById('priceSection');
  if (priceSection) priceSection.style.display = 'block';

  const addToCartBtn = document.getElementById('addToCartBtn');
  if (addToCartBtn) addToCartBtn.disabled = true;
}

function calculateFinalPrice() {
  const sheetInput = document.getElementById('sheetInput');
  const quantity = parseInt(sheetInput.value, 10) || 0;
  const gstRate = parseFloat(document.getElementById('gstSelect').value) || 0;
  const pricingBreakdown = document.getElementById('pricingBreakdown');
  const addToCartBtn = document.getElementById('addToCartBtn');

  if (!pricingBreakdown) return;

  const hasSelections = currentNetPrice > 0 && isPositiveNumber(standardSize.area) && currentThickness;
  if (!hasSelections) {
    resetCalculations();
    return;
  }

  const sheetCount = Math.max(1, quantity);
  const subtotal = currentNetPrice * sheetCount;
  const discountAmount = (subtotal * currentDiscount) / 100;
  const discountedSubtotal = subtotal - discountAmount;
  const gstAmount = (discountedSubtotal * gstRate) / 100;
  const finalTotal = discountedSubtotal + gstAmount;

  const effectiveSqm = isPositiveNumber(standardSize.area) ? standardSize.area : (customSize.area || 0);
  const sqmLabel = effectiveSqm.toFixed(3);

  const baseRateDisplay = getActiveBaseRatePer100Micron().toFixed(2);
  const thicknessFactor = Number(currentThickness || 0) / 100;
  const thicknessFactorDisplay = thicknessFactor.toFixed(2);
  const ratePerSqmDisplay = currentRatePerSqm.toFixed(2);

  pricingBreakdown.innerHTML = `
    <div class="mpack-pricing-row">
      <span class="mpack-pricing-label">Thickness</span>
      <span class="mpack-pricing-separator">=</span>
      <span class="mpack-pricing-value">${currentThickness} µ</span>
    </div>
    <div class="mpack-pricing-row">
      <span class="mpack-pricing-label">Area per sheet</span>
      <span class="mpack-pricing-separator">=</span>
      <span class="mpack-pricing-value">${sqmLabel} sq.m</span>
    </div>
    <div class="mpack-pricing-row">
      <span class="mpack-pricing-label">Sheets</span>
      <span class="mpack-pricing-separator">=</span>
      <span class="mpack-pricing-value">${sheetCount}</span>
    </div>
    <div class="mpack-pricing-row">
      <span class="mpack-pricing-label">Subtotal (Rate × Area × Sheets)</span>
      <span class="mpack-pricing-separator">=</span>
      <span class="mpack-pricing-value">₹${subtotal.toFixed(2)}</span>
    </div>
    ${currentDiscount > 0 ? `
    <div class="mpack-pricing-row">
      <span class="mpack-pricing-label">Discount (${currentDiscount}%)</span>
      <span class="mpack-pricing-separator">=</span>
      <span class="mpack-pricing-value mpack-pricing-value--discount">-₹${discountAmount.toFixed(2)}</span>
    </div>` : ''}
    <div class="mpack-pricing-row">
      <span class="mpack-pricing-label">GST (${gstRate}%)</span>
      <span class="mpack-pricing-separator">=</span>
      <span class="mpack-pricing-value">₹${gstAmount.toFixed(2)}</span>
    </div>
    <div class="mpack-pricing-row mpack-pricing-row--total">
      <span class="mpack-pricing-label">Total Payable</span>
      <span class="mpack-pricing-separator">=</span>
      <span class="mpack-pricing-value mpack-pricing-value--total">₹${finalTotal.toFixed(2)}</span>
    </div>
  `;

  const priceSection = document.getElementById('priceSection');
  if (priceSection) priceSection.style.display = 'block';

  if (addToCartBtn) addToCartBtn.disabled = false;
}

function updatePricingFromSelections() {
  const sheetInput = document.getElementById('sheetInput');
  if (sheetInput) sheetInput.value = '1';

  const discountSelect = document.getElementById('discountSelect');
  if (discountSelect) discountSelect.value = '';
  currentDiscount = 0;

  const activeThicknessSelect = getActiveThicknessSelect();
  const thicknessValue = parseFloat(activeThicknessSelect && activeThicknessSelect.value ? activeThicknessSelect.value : currentThickness || 0);
  const activeThickness = Number.isFinite(thicknessValue) && thicknessValue > 0 ? thicknessValue : 0;
  const sqmArea = isPositiveNumber(standardSize.area) ? standardSize.area : customSize.area;

  if (!activeThickness || !isPositiveNumber(sqmArea)) {
    resetCalculations();
    return;
  }

  currentThickness = String(activeThickness);
  const baseRate = getActiveBaseRatePer100Micron();
  currentRatePerSqm = baseRate * (activeThickness / 100);
  currentNetPrice = currentRatePerSqm * sqmArea;

  calculateFinalPrice();
}

function applyDiscount() {
  const discountSelect = document.getElementById('discountSelect');
  if (!discountSelect) return;

  currentDiscount = parseFloat(discountSelect.value) || 0;
  calculateFinalPrice();
}

async function addMpackToCart() {
  // Check if we're in edit mode
  const urlParams = new URLSearchParams(window.location.search);
  const isEditMode = urlParams.get('edit') === 'true';
  const itemId = urlParams.get('item_id');
  
  const machineSelect = document.getElementById('machineSelect');
  const thicknessSelect = getActiveThicknessSelect();
  const sizeSelect = document.getElementById('sizeSelect');
  const sheetInput = document.getElementById('sheetInput');
  const underpackingTypeSelect = document.getElementById('underpackingType');

  let underpackingType = '';
  let underpackingTypeDisplay = 'Underpacking Material';
  if (underpackingTypeSelect && underpackingTypeSelect.value) {
    underpackingType = underpackingTypeSelect.value;
    underpackingTypeDisplay = underpackingTypeSelect.options[underpackingTypeSelect.selectedIndex].text;
  }

  const formatLabel = underpackingType === 'polipack' ? getPolipackFormatLabel() : '';
  const resolvedName = underpackingType === 'polipack' && formatLabel
    ? `Polipack - ${formatLabel}`
    : underpackingTypeDisplay;
  const quantity = parseInt(sheetInput.value) || 1;

  const hasSizeSelect = Boolean(sizeSelect && sizeSelect.value);
  const hasCustomSize = hasValidCustomSize();

  
  // Check that a size is selected in the dropdown (like thickness)
  if (!underpackingType) {
    showToast('Error', 'Please select an underpacking type before continuing.', 'error');
    if (underpackingTypeSelect) {
      underpackingTypeSelect.classList.add('is-invalid');
      setTimeout(() => underpackingTypeSelect.classList.remove('is-invalid'), 1500);
    }
    return;
  }

  if (!thicknessSelect || !thicknessSelect.value || !sheetInput.value || (!hasSizeSelect && !hasCustomSize)) {
    showToast('Error', 'Please fill in all required fields to calculate pricing.', 'error');
    return;
  }

  // Get discount information
  const discountSelect = document.getElementById('discountSelect');
  const discount = discountSelect ? parseFloat(discountSelect.value) || 0 : 0;
  const sqmArea = standardSize.area || customSize.area || 0;
  const thicknessValue = Number(currentThickness || thicknessSelect.value || 0);
  const ratePerSqm = getActiveBaseRatePer100Micron() * (thicknessValue / 100);
  const unitPrice = ratePerSqm * sqmArea;
  const subtotal = unitPrice * quantity;
  const discountAmount = (subtotal * discount) / 100;
  const discountedSubtotal = subtotal - discountAmount;
  const gstRate = parseFloat(document.getElementById('gstSelect').value) || 0;
  const gstAmount = (discountedSubtotal * gstRate) / 100;
  const finalPrice = discountedSubtotal + gstAmount;

  // Get size from dropdown (like thickness)
  const selectedOption = hasSizeSelect ? sizeSelect.options[sizeSelect.selectedIndex] : null;
  const selectedSize = selectedOption ? selectedOption.text : '';
  const metaFromMap = hasSizeSelect ? sizeMetaMap[sizeSelect.value] : null;
  const dimensionMeta = metaFromMap || parseSizeLabel(selectedSize) || {};
  const standardAlong = typeof dimensionMeta.along === 'number' ? dimensionMeta.along : (standardSize.along || 0);
  const standardAcross = typeof dimensionMeta.across === 'number' ? dimensionMeta.across : (standardSize.across || 0);
  const standardArea = standardSize.area || mmToSqm(standardSize.across, standardSize.along);

  const customAcross = customSize.across || null;
  const customAlong = customSize.along || null;
  const customArea = customSize.area || (customAcross && customAlong ? mmToSqm(customAcross, customAlong) : null);
  const cutToCustom = manualEntryEnabled ? true : Boolean(cutYesRadio && cutYesRadio.checked);

  const customSizeLabel = customAcross && customAlong ? formatDimensionLabel(customAcross, customAlong) : '';
  const standardSizeLabel = selectedSize || standardSize.label || customSizeLabel;
  const resolvedRollLength = standardSize.rollLength || standardAcross || standardSize.across || 0;
  const displayAlong = manualEntryEnabled
    ? (customAlong || standardAlong)
    : (cutToCustom && isPositiveNumber(customAlong) ? customAlong : standardAlong);
  const displayAcross = manualEntryEnabled
    ? (resolvedRollLength || (customAcross || standardAcross))
    : (cutToCustom && isPositiveNumber(customAcross) ? customAcross : standardAcross);
  const displaySizeLabel = manualEntryEnabled
    ? (displayAcross && displayAlong ? formatDimensionLabel(displayAcross, displayAlong) : (standardSizeLabel || ''))
    : ((cutToCustom && customSizeLabel) ? customSizeLabel : standardSizeLabel);

  const product = {
    id: isEditMode ? itemId : 'mpack_' + Date.now(),
    type: 'mpack',
    name: resolvedName,
    machine: machineSelect && machineSelect.value ? machineSelect.options[machineSelect.selectedIndex].text : '--',
    thickness: thicknessSelect.value + ' micron',
    size: displaySizeLabel,
    along_mm: displayAlong,
    across_mm: displayAcross,
    underpacking_type: underpackingType,
    format_label: formatLabel || undefined,
    quantity: quantity,
    unit_price: parseFloat(unitPrice.toFixed(2)),
    discount_percent: discount,
    gst_percent: gstRate,
    image: 'images/mpack-placeholder.jpg',
    added_at: new Date().toISOString(),
    calculations: {
      rate_per_sqm: parseFloat(ratePerSqm.toFixed(2)),
      sqm_per_sheet: parseFloat(sqmArea.toFixed(3)),
      unit_price: parseFloat(unitPrice.toFixed(2)),
      quantity: quantity,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_percent: discount,
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      discounted_subtotal: parseFloat(discountedSubtotal.toFixed(2)),
      gst_percent: gstRate,
      gst_amount: parseFloat(gstAmount.toFixed(2)),
      final_total: parseFloat(finalPrice.toFixed(2))
    },
    custom_across_mm: customAcross,
    custom_along_mm: customAlong,
    custom_area_sqm: customArea,
    standard_across_mm: standardAcross,
    standard_along_mm: standardAlong,
    standard_area_sqm: standardArea,
    cut_to_custom_size: cutToCustom,
    standard_size_label: standardSizeLabel,
    custom_size_label: customSizeLabel,
    display_size_label: displaySizeLabel,
    display_across_mm: displayAcross,
    display_along_mm: displayAlong,
    uses_half_roll: standardSize.usesHalfRoll || false,
  };

  // Show loading state
  const addToCartBtn = event.target;
  const originalText = addToCartBtn.innerHTML;
  const buttonText = isEditMode ? 'Updating...' : 'Adding...';
  addToCartBtn.disabled = true;
  addToCartBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${buttonText}`;
  
  // Handle edit mode
  if (isEditMode && itemId) {
    try {
      // Prepare the form data for update
      const formData = getFormData();
      formData.item_id = itemId;
      
      // Call updateCartItem with the button and item ID
      await updateCartItem(addToCartBtn, itemId);
      return; // Exit after update
    } catch (error) {
      console.error('Error updating cart item:', error);
      showToast('Error', 'Failed to update item. Please try again.', 'error');
      addToCartBtn.disabled = false;
      addToCartBtn.innerHTML = originalText;
      return;
    }
  }

  // Prepare the payload with all necessary fields
  const payload = {
    id: isEditMode ? itemId : 'mpack_' + Date.now(),
    type: 'mpack',
    name: resolvedName,
    machine: machineSelect.value ? machineSelect.options[machineSelect.selectedIndex].text : '--',
    thickness: thicknessSelect.value + ' micron',
    size: displaySizeLabel,
    underpacking_type: underpackingType,
    format_label: formatLabel || undefined,
    quantity: quantity,
    unit_price: parseFloat(unitPrice.toFixed(2)),
    discount_percent: discount,
    gst_percent: gstRate,
    image: 'images/mpack-placeholder.jpg',
    added_at: new Date().toISOString(),
    calculations: {
      rate_per_sqm: parseFloat(ratePerSqm.toFixed(2)),
      sqm_per_sheet: parseFloat(sqmArea.toFixed(3)),
      unit_price: parseFloat(unitPrice.toFixed(2)),
      quantity: quantity,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_percent: discount,
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      discounted_subtotal: parseFloat(discountedSubtotal.toFixed(2)),
      gst_percent: gstRate,
      gst_amount: parseFloat(gstAmount.toFixed(2)),
      final_total: parseFloat(finalPrice.toFixed(2))
    },
    custom_length_mm: customAlong,
    custom_width_mm: customAcross,
    custom_area_sqm: customArea,
    standard_length_mm: standardAlong,
    standard_width_mm: standardAcross,
    standard_area_sqm: standardArea,
    cut_to_custom_size: cutToCustom,
    standard_size_label: standardSizeLabel,
    custom_size_label: customSizeLabel,
    display_size_label: displaySizeLabel,
    display_length_mm: displayAlong,
    display_width_mm: displayAcross
  };

  // Add item_id for edit mode
  if (isEditMode && itemId) {
    payload.item_id = itemId;
  }

  fetch('/add_to_cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      if (isEditMode) {
        showToast('Success', 'Underpacking material updated in cart!', 'success');
        // Redirect back to cart after a short delay
        setTimeout(() => {
          window.location.href = '/cart';
        }, 1000);
      } else {
        showToast('Success', 'Underpacking material added to cart!', 'success');
      }
      updateCartCount();
    } else if (data.is_duplicate) {
      // Show confirmation dialog for duplicate product
      if (confirm('A similar MPack is already in your cart. Would you like to add it anyway?')) {
        // If user confirms, force add the product by removing the duplicate check
        fetch('/add_to_cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({...product, force_add: true})
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast('Success', 'Underpacking material added to cart!', 'success');
            updateCartCount();
          } else {
            showToast('Error', data.error || 'Failed to add to cart', 'error');
          }
        })
        .catch(err => {
          console.error('Error adding to cart:', err);
          showToast('Error', 'Failed to add to cart. Please try again.', 'error');
        });
      }
    } else {
      showToast('Error', data.message || 'Failed to add to cart', 'error');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    showToast('Error', 'Failed to add to cart', 'error');
  })
  .finally(() => {
    addToCartBtn.disabled = false;
    addToCartBtn.innerHTML = originalText;
  });
}
