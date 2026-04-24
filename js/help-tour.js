import i18n from './i18n.js';
import authService from './services/auth.service.js';

class HelpTour {
  constructor() {
    this.currentStep = 0;
    this.isActive = false;
    this.overlay = null;
    this.highlight = null;
    this.card = null;
    
    this.steps = [
      {
        id: 'search',
        title: 'tourStep1Title',
        description: 'tourStep1Desc',
        shortcut: 'Alt+Q',
        shortcutDesc: 'tourShortcutOpenSearch',
        tip: 'tourStep1Tip',
        position: 'top-right',
        highlightTarget: null
      },
      {
        id: 'switch',
        title: 'tourStep2Title',
        description: 'tourStep2Desc',
        shortcut: 'Alt+W',
        shortcutDesc: 'tourShortcutSwitchTab',
        tip: 'tourStep2Tip',
        position: 'center',
        highlightTarget: null
      },
      {
        id: 'pin',
        title: 'tourStep3Title',
        description: 'tourStep3Desc',
        shortcut: 'Alt+E',
        shortcutDesc: 'tourShortcutOpenPin',
        tip: 'tourStep3Tip',
        position: 'center',
        highlightTarget: null
      },
      {
        id: 'shortcuts',
        title: 'tourStep4Title',
        description: 'tourStep4Desc',
        tip: 'tourStep4Tip',
        position: 'center',
        isLast: true,
        showShortcutsList: true,
        highlightTarget: null
      }
    ];
  }

  async init() {
    await i18n.initialize();
    
    const result = await chrome.storage.local.get('helpTourCompleted');
    if (!result.helpTourCompleted) {
      setTimeout(() => this.start(), 500);
    }
  }

  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.currentStep = 0;
    
    this.createOverlay();
    this.createCard();
    
    requestAnimationFrame(() => {
      this.overlay.classList.add('active');
      this.showStep(0);
    });
    
    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }

  async end() {
    this.isActive = false;
    
    if (this.overlay) {
      this.overlay.classList.remove('active');
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
      }, 300);
    }
    
    if (this.card && this.card.parentNode) {
      this.card.parentNode.removeChild(this.card);
      this.card = null;
    }
    
    document.removeEventListener('keydown', this.handleKeyboard.bind(this));
    
    await chrome.storage.local.set({ helpTourCompleted: true });
    await authService.saveSettings({ helpTourCompleted: true });
  }

  skip() {
    this.end();
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'help-tour-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.nextStep();
      }
    });
    document.body.appendChild(this.overlay);
  }

  createCard() {
    this.card = document.createElement('div');
    this.card.className = 'help-tour-card';
    document.body.appendChild(this.card);
  }

  showStep(index) {
    const step = this.steps[index];
    if (!step) return;
    
    this.currentStep = index;
    
    this.positionCard(step);
    this.renderCardContent(step);
    
    requestAnimationFrame(() => {
      this.card.classList.add('active');
    });
  }

  positionCard(step) {
    const cardWidth = 360;
    const cardHeight = 280;
    const padding = 20;
    
    let top, left;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    switch (step.position) {
      case 'top-right':
        top = 60;
        left = viewportWidth - cardWidth - padding - 20;
        if (left < padding) {
          left = padding;
        }
        break;
      case 'top-left':
        top = 60;
        left = padding;
        break;
      case 'center':
      default:
        top = (viewportHeight - cardHeight) / 2;
        left = (viewportWidth - cardWidth) / 2;
        break;
    }
    
    if (top < padding) top = padding;
    if (top + cardHeight > viewportHeight - padding) {
      top = viewportHeight - cardHeight - padding;
    }
    if (left < padding) left = padding;
    if (left + cardWidth > viewportWidth - padding) {
      left = viewportWidth - cardWidth - padding;
    }
    
    this.card.style.top = `${top}px`;
    this.card.style.left = `${left}px`;
  }

  renderCardContent(step) {
    const stepNum = this.currentStep + 1;
    const totalSteps = this.steps.length;
    const title = i18n.getMessage(step.title) || step.title;
    const description = i18n.getMessage(step.description) || step.description;
    const tip = step.tip ? (i18n.getMessage(step.tip) || step.tip) : null;
    
    let contentHtml = `
      <div class="help-tour-card-header">
        <div class="help-tour-step-number">${stepNum}</div>
        <h3 class="help-tour-title">${title}</h3>
      </div>
      <p class="help-tour-description">${description}</p>
    `;
    
    if (step.showShortcutsList) {
      contentHtml += `
        <div class="help-tour-shortcuts-list">
          <div class="help-tour-shortcuts-item">
            <span class="help-tour-shortcuts-item-key">Alt+Q</span>
            <span class="help-tour-shortcuts-item-desc">${i18n.getMessage('tourShortcutOpenSearch') || '打开标签页搜索'}</span>
          </div>
          <div class="help-tour-shortcuts-item">
            <span class="help-tour-shortcuts-item-key">Alt+W</span>
            <span class="help-tour-shortcuts-item-desc">${i18n.getMessage('tourShortcutSwitchTab') || '切换到上一个标签'}</span>
          </div>
          <div class="help-tour-shortcuts-item">
            <span class="help-tour-shortcuts-item-key">Alt+E</span>
            <span class="help-tour-shortcuts-item-desc">${i18n.getMessage('tourShortcutOpenPin') || '打开固定标签列表'}</span>
          </div>
        </div>
      `;
    } else if (step.shortcut) {
      const shortcutDesc = i18n.getMessage(step.shortcutDesc) || '';
      contentHtml += `
        <div class="help-tour-shortcut-box">
          <span class="help-tour-shortcut-key">${step.shortcut}</span>
          <span class="help-tour-shortcut-desc">${shortcutDesc}</span>
        </div>
      `;
    }
    
    if (tip) {
      contentHtml += `<div class="help-tour-tip">${tip}</div>`;
    }
    
    let buttonsHtml = '';
    if (step.isLast) {
      buttonsHtml = `
        <button class="help-tour-btn help-tour-btn-skip" data-action="skip">${i18n.getMessage('tourBtnSkip') || '跳过'}</button>
        <div class="help-tour-buttons">
          <button class="help-tour-btn help-tour-btn-setup" data-action="setup">${i18n.getMessage('tourBtnSetupShortcuts') || '设置快捷键'}</button>
          <button class="help-tour-btn help-tour-btn-done" data-action="done">${i18n.getMessage('tourBtnDone') || '完成'}</button>
        </div>
      `;
    } else {
      buttonsHtml = `
        <button class="help-tour-btn help-tour-btn-skip" data-action="skip">${i18n.getMessage('tourBtnSkip') || '跳过'}</button>
        <div class="help-tour-buttons">
          <button class="help-tour-btn help-tour-btn-next" data-action="next">${i18n.getMessage('tourBtnNext') || '下一步'}</button>
        </div>
      `;
    }
    
    let dotsHtml = '';
    for (let i = 0; i < totalSteps; i++) {
      dotsHtml += `<div class="help-tour-dot ${i === this.currentStep ? 'active' : ''}" data-step="${i}"></div>`;
    }
    
    contentHtml += `
      <div class="help-tour-footer">
        <div class="help-tour-dots">${dotsHtml}</div>
        ${buttonsHtml}
      </div>
    `;
    
    this.card.innerHTML = contentHtml;
    
    this.card.querySelector('[data-action="skip"]')?.addEventListener('click', () => this.skip());
    this.card.querySelector('[data-action="next"]')?.addEventListener('click', () => this.nextStep());
    this.card.querySelector('[data-action="done"]')?.addEventListener('click', () => this.end());
    this.card.querySelector('[data-action="setup"]')?.addEventListener('click', () => {
      this.openShortcutSettings();
    });
    
    this.card.querySelectorAll('.help-tour-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const stepIndex = parseInt(e.target.dataset.step, 10);
        this.goToStep(stepIndex);
      });
    });
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.card.classList.remove('active');
      setTimeout(() => {
        this.showStep(this.currentStep + 1);
      }, 150);
    } else {
      this.end();
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.card.classList.remove('active');
      setTimeout(() => {
        this.showStep(this.currentStep - 1);
      }, 150);
    }
  }

  goToStep(index) {
    if (index >= 0 && index < this.steps.length && index !== this.currentStep) {
      this.card.classList.remove('active');
      setTimeout(() => {
        this.showStep(index);
      }, 150);
    }
  }

  handleKeyboard(e) {
    if (!this.isActive) return;
    
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        this.nextStep();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        this.prevStep();
        break;
      case 'Escape':
        e.preventDefault();
        this.skip();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.currentStep === this.steps.length - 1) {
          this.end();
        } else {
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
    this.end();
  }
}

const helpTour = new HelpTour();
export default helpTour;
