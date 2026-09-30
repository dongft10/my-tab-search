/**
 * 落地页浏览器适配
 *
 * 根据当前浏览器（Chrome / Edge）动态调整页面中的浏览器名称、商店信息、
 * 扩展管理页协议等文案，避免 Edge 用户看到 Chrome 专属描述。
 *
 * 使用方式（在 HTML 中标记需要适配的节点）：
 *   data-browser-adapt="key"          将文本内容替换为 profile[key]
 *   data-browser-adapt-href="key"     将 href 属性替换为 profile[key]
 *   data-browser-adapt-content="key"  将 content 属性替换为 profile[key]
 *
 * HTML 中的默认文案一律写 Chrome，保证禁用 JS 或爬虫抓取时仍可读。
 */
(function () {
    'use strict';

    /** 各浏览器的展示配置 */
    const BROWSER_PROFILES = {
        chrome: {
            name: 'Chrome',
            nameWithPossessive: "Chrome's",
            extensionsUrl: 'chrome://extensions/',
            shortcutsUrl: 'chrome://extensions/shortcuts',
            storeUrl: 'https://chromewebstore.google.com/detail/mytabsearch-extension/adfbidbchmbodidfjmimbkfndnenljjp',
            storeName: 'Chrome Web Store',
            addButtonLabel: 'Add to Chrome',
            storeStepTitle: 'From Chrome Web Store (Recommended)',
            pageTitle: 'MyTabSearch - Chrome Extension',
            metaDescription: 'MyTabSearch - Efficient Chrome extension for managing browser tabs with quick search and switching'
        },
        edge: {
            name: 'Edge',
            nameWithPossessive: "Edge's",
            extensionsUrl: 'edge://extensions/',
            shortcutsUrl: 'edge://extensions/shortcuts',
            storeUrl: 'https://microsoftedge.microsoft.com/addons/detail/goemcphhpfajifddhebagehkkaeblcpf',
            storeName: 'Microsoft Edge Add-ons',
            addButtonLabel: 'Get',
            storeStepTitle: 'From Microsoft Edge Add-ons (Recommended)',
            pageTitle: 'MyTabSearch - Edge Add-on',
            metaDescription: 'MyTabSearch - Efficient Edge add-on for managing browser tabs with quick search and switching'
        }
    };

    /** 默认以 Chrome 场景兜底 */
    const DEFAULT_PROFILE = BROWSER_PROFILES.chrome;

    /**
     * 检测当前浏览器类型
     * @returns {'chrome'|'edge'|'unknown'} 浏览器类型
     */
    function detectBrowser() {
        const ua = navigator.userAgent;
        // Edge 的 UA 同时包含 Chrome 与 Edg，需优先判断 Edge
        if (ua.includes('Edg/')) {
            return 'edge';
        }
        if (ua.includes('Chrome/')) {
            return 'chrome';
        }
        return 'unknown';
    }

    /**
     * 获取当前浏览器的展示配置
     * @returns {Object} 浏览器配置对象
     */
    function getProfile() {
        return BROWSER_PROFILES[detectBrowser()] || DEFAULT_PROFILE;
    }

    /**
     * 应用浏览器名称等文案适配
     */
    function applyBrowserAdaptation() {
        const profile = getProfile();

        /**
         * 安全地从 profile 取值并应用
         * @param {HTMLElement} el 目标节点
         * @param {string} key 配置键名
         * @param {Function} apply 赋值回调
         */
        const applyByKey = (el, key, apply) => {
            const value = profile[key];
            if (!value) {
                return;
            }
            apply(value);
        };

        document.querySelectorAll('[data-browser-adapt]').forEach((el) => {
            const key = el.getAttribute('data-browser-adapt');
            applyByKey(el, key, (value) => {
                el.textContent = value;
            });
        });

        document.querySelectorAll('[data-browser-adapt-href]').forEach((el) => {
            const key = el.getAttribute('data-browser-adapt-href');
            applyByKey(el, key, (value) => {
                el.setAttribute('href', value);
            });
        });

        document.querySelectorAll('[data-browser-adapt-content]').forEach((el) => {
            const key = el.getAttribute('data-browser-adapt-content');
            applyByKey(el, key, (value) => {
                el.setAttribute('content', value);
            });
        });
    }

    /**
     * 初始化：确保 DOM 就绪后再执行替换
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyBrowserAdaptation);
        } else {
            applyBrowserAdaptation();
        }
    }

    init();
})();
