import i18n from './i18n.js';

class HelpTourPage {
  constructor() {
    this.currentStep = 0;
    this.card = null;
    this.highlight = null;
    
    this.steps = [
      {
        id: "search",
        title: "tourStep1Title",
        description: "tourStep1Desc",
        shortcut: "Alt+Q",
        shortcutDesc: "tourShortcutOpenSearch",
        tip: "tourStep1Tip",
        cardPosition: { topVh: 10, rightVw: 37 },
        highlight: { topVh: 4, rightVw: 8, widthVw: 28, heightVh: 62 },
        arrow: "arrow-right"
      },
      {
        id: "switch",
        title: "tourStep2Title",
        description: "tourStep2Desc",
        shortcut: "Alt+W",
        shortcutDesc: "tourShortcutSwitchTab",
        tip: "tourStep2Tip",
        cardPosition: { centerOffsetX: 0, topVh: 5 },
        highlight: { topVh: 0, rightVw: 0, widthVw: 100, heightVh: 5 },
        arrow: "arrow-top"
      },
      {
        id: "pin",
        title: "tourStep3Title",
        description: "tourStep3Desc",
        shortcut: "Alt+E",
        shortcutDesc: "tourShortcutOpenPin",
        tip: "tourStep3Tip",
        cardPosition: { centerOffsetX: -452, centerOffsetY: 0 },
        highlight: { centerOffsetX: 0, centerOffsetY: 0, widthVw: 22, heightVh: 78.6 },
        arrow: "arrow-right"
      },
      {
        id: "shortcuts",
        title: "tourStep4Title",
        description: "tourStep4Desc",
        tip: "tourStep4Tip",
        cardPosition: { centerOffsetX: 0, centerOffsetY: 0 },
        highlight: { centerOffsetX: 0, centerOffsetY: 0, width: 1, height: 1 },
        arrow: null,
        isLast: true,
        showShortcutsList: true
      }
    ];
  }

  async init() {
    await i18n.initialize();
    
    this.card = document.getElementById('tour-card');
    this.highlight = document.getElementById('highlight');
    
    this.showStep(0);
    this.bindEvents();
    
    i18n.addListener(() => {
      this.showStep(this.currentStep);
    });
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    const step = this.steps[this.currentStep];
    if (step) {
      this.updateHighlight(step);
      this.positionCard(step);
    }
  }

  showStep(index) {
    const step = this.steps[index];
    if (!step) return;
    
    this.currentStep = index;
    
    this.updateHighlight(step);
    this.positionCard(step);
    this.renderCardContent(step);
    
    requestAnimationFrame(() => {
      this.card.classList.add('active');
    });
  }

  updateHighlight(step) {
    if (!this.highlight) return;
    
    if (step.highlight) {
      const h = step.highlight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      let top, left, width, height;
      
      width = h.widthVw !== undefined ? (h.widthVw / 100) * vw : (h.width || 300);
      height = h.heightVh !== undefined ? (h.heightVh / 100) * vh : (h.height || 300);
      
      // 基于屏幕中心偏移定位
      if (h.centerOffsetX !== undefined || h.centerOffsetY !== undefined) {
        const offsetX = h.centerOffsetX || 0;
        const offsetY = h.centerOffsetY || 0;
        left = (vw - width) / 2 + offsetX;
        top = (vh - height) / 2 + offsetY;
      } else {
        // 传统定位方式
        if (h.topVh !== undefined) {
          top = (h.topVh / 100) * vh;
        } else {
          top = h.top || 0;
        }
        
        if (h.rightVw !== undefined) {
          left = vw - (h.rightVw / 100) * vw - width;
        } else if (h.right !== undefined) {
          left = vw - h.right - width;
        } else if (h.leftVw !== undefined) {
          left = (h.leftVw / 100) * vw;
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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = 380;
    const cardHeight = 300;
    const padding = 40;
    
    let top, left;
    
    if (step.cardPosition) {
      const pos = step.cardPosition;
      
      // 水平方向定位
      if (pos.centerOffsetX !== undefined) {
        left = (vw - cardWidth) / 2 + (pos.centerOffsetX || 0);
      } else if (pos.leftVw !== undefined) {
        left = (pos.leftVw / 100) * vw;
      } else if (pos.rightVw !== undefined) {
        left = vw - (pos.rightVw / 100) * vw - cardWidth;
      } else if (pos.right !== undefined) {
        left = vw - pos.right - cardWidth;
      } else if (pos.left !== undefined) {
        left = pos.left;
      } else {
        left = (vw - cardWidth) / 2;
      }
      
      // 垂直方向定位
      if (pos.centerOffsetY !== undefined) {
        top = (vh - cardHeight) / 2 + (pos.centerOffsetY || 0);
      } else if (pos.topVh !== undefined) {
        top = (pos.topVh / 100) * vh;
      } else if (pos.bottomVh !== undefined) {
        top = vh - (pos.bottomVh / 100) * vh - cardHeight;
      } else if (pos.top !== undefined) {
        top = pos.top;
      } else if (pos.bottom !== undefined) {
        top = vh - pos.bottom - cardHeight;
      } else {
        top = (vh - cardHeight) / 2;
      }
    } else {
      top = (vh - cardHeight) / 2;
      left = (vw - cardWidth) / 2;
    }
    
    if (top < padding) top = padding;
    if (left < padding) left = padding;
    
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
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    this.done();
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
