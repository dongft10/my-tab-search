import i18n from './i18n.js';

const BG_IMAGE_WIDTH = 1920;
const BG_IMAGE_HEIGHT = 1049;
const BG_IMAGE_RATIO = BG_IMAGE_WIDTH / BG_IMAGE_HEIGHT;

class HelpTourPage {
  constructor() {
    this.currentStep = 0;
    this.card = null;
    this.highlight = null;
    this.overlayImage = null;
    this.container = null;
    this.containerRect = { width: 0, height: 0, offsetX: 0, offsetY: 0 };
    
    this.steps = [
      {
        id: "search",
        title: "tourStep1Title",
        description: "tourStep1Desc",
        shortcut: "Alt+Q",
        shortcutDesc: "tourShortcutOpenSearch",
        tip: "tourStep1Tip",
        cardPosition: { topPercent: 15, rightPercent: 33.6 },
        highlight: { topPercent: 4, rightPercent: 7.8, widthPercent: 23, heightPercent: 62 },
        arrow: "arrow-right"
      },
      {
        id: "switch",
        title: "tourStep2Title",
        description: "tourStep2Desc",
        shortcut: "Alt+W",
        shortcutDesc: "tourShortcutSwitchTab",
        tip: "tourStep2Tip",
        cardPosition: { centerOffsetXPercent: 0, topPercent: 5 },
        highlight: { topPercent: 0, rightPercent: 0, widthPercent: 100, heightPercent: 5 },
        arrow: "arrow-top"
      },
      {
        id: "pin",
        title: "tourStep3Title",
        description: "tourStep3Desc",
        shortcut: "Alt+E",
        shortcutDesc: "tourShortcutOpenPin",
        tip: "tourStep3Tip",
        cardPosition: { centerOffsetXPercent: -24, topPercent: 5 },
        highlight: { centerOffsetXPercent: 0, centerOffsetYPercent: 0, widthPercent: 22, heightPercent: 78.6 },
        arrow: "arrow-right"
      },
      {
        id: "pinExtension",
        title: "tourStep4Title",
        description: "tourStep4Desc",
        tip: "tourStep4Tip",
        cardPosition: { topPercent: 10, rightPercent: 27 },
        highlight: { topPercent: 4, rightPercent: 5, widthPercent: 20, heightPercent: 40 },
        arrow: "arrow-right",
        overlayImage: "../images/pin-extension.png",
        overlayPosition: { topPercent: 4, rightPercent: 0.9, widthPercent: 28, heightPercent: 36 }
      },
      {
        id: "shortcuts",
        title: "tourStep5Title",
        description: "tourStep5Desc",
        tip: "tourStep5Tip",
        cardPosition: { centerOffsetXPercent: 0, centerOffsetYPercent: 0 },
        highlight: { centerOffsetXPercent: 0, centerOffsetYPercent: 0, widthPercent: 1, heightPercent: 1 },
        arrow: null,
        isLast: true,
        showShortcutsList: true
      }
    ];
  }

  async init() {
    await i18n.initialize();
    
    this.container = document.getElementById('content-container');
    this.card = document.getElementById('tour-card');
    this.highlight = document.getElementById('highlight');
    this.overlayImage = document.getElementById('overlay-image');
    
    this.updateContainerPosition();
    this.showStep(0);
    this.bindEvents();
    
    i18n.addListener(() => {
      this.showStep(this.currentStep);
    });
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    window.addEventListener('resize', () => this.handleResize());
    document.addEventListener('click', (e) => this.handleClick(e));
  }

  handleClick(e) {
    if (e.target.closest('.help-tour-card')) return;
    
    if (this.currentStep === this.steps.length - 1) {
      this.done();
    } else {
      this.nextStep();
    }
  }

  updateContainerPosition() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewportRatio = vw / vh;
    
    let containerWidth, containerHeight, offsetX, offsetY;
    
    if (viewportRatio > BG_IMAGE_RATIO) {
      containerHeight = vh;
      containerWidth = vh * BG_IMAGE_RATIO;
      offsetX = (vw - containerWidth) / 2;
      offsetY = 0;
    } else {
      containerWidth = vw;
      containerHeight = vw / BG_IMAGE_RATIO;
      offsetX = 0;
      offsetY = (vh - containerHeight) / 2;
    }
    
    this.containerRect = { width: containerWidth, height: containerHeight, offsetX, offsetY };
    
    this.container.style.width = `${containerWidth}px`;
    this.container.style.height = `${containerHeight}px`;
    this.container.style.left = `${offsetX}px`;
    this.container.style.top = `${offsetY}px`;
  }

  handleResize() {
    this.updateContainerPosition();
    const step = this.steps[this.currentStep];
    if (step) {
      this.updateHighlight(step);
      this.updateOverlayImage(step);
      this.positionCard(step);
    }
  }

  showStep(index) {
    const step = this.steps[index];
    if (!step) return;
    
    this.currentStep = index;
    
    this.updateHighlight(step);
    this.updateOverlayImage(step);
    this.positionCard(step);
    this.renderCardContent(step);
    
    requestAnimationFrame(() => {
      this.card.classList.add('active');
    });
  }

  updateOverlayImage(step) {
    if (!this.overlayImage) return;
    
    if (step.overlayImage) {
      this.overlayImage.style.backgroundImage = `url('${step.overlayImage}')`;
      
      const pos = step.overlayPosition || {};
      const rect = this.containerRect;
      
      let top = 0, right = 0, width = 300, height = 200;
      
      if (pos.topPercent !== undefined) top = (pos.topPercent / 100) * rect.height;
      if (pos.rightPercent !== undefined) right = (pos.rightPercent / 100) * rect.width;
      
      if (pos.widthPercent !== undefined) width = (pos.widthPercent / 100) * rect.width;
      if (pos.heightPercent !== undefined) height = (pos.heightPercent / 100) * rect.height;
      
      this.overlayImage.style.top = `${top}px`;
      this.overlayImage.style.right = `${right}px`;
      this.overlayImage.style.width = `${width}px`;
      this.overlayImage.style.height = `${height}px`;
      this.overlayImage.style.left = 'auto';
      this.overlayImage.style.bottom = 'auto';
      
      this.overlayImage.classList.add('visible');
    } else {
      this.overlayImage.classList.remove('visible');
    }
  }

  updateHighlight(step) {
    if (!this.highlight) return;
    
    if (step.highlight) {
      const h = step.highlight;
      const rect = this.containerRect;
      
      let top, left, width, height;
      
      width = h.widthPercent !== undefined ? (h.widthPercent / 100) * rect.width : (h.width || 300);
      height = h.heightPercent !== undefined ? (h.heightPercent / 100) * rect.height : (h.height || 300);
      
      if (h.centerOffsetXPercent !== undefined || h.centerOffsetYPercent !== undefined) {
        const offsetX = h.centerOffsetXPercent !== undefined ? (h.centerOffsetXPercent / 100) * rect.width : 0;
        const offsetY = h.centerOffsetYPercent !== undefined ? (h.centerOffsetYPercent / 100) * rect.height : 0;
        left = (rect.width - width) / 2 + offsetX;
        top = (rect.height - height) / 2 + offsetY;
      } else {
        if (h.topPercent !== undefined) {
          top = (h.topPercent / 100) * rect.height;
        } else {
          top = h.top || 0;
        }
        
        if (h.rightPercent !== undefined) {
          left = rect.width - (h.rightPercent / 100) * rect.width - width;
        } else if (h.right !== undefined) {
          left = rect.width - h.right - width;
        } else if (h.leftPercent !== undefined) {
          left = (h.leftPercent / 100) * rect.width;
        } else {
          left = h.left || 0;
        }
      }
      
      this.highlight.style.top = `${top}px`;
      this.highlight.style.left = `${left}px`;
      this.highlight.style.width = `${width}px`;
      this.highlight.style.height = `${height}px`;
      this.highlight.classList.add('visible');
    } else {
      this.highlight.classList.remove('visible');
    }
  }

  positionCard(step) {
    const rect = this.containerRect;
    const cardWidth = 380;
    const cardHeight = 300;
    const padding = 20;
    
    let top, left;
    
    if (step.cardPosition) {
      const pos = step.cardPosition;
      
      if (pos.centerOffsetXPercent !== undefined) {
        left = (rect.width - cardWidth) / 2 + (pos.centerOffsetXPercent / 100) * rect.width;
      } else if (pos.leftPercent !== undefined) {
        left = (pos.leftPercent / 100) * rect.width;
      } else if (pos.rightPercent !== undefined) {
        left = rect.width - (pos.rightPercent / 100) * rect.width - cardWidth;
      } else if (pos.right !== undefined) {
        left = rect.width - pos.right - cardWidth;
      } else if (pos.left !== undefined) {
        left = pos.left;
      } else {
        left = (rect.width - cardWidth) / 2;
      }
      
      if (pos.centerOffsetYPercent !== undefined) {
        top = (rect.height - cardHeight) / 2 + (pos.centerOffsetYPercent / 100) * rect.height;
      } else if (pos.topPercent !== undefined) {
        top = (pos.topPercent / 100) * rect.height;
      } else if (pos.bottomPercent !== undefined) {
        top = rect.height - (pos.bottomPercent / 100) * rect.height - cardHeight;
      } else if (pos.top !== undefined) {
        top = pos.top;
      } else if (pos.bottom !== undefined) {
        top = rect.height - pos.bottom - cardHeight;
      } else {
        top = (rect.height - cardHeight) / 2;
      }
    } else {
      top = (rect.height - cardHeight) / 2;
      left = (rect.width - cardWidth) / 2;
    }
    
    if (top < padding) top = padding;
    if (left < padding) left = padding;
    if (left + cardWidth > rect.width - padding) {
      left = rect.width - cardWidth - padding;
    }
    if (top + cardHeight > rect.height - padding) {
      top = rect.height - cardHeight - padding;
    }
    
    this.card.style.top = `${top}px`;
    this.card.style.left = `${left}px`;
    
    this.card.classList.remove('arrow-left', 'arrow-right', 'arrow-top', 'arrow-bottom');
    if (step.arrow) {
      this.card.classList.add(step.arrow);
    }
  }

  renderCardContent(step) {
    const stepNum = this.currentStep + 1;
    const totalSteps = this.steps.length;
    const title = i18n.getMessage(step.title) || step.title;
    const description = i18n.getMessage(step.description) || step.description;
    const tip = step.tip ? (i18n.getMessage(step.tip) || step.tip) : null;
    
    let contentHtml = `
      <button class="help-tour-btn-skip-top" data-action="skip">${i18n.getMessage('tourBtnSkip') || '跳过'}</button>
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
        <div class="help-tour-buttons">
          <button class="help-tour-btn help-tour-btn-prev" data-action="prev">${i18n.getMessage('tourBtnPrev') || '上一步'}</button>
          <button class="help-tour-btn help-tour-btn-setup" data-action="setup">${i18n.getMessage('tourBtnSetupShortcuts') || '设置快捷键'}</button>
          <button class="help-tour-btn help-tour-btn-done" data-action="done">${i18n.getMessage('tourBtnDone') || '完成'}</button>
        </div>
      `;
    } else if (this.currentStep === 0) {
      buttonsHtml = `
        <div class="help-tour-buttons">
          <button class="help-tour-btn help-tour-btn-next" data-action="next">${i18n.getMessage('tourBtnNext') || '下一步'}</button>
        </div>
      `;
    } else {
      buttonsHtml = `
        <div class="help-tour-buttons">
          <button class="help-tour-btn help-tour-btn-prev" data-action="prev">${i18n.getMessage('tourBtnPrev') || '上一步'}</button>
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
    this.card.querySelector('[data-action="prev"]')?.addEventListener('click', () => this.prevStep());
    this.card.querySelector('[data-action="next"]')?.addEventListener('click', () => this.nextStep());
    this.card.querySelector('[data-action="done"]')?.addEventListener('click', () => this.done());
    this.card.querySelector('[data-action="setup"]')?.addEventListener('click', () => this.openShortcutSettings());
    
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
      }, 200);
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.card.classList.remove('active');
      setTimeout(() => {
        this.showStep(this.currentStep - 1);
      }, 200);
    }
  }

  goToStep(index) {
    if (index >= 0 && index < this.steps.length && index !== this.currentStep) {
      this.card.classList.remove('active');
      setTimeout(() => {
        this.showStep(index);
      }, 200);
    }
  }

  openShortcutSettings() {
    chrome.tabs.query({ url: 'chrome://extensions/shortcuts' }, (shortcutsTabs) => {
      if (shortcutsTabs.length > 0) {
        chrome.tabs.update(shortcutsTabs[0].id, { active: true });
        chrome.windows.update(shortcutsTabs[0].windowId, { focused: true });
        this.done();
        return;
      }
      chrome.tabs.query({ url: 'chrome://extensions/*' }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { url: 'chrome://extensions/shortcuts', active: true });
          chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        }
        this.done();
      });
    });
  }

  done() {
    chrome.storage.local.set({ helpTourCompleted: true });
    window.close();
  }

  skip() {
    this.done();
  }

  handleKeyboard(e) {
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
      case ' ':
        e.preventDefault();
        if (this.currentStep === this.steps.length - 1) {
          this.done();
        } else {
          this.nextStep();
        }
        break;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tourPage = new HelpTourPage();
  tourPage.init();
});
