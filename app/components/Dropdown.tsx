'use client';

import React, { useState, useRef, useEffect } from 'react';

interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  items: DropdownItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  items,
  value,
  onChange,
  placeholder = 'Select option',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find(item => item.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#e0e5ec] rounded-xl shadow-[6px_6px_12px_#b8bcc2,-6px_-6px_12px_#ffffff] hover:shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] active:shadow-[inset_4px_4px_8px_#b8bcc2,inset_-4px_-4px_8px_#ffffff] text-gray-700 transition-all duration-200"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedItem?.icon && <span className="w-4 h-4 text-gray-500">{selectedItem.icon}</span>}
          <span className="truncate">{selectedItem ? selectedItem.label : placeholder}</span>
        </div>
        <svg
          className={`w-4 h-4 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-3 bg-[#e0e5ec] rounded-xl shadow-[8px_8px_16px_#b8bcc2,-8px_-8px_16px_#ffffff] overflow-hidden transition-all duration-200">
          <ul
            className="max-h-60 overflow-auto py-2"
            role="listbox"
          >
            {items.map((item) => (
              <li key={item.value}>
                <button
                  onClick={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={item.value === value}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm transition-colors duration-200 ${
                    item.value === value
                      ? 'bg-[#e0e5ec] shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] text-blue-600 font-semibold'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  {item.icon && <span className="w-4 h-4 opacity-70">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
