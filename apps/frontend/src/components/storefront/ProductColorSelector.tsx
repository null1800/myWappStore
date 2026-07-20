'use client';

import { useState } from 'react';

interface Color {
  name: string;
  hex: string;
}

interface ProductColorSelectorProps {
  colors: Color[];
  selectedColor?: Color;
  onColorSelect: (color: Color) => void;
}

export function ProductColorSelector({ colors, selectedColor, onColorSelect }: ProductColorSelectorProps) {
  if (colors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">Color:</span>
        <span className="text-sm font-medium text-slate-900">{selectedColor?.name || 'Select a color'}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {colors.map((color, idx) => (
          <button
            key={idx}
            onClick={() => onColorSelect(color)}
            className={`relative w-10 h-10 rounded-full border-2 shadow-sm hover:scale-110 transition-transform ${
              selectedColor?.name === color.name ? 'border-slate-900 ring-2 ring-slate-300 ring-offset-2' : 'border-white'
            }`}
            style={{ backgroundColor: color.hex }}
            title={color.name}
            aria-label={`Select ${color.name}`}
          >
            {selectedColor?.name === color.name && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white/80" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
