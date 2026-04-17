import i18n from './i18n.js';

class HelpGuide {
  constructor() {
    this.currentStep = 0;
    this.totalSteps = 4;
    this.steps = [
      {
        title: 'helpStep1Title',
        description: 'helpStep1Desc',
        shortcut: 'helpStep1Shortcut',
        tip: 'helpStep1Tip',
        demoIcon: 'search',
        demoText: 'helpDemoSearch'
      },
      {
        title: 'helpStep2Title',
        description: 'helpStep2Desc',
        shortcut: null,
        tip: 'helpStep2Tip',
        demoIcon: 'switch',
        demoText: 'helpDemoSwitch'
      },
      {
        title: 'helpStep3Title',
        description: 'helpStep3Desc',
        shortcut: 'helpStep3Shortcut',
        tip: 'helpStep3Tip',
        demoIcon: 'pin',
        demoText: 'helpDemoPin'
      },
      {
        title: 'helpStep4Title',
        description: 'helpStep4Desc',
        shortcut: null,
        tip: 'helpStep4Tip',
        isLast: true
      }
    ];
    
    this.demoIcons = {
      search: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
        <path d="M11.742 10.344a6.5 6.5 0 1 1-1.397-1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
      </svg>`,
      switch: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
        <path d="M11.354 9.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 0 0 .708.708L8 7.207l2.646 2.647a.5.5 0 0 0 .708 0z"/>
        <path d="M4.354 6.646a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L0 9.293l2.646-2.647a.5.5 0 0 1 .708 0z" transform="translate(8, 0) scale(-1, 1) translate(-8, 0)"/>
        <path fill-rule="evenodd" d="M8 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-1 0v-9A.5.5 0 0 1 8 3Z"/>
      </svg>`,
      pin: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
        <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z"/>
      </svg>`
    };
  }

  async init() {
    await i18n.initialize();
    i18n.updatePageI18n();
    this.bindEvents();
    this.showStep(0);
    
    i18n.addListener(() => {
      i18n.updatePageI18n();
      this.showStep(this.currentStep);
    });
  }

  bindEvents() {
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnClose = document.getElementById('btn-close');
    const btnSetupShortcuts = document.getElementById('btn-setup-shortcuts');
    const btnStart = document.getElementById('btn-start');
    
    if (btnNext) {
      btnNext.addEventListener('click', () => this.nextStep());
    }
    
    if (btnPrev) {
      btnPrev.addEventListener('click', () => this.prevStep());
    }
    
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }
    
    if (btnSetupShortcuts) {
      btnSetupShortcuts.addEventListener('click', () => this.openShortcutSettings());
    }
    
    if (btnStart) {
      btnStart.addEventListener('click', () => this.close());
    }
    
    document.querySelectorAll('.step-dot').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        const step = parseInt(e.target.dataset.step, 10);
        this.goToStep(step);
      });
    });
    
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  showStep(index) {
    const step = this.steps[index];
    this.currentStep = index;
    
    this.updateContent(step);
    this.updateIndicator(index);
    this.updateButtons(index);
  }

  updateContent(step) {
    const container = document.getElementById('step-content');
    const titleEl = document.getElementById('step-title');
    const descEl = document.getElementById('step-description');
    const shortcutEl = document.getElementById('step-shortcut');
    const tipEl = document.getElementById('step-tip');
    
    container.classList.add('fade-out');
    
    setTimeout(() => {
      titleEl.textContent = i18n.getMessage(step.title);
      descEl.textContent = i18n.getMessage(step.description);
      tipEl.textContent = i18n.getMessage(step.tip);
      
      if (step.shortcut) {
        shortcutEl.textContent = i18n.getMessage(step.shortcut);
        shortcutEl.style.display = 'inline-block';
      } else {
        shortcutEl.style.display = 'none';
      }
      
      if (step.isLast) {
        this.showShortcutsList();
      } else {
        this.showDemoPlaceholder(step);
      }
      
      container.classList.remove('fade-out');
      container.classList.add('fade-in');
      
      setTimeout(() => {
        container.classList.remove('fade-in');
      }, 150);
    }, 150);
  }

  showDemoPlaceholder(step) {
    const demoContainer = document.getElementById('demo-container');
    const icon = this.demoIcons[step.demoIcon] || this.demoIcons.search;
    const demoText = i18n.getMessage(step.demoText) || '';
    
    demoContainer.innerHTML = `
      <div class="demo-placeholder">
        <div class="demo-icon">${icon}</div>
        <div class="demo-text">${demoText}</div>
      </div>
    `;
  }

  showShortcutsList() {
    const demoContainer = document.getElementById('demo-container');
    
    demoContainer.innerHTML = `
      <div class="shortcuts-list">
        <div class="shortcut-item">
          <span class="shortcut-key">Alt+Q</span>
          <span class="shortcut-desc">${i18n.getMessage('helpShortcutsAltQ')}</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Alt+W</span>
          <span class="shortcut-desc">${i18n.getMessage('helpShortcutsAltW')}</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-key">Alt+E</span>
          <span class="shortcut-desc">${i18n.getMessage('helpShortcutsAltE')}</span>
          <span class="warning-badge">${i18n.getMessage('helpShortcutsNeedSetup')}</span>
        </div>
      </div>
    `;
  }

  updateIndicator(index) {
    document.querySelectorAll('.step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  updateButtons(index) {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSetup = document.getElementById('btn-setup-shortcuts');
    const btnStart = document.getElementById('btn-start');
    
    if (btnPrev) {
      btnPrev.style.display = index === 0 ? 'none' : 'inline-flex';
    }
    
    if (btnNext) {
      btnNext.style.display = index === this.totalSteps - 1 ? 'none' : 'inline-flex';
    }
    
    if (btnSetup) {
      btnSetup.style.display = index === this.totalSteps - 1 ? 'inline-flex' : 'none';
    }
    
    if (btnStart) {
      btnStart.style.display = index === this.totalSteps - 1 ? 'inline-flex' : 'none';
    }
  }

  nextStep() {
    if (this.currentStep < this.totalSteps - 1) {
      this.showStep(this.currentStep + 1);
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  goToStep(index) {
    if (index >= 0 && index < this.totalSteps && index !== this.currentStep) {
      this.showStep(index);
    }
  }

  handleKeyboard(e) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        this.prevStep();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        this.nextStep();
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
      case 'Enter':
        if (this.currentStep === this.totalSteps - 1) {
          e.preventDefault();
          this.close();
        } else {
          e.preventDefault();
          this.nextStep();
        }
        break;
    }
  }

  openShortcutSettings() {
    chrome.tabs.query({ url: 'chrome://extensions/shortcuts' }, (shortcutsTabs) => {
      if (shortcutsTabs.length > 0) {
        chrome.tabs.update(shortcutsTabs[0].id, { active: true });
        chrome.windows.update(shortcutsTabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.query({ url: 'chrome://extensions/*' }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { url: 'chrome://extensions/shortcuts', active: true });
            chrome.windows.update(tabs[0].windowId, { focused: true });
          } else {
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
          }
        });
      }
    });
  }

  close() {
    window.close();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const helpGuide = new HelpGuide();
  helpGuide.init();
});
