// 扩展配置文件
// 集中管理所有可配置项

/**
 * 固定标签页相关配置
 */
export const PINNED_TABS_CONFIG = {
  // 固定标签页容量限制（最大数量）
  MAX_PINNED_TABS: 5,
  
  // 固定标签页弹窗尺寸
  WINDOW_WIDTH: 416,
  WINDOW_HEIGHT: 600
};

/**
 * 搜索相关配置
 */
export const SEARCH_CONFIG = {
  // 搜索防抖延迟（毫秒）
  DEBOUNCE_DELAY: 150,
  
  // 最大搜索结果数量
  MAX_RESULTS: 100
};

/**
 * UI 相关配置
 */
export const UI_CONFIG = {
  // Toast 提示显示时长（毫秒）
  TOAST_DURATION: 3000,
  
  // 列表项滚动动画时长（毫秒）
  SCROLL_ANIMATION_DURATION: 100
};

// 默认导出所有配置
export default {
  PINNED_TABS_CONFIG,
  SEARCH_CONFIG,
  UI_CONFIG
};
