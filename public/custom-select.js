// custom-select.js
// Auto-converts native <select> into custom UI components.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('select').forEach(setupCustomSelect);

  const bodyObserver = new MutationObserver((mutations) => {
    mutations.forEach(mut => {
      mut.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.tagName === 'SELECT') setupCustomSelect(node);
          else node.querySelectorAll('select').forEach(setupCustomSelect);
        }
      });
    });
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
});

function setupCustomSelect(selectEl) {
  if (selectEl.dataset.customized) return;
  selectEl.dataset.customized = "true";

  selectEl.style.display = 'none';

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  
  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-dropdown';
  
  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);

  function renderOptions() {
    dropdown.innerHTML = '';
    const options = Array.from(selectEl.options);
    
    const selectedOpt = options[selectEl.selectedIndex] || options[0];
    const triggerText = selectedOpt ? selectedOpt.text : 'Select...';
    trigger.innerHTML = `<span>${triggerText}</span><span class="custom-arrow"></span>`;

    options.forEach((opt, index) => {
      const item = document.createElement('div');
      item.className = 'custom-select-item';
      if (index === selectEl.selectedIndex) item.classList.add('selected');
      item.textContent = opt.text;
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectEl.selectedIndex = index;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        closeAll();
        renderOptions();
      });
      dropdown.appendChild(item);
    });
  }

  renderOptions();

  const observer = new MutationObserver(renderOptions);
  observer.observe(selectEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'selectedIndex'] });

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrapper.classList.contains('open');
    closeAll();
    if (!isOpen) wrapper.classList.add('open');
  });
}

function closeAll() {
  document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
}

document.addEventListener('click', closeAll);
