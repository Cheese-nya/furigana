'use client';

import React, { useState } from 'react';
import { Modal } from './Modal';

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  isOpen,
  onToggle,
  title = '假名标注工具'
}) => {
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);

  return (
    <>
      {/* Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-gray-500/20 backdrop-blur-xs z-40 transition-opacity duration-200"
        />
      )}

      {/* Neumorphic Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col bg-[#e0e5ec] rounded-r-3xl shadow-[8px_8px_16px_#b8bcc2,-8px_-8px_16px_#ffffff]">
          {/* Header */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="./logo.png" alt="Software Logo" className="w-8 h-8 rounded-xl shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] object-cover" />
              <span className="text-xl font-semibold text-gray-800 tracking-tight truncate">
                {title}
              </span>
            </div>
            <button
              onClick={onToggle}
              aria-label="关闭侧边栏"
              className="w-9 h-9 rounded-xl bg-[#e0e5ec] shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] hover:shadow-[2px_2px_4px_#b8bcc2,-2px_-2px_4px_#ffffff] active:shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] flex items-center justify-center text-gray-600 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-4">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  onToggle();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-all duration-200 ${
                  item.active
                    ? 'bg-[#e0e5ec] text-blue-600 font-semibold shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff]'
                    : 'bg-[#e0e5ec] text-gray-600 font-medium shadow-[6px_6px_12px_#b8bcc2,-6px_-6px_12px_#ffffff] hover:shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] active:shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff]'
                }`}
              >
                <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${item.active ? 'text-blue-600' : 'text-gray-500'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Footer Section with Reward Button & Twitter Author info */}
          <div className="p-5 flex flex-col gap-4 border-t border-gray-300/40">
            {/* Donate / Reward Button */}
            <button
              onClick={() => setIsRewardModalOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#e0e5ec] shadow-[6px_6px_12px_#b8bcc2,-6px_-6px_12px_#ffffff] hover:shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] active:shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff] text-gray-700 font-medium text-sm transition-all duration-200"
            >
              <img
                src="./cheese_icon.jpg"
                alt="Cheese Logo"
                className="w-5 h-5 rounded-md object-cover"
              />
              <span>打赏作者</span>
            </button>

            {/* Author Handle with Twitter Icon */}
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 tracking-wider">
              {/* Twitter / X Logo */}
              <svg className="w-3.5 h-3.5 fill-current text-gray-600" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>チーズ@beimisama</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Reward QR Code Modal */}
      <Modal
        isOpen={isRewardModalOpen}
        onClose={() => setIsRewardModalOpen(false)}
        title="🧀 支持作者"
      >
        <div className="flex flex-col items-center justify-center py-2 space-y-4">
          <div className="p-3 bg-[#e0e5ec] rounded-2xl shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff]">
            <img
              src="./reward_qrcode.png"
              alt="Reward QR Code"
              className="w-64 h-64 object-contain rounded-xl"
            />
          </div>
          <p className="text-xs text-gray-500 font-medium tracking-wide">
            为作者集齐芝士碎片
          </p>
        </div>
      </Modal>
    </>
  );
};
