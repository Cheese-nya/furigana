/**
 * Neo-Brutalist Soft (柔和野兽派) Style Tokens
 * Rules:
 * - NO rounded corners (rounded-none)
 * - 2px dark gray borders (border-2 border-gray-800)
 * - Hard edge shadows with semi-transparency
 * - Hover state: shadow disappears, elements translate down/right
 * - Soft colors, NO pure black background, NO gradients
 */

export const brutalistStyles = {
  // 容器/卡片
  card: "rounded-none border-2 border-gray-800 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]",
  
  // 按钮 (基础交互)
  buttonBase: "rounded-none border-2 border-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] transition-all duration-300 font-bold tracking-tight disabled:opacity-50 disabled:pointer-events-none",
  
  // 按钮变体
  buttonPrimary: "bg-sky-200 text-gray-900", // Soft blue
  buttonSecondary: "bg-pink-200 text-gray-900", // Soft pink
  buttonSuccess: "bg-lime-200 text-gray-900", // Soft green
  buttonDanger: "bg-red-200 text-gray-900", // Soft red
  buttonNeutral: "bg-gray-100 text-gray-900", // Neutral
  
  // 输入框
  input: "rounded-none border-2 border-gray-800 bg-gray-50 font-mono text-gray-800 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(56,189,248,0.3)] transition-shadow px-3 py-2",
  
  // 标签
  badge: "rounded-none border-2 border-gray-800 px-2 py-1 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]",
  
  // 文字
  textHeading: "font-bold tracking-tight text-gray-900",
  textBody: "font-mono text-gray-800",
};
